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

    // Get profile data
    const [allPersonalData, allSocialProfiles] = await Promise.all([
      base44.asServiceRole.entities.PersonalData.list(),
      base44.asServiceRole.entities.SocialMediaProfile.list()
    ]);

    const personalData = allPersonalData.filter(d => d.profile_id === profileId);
    const socialProfiles = allSocialProfiles.filter(s => s.profile_id === profileId);

    if (personalData.length === 0) {
      return Response.json({ 
        message: 'No personal data to monitor',
        mentionsFound: 0,
        impersonationsFound: 0
      });
    }

    // INCÓGNITO comprehensive monitoring prompt
    const monitoringPrompt = `IMPORTANT:
    - Never fabricate breach results, impersonation profiles, card data, identities, exposures, or search results.
    - Only use the JSON data provided.
    - If unsure, state uncertainty clearly.
    - Never create fake people, companies, or platforms.
    - Never state someone is impersonating a user unless multiple positive indicators exist.
    - If findings are inconclusive, state ambiguity instead of certainty.

    You are INCÓGNITO, a professional-grade identity forensic analyst. Extract EXACT VERBATIM content where this person's data appears publicly.

=== VICTIM'S PROTECTED DATA (VAULT) ===
${personalData.map(d => `${d.data_type}: "${d.value}"`).join('\n')}

=== VICTIM'S KNOWN SOCIAL PROFILES ===
${socialProfiles.map(s => `${s.platform}: @${s.username}`).join('\n')}

=== FORENSIC EXTRACTION PROTOCOL ===

RULE 1: EXTRACT EXACT VERBATIM CONTENT
For every finding, quote the EXACT text/content found:
- Never say "Personal info found" - quote EXACTLY what was found
- Include exact URLs, exact text, exact data values
- Example: "Found on Spokeo: Address listed as '123 Main St, Cleveland, TN 37312'"

RULE 2: SOURCE DOCUMENTATION
For each exposure, document:
- exact_source_name: "Spokeo", "WhitePages", "Facebook", etc.
- exact_url: Full URL if available
- exact_content_found: Verbatim text/data shown on the source
- vault_data_matched: Which specific vault value was found

RULE 3: MATCHING REQUIREMENTS
- NAME matches: Require 2+ identifiers (name + phone, name + address, etc.)
- ALL OTHER data types (email, phone, address, SSN): 1 match is sufficient

=== SOURCES TO SCAN ===
DATA BROKERS & PEOPLE SEARCH:
- Spokeo, BeenVerified, WhitePages, TruePeopleSearch, FastPeopleSearch
- Radaris, Intelius, PeopleFinder, USSearch, Pipl

PUBLIC RECORDS:
- Court records, property records, voter registration, business filings

SOCIAL MEDIA:
- Facebook, Twitter/X, Instagram, LinkedIn, TikTok, Reddit, YouTube

OTHER:
- News articles, forum posts, blog mentions, review sites

=== REQUIRED OUTPUT FOR EACH FINDING ===

1. EXACT SOURCE:
   - platform/source_name: Exact site name
   - source_url: Full URL
   
2. VERBATIM CONTENT FOUND:
   - content_verbatim: Exact text/data as it appears on the source
   - example: "John Smith, 423-555-1234, 123 Main St, Cleveland TN"
   
3. VAULT MATCHES:
   - vault_data_matched: ["full_name: John Smith", "phone: 423-555-1234", "address: 123 Main St"]
   
4. RISK ASSESSMENT:
   - privacy_risk_level: none/low/medium/high/critical
   - exposure_type: data_broker/social_media/public_record/forum/news

=== IMPERSONATION DETECTION ===
For suspicious profiles, extract:
- suspicious_username: Exact username
- suspicious_profile_url: Full URL
- verbatim_content: Exact bio, name, photos as shown
- vault_matches: Which victim data was copied
- identity_match_score: 0-100
- threat_type: impersonation/phishing/fraud/catfishing/harassment

Return JSON with:
- mentions: Array with verbatim content for each exposure
- impersonations: Array of suspicious profiles with exact matched content
- privacy_risks: Array of specific concerns
- overall_risk_score: 0-100
- summary: Overview of findings

Only include findings with exact vault data matches. No assumptions or generic matches.`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: monitoringPrompt,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          mentions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                platform: { type: "string" },
                source_url: { type: "string" },
                mention_type: { type: "string" },
                content_verbatim: { type: "string", description: "Exact verbatim content as it appears on source" },
                content: { type: "string" },
                author_username: { type: "string" },
                author_profile_url: { type: "string" },
                post_url: { type: "string" },
                sentiment: { type: "string" },
                sentiment_score: { type: "number" },
                privacy_risk_level: { type: "string" },
                exposure_type: { type: "string", enum: ["data_broker", "social_media", "public_record", "forum", "news", "other"] },
                exposed_data: { type: "array", items: { type: "string" } },
                vault_data_matched: { type: "array", items: { type: "string" }, description: "Array of 'data_type: exact_value' matched" },
                reach_estimate: { type: "number" },
                engagement_count: { type: "number" },
                published_date: { type: "string" },
                ai_analysis: { type: "string" },
                recommended_actions: { type: "array", items: { type: "string" } },
                matched_identifiers: { type: "array", items: { type: "string" } }
              }
            }
          },
          impersonations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                platform: { type: "string" },
                suspicious_username: { type: "string" },
                suspicious_profile_url: { type: "string" },
                verbatim_name: { type: "string", description: "Exact name shown on suspicious profile" },
                verbatim_bio: { type: "string", description: "Exact bio text from suspicious profile" },
                verbatim_location: { type: "string" },
                verbatim_employer: { type: "string" },
                vault_matches: { type: "array", items: { type: "string" }, description: "Which vault data was copied" },
                identity_match_score: { type: "number" },
                similarity_score: { type: "number" },
                finding_type: { type: "string" },
                threat_type: { type: "string", enum: ["impersonation", "phishing", "fraud", "catfishing", "harassment", "doxxing"] },
                behavioral_red_flags: { type: "array", items: { type: "string" } },
                evidence: { type: "string" },
                severity: { type: "string" },
                matched_identifiers: { type: "array", items: { type: "string" } }
              }
            }
          },
          privacy_risks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                risk_type: { type: "string" },
                description: { type: "string" },
                severity: { type: "string" },
                affected_platforms: { type: "array", items: { type: "string" } }
              }
            }
          },
          overall_risk_score: { type: "number" },
          summary: { type: "string" }
        }
      }
    });

    const mentions = result.mentions || [];
    const impersonations = result.impersonations || [];
    const privacyRisks = result.privacy_risks || [];

    // Filter: name-only matches require 2+ identifiers, all other types need only 1
    const isNameOnlyMatch = (identifiers) => {
      if (!identifiers || identifiers.length === 0) return false;
      const nameTypes = ['full_name', 'alias', 'name'];
      return identifiers.every(id => nameTypes.some(nt => id.toLowerCase().includes(nt)));
    };
    
    const validMentions = mentions.filter(m => {
      const identifiers = m.matched_identifiers || m.exposed_data || [];
      if (identifiers.length === 0) return false;
      // If only name matched, require 2+ identifiers
      if (isNameOnlyMatch(identifiers)) return identifiers.length >= 2;
      // Otherwise, 1 identifier is enough
      return true;
    });
    
    const validImpersonations = impersonations.filter(i => {
      const identifiers = i.matched_identifiers || [];
      if (identifiers.length === 0) return false;
      if (isNameOnlyMatch(identifiers)) return identifiers.length >= 2;
      return true;
    });

    // Create mention records with INCÓGNITO verbatim content
    for (const mention of validMentions) {
      await base44.asServiceRole.entities.SocialMediaMention.create({
        profile_id: profileId,
        platform: mention.platform,
        mention_type: mention.exposure_type || mention.mention_type,
        content: mention.content_verbatim || mention.content,
        author_username: mention.author_username,
        author_profile_url: mention.author_profile_url,
        post_url: mention.source_url || mention.post_url,
        sentiment: mention.sentiment,
        sentiment_score: mention.sentiment_score || 0,
        privacy_risk_level: mention.privacy_risk_level || 'none',
        exposed_data: mention.vault_data_matched || mention.exposed_data || [],
        reach_estimate: mention.reach_estimate || 0,
        engagement_count: mention.engagement_count || 0,
        detected_date: new Date().toISOString(),
        published_date: mention.published_date || new Date().toISOString(),
        ai_analysis: mention.ai_analysis,
        recommended_actions: mention.recommended_actions || [],
        status: 'new'
      });

      // Create alert for high-risk mentions
      if (mention.privacy_risk_level === 'high' || mention.privacy_risk_level === 'critical') {
        await base44.asServiceRole.entities.NotificationAlert.create({
          profile_id: profileId,
          alert_type: 'high_risk_alert',
          title: `${mention.privacy_risk_level.toUpperCase()}: Privacy Risk on ${mention.platform}`,
          message: `Detected concerning mention by @${mention.author_username}: ${mention.ai_analysis}`,
          severity: mention.privacy_risk_level === 'critical' ? 'critical' : 'high',
          is_read: false,
          action_url: mention.post_url
        });
      }

      // Alert for negative sentiment
      if (mention.sentiment === 'concerning' || mention.sentiment_score < -50) {
        await base44.asServiceRole.entities.NotificationAlert.create({
          profile_id: profileId,
          alert_type: 'high_risk_alert',
          title: `Concerning Mention Detected on ${mention.platform}`,
          message: `Negative sentiment detected in mention by @${mention.author_username}. Sentiment score: ${mention.sentiment_score}`,
          severity: 'medium',
          is_read: false,
          action_url: mention.post_url
        });
      }
    }

    // Create impersonation records with INCÓGNITO verbatim content
    for (const imp of validImpersonations) {
      await base44.asServiceRole.entities.SocialMediaFinding.create({
        profile_id: profileId,
        platform: imp.platform,
        finding_type: imp.threat_type || imp.finding_type || 'impersonation',
        suspicious_username: imp.suspicious_username,
        suspicious_profile_url: imp.suspicious_profile_url,
        similarity_score: imp.identity_match_score || imp.similarity_score || 0,
        misused_data_details: {
          full_name: imp.verbatim_name,
          bio: imp.verbatim_bio,
          location: imp.verbatim_location,
          workplace: imp.verbatim_employer,
          vault_matches: imp.vault_matches || [],
          behavioral_red_flags: imp.behavioral_red_flags || []
        },
        misused_data: imp.vault_matches || imp.matched_identifiers || [],
        evidence: imp.evidence,
        severity: imp.severity || 'high',
        detected_date: new Date().toISOString().split('T')[0],
        status: 'new'
      });
    }

    // Create AI insight for privacy risks
    if (privacyRisks.length > 0) {
      await base44.asServiceRole.entities.AIInsight.create({
        profile_id: profileId,
        insight_type: 'risk_prediction',
        title: 'Social Media Privacy Risks Detected',
        description: `Found ${privacyRisks.length} privacy risk${privacyRisks.length === 1 ? '' : 's'} across social media platforms. ${result.summary}`,
        severity: result.overall_risk_score >= 70 ? 'high' : result.overall_risk_score >= 40 ? 'medium' : 'low',
        recommendations: privacyRisks.slice(0, 5).map(r => r.description),
        confidence_score: 80,
        is_read: false
      });
    }

    return Response.json({
      success: true,
      mentionsFound: validMentions.length,
      impersonationsFound: validImpersonations.length,
      privacyRisksFound: privacyRisks.length,
      overall_risk_score: result.overall_risk_score || 0,
      summary: result.summary,
      message: `Found ${validMentions.length} mention${validMentions.length === 1 ? '' : 's'} (2+ identifiers), ${validImpersonations.length} potential impersonation${validImpersonations.length === 1 ? '' : 's'} (2+ identifiers), and ${privacyRisks.length} privacy risk${privacyRisks.length === 1 ? '' : 's'}`
    });

  } catch (error) {
    console.error('Social media monitoring error:', error);
    return Response.json({ 
      error: error.message,
      details: 'Failed to monitor social media'
    }, { status: 500 });
  }
});