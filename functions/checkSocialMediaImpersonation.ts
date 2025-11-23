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

    // Get user's legitimate social media profiles
    const allSocialProfiles = await base44.entities.SocialMediaProfile.list();
    const userProfiles = allSocialProfiles.filter(p => p.profile_id === profileId);

    if (userProfiles.length === 0) {
      return Response.json({ 
        message: 'No social media profiles to monitor',
        findingsCount: 0 
      });
    }

    // Get user's personal data for this profile
    const allPersonalData = await base44.entities.PersonalData.list();
    const profileData = allPersonalData.filter(d => d.profile_id === profileId);

    const userDataSummary = profileData.map(d => `${d.data_type}: ${d.value}`).join(', ');

    const findings = [];

    for (const legitimateProfile of userProfiles) {
      const prompt = `You are an identity theft detection AI. Analyze social media for impersonation attempts.

User's legitimate profile: ${legitimateProfile.platform} - @${legitimateProfile.username}
User's personal data: ${userDataSummary}

Search for:
1. Profiles impersonating this user (similar usernames, stolen photos, copied bio)
2. Unauthorized use of user's personal data (name, photos, information)
3. Accounts claiming to be this person
4. Fake profiles using variations of their username

For each suspicious finding, provide:
- platform: social media platform
- finding_type: impersonation, data_misuse, unauthorized_profile, stolen_content, or identity_theft
- suspicious_username: username of suspicious account
- suspicious_profile_url: URL to profile (if available)
- similarity_score: 0-100 confidence this is impersonation
- misused_data: array of data types being misused
- evidence: what makes this suspicious
- severity: critical, high, medium, or low
- ai_recommendations: array of recommended actions

Return JSON with findings array. Only include high-confidence findings (similarity_score >= 60).`;

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
                  platform: { type: "string" },
                  finding_type: { type: "string" },
                  suspicious_username: { type: "string" },
                  suspicious_profile_url: { type: "string" },
                  similarity_score: { type: "number" },
                  misused_data: { type: "array", items: { type: "string" } },
                  evidence: { type: "string" },
                  severity: { type: "string" },
                  ai_recommendations: { type: "array", items: { type: "string" } }
                }
              }
            }
          }
        }
      });

      if (result.findings && result.findings.length > 0) {
        for (const finding of result.findings) {
          // Create finding record
          await base44.entities.SocialMediaFinding.create({
            profile_id: profileId,
            platform: finding.platform,
            finding_type: finding.finding_type,
            suspicious_username: finding.suspicious_username,
            suspicious_profile_url: finding.suspicious_profile_url || '',
            similarity_score: finding.similarity_score,
            misused_data: finding.misused_data || [],
            evidence: finding.evidence,
            status: 'new',
            severity: finding.severity,
            detected_date: new Date().toISOString().split('T')[0],
            ai_recommendations: finding.ai_recommendations || []
          });

          // Create notification alert
          await base44.entities.NotificationAlert.create({
            profile_id: profileId,
            alert_type: 'high_risk_alert',
            title: `${finding.severity.toUpperCase()}: Social Media Impersonation Detected`,
            message: `Potential ${finding.finding_type} found on ${finding.platform}: @${finding.suspicious_username}. ${finding.evidence}`,
            severity: finding.severity,
            is_read: false,
            related_data_ids: [],
            threat_indicators: finding.misused_data || [],
            confidence_score: finding.similarity_score
          });

          findings.push(finding);
        }
      }
    }

    return Response.json({
      success: true,
      findingsCount: findings.length,
      findings,
      message: findings.length > 0 
        ? `Found ${findings.length} potential impersonation attempt(s)`
        : 'No impersonation attempts detected'
    });

  } catch (error) {
    console.error('Impersonation check error:', error);
    return Response.json({ 
      error: error.message,
      details: 'Failed to check for social media impersonation'
    }, { status: 500 });
  }
});