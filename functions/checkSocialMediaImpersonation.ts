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
      // Build detailed vault data for matching
      const vaultValues = {};
      profileData.forEach(d => {
        if (!vaultValues[d.data_type]) vaultValues[d.data_type] = [];
        vaultValues[d.data_type].push(d.value);
      });

      const prompt = `You are an advanced identity theft and social media threat detection AI. Your job is to find accounts that are using THIS SPECIFIC USER'S data.

USER'S LEGITIMATE PROFILE:
Platform: ${legitimateProfile.platform}
Username: @${legitimateProfile.username}
Profile URL: ${legitimateProfile.profile_url || 'Not provided'}

USER'S EXACT PERSONAL DATA (VAULT) - ONLY REPORT MATCHES TO THESE SPECIFIC VALUES:
${Object.entries(vaultValues).map(([type, values]) => `- ${type}: ${values.join(', ')}`).join('\n')}

CRITICAL MATCHING RULES:
1. ONLY report a finding if the suspicious profile contains ONE OR MORE of the EXACT values listed above
2. A "name match" means the suspicious profile uses the EXACT name from the vault (e.g., if vault has "John Smith", report profiles using "John Smith" or very close variants like "John A. Smith")
3. An "email match" means the suspicious profile displays or references the EXACT email from the vault
4. A "phone match" means the suspicious profile displays the EXACT phone number
5. DO NOT report generic fake accounts - only accounts specifically using THIS USER's data
6. If you cannot confirm the suspicious profile uses data from the vault above, DO NOT include it

COMPREHENSIVE SCAN REQUIREMENTS:

1. IMPERSONATION DETECTION:
   - Search for accounts with similar/variant usernames (typosquatting, underscore variations)
   - Look for profiles using the same or similar display name
   - Detect copied profile photos or stolen images
   - Find accounts with copied bio text or similar descriptions

2. DATA MISUSE ANALYSIS:
   - Check if user's name appears on unauthorized accounts
   - Look for user's photos being used elsewhere
   - Detect personal information being shared without consent
   - Find scraped content from the legitimate profile

3. STOLEN CONTENT DETECTION:
   - Search for reposted photos/videos without attribution
   - Find copied posts or status updates
   - Detect repurposed professional content

4. CROSS-PLATFORM THREATS:
   - Check related platforms for coordinated impersonation
   - Look for fake accounts linking to each other
   - Detect phishing profiles that reference the real user

SEVERITY CLASSIFICATION:
- CRITICAL: Active scam using user's identity, financial fraud attempts
- HIGH: Complete profile impersonation, identity theft in progress
- MEDIUM: Partial data misuse, stolen photos, bio copying
- LOW: Similar usernames, potential future threat

For each finding, provide DETAILED information including:
- The actual content being misused (full_name, bio text, photo URLs, location, workplace, education)
- WHICH SPECIFIC VALUE from the user's vault was matched (e.g., "Uses exact name 'John Smith' from vault")
- Photo comparison details if applicable
- Common friends/connections if detectable
- Specific evidence of impersonation

CRITICAL: Return ONLY findings where you can prove the suspicious profile uses one or more EXACT values from the user's vault listed above. If you're not 100% certain the profile uses the user's specific data, DO NOT include it.`;

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
                  finding_type: { type: "string", enum: ["impersonation", "data_misuse", "unauthorized_profile", "stolen_content", "identity_theft"] },
                  suspicious_username: { type: "string" },
                  suspicious_profile_url: { type: "string" },
                  suspicious_profile_photo: { type: "string" },
                  your_profile_photo: { type: "string" },
                  matching_photos: { type: "array", items: { type: "string" } },
                  photo_similarity_score: { type: "number" },
                  common_friends: { 
                    type: "array", 
                    items: { 
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        username: { type: "string" },
                        profile_url: { type: "string" }
                      }
                    }
                  },
                  misused_data_details: {
                    type: "object",
                    properties: {
                      full_name: { type: "string" },
                      bio: { type: "string" },
                      photos: { type: "array", items: { type: "string" } },
                      location: { type: "string" },
                      workplace: { type: "string" },
                      education: { type: "string" },
                      other: { type: "string" }
                    }
                  },
                  similarity_score: { type: "number" },
                  misused_data: { type: "array", items: { type: "string" } },
                  evidence: { type: "string" },
                  severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
                  ai_recommendations: { type: "array", items: { type: "string" } },
                  threat_category: { type: "string" },
                  potential_impact: { type: "string" }
                }
              }
            },
            scan_summary: {
              type: "object",
              properties: {
                total_threats_found: { type: "number" },
                critical_count: { type: "number" },
                high_count: { type: "number" },
                medium_count: { type: "number" },
                low_count: { type: "number" },
                platforms_scanned: { type: "array", items: { type: "string" } },
                scan_confidence: { type: "number" }
              }
            }
          }
        }
      });

      if (result.findings && result.findings.length > 0) {
        for (const finding of result.findings) {
          // Only save findings with sufficient confidence that directly involve user's data
          if (finding.similarity_score < 60) continue;

          // REJECT PLACEHOLDER DATA - LLM sometimes generates fake template values
          const hasPlaceholders = (str) => {
            if (!str) return false;
            return /\[.*\]/.test(str) || /suspicious/i.test(str) || /example/i.test(str) || /placeholder/i.test(str) || /fake/i.test(str) || /impersonat/i.test(str);
          };

          // Check for placeholder values in critical fields
          if (hasPlaceholders(finding.suspicious_username) ||
              hasPlaceholders(finding.suspicious_profile_url) ||
              hasPlaceholders(finding.evidence) ||
              (finding.misused_data_details && (
                hasPlaceholders(finding.misused_data_details.full_name) ||
                hasPlaceholders(finding.misused_data_details.bio) ||
                hasPlaceholders(finding.misused_data_details.location) ||
                hasPlaceholders(finding.misused_data_details.workplace) ||
                hasPlaceholders(finding.misused_data_details.education)
              ))) {
            console.log('Skipping finding with placeholder data:', finding.suspicious_username);
            continue;
          }

          // Must have a real profile URL to be actionable
          if (!finding.suspicious_profile_url || 
              !finding.suspicious_profile_url.startsWith('http') ||
              finding.suspicious_profile_url.includes('example.com')) {
            continue;
          }

          // CRITICAL: Verify at least one vault value appears in the finding
          const vaultValuesFlat = Object.values(vaultValues).flat().map(v => v.toLowerCase());
          const findingText = JSON.stringify(finding).toLowerCase();
          const hasVaultMatch = vaultValuesFlat.some(val => val && val.length > 3 && findingText.includes(val));

          if (!hasVaultMatch) {
            console.log('Skipping finding - no vault data match:', finding.suspicious_username);
            continue;
          }
          
          // Create finding record with all enhanced details
          await base44.entities.SocialMediaFinding.create({
            profile_id: profileId,
            platform: finding.platform || legitimateProfile.platform,
            finding_type: finding.finding_type,
            suspicious_username: finding.suspicious_username,
            suspicious_profile_url: finding.suspicious_profile_url || '',
            suspicious_profile_photo: finding.suspicious_profile_photo || '',
            your_profile_photo: finding.your_profile_photo || '',
            matching_photos: finding.matching_photos || [],
            photo_similarity_score: finding.photo_similarity_score || 0,
            common_friends: finding.common_friends || [],
            misused_data_details: finding.misused_data_details || {},
            similarity_score: finding.similarity_score,
            misused_data: finding.misused_data || [],
            evidence: finding.evidence,
            status: 'new',
            severity: finding.severity,
            detected_date: new Date().toISOString().split('T')[0],
            ai_recommendations: finding.ai_recommendations || []
          });

          // Create prioritized notification alert based on severity
          const alertType = finding.severity === 'critical' ? 'high_risk_alert' : 
                          finding.severity === 'high' ? 'high_risk_alert' : 'emerging_threat';
          
          await base44.entities.NotificationAlert.create({
            profile_id: profileId,
            alert_type: alertType,
            title: `${finding.severity.toUpperCase()}: ${finding.finding_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Detected`,
            message: `Potential ${finding.finding_type.replace(/_/g, ' ')} found on ${finding.platform}: @${finding.suspicious_username}. ${finding.evidence}${finding.potential_impact ? ` Impact: ${finding.potential_impact}` : ''}`,
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

    // Categorize findings by severity for summary
    const categorizedFindings = {
      critical: findings.filter(f => f.severity === 'critical'),
      high: findings.filter(f => f.severity === 'high'),
      medium: findings.filter(f => f.severity === 'medium'),
      low: findings.filter(f => f.severity === 'low')
    };

    return Response.json({
      success: true,
      findingsCount: findings.length,
      findings,
      summary: {
        total: findings.length,
        critical: categorizedFindings.critical.length,
        high: categorizedFindings.high.length,
        medium: categorizedFindings.medium.length,
        low: categorizedFindings.low.length,
        requiresImmediateAction: categorizedFindings.critical.length + categorizedFindings.high.length
      },
      message: findings.length > 0 
        ? `Found ${findings.length} threat(s): ${categorizedFindings.critical.length} critical, ${categorizedFindings.high.length} high, ${categorizedFindings.medium.length} medium, ${categorizedFindings.low.length} low`
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