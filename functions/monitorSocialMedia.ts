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

    // Build comprehensive monitoring prompt
    const monitoringPrompt = `You are an advanced social media monitoring AI. Search for REAL, PUBLICLY AVAILABLE information about this person across the internet.

Personal Data to Search For:
${personalData.map(d => `${d.data_type}: ${d.value}`).join('\n')}

Known Social Profiles:
${socialProfiles.map(s => `${s.platform}: @${s.username}`).join('\n')}

CRITICAL INSTRUCTIONS:
1. Search the web for this person's data appearing on people search sites, data brokers, social media, forums, etc.
2. Report what you find indexed publicly - include site names, what data appears there, and URLs if available
3. For social media, report the platforms where this person's info appears publicly
4. Be thorough - check Spokeo, BeenVerified, WhitePages, TruePeopleSearch, Radaris, etc.
5. If data appears on a site but you don't have exact URL, still report the finding with the site name

MATCHING RULES:
- For NAME matches (full_name, alias): Require AT LEAST TWO (2) identifiers to prevent false positives from common names
- For ALL OTHER data types (email, phone, address, SSN, etc.): Only ONE (1) identifier match is sufficient

Examples:
- ✓ VALID: Post contains user's email address (1 match is enough for email)
- ✓ VALID: Profile shows user's phone number (1 match is enough for phone)
- ✓ VALID: Content reveals user's address (1 match is enough for address)
- ✓ VALID: Full name + any other identifier (2 matches required for name)
- ✗ INVALID: Only mentions a common name without other identifiers

COMPREHENSIVE MONITORING TASKS:

1. MENTION DETECTION - Find all mentions across platforms:
   - Direct mentions (@username, name tags)
   - Indirect references (talking about the person without tagging)
   - Photo/video appearances
   - Comments and shares
   
2. SENTIMENT ANALYSIS - For each mention, analyze:
   - Overall sentiment (positive, neutral, negative, concerning)
   - Sentiment score (-100 to 100)
   - Emotional tone and context
   
3. PRIVACY RISK ASSESSMENT - Identify:
   - Personal data being shared without consent
   - Location reveals and check-ins
   - Photos/videos with private information visible
   - Contact details being shared
   - Financial information exposure
   
4. IMPERSONATION DETECTION - Look for:
   - Fake profiles using this person's name/photos
   - Accounts claiming to be this person
   - Unauthorized use of identity
   - Catfishing attempts
   
5. UNAUTHORIZED DATA USE - Detect:
   - Photos/videos used without permission
   - Personal information being sold/shared
   - Data being used for doxxing
   - Information in data broker listings

PLATFORMS & SOURCES TO SEARCH:
- Social Media: Facebook, Twitter/X, Instagram, LinkedIn, TikTok, Reddit, YouTube, Pinterest
- People Search Sites: Spokeo, BeenVerified, WhitePages, TruePeopleSearch, FastPeopleSearch
- Public Records: Court records, property records, voter registration
- Forums & Communities: Reddit posts, forum mentions, community discussions
- Professional Sites: LinkedIn profiles, company directories, business listings
- Other: News articles, blog mentions, review sites

IMPORTANT: Report all publicly indexed appearances of this person's data. Include site names and as much detail as available. Focus on data broker sites, people search engines, and public records where personal info commonly appears.

For EACH finding, include a "matched_identifiers" field listing which specific data types matched.

Return JSON with:
- mentions: array of detected mentions with full details
- impersonations: array of suspicious accounts/profiles
- privacy_risks: array of specific privacy concerns found
- overall_risk_score: 0-100
- summary: brief overview of findings

Only include real findings with confidence >= 65%. Remember: name matches require 2+ identifiers, all other data types require only 1.`;

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
                mention_type: { type: "string" },
                content: { type: "string" },
                author_username: { type: "string" },
                author_profile_url: { type: "string" },
                post_url: { type: "string" },
                sentiment: { type: "string" },
                sentiment_score: { type: "number" },
                privacy_risk_level: { type: "string" },
                exposed_data: { type: "array", items: { type: "string" } },
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
                similarity_score: { type: "number" },
                finding_type: { type: "string" },
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

    // Create mention records
    for (const mention of validMentions) {
      await base44.asServiceRole.entities.SocialMediaMention.create({
        profile_id: profileId,
        platform: mention.platform,
        mention_type: mention.mention_type,
        content: mention.content,
        author_username: mention.author_username,
        author_profile_url: mention.author_profile_url,
        post_url: mention.post_url,
        sentiment: mention.sentiment,
        sentiment_score: mention.sentiment_score || 0,
        privacy_risk_level: mention.privacy_risk_level || 'none',
        exposed_data: mention.exposed_data || [],
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

    // Create impersonation records
    for (const imp of validImpersonations) {
      await base44.asServiceRole.entities.SocialMediaFinding.create({
        profile_id: profileId,
        platform: imp.platform,
        finding_type: imp.finding_type || 'impersonation',
        suspicious_username: imp.suspicious_username,
        suspicious_profile_url: imp.suspicious_profile_url,
        similarity_score: imp.similarity_score || 0,
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