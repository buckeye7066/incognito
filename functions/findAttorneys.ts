import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { location, specialty, exposureType } = await req.json();

    // Default to Tennessee if no location provided
    const searchLocation = location || 'Tennessee';

    // Map exposure type to legal specialty
    const specialtyMap = {
      impersonation: ['identity theft', 'cybercrime', 'defamation'],
      data_broker: ['data privacy', 'consumer protection', 'CCPA/GDPR'],
      breach: ['data breach', 'class action', 'consumer protection'],
      identity_theft: ['identity theft', 'fraud', 'consumer protection'],
      harassment: ['cyberstalking', 'harassment', 'defamation']
    };

    const searchSpecialties = specialty 
      ? [specialty] 
      : (specialtyMap[exposureType] || ['data privacy', 'identity theft', 'consumer protection']);

    const prompt = `IMPORTANT SAFETY RULES:
- ONLY return REAL, VERIFIED attorneys and law firms.
- NEVER fabricate names, phone numbers, or addresses.
- If unsure about contact information, omit it.
- Only include attorneys who can be independently verified.

Search for attorneys in ${searchLocation} who specialize in:
${searchSpecialties.join(', ')}

Look for:
1. Bar-registered attorneys in the specified location
2. Law firms with verified data privacy/cybercrime practice areas
3. Attorneys who have handled similar cases

Check sources:
- State bar association directories
- AVVO, Martindale-Hubbell, Super Lawyers
- Law firm websites
- Legal aid organizations (for free consultations)

For each VERIFIED attorney, provide:
- name: Full name with credentials (e.g., "John Smith, J.D.")
- firm: Law firm name
- location: City, State
- phone: Contact phone (only if verified)
- email: Contact email (only if verified)
- website: Law firm website
- specialty: Primary practice areas
- free_consultation: true/false if known
- notable_cases: Any relevant case experience
- confidence: 0-100 how confident this is accurate

Prioritize:
1. Attorneys with free consultations
2. Attorneys with specific experience in the relevant area
3. Attorneys closer to ${searchLocation}

Return ONLY verified attorneys. An empty array is better than fabricated contacts.`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          attorneys: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                firm: { type: "string" },
                location: { type: "string" },
                phone: { type: "string" },
                email: { type: "string" },
                website: { type: "string" },
                specialty: { type: "array", items: { type: "string" } },
                free_consultation: { type: "boolean" },
                notable_cases: { type: "string" },
                confidence: { type: "number" }
              }
            }
          },
          legal_aid_resources: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                website: { type: "string" },
                phone: { type: "string" }
              }
            }
          }
        }
      }
    });

    // Filter out low-confidence results
    const validAttorneys = (result.attorneys || []).filter(a => {
      if (a.confidence && a.confidence < 60) return false;
      if (!a.name || !a.firm) return false;
      if (/\[.*\]/.test(a.name) || /example/i.test(a.name)) return false;
      return true;
    });

    // Sort by free consultation first, then confidence
    validAttorneys.sort((a, b) => {
      if (a.free_consultation && !b.free_consultation) return -1;
      if (!a.free_consultation && b.free_consultation) return 1;
      return (b.confidence || 0) - (a.confidence || 0);
    });

    return Response.json({
      success: true,
      attorneys: validAttorneys,
      legal_aid_resources: result.legal_aid_resources || [],
      search_location: searchLocation,
      specialties_searched: searchSpecialties,
      message: validAttorneys.length > 0
        ? `Found ${validAttorneys.length} attorney(s) in ${searchLocation}`
        : `No verified attorneys found. Try expanding your search area.`
    });

  } catch (error) {
    console.error('Attorney search error occurred');
    return Response.json({ 
      error: 'Failed to find attorneys',
      details: 'An error occurred during attorney search'
    }, { status: 500 });
  }
});