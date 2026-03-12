import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    if (body._selfTest === '1') {
      return Response.json({ ok: true, testMode: true, function: 'searchNoProofSettlements' });
    }

    const { profileId } = body;

    // Gather profile context: breaches they've been part of, companies they use,
    // services found in their scan results
    let profileContext = '';
    let knownCompanies: string[] = [];
    let knownBreaches: string[] = [];

    if (profileId) {
      try {
        const scanResults = await base44.entities.ScanResult.list();
        const profileScans = scanResults.filter((s: any) => s.profile_id === profileId);

        knownCompanies = [...new Set(profileScans.map((s: any) => s.source_name).filter(Boolean))];
        knownBreaches = profileScans
          .filter((s: any) => s.source_type === 'breach_database' || s.source_type === 'breach_notice')
          .map((s: any) => s.source_name)
          .filter(Boolean);

        if (knownCompanies.length > 0) {
          profileContext = `\n\nPROFILE CONTEXT - This user has accounts with or has been breached by: ${knownCompanies.join(', ')}`;
        }
      } catch {
        // Continue without profile context
      }
    }

    const prompt = `IMPORTANT SAFETY RULES:
- ONLY return REAL, VERIFIED open class action settlements.
- NEVER fabricate case names, URLs, settlement amounts, or deadlines.
- If unsure about a settlement, omit it entirely.
- Every settlement must have a real, verifiable claim URL or website.
- An empty array is better than fabricated results.

Search for currently OPEN class action settlements that meet ALL of these criteria:
1. NO PROOF OF PURCHASE required (or very minimal proof like "I was a customer")
2. Claim filing is currently OPEN (deadline has NOT passed as of today)
3. Settlement is APPROVED by the court
4. Claims can be filed ONLINE
5. Available to US residents

These are commonly called "no proof" settlements, "no receipt needed" settlements, or 
"low documentation" class action claims.

Search these sources:
- TopClassActions.com/settlements
- ClassAction.org/settlements  
- OpenClassActions.com
- ConsumerClassAction.com
- Recent news about "open class action settlements 2024 2025 2026"
- Reddit r/classaction, r/freemoney for verified open settlements

Categories to search:
- Data breach settlements (Equifax, T-Mobile, Facebook, etc.)
- Consumer product settlements
- Overcharging/price fixing settlements
- Privacy violation settlements
- TCPA (robocall/text spam) settlements
- Banking/financial service settlements
- Tech company privacy settlements
${profileContext}

For each VERIFIED open settlement, provide:
- settlement_name: Official settlement name (e.g. "Smith v. Company Inc.")
- company: The defendant company
- category: "data_breach" | "privacy" | "consumer" | "financial" | "tcpa" | "product" | "other"
- settlement_amount: Total settlement fund amount
- estimated_individual_payout: Estimated per-person payout range
- proof_required: What proof is needed (e.g. "none", "attestation only", "email address", "proof of purchase")
- proof_difficulty: "none" | "minimal" | "moderate" 
- eligibility: Who qualifies (e.g. "US residents who used Facebook 2010-2022")
- claim_deadline: Filing deadline (YYYY-MM-DD)
- claim_url: Direct URL to file the claim
- website: Settlement website
- court: Court overseeing the settlement
- status: "open" | "pending_approval"
- filing_time_estimate: How long it takes to file (e.g. "2-5 minutes")
- confidence: 0-100 how confident this is real and currently open

Return ONLY settlements that are verifiably open right now. Prioritize:
1. No-proof-required first
2. Highest estimated payouts
3. Soonest deadlines (urgency)`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          settlements: {
            type: "array",
            items: {
              type: "object",
              properties: {
                settlement_name: { type: "string" },
                company: { type: "string" },
                category: { type: "string" },
                settlement_amount: { type: "string" },
                estimated_individual_payout: { type: "string" },
                proof_required: { type: "string" },
                proof_difficulty: { type: "string", enum: ["none", "minimal", "moderate"] },
                eligibility: { type: "string" },
                claim_deadline: { type: "string" },
                claim_url: { type: "string" },
                website: { type: "string" },
                court: { type: "string" },
                status: { type: "string", enum: ["open", "pending_approval"] },
                filing_time_estimate: { type: "string" },
                confidence: { type: "number" }
              }
            }
          },
          search_metadata: {
            type: "object",
            properties: {
              sources_checked: { type: "number" },
              total_found: { type: "number" },
              search_date: { type: "string" }
            }
          }
        }
      }
    });

    // Filter: confidence >= 65, must have settlement name and claim URL
    const valid = (result.settlements || []).filter((s: any) => {
      if (s.confidence && s.confidence < 65) return false;
      if (!s.settlement_name) return false;
      if (/\[.*\]/.test(s.settlement_name) || /example/i.test(s.settlement_name)) return false;
      return true;
    });

    // Tag settlements that match profile's known companies/breaches
    const tagged = valid.map((s: any) => {
      const companyLower = (s.company || '').toLowerCase();
      const matchesProfile = knownCompanies.some(c => 
        companyLower.includes(c.toLowerCase()) || c.toLowerCase().includes(companyLower)
      );
      const matchesBreach = knownBreaches.some(b =>
        companyLower.includes(b.toLowerCase()) || b.toLowerCase().includes(companyLower)
      );
      return {
        ...s,
        profile_match: matchesProfile || matchesBreach,
        match_reason: matchesBreach ? 'You were in a breach by this company'
          : matchesProfile ? 'Found in your scan results'
          : null
      };
    });

    // Sort: profile matches first, then by proof difficulty (none first), then deadline urgency
    tagged.sort((a: any, b: any) => {
      if (a.profile_match && !b.profile_match) return -1;
      if (!a.profile_match && b.profile_match) return 1;
      const diffOrder = { none: 0, minimal: 1, moderate: 2 };
      const aDiff = diffOrder[a.proof_difficulty as keyof typeof diffOrder] ?? 3;
      const bDiff = diffOrder[b.proof_difficulty as keyof typeof diffOrder] ?? 3;
      if (aDiff !== bDiff) return aDiff - bDiff;
      if (a.claim_deadline && b.claim_deadline) {
        return new Date(a.claim_deadline).getTime() - new Date(b.claim_deadline).getTime();
      }
      return 0;
    });

    const profileMatches = tagged.filter((s: any) => s.profile_match).length;

    return Response.json({
      success: true,
      settlements: tagged,
      stats: {
        total_found: tagged.length,
        profile_matches: profileMatches,
        no_proof_count: tagged.filter((s: any) => s.proof_difficulty === 'none').length,
        minimal_proof_count: tagged.filter((s: any) => s.proof_difficulty === 'minimal').length,
        categories: [...new Set(tagged.map((s: any) => s.category))],
        profile_companies_checked: knownCompanies
      },
      metadata: result.search_metadata
    });

  } catch (error) {
    console.error('Settlement search error');
    return Response.json({
      error: 'Failed to search for settlements',
      details: 'An error occurred during settlement search'
    }, { status: 500 });
  }
});
