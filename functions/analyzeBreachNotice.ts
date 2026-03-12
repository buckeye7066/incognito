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
      return Response.json({ ok: true, testMode: true, function: 'analyzeBreachNotice' });
    }

    const { noticeText, profileId } = body;

    if (!noticeText || noticeText.trim().length < 20) {
      return Response.json({
        error: 'Please provide the text content of the breach notice (paste or upload).'
      }, { status: 400 });
    }

    const prompt = `IMPORTANT SAFETY RULES:
- ONLY extract information that is explicitly stated in the notice text.
- NEVER fabricate company names, dates, or legal details.
- If a field cannot be determined from the text, use null.
- Be precise about dates and data types.

You are analyzing a DATA BREACH NOTIFICATION letter/email. Extract the following from the text below:

--- BREACH NOTICE TEXT ---
${noticeText.slice(0, 8000)}
--- END ---

Extract:
1. company_name: The company that was breached (who sent the notice)
2. breach_date: When the breach occurred (YYYY-MM-DD if possible)
3. discovery_date: When the company discovered the breach
4. notification_date: Date on the notice letter
5. data_types_exposed: Array of specific data types compromised (e.g. "SSN", "email", "credit card number", "name", "address", "DOB", "medical records", "password", "phone number", "drivers license")
6. affected_count: Number of people affected if mentioned
7. breach_description: 1-2 sentence summary of what happened
8. remediation_offered: What the company is offering (credit monitoring, identity protection, etc.)
9. remediation_provider: The monitoring service offered (e.g. "Experian IdentityWorks", "Kroll")
10. claim_deadline: Any deadline to enroll in remediation or file a claim
11. reference_number: Any case/reference number in the notice
12. regulatory_citations: Any laws or regulations mentioned (e.g. HIPAA, state breach notification laws)
13. class_action_mentioned: true/false - does the notice mention any lawsuit or settlement
14. class_action_details: If a lawsuit is mentioned, extract case name, court, and settlement URL
15. severity_assessment: "critical" if SSN/financial data, "high" if PII like DOB/address, "medium" if email/username only, "low" if minimal data`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          company_name: { type: "string" },
          breach_date: { type: "string" },
          discovery_date: { type: "string" },
          notification_date: { type: "string" },
          data_types_exposed: { type: "array", items: { type: "string" } },
          affected_count: { type: "string" },
          breach_description: { type: "string" },
          remediation_offered: { type: "string" },
          remediation_provider: { type: "string" },
          claim_deadline: { type: "string" },
          reference_number: { type: "string" },
          regulatory_citations: { type: "array", items: { type: "string" } },
          class_action_mentioned: { type: "boolean" },
          class_action_details: {
            type: "object",
            properties: {
              case_name: { type: "string" },
              court: { type: "string" },
              settlement_url: { type: "string" },
              claim_deadline: { type: "string" },
              estimated_payout: { type: "string" }
            }
          },
          severity_assessment: { type: "string", enum: ["critical", "high", "medium", "low"] }
        }
      }
    });

    // Cross-reference with known class actions from the static registry
    const companyName = result.company_name || '';
    let knownMatches = [];

    if (companyName) {
      try {
        const caResp = await base44.functions.invoke('listClassActions', {
          company: companyName
        });
        knownMatches = caResp?.data?.lawsuits || [];
      } catch {
        // listClassActions not available or errored - continue
      }
    }

    // Also do an AI-powered search for recent class actions
    let aiClassActions = [];
    if (companyName) {
      try {
        const caResp = await base44.functions.invoke('checkClassActions', {
          companyName,
          breachName: result.breach_description
        });
        aiClassActions = caResp?.litigation || [];
      } catch {
        // Continue without AI search results
      }
    }

    // Store the breach notice analysis as a scan result
    if (profileId && companyName) {
      try {
        await base44.asServiceRole.entities.ScanResult.create({
          profile_id: profileId,
          source_name: companyName,
          source_type: 'breach_notice',
          risk_score: result.severity_assessment === 'critical' ? 95
            : result.severity_assessment === 'high' ? 80
            : result.severity_assessment === 'medium' ? 60 : 40,
          data_exposed: result.data_types_exposed || [],
          breach_date: result.breach_date || null,
          status: 'new',
          scan_date: new Date().toISOString().split('T')[0],
          metadata: {
            source: 'breach_notice_upload',
            remediation_offered: result.remediation_offered,
            claim_deadline: result.claim_deadline,
            affected_count: result.affected_count,
            class_action_found: knownMatches.length > 0 || aiClassActions.length > 0
          }
        });
      } catch {
        // Non-critical - continue even if storage fails
      }
    }

    const totalClassActions = [
      ...knownMatches.map(m => ({ ...m, source: 'known_registry' })),
      ...aiClassActions.map(a => ({ ...a, source: 'ai_search' }))
    ];

    // Deduplicate by company + title
    const seen = new Set();
    const deduped = totalClassActions.filter(ca => {
      const key = `${(ca.company || ca.matched_company || '').toLowerCase()}_${(ca.title || ca.lawsuit_name || '').toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return Response.json({
      success: true,
      analysis: result,
      class_actions: {
        total_found: deduped.length,
        from_notice: result.class_action_mentioned ? [result.class_action_details] : [],
        from_registry: knownMatches,
        from_ai_search: aiClassActions,
        combined: deduped
      },
      profile_impact: {
        severity: result.severity_assessment,
        data_at_risk: result.data_types_exposed || [],
        action_required: result.severity_assessment === 'critical' || result.severity_assessment === 'high',
        has_class_action: deduped.length > 0,
        has_remediation: !!result.remediation_offered
      }
    });

  } catch (error) {
    console.error('Breach notice analysis error');
    return Response.json({
      error: 'Failed to analyze breach notice',
      details: 'An error occurred during analysis'
    }, { status: 500 });
  }
});
