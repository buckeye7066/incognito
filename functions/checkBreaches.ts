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
      return Response.json({ ok: true, testMode: true, function: 'checkBreaches' });
    }
    
    const { profileId, identifiers } = body;

    if (!identifiers || identifiers.length === 0) {
      return Response.json({ error: 'No identifiers provided' }, { status: 400 });
    }

    const HIBP_API_KEY = Deno.env.get('HIBP_API_KEY');
    if (!HIBP_API_KEY) {
      return Response.json({ error: 'HIBP API key not configured' }, { status: 500 });
    }

    const breachResults = [];

    // Check each identifier
    for (const identifier of identifiers) {
      const { id, data_type, value } = identifier;

      // Only check emails with HIBP (their primary supported type)
      if (data_type === 'email') {
        try {
          // Have I Been Pwned API v3 - requires API key
          const response = await fetch(
            `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(value)}?truncateResponse=false`,
            {
              headers: {
                'User-Agent': 'Incognito-Privacy-App',
                'hibp-api-key': HIBP_API_KEY
              }
            }
          );

          if (response.status === 200) {
            const breaches = await response.json();
            
            for (const breach of breaches) {
              breachResults.push({
                identifier_id: id,
                identifier_value: value,
                data_type,
                breach_name: breach.Name,
                breach_date: breach.BreachDate,
                breach_title: breach.Title,
                description: breach.Description,
                data_classes: breach.DataClasses || [],
                is_verified: breach.IsVerified,
                is_sensitive: breach.IsSensitive,
                pwn_count: breach.PwnCount,
                logo_path: breach.LogoPath
              });

              // Create scan result record
              await base44.asServiceRole.entities.ScanResult.create({
                profile_id: profileId,
                personal_data_id: id,
                source_name: breach.Name,
                source_type: 'breach_database',
                risk_score: breach.IsSensitive ? 90 : 70,
                data_exposed: breach.DataClasses || [],
                breach_date: breach.BreachDate,
                status: 'new',
                scan_date: new Date().toISOString().split('T')[0],
                metadata: {
                  pwn_count: breach.PwnCount,
                  is_verified: breach.IsVerified,
                  description: breach.Description
                }
              });

              // Create notification for this breach
              await base44.asServiceRole.entities.NotificationAlert.create({
                profile_id: profileId,
                alert_type: 'new_breach_detected',
                title: `Breach Detected: ${breach.Name}`,
                message: `Your email was found in the ${breach.Name} breach (${breach.BreachDate}). Exposed: ${breach.DataClasses?.slice(0, 5).join(', ')}.`,
                severity: breach.IsSensitive ? 'critical' : 'high',
                is_read: false,
                related_data_ids: [id],
                threat_indicators: breach.DataClasses || []
              });
            }
          } else if (response.status === 404) {
            // No breach found - good news!
            breachResults.push({
              identifier_id: id,
              identifier_value: value,
              data_type,
              status: 'clean',
              message: 'No breaches found'
            });
          } else if (response.status === 401) {
            console.error('HIBP API key invalid');
            return Response.json({ error: 'HIBP API key invalid' }, { status: 401 });
          } else if (response.status === 429) {
            console.error('HIBP rate limit exceeded');
            // Continue with other identifiers after a delay
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (error) {
          console.error(`Error checking ${value}:`, error);
        }

        // Rate limiting - HIBP allows 1 request per 1.5 seconds for paid plans
        await new Promise(resolve => setTimeout(resolve, 1600));
      }
    }

    const breachesFound = breachResults.filter(r => r.breach_name);
    const cleanCount = breachResults.filter(r => r.status === 'clean').length;

    return Response.json({
      success: true,
      breaches_found: breachesFound.length,
      clean_count: cleanCount,
      results: breachResults,
      message: breachesFound.length > 0 
        ? `Found ${breachesFound.length} breach${breachesFound.length === 1 ? '' : 'es'} affecting your email`
        : 'No breaches found - your email is clean!'
    });

  } catch (error) {
    console.error('Breach check error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});