import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { profileId, identifiers } = await req.json();

    if (!identifiers || identifiers.length === 0) {
      return Response.json({ error: 'No identifiers provided' }, { status: 400 });
    }

    const breachResults = [];

    // Check each identifier
    for (const identifier of identifiers) {
      const { id, data_type, value } = identifier;

      // Only check emails and usernames with HIBP
      if (data_type === 'email' || data_type === 'username') {
        try {
          // Have I Been Pwned API v3
          const response = await fetch(
            `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(value)}?truncateResponse=false`,
            {
              headers: {
                'User-Agent': 'Incognito-Privacy-App',
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
                description: breach.Description,
                data_classes: breach.DataClasses || [],
                is_verified: breach.IsVerified,
                is_sensitive: breach.IsSensitive
              });

              // Create notification for this breach
              await base44.asServiceRole.entities.NotificationAlert.create({
                profile_id: profileId,
                alert_type: 'new_breach_detected',
                title: `Breach Detected: ${breach.Name}`,
                message: `Your ${data_type} was found in the ${breach.Name} breach from ${breach.BreachDate}. Data exposed: ${breach.DataClasses?.join(', ')}.`,
                severity: breach.IsSensitive ? 'critical' : 'high',
                action_url: `#/Vault`,
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
              status: 'clean'
            });
          }
        } catch (error) {
          console.error(`Error checking ${value}:`, error);
        }

        // Rate limiting - HIBP allows 1 request per 1.5 seconds
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    return Response.json({
      success: true,
      breaches_found: breachResults.filter(r => r.breach_name).length,
      clean_count: breachResults.filter(r => r.status === 'clean').length,
      results: breachResults
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});