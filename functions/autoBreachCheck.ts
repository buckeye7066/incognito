import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // This is a scheduled function - use service role
    const allPreferences = await base44.asServiceRole.entities.UserPreferences.list();
    const autoEnabled = allPreferences.filter(p => p.auto_breach_check_enabled);

    if (autoEnabled.length === 0) {
      return Response.json({ message: 'No users with auto breach check enabled', checked: 0 });
    }

    const allPersonalData = await base44.asServiceRole.entities.PersonalData.list();
    const allProfiles = await base44.asServiceRole.entities.Profile.list();

    let totalChecked = 0;
    let totalBreaches = 0;

    for (const pref of autoEnabled) {
      // Get profiles for this preference owner
      const profileIds = allProfiles.map(p => p.id);
      const emails = allPersonalData.filter(d =>
        profileIds.includes(d.profile_id) &&
        d.data_type === 'email' &&
        d.monitoring_enabled
      );

      for (const emailData of emails) {
        try {
          const hibpKey = Deno.env.get('HIBP_API_KEY');
          if (!hibpKey) continue;

          const response = await fetch(
            `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(emailData.value)}?truncateResponse=false`,
            {
              headers: {
                'hibp-api-key': hibpKey,
                'User-Agent': 'Incognito-Privacy-App'
              }
            }
          );

          if (response.status === 200) {
            const breaches = await response.json();
            // Check for new breaches (not already logged)
            const existing = await base44.asServiceRole.entities.ScanResult.filter({
              personal_data_id: emailData.id
            });
            const existingNames = new Set(existing.map(r => r.source_name));

            for (const breach of breaches) {
              if (!existingNames.has(breach.Title || breach.Name)) {
                await base44.asServiceRole.entities.ScanResult.create({
                  profile_id: emailData.profile_id,
                  personal_data_id: emailData.id,
                  source_name: breach.Title || breach.Name,
                  source_url: breach.Domain ? `https://${breach.Domain}` : 'https://haveibeenpwned.com',
                  source_type: 'breach_database',
                  risk_score: breach.IsSensitive ? 90 : (breach.DataClasses?.length > 5 ? 80 : 60),
                  data_exposed: breach.DataClasses || ['email'],
                  breach_date: breach.BreachDate,
                  status: 'new',
                  scan_date: new Date().toISOString().split('T')[0],
                  metadata: { details: breach.Description, auto_detected: true }
                });

                await base44.asServiceRole.entities.NotificationAlert.create({
                  profile_id: emailData.profile_id,
                  alert_type: 'new_breach_detected',
                  title: `New Breach: ${breach.Title || breach.Name}`,
                  message: `Your email was found in a new data breach: ${breach.Title || breach.Name}. Data exposed: ${breach.DataClasses?.slice(0, 3).join(', ')}.`,
                  severity: breach.IsSensitive ? 'critical' : 'high',
                  confidence_score: 100,
                  threat_indicators: breach.DataClasses || []
                });

                totalBreaches++;
              }
            }
          }

          totalChecked++;
          // Respect HIBP rate limits
          await new Promise(r => setTimeout(r, 1600));
        } catch (_e) {
          // Continue with next email
        }
      }
    }

    return Response.json({
      message: `Auto breach check complete`,
      checked: totalChecked,
      new_breaches: totalBreaches
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});