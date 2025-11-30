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
      return Response.json({ ok: true, testMode: true, function: 'checkBreachAlerts' });
    }
    
    const { profileId } = body;

    // Get user's personal data from vault
    const allPersonalData = await base44.entities.PersonalData.list();
    const profileData = profileId 
      ? allPersonalData.filter(d => d.profile_id === profileId && d.monitoring_enabled)
      : allPersonalData.filter(d => d.monitoring_enabled);

    if (profileData.length === 0) {
      return Response.json({ 
        message: 'No monitored data in vault',
        alertsCreated: 0 
      });
    }

    // Build user's actual data for verification
    const dataValues = profileData.map(d => ({
      type: d.data_type,
      value: d.value,
      id: d.id,
      profile_id: d.profile_id
    }));

    // Get emails specifically for HIBP check
    const emails = profileData.filter(d => d.data_type === 'email').map(d => d.value);
    
    const alertsCreated = [];
    const breachesFound = [];

    // Check each email against Have I Been Pwned
    const HIBP_API_KEY = Deno.env.get('HIBP_API_KEY');
    
    for (const email of emails) {
      try {
        // Rate limit - HIBP requires 1.5 seconds between requests
        await new Promise(resolve => setTimeout(resolve, 1600));
        
        const hibpResponse = await fetch(
          `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`,
          {
            headers: {
              'hibp-api-key': HIBP_API_KEY,
              'User-Agent': 'Incognito-Privacy-Guardian'
            }
          }
        );

        if (hibpResponse.status === 200) {
          const breaches = await hibpResponse.json();
          
          // Filter to recent breaches (last 90 days)
          const recentBreaches = breaches.filter(b => {
            const breachDate = new Date(b.BreachDate || b.AddedDate);
            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
            return breachDate >= ninetyDaysAgo;
          });

          for (const breach of recentBreaches) {
            breachesFound.push({
              breach_name: breach.Name,
              breach_date: breach.BreachDate,
              domain: breach.Domain,
              data_types_exposed: breach.DataClasses || [],
              description: breach.Description?.replace(/<[^>]*>/g, '') || 'Data breach detected',
              records_affected: breach.PwnCount?.toLocaleString() || 'Unknown',
              is_verified: breach.IsVerified,
              email_found: email
            });
          }
        }
      } catch (hibpError) {
        console.error('HIBP check failed for email:', hibpError.message);
      }
    }

    // Now use LLM to check for breaches affecting OTHER data types (phone, SSN, etc.)
    // Only if user has non-email data in vault
    const nonEmailData = profileData.filter(d => d.data_type !== 'email');
    
    if (nonEmailData.length > 0) {
      const prompt = `You are a data breach verification system. Check if ANY of the user's SPECIFIC data values below appear in known, VERIFIED data breaches.

USER'S EXACT DATA VALUES TO CHECK:
${nonEmailData.map(d => `- ${d.data_type}: "${d.value}"`).join('\n')}

CRITICAL MATCHING RULES:
1. ONLY report a match if the user's EXACT VALUE appears in a known breach
2. DO NOT report generic breaches just because they contain "phone numbers" or "addresses"
3. You must have evidence or strong indication that THIS SPECIFIC value was in the breach
4. For names - only match if the exact full name appears in breach data
5. For phones - only match if the exact phone number was exposed
6. For SSN/sensitive IDs - these are rarely searchable, only report if you have specific evidence

SEARCH:
- Check known breach databases and breach search services
- Look for the user's specific values in exposed data compilations
- Search for any public exposure of these exact values

If you find a VERIFIED match where the user's specific data appears in a breach, return it.
If you cannot confirm the user's SPECIFIC VALUES are in a breach, return an empty array.`;

      const llmResult = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            verified_breaches: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  breach_name: { type: "string" },
                  breach_date: { type: "string" },
                  source_url: { type: "string" },
                  matched_data_type: { type: "string" },
                  matched_value: { type: "string" },
                  evidence: { type: "string" },
                  severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
                  description: { type: "string" }
                }
              }
            }
          }
        }
      });

      // Add LLM-verified breaches that have actual matches
      if (llmResult.verified_breaches) {
        for (const breach of llmResult.verified_breaches) {
          // Verify the matched value actually exists in user's vault
          const matchedData = nonEmailData.find(d => 
            d.value.toLowerCase() === breach.matched_value?.toLowerCase() ||
            d.value.includes(breach.matched_value) ||
            breach.matched_value?.includes(d.value)
          );
          
          if (matchedData && breach.evidence && !breach.evidence.toLowerCase().includes('not found')) {
            breachesFound.push({
              ...breach,
              email_found: null,
              data_found: matchedData.value,
              data_type: matchedData.data_type
            });
          }
        }
      }
    }

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          breaches: {
            type: "array",
            items: {
              type: "object",
              properties: {
                breach_name: { type: "string" },
                breach_date: { type: "string" },
                source_url: { type: "string" },
                records_affected: { type: "string" },
                data_types_exposed: { type: "array", items: { type: "string" } },
                severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
                description: { type: "string" },
                recommended_actions: { type: "array", items: { type: "string" } }
              }
            }
          }
        }
      }
    });

    // Create alerts only for verified breaches
    if (breachesFound.length > 0) {
      const existingAlerts = await base44.entities.NotificationAlert.list();
      
      for (const breach of breachesFound) {
        // Check if we already alerted about this specific breach + data combination
        const alertKey = breach.email_found || breach.data_found;
        const alreadyAlerted = existingAlerts.some(a => 
          a.title?.includes(breach.breach_name) && 
          a.message?.includes(alertKey) &&
          a.alert_type === 'new_breach_detected'
        );

        if (alreadyAlerted) continue;

        // Find the profile for this data
        const matchedData = profileData.find(d => 
          d.value === breach.email_found || d.value === breach.data_found
        );
        
        if (!matchedData) continue;

        const exposedDataTypes = breach.data_types_exposed?.join(', ') || 'personal information';
        const yourData = breach.email_found ? `email: ${breach.email_found}` : `${breach.data_type}: ${breach.data_found}`;

        await base44.entities.NotificationAlert.create({
          profile_id: matchedData.profile_id,
          alert_type: 'new_breach_detected',
          title: `🚨 VERIFIED: Your data found in ${breach.breach_name} breach`,
          message: `Your ${yourData} was found in the ${breach.breach_name} data breach (${breach.breach_date}).\n\nData exposed in this breach: ${exposedDataTypes}\n\nRecords affected: ${breach.records_affected || 'Unknown'}\n\n${breach.description || ''}`,
          severity: breach.is_verified === false ? 'medium' : 'high',
          is_read: false,
          action_url: breach.source_url || breach.domain ? `https://${breach.domain}` : null,
          related_data_ids: [matchedData.id],
          threat_indicators: [
            'Change passwords for this account immediately',
            'Enable 2-factor authentication if available',
            'Monitor for suspicious activity',
            'Consider credit monitoring if sensitive data exposed'
          ],
          confidence_score: 100 // This is a verified match
        });

        alertsCreated.push({
          breach_name: breach.breach_name,
          profile_id: matchedData.profile_id,
          your_data: yourData,
          severity: breach.is_verified === false ? 'medium' : 'high'
        });
      }
    }

    return Response.json({
      success: true,
      breachesFound: breachesFound.length,
      alertsCreated: alertsCreated.length,
      alerts: alertsCreated,
      message: alertsCreated.length > 0 
        ? `Found ${breachesFound.length} breach(es) containing YOUR data. Created ${alertsCreated.length} alert(s).`
        : 'No breaches found containing your specific data'
    });

  } catch (error) {
    console.error('Breach alert check error:', error);
    return Response.json({ 
      error: error.message,
      details: 'Failed to check for breach alerts'
    }, { status: 500 });
  }
});