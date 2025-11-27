import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { companyName, breachName, dataType } = await req.json();

    if (!companyName && !breachName) {
      return Response.json({ 
        error: 'companyName or breachName is required' 
      }, { status: 400 });
    }

    const searchTerm = companyName || breachName;

    const prompt = `IMPORTANT SAFETY RULES:
- ONLY return REAL, VERIFIED class action lawsuits.
- NEVER fabricate case names, URLs, or legal details.
- If unsure, state uncertainty clearly.
- If no lawsuits exist, return an empty array.

Search for active or recently settled class action lawsuits against "${searchTerm}" related to:
- Data breaches
- Privacy violations
- Identity theft
- Consumer data misuse
- TCPA violations (unwanted calls/texts)

Check these sources:
- TopClassActions.com
- ClassAction.org
- ConsumerFinance.gov
- PACER federal court records
- State court dockets
- Recent news about "${searchTerm} class action"

For each VERIFIED lawsuit found, provide:
- lawsuit_name: Official case name (e.g., "Smith v. Company Inc.")
- case_number: If available
- court: Which court (e.g., "U.S. District Court, Northern District of California")
- status: active/settled/dismissed/pending_approval
- deadline: Settlement claim deadline if applicable
- url: Direct link to claim form or case information
- estimated_payout: If settlement approved
- how_to_join: Brief instructions
- matched_company: Company name that matched
- confidence: 0-100 how confident this is accurate

Return ONLY verified, real lawsuits. An empty array is better than fabricated results.`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          litigation: {
            type: "array",
            items: {
              type: "object",
              properties: {
                lawsuit_name: { type: "string" },
                case_number: { type: "string" },
                court: { type: "string" },
                status: { type: "string", enum: ["active", "settled", "dismissed", "pending_approval", "unknown"] },
                deadline: { type: "string" },
                url: { type: "string" },
                estimated_payout: { type: "string" },
                how_to_join: { type: "string" },
                matched_company: { type: "string" },
                confidence: { type: "number" }
              }
            }
          },
          search_summary: {
            type: "object",
            properties: {
              companies_searched: { type: "array", items: { type: "string" } },
              sources_checked: { type: "number" },
              total_found: { type: "number" }
            }
          }
        }
      }
    });

    // Filter out low-confidence results
    const validLitigation = (result.litigation || []).filter(l => {
      // Must have confidence >= 70
      if (l.confidence && l.confidence < 70) return false;
      // Must have a lawsuit name
      if (!l.lawsuit_name) return false;
      // Reject placeholders
      if (/\[.*\]/.test(l.lawsuit_name) || /example/i.test(l.lawsuit_name)) return false;
      return true;
    });

    return Response.json({
      success: true,
      litigation: validLitigation,
      summary: result.search_summary,
      searched_for: searchTerm,
      message: validLitigation.length > 0
        ? `Found ${validLitigation.length} potential class action(s) against ${searchTerm}`
        : `No verified class actions found for ${searchTerm}`
    });

  } catch (error) {
    console.error('Class action check error occurred');
    return Response.json({ 
      error: 'Failed to check for class actions',
      details: 'An error occurred during lawsuit search'
    }, { status: 500 });
  }
});