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

      const prompt = `IMPORTANT SAFETY RULES:
- NEVER fabricate breach data, impersonation findings, exposures, or personal details.
- NEVER invent platforms, people, websites, or records.
- NEVER guess. If unsure, explicitly say 'uncertain.'
- ONLY use the JSON evidence provided.
- If a detail is not present in the evidence, DO NOT add it.
- If no impersonation is found, return an empty findings array.

You are INCÓGNITO, a professional-grade identity forensic analyst. Your mission: find accounts using THIS SPECIFIC USER'S data and extract EXACT VERBATIM evidence.

=== VICTIM'S LEGITIMATE PROFILE ===
Platform: ${legitimateProfile.platform}
Username: @${legitimateProfile.username}
Profile URL: ${legitimateProfile.profile_url || 'Not provided'}

=== VICTIM'S EXACT PERSONAL DATA (VAULT) ===
${Object.entries(vaultValues).map(([type, values]) => `${type}: "${values.join('", "')}"`).join('\n')}

=== FORENSIC MATCHING PROTOCOL ===

RULE 1: EXTRACT EXACT VERBATIM CONTENT
- Never say "Suspicious bio text" - quote the EXACT bio: "Matched Bio: 'Retired cardiac nurse | father | minister'"
- Never say "Uses similar name" - quote EXACTLY: "Matched Name: 'John A. Smith'"
- Quote exact usernames, URLs, locations, workplaces, education, captions, hashtags

RULE 2: IDENTITY MATCH SCORE (0-100)
Calculate based on:
- Exact name match: +30 points
- Exact photo match: +25 points
- Exact bio/description match: +20 points
- Exact location match: +10 points
- Exact employer/education match: +10 points
- Username similarity: +5 points

RULE 3: THREAT CLASSIFICATION
Determine likely intent:
- IMPERSONATION: Pretending to be the victim
- PHISHING: Using victim's identity to scam others
- FRAUD: Financial exploitation using victim's data
- CATFISHING: Romance/relationship scam
- BRAND_THEFT: Stealing professional reputation
- HARASSMENT: Defamation or stalking
- DOXXING: Exposing private information

RULE 4: BEHAVIORAL RED FLAGS
Document if present:
- Burner account (new, low activity)
- Boosted/fake follower metrics
- Copied photos from victim
- Similar bio structure
- Cross-platform coordination

=== REQUIRED OUTPUT FOR EACH FINDING ===

1. MATCHED DATA (EXACT COPIES):
   - matched_name: "Exact name text from suspicious profile"
   - matched_bio: "Exact bio text from suspicious profile"
   - matched_photos: [array of exact photo URLs]
   - matched_location: "Exact location text"
   - matched_employer: "Exact employer text"
   - matched_education: "Exact education text"
   - matched_usernames: [array of exact usernames]

2. VAULT MATCHES (which victim data was copied):
   - vault_matches: [array of "data_type: exact_value" that matched]

3. IDENTITY MATCH SCORE: 0-100

4. THREAT CLASSIFICATION:
   - threat_type: impersonation/phishing/fraud/catfishing/brand_theft/harassment/doxxing
   - risk_level: critical/high/medium/low
   - behavioral_red_flags: [array of observed red flags]

5. EVIDENCE SUMMARY:
   - Verbatim quotes proving the match
   - URLs to suspicious content
   - Timestamps if available

CRITICAL: Only return findings with Identity Match Score >= 60 and at least one EXACT vault value match. No generic or assumed matches.`;

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
                  finding_type: { type: "string", enum: ["impersonation", "data_misuse", "unauthorized_profile", "stolen_content", "identity_theft", "phishing", "fraud", "catfishing", "brand_theft", "harassment", "doxxing"] },
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
                  // INCÓGNITO: Exact verbatim matched content
                  matched_data_verbatim: {
                    type: "object",
                    properties: {
                      matched_name: { type: "string", description: "Exact name text from suspicious profile" },
                      matched_bio: { type: "string", description: "Exact bio text from suspicious profile" },
                      matched_photos: { type: "array", items: { type: "string" } },
                      matched_location: { type: "string", description: "Exact location text" },
                      matched_employer: { type: "string", description: "Exact employer text" },
                      matched_education: { type: "string", description: "Exact education text" },
                      matched_usernames: { type: "array", items: { type: "string" } }
                    }
                  },
                  vault_matches: { type: "array", items: { type: "string" }, description: "Array of 'data_type: exact_value' that matched" },
                  identity_match_score: { type: "number", description: "0-100 forensic match score" },
                  threat_type: { type: "string", enum: ["impersonation", "phishing", "fraud", "catfishing", "brand_theft", "harassment", "doxxing"] },
                  behavioral_red_flags: { type: "array", items: { type: "string" } },
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
            // SECURITY: Do not log usernames
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
            // SECURITY: Do not log usernames
            continue;
          }
          
          // Create finding record with INCÓGNITO enhanced forensic details
          await base44.entities.SocialMediaFinding.create({
            profile_id: profileId,
            platform: finding.platform || legitimateProfile.platform,
            finding_type: finding.threat_type || finding.finding_type,
            suspicious_username: finding.suspicious_username,
            suspicious_profile_url: finding.suspicious_profile_url || '',
            suspicious_profile_photo: finding.suspicious_profile_photo || '',
            your_profile_photo: finding.your_profile_photo || '',
            matching_photos: finding.matching_photos || [],
            photo_similarity_score: finding.photo_similarity_score || 0,
            common_friends: finding.common_friends || [],
            misused_data_details: {
              ...(finding.misused_data_details || {}),
              // INCÓGNITO: Add verbatim matched content
              full_name: finding.matched_data_verbatim?.matched_name || finding.misused_data_details?.full_name,
              bio: finding.matched_data_verbatim?.matched_bio || finding.misused_data_details?.bio,
              location: finding.matched_data_verbatim?.matched_location || finding.misused_data_details?.location,
              workplace: finding.matched_data_verbatim?.matched_employer || finding.misused_data_details?.workplace,
              education: finding.matched_data_verbatim?.matched_education || finding.misused_data_details?.education,
              photos: finding.matched_data_verbatim?.matched_photos || finding.misused_data_details?.photos || [],
              vault_matches: finding.vault_matches || [],
              behavioral_red_flags: finding.behavioral_red_flags || []
            },
            similarity_score: finding.identity_match_score || finding.similarity_score,
            misused_data: finding.vault_matches || finding.misused_data || [],
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
    // SECURITY: Do not log full error details
    console.error('Impersonation check error occurred');
    return Response.json({ 
      error: 'Failed to check for social media impersonation',
      details: 'An error occurred during impersonation check'
    }, { status: 500 });
  }
});