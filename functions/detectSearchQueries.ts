import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { profileId } = await req.json();

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

    // Build search queries to monitor
    const searchableData = personalData.map(d => ({
      type: d.data_type,
      value: d.value
    }));

    const prompt = `You are a data exposure detection AI. Search for where this person's information appears PUBLICLY INDEXED on the internet:

Personal Data to Search For:
${searchableData.map(d => `${d.type}: ${d.value}`).join('\n')}

SEARCH THESE SOURCES FOR PUBLIC EXPOSURES:
1. People Search Sites: Spokeo, BeenVerified, WhitePages, TruePeopleSearch, FastPeopleSearch, Radaris, Intelius, PeopleFinder
2. Data Broker Sites: Acxiom, LexisNexis, Experian (public records)
3. Social Media: Facebook, Twitter/X, Instagram, LinkedIn, TikTok, Reddit profiles
4. Public Records: Court records, property records, voter registration, business filings
5. Professional Sites: LinkedIn, company directories, business listings
6. Other: News articles, forum posts, review sites, comment sections

Report each place where this person's data appears publicly as a "finding".

For each detected search query that matches this person's data, provide:
- search_platform: where the search was detected
- query_detected: the actual search query
- matched_data_types: array of data types that were matched (e.g., ["full_name", "address"])
- matched_values: array of actual values matched
- searcher_identity: who performed the search (username, name, or "Anonymous" if unknown)
- searcher_ip: IP address if detectable, or "Unknown"
- device_info: device/browser information if available
- search_context: what the searcher was likely looking for
- risk_level: critical, high, medium, or low
- detected_date: ISO timestamp when search occurred
- geographic_origin: specific location (City, State, Country format)
- ai_analysis: your analysis of intent and risk

MATCHING RULES:
- For NAME matches (full_name, alias): Require AT LEAST TWO (2) identifiers to prevent false positives from common names
- For ALL OTHER data types (email, phone, address, SSN, etc.): Only ONE (1) identifier match is sufficient

Examples:
- ✓ VALID: Query contains user's email address (1 match enough)
- ✓ VALID: Query contains user's phone number (1 match enough)  
- ✓ VALID: Query contains full_name + any other identifier (2 matches for name)
- ✗ INVALID: Query contains only a common name without other identifiers

IMPORTANT: For searcher_identity, try to identify if it's:
- A known person's name
- A social media username
- An email address
- A company/organization
- "Anonymous" if truly untraceable

Return JSON with findings array. Only include real, detected searches with confidence >= 70%. Remember: name matches require 2+ identifiers, all other data types require only 1.`;

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
                search_platform: { type: "string" },
                query_detected: { type: "string" },
                matched_data_types: { type: "array", items: { type: "string" } },
                matched_values: { type: "array", items: { type: "string" } },
                searcher_identity: { type: "string" },
                searcher_ip: { type: "string" },
                device_info: { type: "string" },
                search_context: { type: "string" },
                risk_level: { type: "string" },
                detected_date: { type: "string" },
                geographic_origin: { type: "string" },
                ai_analysis: { type: "string" }
              }
            }
          }
        }
      }
    });

    const findings = result.findings || [];
    
    // Filter: name-only matches require 2+ identifiers, all other types need only 1
    const isNameOnlyMatch = (types) => {
      if (!types || types.length === 0) return false;
      const nameTypes = ['full_name', 'alias', 'name'];
      return types.every(t => nameTypes.some(nt => t.toLowerCase().includes(nt)));
    };
    
    const validFindings = findings.filter(f => {
      const types = f.matched_data_types || [];
      if (types.length === 0) return false;
      if (isNameOnlyMatch(types)) return types.length >= 2;
      return true;
    });
    
    // Create finding records
    for (const finding of validFindings) {
      await base44.asServiceRole.entities.SearchQueryFinding.create({
        profile_id: profileId,
        search_platform: finding.search_platform,
        query_detected: finding.query_detected,
        matched_data_types: finding.matched_data_types || [],
        matched_values: finding.matched_values || [],
        searcher_identity: finding.searcher_identity || 'Anonymous',
        searcher_ip: finding.searcher_ip || 'Unknown',
        device_info: finding.device_info || 'Unknown',
        search_context: finding.search_context,
        risk_level: finding.risk_level,
        detected_date: finding.detected_date || new Date().toISOString(),
        geographic_origin: finding.geographic_origin || 'Unknown',
        ai_analysis: finding.ai_analysis,
        status: 'new'
      });

      // Create notification for high-risk searches
      if (finding.risk_level === 'critical' || finding.risk_level === 'high') {
        await base44.asServiceRole.entities.NotificationAlert.create({
          profile_id: profileId,
          alert_type: 'high_risk_alert',
          title: `${finding.risk_level.toUpperCase()}: Someone Searched for Your Data`,
          message: `Detected search query on ${finding.search_platform}: "${finding.query_detected}". ${finding.ai_analysis}`,
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
      message: validFindings.length > 0
        ? `Detected ${validFindings.length} search quer${validFindings.length === 1 ? 'y' : 'ies'} matching your data`
        : 'No search queries detected at this time'
    });

  } catch (error) {
    console.error('Search query detection error:', error);
    return Response.json({ 
      error: error.message,
      details: 'Failed to detect search queries'
    }, { status: 500 });
  }
});