import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// SECURITY: PII Redaction helpers
const redactEmail = (email) => {
  if (!email) return '[redacted]';
  return email.replace(/^(.)(.*)(@.+)$/, '$1***$3');
};

const redactPhone = (phone) => {
  if (!phone) return '[redacted]';
  return phone.replace(/\b(\d{3})\d{3,4}(\d{4})\b/g, '$1-***-$2');
};

const redactAddress = (address) => {
  if (!address) return '[redacted]';
  // Redact house/building numbers
  return address.replace(/^\d+\s+/g, '*** ').replace(/\s+\d+\s*$/g, ' ***');
};

const redactName = (name) => {
  if (!name) return '[redacted]';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0][0] + '.';
  return parts[0][0] + '. ' + parts.slice(1).join(' ');
};

const redactArray = (arr, redactFn) => {
  if (!Array.isArray(arr) || arr.length === 0) return [];
  return arr.map(redactFn);
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { findingId, profileId } = await req.json();

    if (!findingId) {
      return Response.json({ error: 'findingId is required' }, { status: 400 });
    }

    // Get the finding
    const allFindings = await base44.entities.SocialMediaFinding.list();
    const finding = allFindings.find(f => f.id === findingId);

    if (!finding) {
      return Response.json({ error: 'Finding not found' }, { status: 404 });
    }

    // Get user's personal data (the vault)
    const allPersonalData = await base44.entities.PersonalData.list();
    const myData = allPersonalData.filter(d => d.profile_id === (profileId || finding.profile_id));

    // Get user's social media profiles
    const allSocialProfiles = await base44.entities.SocialMediaProfile.list();
    const myProfiles = allSocialProfiles.filter(p => p.profile_id === (profileId || finding.profile_id));

    // Get profile info
    const allProfiles = await base44.entities.Profile.list();
    const profile = allProfiles.find(p => p.id === (profileId || finding.profile_id));

    const now = new Date().toISOString();
    const safe = (v) => (!v || v === '' ? '[not available]' : String(v));
    const list = (arr) => Array.isArray(arr) && arr.length > 0 ? arr.join(', ') : '[none recorded]';

    // Build user profile summary from vault data - WITH REDACTION
    const myName = myData.find(d => d.data_type === 'full_name')?.value || user.full_name;
    const myEmails = myData.filter(d => d.data_type === 'email').map(d => d.value);
    const myPhones = myData.filter(d => d.data_type === 'phone').map(d => d.value);
    const myUsernames = myData.filter(d => d.data_type === 'username').map(d => d.value);
    const myAddresses = myData.filter(d => d.data_type === 'address').map(d => d.value);
    const myEmployer = myData.find(d => d.data_type === 'employer')?.value;

    // REDACTED versions for output
    const redactedName = redactName(myName);
    const redactedEmails = redactArray(myEmails, redactEmail);
    const redactedPhones = redactArray(myPhones, redactPhone);
    const redactedAddresses = redactArray(myAddresses, redactAddress);

    // Build matched fields with redaction
    const matchedFields = {};
    const verbatimQuotes = [];
    
    if (finding.misused_data_details) {
      const details = finding.misused_data_details;
      if (details.full_name) {
        matchedFields.name = redactName(details.full_name);
        verbatimQuotes.push(`MATCHED NAME: "${redactName(details.full_name)}"`);
      }
      if (details.bio) {
        matchedFields.bio = details.bio?.substring(0, 50) + '...';
        verbatimQuotes.push(`MATCHED BIO: "${details.bio?.substring(0, 50)}..."`);
      }
      if (details.location) {
        matchedFields.location = redactAddress(details.location);
        verbatimQuotes.push(`MATCHED LOCATION: "${redactAddress(details.location)}"`);
      }
      if (details.workplace) {
        matchedFields.workplace = details.workplace;
        verbatimQuotes.push(`MATCHED EMPLOYER: "${details.workplace}"`);
      }
      if (details.education) {
        matchedFields.education = details.education;
        verbatimQuotes.push(`MATCHED EDUCATION: "${details.education}"`);
      }
      if (details.photos?.length) {
        matchedFields.photos = `${details.photos.length} photo(s)`;
        verbatimQuotes.push(`MATCHED PHOTOS: ${details.photos.length} image(s)`);
      }
      if (details.vault_matches?.length) {
        details.vault_matches.forEach(v => {
          // Redact any PII in vault matches
          let redactedMatch = v;
          if (v.includes('@')) redactedMatch = redactEmail(v);
          else if (/\d{3}.*\d{4}/.test(v)) redactedMatch = redactPhone(v);
          verbatimQuotes.push(`VAULT MATCH: ${redactedMatch}`);
        });
      }
      if (details.behavioral_red_flags?.length) {
        matchedFields.red_flags = details.behavioral_red_flags;
      }
    }

    const matchedLines = verbatimQuotes.length > 0 
      ? verbatimQuotes.map(q => `- ${q}`).join('\n')
      : '[no exact matches detected]';
    
    const identityMatchScore = finding.similarity_score || 0;

    // REDACTED LAW ENFORCEMENT EVIDENCE PACKET
    const lawEnforcementPacket = `
================================================================================
              INCÓGNITO FORENSIC EVIDENCE PACKET - LAW ENFORCEMENT
================================================================================
Case Reference: INC-${finding.id.slice(0, 8).toUpperCase()}
Generated: ${now}
Identity Match Score: ${identityMatchScore}/100
Threat Classification: ${finding.finding_type?.toUpperCase() || 'IMPERSONATION'}
Risk Level: ${finding.severity?.toUpperCase() || 'HIGH'}

================================================================================
SECTION 1: VICTIM INFORMATION (REDACTED FOR SECURITY)
================================================================================
Full Legal Name: ${redactedName}
Known Usernames/Handles: ${list(myUsernames)}
Primary Email(s): ${list(redactedEmails)}
Primary Phone(s): ${list(redactedPhones)}
Location (City, State): ${list(redactedAddresses)}
Employer: ${safe(myEmployer)}
Platforms Controlled by Victim: ${list(myProfiles.map(p => `${p.platform} (@${p.username})`))}

NOTE: Full unredacted victim information available upon legal request with proper authorization.

================================================================================
SECTION 2: SUSPECTED IMPERSONATING ACCOUNT
================================================================================
Platform: ${safe(finding.platform)}
Username/Handle: @${safe(finding.suspicious_username)}
Profile URL: ${safe(finding.suspicious_profile_url)}
Account ID: [request from platform via subpoena]

--- MATCHED CONTENT FROM SUSPICIOUS PROFILE ---
Display Name: "${safe(matchedFields.name || '[not extracted]')}"
Bio Text: "${safe(matchedFields.bio || '[not extracted]')}"
Location Shown: "${safe(matchedFields.location || '[not extracted]')}"
Workplace Listed: "${safe(matchedFields.workplace || '[not extracted]')}"

================================================================================
SECTION 3: FORENSIC MATCH ANALYSIS
================================================================================
The following data on the suspected account matches victim's protected information:

${matchedLines}

================================================================================
SECTION 4: BEHAVIORAL RED FLAGS
================================================================================
${finding.misused_data_details?.behavioral_red_flags?.length > 0 
  ? finding.misused_data_details.behavioral_red_flags.map(f => `- ${f}`).join('\n')
  : '- [no behavioral flags recorded]'}

================================================================================
SECTION 5: RECOMMENDED ACTIONS
================================================================================
- File platform report immediately
- Preserve evidence via screenshots
- Request platform data preservation
- Consider filing police report

================================================================================
This evidence packet was generated by INCÓGNITO Privacy Guardian.
PII has been redacted. Full details available upon authorized legal request.
================================================================================
`.trim();

    // REDACTED ATTORNEY BRIEFING PACKET
    const attorneyPacket = `
================================================================================
              INCÓGNITO FORENSIC EVIDENCE PACKET - ATTORNEY BRIEFING
================================================================================
Case Reference: INC-${finding.id.slice(0, 8).toUpperCase()}
Generated: ${now}
Identity Match Score: ${identityMatchScore}/100

================================================================================
SECTION 1: CLIENT INFORMATION (REDACTED)
================================================================================
Full Legal Name: ${redactedName}
Contact Email(s): ${list(redactedEmails)}
Contact Phone(s): ${list(redactedPhones)}
Location: ${list(redactedAddresses)}

NOTE: Full unredacted client information available in secure client file.

================================================================================
SECTION 2: IMPERSONATING ACCOUNT DETAILS
================================================================================
Platform: ${safe(finding.platform)}
Profile URL: ${safe(finding.suspicious_profile_url)}
Username/Handle: @${safe(finding.suspicious_username)}

================================================================================
SECTION 3: EVIDENCE SUMMARY
================================================================================
${matchedLines}

================================================================================
SECTION 4: RECOMMENDED LEGAL THEORIES
================================================================================
□ State identity theft statute
□ Misappropriation of name/likeness
□ False light invasion of privacy
□ Intentional infliction of emotional distress

================================================================================
SECTION 5: PLATFORM REPORTING
================================================================================
${getPlatformReportInfo(finding.platform)}

================================================================================
This briefing was generated by INCÓGNITO Privacy Guardian.
PII redacted for security. Full details in secure client file.
================================================================================
`.trim();

    return Response.json({
      success: true,
      findingId,
      caseReference: `INC-${finding.id.slice(0, 8).toUpperCase()}`,
      lawEnforcementPacket,
      attorneyPacket,
      packets: {
        law_enforcement: lawEnforcementPacket,
        attorney: attorneyPacket
      },
      // REDACTED structured data
      structured: {
        victim: {
          legal_name: redactedName,
          emails: redactedEmails,
          phones: redactedPhones,
          usernames: myUsernames,
          addresses: redactedAddresses,
          owned_platforms: myProfiles.map(p => `${p.platform} (@${p.username})`)
        },
        suspect: {
          platform: finding.platform,
          username: finding.suspicious_username,
          profile_url: finding.suspicious_profile_url,
          display_name: matchedFields.name,
          first_seen_utc: finding.detected_date || finding.created_date
        },
        matches: matchedFields
      },
      generatedAt: now,
      redacted: true
    });

  } catch (error) {
    console.error('Evidence packet generation error');
    return Response.json({ 
      error: 'Failed to generate evidence packet',
      details: 'An error occurred during processing'
    }, { status: 500 });
  }
});

function getPlatformReportInfo(platform) {
  const info = {
    instagram: `Report URL: https://help.instagram.com/contact/636276399721841`,
    facebook: `Report URL: https://www.facebook.com/help/contact/169486816475808`,
    twitter: `Report URL: https://help.twitter.com/forms/impersonation`,
    linkedin: `Report URL: https://www.linkedin.com/help/linkedin/ask/TS-NFPI`,
    tiktok: `Report URL: https://www.tiktok.com/legal/report/privacy`,
    youtube: `Report URL: https://support.google.com/youtube/answer/2801947`,
  };
  return info[platform?.toLowerCase()] || `Contact ${platform || 'the platform'} support directly.`;
}