import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    
    // Self-test mode
    if (body._selfTest === '1') {
      return Response.json({ ok: true, testMode: true, function: 'detectSearchQueries' });
    }
    
    const { profileId } = body;

    if (!profileId) {
      return Response.json({ error: 'profileId is required' }, { status: 400 });
    }

    // Get profile's personal data
    const allPersonalData = await base44.asServiceRole.entities.PersonalData.list();
    const personalData = allPersonalData.filter(d => d.profile_id === profileId && d.monitoring_enabled);

    if (personalData.length === 0) {
      return Response.json({ 
        message: 'No personal data to monitor',
        findingsCount: 0 
      });
    }

    // Build searchable data
    const searchableData = personalData.map(d => ({
      type: d.data_type,
      value: d.value
    }));

    const prompt = `IMPORTANT SAFETY RULES:
- NEVER fabricate breach data, impersonation findings, exposures, or personal details.
- NEVER invent platforms, people, websites, or records.
- NEVER guess. If unsure, explicitly say 'uncertain.'
- ONLY use the JSON evidence provided.
- If a detail is not present in the evidence, DO NOT add it.
- It is better to return an empty array than false positives.

You are a precise data exposure detection system. Your job is to find REAL, VERIFIABLE places where this person's data appears publicly online.

=== USER'S PERSONAL DATA TO SEARCH FOR ===
${searchableData.map(d => `${d.type}: "${d.value}"`).join('\n')}

=== SEARCH METHODOLOGY ===
Search the internet for ACTUAL appearances of this data on:

1. PEOPLE SEARCH / DATA BROKERS (high priority):
   - Spokeo.com, BeenVerified.com, WhitePages.com
   - TruePeopleSearch.com, FastPeopleSearch.com
   - Radaris.com, Intelius.com, PeopleFinder.com
   - MyLife.com, USSearch.com, Pipl.com

2. PUBLIC RECORDS:
   - Property records, court records
   - Business registrations, LLC filings
   - Voter registration databases
   - Professional licenses

3. SOCIAL MEDIA (public profiles):
   - LinkedIn, Facebook, Twitter/X, Instagram
   - Reddit, TikTok, YouTube

4. OTHER PUBLIC SOURCES:
   - News articles mentioning the person
   - Forum posts, blog comments
   - Review sites (Yelp, Google Reviews)
   - Company websites, directories

=== STRICT MATCHING REQUIREMENTS ===

CRITICAL: Only report findings where you have HIGH CONFIDENCE (80%+) that the data matches.

For NAME matches: Require the EXACT full name + at least ONE other matching identifier (address, phone, email, employer)
For EMAIL matches: Exact email address match only
For PHONE matches: Exact phone number match only  
For ADDRESS matches: Exact or very close address match (same street address)
For OTHER data: Exact match required

=== OUTPUT FORMAT ===

For each VERIFIED exposure, provide:
- source_name: The website/platform name (e.g., "Spokeo", "WhitePages")
- source_url: Direct URL if available, or base site URL
- data_found: EXACTLY what data appears (verbatim quote)
- matched_data_types: Which vault data types were matched
- matched_values: The exact values that matched
- risk_level: critical/high/medium/low based on data sensitivity
- ai_analysis: Brief explanation of the exposure and risk

=== WHAT NOT TO INCLUDE ===
- Do NOT make up findings
- Do NOT report if match confidence is below 80%
- Do NOT include sites you cannot verify have the data
- Do NOT invent URLs or fake sources

Return ONLY verified, real exposures. It's better to return an empty array than false positives.`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          findings: {
            type: "array",
            items: {
              type: "object",
              properties: {
                source_name: { type: "string", description: "Site name like Spokeo, WhitePages, etc." },
                source_url: { type: "string", description: "URL where data was found" },
                data_found: { type: "string", description: "Exact verbatim data shown on the source" },
                matched_data_types: { type: "array", items: { type: "string" } },
                matched_values: { type: "array", items: { type: "string" } },
                risk_level: { type: "string", enum: ["critical", "high", "medium", "low"] },
                ai_analysis: { type: "string" },
                confidence_score: { type: "number", description: "0-100 confidence in this match" }
              }
            }
          },
          search_summary: {
            type: "object",
            properties: {
              sources_checked: { type: "number" },
              exposures_found: { type: "number" },
              highest_risk: { type: "string" }
            }
          }
        }
      }
    });

    const findings = result.findings || [];
    
    // Filter: only keep findings with confidence >= 80 and proper matches
    const isNameOnlyMatch = (types) => {
      if (!types || types.length === 0) return false;
      const nameTypes = ['full_name', 'alias', 'name'];
      return types.every(t => nameTypes.some(nt => t.toLowerCase().includes(nt)));
    };
    
    const validFindings = findings.filter(f => {
      // Must have confidence >= 80
      if (f.confidence_score && f.confidence_score < 80) return false;
      
      const types = f.matched_data_types || [];
      if (types.length === 0) return false;
      
      // Name-only matches need 2+ identifiers
      if (isNameOnlyMatch(types)) return types.length >= 2;
      
      return true;
    });
    
    // Create finding records
    for (const finding of validFindings) {
      await base44.asServiceRole.entities.SearchQueryFinding.create({
        profile_id: profileId,
        search_platform: finding.source_name,
        query_detected: finding.data_found,
        matched_data_types: finding.matched_data_types || [],
        matched_values: finding.matched_values || [],
        risk_level: finding.risk_level,
        detected_date: new Date().toISOString(),
        ai_analysis: finding.ai_analysis,
        status: 'new'
      });

      // Create notification for high-risk findings
      if (finding.risk_level === 'critical' || finding.risk_level === 'high') {
        await base44.asServiceRole.entities.NotificationAlert.create({
          profile_id: profileId,
          alert_type: 'high_risk_alert',
          title: `Data Found on ${finding.source_name}`,
          message: `Your personal data appears on ${finding.source_name}. ${finding.ai_analysis}`,
          severity: finding.risk_level === 'critical' ? 'critical' : 'high',
          is_read: false,
          threat_indicators: finding.matched_data_types
        });
      }
    }

    return Response.json({
      success: true,
      findingsCount: validFindings.length,
      findings: validFindings,
      summary: result.search_summary,
      message: validFindings.length > 0
        ? `Found your data on ${validFindings.length} source${validFindings.length === 1 ? '' : 's'}`
        : 'No verified data exposures found'
    });

  } catch (error) {
    // SECURITY: Do not log full error details
    console.error('Data exposure detection error occurred');
    return Response.json({ 
      error: 'Failed to detect data exposures',
      details: 'An error occurred during exposure detection'
    }, { status: 500 });
  }
});