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

    // Gather all user PII from vault
    const allPersonalData = await base44.asServiceRole.entities.PersonalData.list();
    const personalData = allPersonalData.filter(d => d.profile_id === profileId && d.monitoring_enabled);

    // Get social media profiles
    const allSocialProfiles = await base44.asServiceRole.entities.SocialMediaProfile.list();
    const socialProfiles = allSocialProfiles.filter(p => p.profile_id === profileId);

    // Get profile info
    const allProfiles = await base44.asServiceRole.entities.Profile.list();
    const profile = allProfiles.find(p => p.id === profileId);

    // Build comprehensive PII object
    const userPII = {
      emails: personalData.filter(d => d.data_type === 'email').map(d => d.value),
      phones: personalData.filter(d => d.data_type === 'phone').map(d => d.value),
      addresses: personalData.filter(d => d.data_type === 'address').map(d => d.value),
      fullNames: personalData.filter(d => d.data_type === 'full_name').map(d => d.value),
      usernames: personalData.filter(d => d.data_type === 'username').map(d => d.value),
      aliases: personalData.filter(d => d.data_type === 'alias').map(d => d.value),
      dob: personalData.find(d => d.data_type === 'dob')?.value,
      ssnFragment: personalData.find(d => d.data_type === 'ssn')?.value?.slice(-4),
      employers: personalData.filter(d => d.data_type === 'employer').map(d => d.value),
      relatives: personalData.filter(d => d.data_type === 'relative').map(d => d.value),
      socialHandles: socialProfiles.map(p => ({ platform: p.platform, username: p.username, url: p.profile_url })),
      profileName: profile?.name || user.full_name
    };

    // OSINT scan prompt with safety rules
    const osintPrompt = `IMPORTANT SAFETY RULES:
- Never fabricate breach data, impersonation findings, personal records, or any PII that was not explicitly found.
- Only report REAL, VERIFIABLE public data from known sources.
- If unsure about any finding, state uncertainty clearly.
- Never guess. Never invent people, platforms, or profiles.
- If no exposures are found, return empty arrays.

You are an OSINT intelligence analyst. Search for PUBLIC appearances of this person's data across:
1. People search sites (Spokeo, BeenVerified, WhitePages, TruePeopleSearch, Radaris, etc.)
2. Data broker databases (Acxiom, Epsilon, Oracle Data Cloud)
3. Public social media profiles and mentions
4. Public breach database metadata (HIBP-style, no passwords)
5. Public court/arrest record summaries
6. News/newspaper mentions
7. Forum and Reddit mentions
8. Username registrations across platforms
9. Email mentions in public pastes or leaks
10. Phone number reverse lookups

USER'S PROTECTED DATA TO SEARCH FOR:
- Emails: ${userPII.emails.join(', ') || 'none'}
- Phones: ${userPII.phones.join(', ') || 'none'}
- Names: ${userPII.fullNames.join(', ') || userPII.profileName}
- Usernames: ${userPII.usernames.join(', ') || 'none'}
- Aliases: ${userPII.aliases.join(', ') || 'none'}
- Addresses: ${userPII.addresses.join(', ') || 'none'}
- DOB: ${userPII.dob || 'not provided'}
- SSN Last 4: ${userPII.ssnFragment || 'not provided'}
- Employers: ${userPII.employers.join(', ') || 'none'}
- Social Handles: ${userPII.socialHandles.map(h => `${h.platform}:@${h.username}`).join(', ') || 'none'}

For each finding, provide:
- source_name: The website/database name
- source_url: Direct URL if available
- source_type: people_finder|data_broker|social_media|breach_database|court_record|news|forum|paste|other
- matched_fields: Array of which PII fields matched (email, phone, name, username, etc.)
- matched_values: The actual values that matched
- data_exposed: What additional data is visible at this source
- confidence: 0-100 how confident this is the same person
- severity: critical|high|medium|low
- is_impersonation: boolean - true if this appears to be someone else using the data
- explanation: Brief explanation of the finding

CRITICAL MATCHING RULES:
- Single data point (email, phone, username, SSN fragment, DOB, address) = VALID MATCH
- Name alone = ONLY VALID if 2+ other data points also match in same source
- Always verify the matched data actually appears - don't assume`;

    const osintResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: osintPrompt,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          findings: {
            type: "array",
            items: {
              type: "object",
              properties: {
                source_name: { type: "string" },
                source_url: { type: "string" },
                source_type: { type: "string" },
                matched_fields: { type: "array", items: { type: "string" } },
                matched_values: { type: "array", items: { type: "string" } },
                data_exposed: { type: "array", items: { type: "string" } },
                confidence: { type: "number" },
                severity: { type: "string" },
                is_impersonation: { type: "boolean" },
                explanation: { type: "string" }
              }
            }
          },
          scan_summary: {
            type: "object",
            properties: {
              total_sources_checked: { type: "number" },
              total_matches_found: { type: "number" },
              impersonation_alerts: { type: "number" },
              breach_exposures: { type: "number" },
              broker_listings: { type: "number" }
            }
          }
        }
      }
    });

    // Filter findings based on correlation rules
    const validFindings = (osintResult.findings || []).filter(finding => {
      // Reject placeholder/fake data
      if (!finding.source_url || finding.source_url.includes('example.com')) return false;
      if (finding.confidence < 50) return false;
      
      const matchedFields = finding.matched_fields || [];
      const hasStrongMatch = matchedFields.some(f => 
        ['email', 'phone', 'username', 'ssn', 'dob', 'address'].includes(f.toLowerCase())
      );
      
      // Name-only requires 2+ additional matches
      if (matchedFields.length === 1 && matchedFields[0].toLowerCase().includes('name')) {
        return false;
      }
      
      // Name + 1 other = still not enough
      if (matchedFields.includes('name') && matchedFields.length < 3) {
        const nonNameFields = matchedFields.filter(f => !f.toLowerCase().includes('name'));
        if (nonNameFields.length < 2) return false;
      }
      
      return hasStrongMatch || matchedFields.length >= 2;
    });

    // Call correlation engine
    const correlationResult = await base44.functions.invoke('correlateProfileData', {
      profileId,
      findings: validFindings,
      userPII
    });

    // Store findings as ScanResults
    for (const finding of validFindings) {
      await base44.asServiceRole.entities.ScanResult.create({
        profile_id: profileId,
        source_name: finding.source_name,
        source_url: finding.source_url,
        source_type: finding.source_type,
        risk_score: finding.severity === 'critical' ? 90 : finding.severity === 'high' ? 75 : finding.severity === 'medium' ? 50 : 30,
        data_exposed: finding.data_exposed || finding.matched_fields,
        status: 'new',
        scan_date: new Date().toISOString().split('T')[0],
        metadata: {
          matched_fields: finding.matched_fields,
          matched_values: finding.matched_values,
          confidence: finding.confidence,
          is_impersonation: finding.is_impersonation,
          explanation: finding.explanation,
          scan_type: 'identity_scan'
        }
      });
    }

    // Create notification if high-risk findings
    const criticalCount = validFindings.filter(f => f.severity === 'critical').length;
    const impersonationCount = validFindings.filter(f => f.is_impersonation).length;
    
    if (criticalCount > 0 || impersonationCount > 0) {
      await base44.asServiceRole.entities.NotificationAlert.create({
        profile_id: profileId,
        alert_type: 'high_risk_alert',
        title: `Identity Scan: ${criticalCount} Critical Exposures Found`,
        message: `Found ${validFindings.length} matches across web sources. ${impersonationCount} possible impersonation(s) detected.`,
        severity: criticalCount > 0 ? 'critical' : 'high',
        is_read: false
      });
    }

    return Response.json({
      success: true,
      matches: validFindings,
      threats: validFindings.filter(f => f.is_impersonation),
      evidence: validFindings.map(f => ({
        source: f.source_name,
        url: f.source_url,
        matched: f.matched_fields,
        explanation: f.explanation
      })),
      risk_score: correlationResult.data?.risk_score || 0,
      scan_timestamp: Date.now(),
      summary: {
        total_matches: validFindings.length,
        impersonations: impersonationCount,
        critical: criticalCount,
        high: validFindings.filter(f => f.severity === 'high').length,
        medium: validFindings.filter(f => f.severity === 'medium').length,
        low: validFindings.filter(f => f.severity === 'low').length
      }
    });

  } catch (error) {
    // SECURITY: Do not log full error details
    console.error('Identity scan error occurred');
    return Response.json({ error: 'An error occurred during identity scan' }, { status: 500 });
  }
});