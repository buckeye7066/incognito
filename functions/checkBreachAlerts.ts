import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { profileId } = await req.json();

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

    // Build a summary of user's data types for breach matching
    const dataTypes = [...new Set(profileData.map(d => d.data_type))];
    const dataValues = profileData.map(d => ({
      type: d.data_type,
      value: d.value,
      id: d.id,
      profile_id: d.profile_id
    }));

    // Search for recent data breaches that could affect the user
    const prompt = `You are a data breach monitoring system. Search for RECENT data breaches (last 30 days or currently being reported) that could potentially contain the following types of personal data:

DATA TYPES TO MONITOR:
${dataTypes.map(t => `- ${t}`).join('\n')}

SEARCH REQUIREMENTS:
1. Find REAL, RECENT data breaches being reported in the news
2. Focus on breaches from the last 30 days
3. Include breaches from companies, healthcare providers, financial institutions, retailers, etc.
4. For each breach, determine which data types from the list above could be affected

For each breach found, provide:
- breach_name: Name of the company/organization breached
- breach_date: Date of breach or when it was disclosed (YYYY-MM-DD format)
- source_url: URL to news article or official disclosure
- records_affected: Estimated number of records (if known)
- data_types_exposed: Array of data types exposed that match the user's monitored types
- severity: critical, high, medium, or low based on sensitivity of data exposed
- description: Brief description of the breach
- recommended_actions: Array of recommended actions for affected individuals

IMPORTANT: Only return breaches that expose at least one of the data types listed above. Be accurate and cite real sources.`;

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

    const alertsCreated = [];

    if (result.breaches && result.breaches.length > 0) {
      // Get existing alerts to avoid duplicates
      const existingAlerts = await base44.entities.NotificationAlert.list();
      
      for (const breach of result.breaches) {
        // Check if we already alerted about this breach
        const alreadyAlerted = existingAlerts.some(a => 
          a.title?.includes(breach.breach_name) && 
          a.alert_type === 'new_breach_detected'
        );

        if (alreadyAlerted) continue;

        // Find which of the user's specific data types are affected
        const affectedDataTypes = dataTypes.filter(dt => 
          breach.data_types_exposed.some(exposed => 
            exposed.toLowerCase().includes(dt.replace(/_/g, ' ').toLowerCase()) ||
            dt.replace(/_/g, ' ').toLowerCase().includes(exposed.toLowerCase())
          )
        );

        if (affectedDataTypes.length === 0) continue;

        // Determine affected profiles
        const affectedProfiles = [...new Set(
          profileData
            .filter(d => affectedDataTypes.includes(d.data_type))
            .map(d => d.profile_id)
        )];

        // Create alert for each affected profile
        for (const pid of affectedProfiles) {
          await base44.entities.NotificationAlert.create({
            profile_id: pid,
            alert_type: 'new_breach_detected',
            title: `⚠️ Data Breach Alert: ${breach.breach_name}`,
            message: `${breach.description}\n\nYour potentially exposed data: ${affectedDataTypes.join(', ')}\n\nRecords affected: ${breach.records_affected || 'Unknown'}`,
            severity: breach.severity,
            is_read: false,
            action_url: breach.source_url,
            related_data_ids: profileData
              .filter(d => d.profile_id === pid && affectedDataTypes.includes(d.data_type))
              .map(d => d.id),
            threat_indicators: breach.recommended_actions || [],
            confidence_score: 85
          });

          alertsCreated.push({
            breach_name: breach.breach_name,
            profile_id: pid,
            affected_data: affectedDataTypes,
            severity: breach.severity
          });
        }
      }
    }

    return Response.json({
      success: true,
      breachesFound: result.breaches?.length || 0,
      alertsCreated: alertsCreated.length,
      alerts: alertsCreated,
      message: alertsCreated.length > 0 
        ? `Created ${alertsCreated.length} breach alert(s) for ${result.breaches.length} breach(es)`
        : 'No new breaches affecting your data were found'
    });

  } catch (error) {
    console.error('Breach alert check error:', error);
    return Response.json({ 
      error: error.message,
      details: 'Failed to check for breach alerts'
    }, { status: 500 });
  }
});