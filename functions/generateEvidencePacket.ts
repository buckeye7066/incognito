import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

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

    // Build user profile summary from vault data
    const myName = myData.find(d => d.data_type === 'full_name')?.value || user.full_name;
    const myEmails = myData.filter(d => d.data_type === 'email').map(d => d.value);
    const myPhones = myData.filter(d => d.data_type === 'phone').map(d => d.value);
    const myUsernames = myData.filter(d => d.data_type === 'username').map(d => d.value);
    const myAddresses = myData.filter(d => d.data_type === 'address').map(d => d.value);
    const myEmployer = myData.find(d => d.data_type === 'employer')?.value;

    // Build matched fields from finding data
    const matchedFields = {};
    if (finding.misused_data_details) {
      const details = finding.misused_data_details;
      if (details.full_name) matchedFields.name = details.full_name;
      if (details.bio) matchedFields.bio = details.bio;
      if (details.location) matchedFields.location = details.location;
      if (details.workplace) matchedFields.workplace = details.workplace;
      if (details.education) matchedFields.education = details.education;
      if (details.photos?.length) matchedFields.photos = `${details.photos.length} image(s)`;
    }
    if (finding.misused_data?.length) {
      finding.misused_data.forEach(d => {
        if (!matchedFields[d.toLowerCase()]) {
          matchedFields[d.toLowerCase().replace(/ /g, '_')] = 'matched';
        }
      });
    }

    const matchedLines = Object.keys(matchedFields).length > 0 
      ? Object.entries(matchedFields).map(([field, value]) => `- ${field}: ${Array.isArray(value) ? value.join(', ') : value}`).join('\n')
      : '[no exact matches detected]';

    // LAW ENFORCEMENT PACKET
    const lawEnforcementPacket = `
================================================================================
EVIDENCE SUMMARY – SUSPECTED ONLINE IMPERSONATION / POSSIBLE IDENTITY THEFT
================================================================================
Generated: ${now}
Case Reference: INC-${finding.id.slice(0, 8).toUpperCase()}

--------------------------------------------------------------------------------
1. REPORTING VICTIM (COMPLAINANT)
--------------------------------------------------------------------------------
Full Legal Name: ${safe(myName)}
Known Usernames/Handles: ${list(myUsernames.length ? myUsernames : myProfiles.map(p => '@' + p.username))}
Primary Email(s): ${list(myEmails)}
Primary Phone(s): ${list(myPhones)}
Location: ${list(myAddresses)}
Platforms Controlled by Victim: ${list(myProfiles.map(p => `${p.platform} (@${p.username})`))}

--------------------------------------------------------------------------------
2. SUSPECTED IMPERSONATING ACCOUNT
--------------------------------------------------------------------------------
Platform: ${safe(finding.platform)}
Profile Name/Display Name: ${safe(finding.misused_data_details?.full_name)}
Username/Handle: @${safe(finding.suspicious_username)}
Profile URL: ${safe(finding.suspicious_profile_url)}
Location Shown on Profile: ${safe(finding.misused_data_details?.location)}
Bio Text: ${safe(finding.misused_data_details?.bio)}
Workplace Listed: ${safe(finding.misused_data_details?.workplace)}
Education Listed: ${safe(finding.misused_data_details?.education)}

--------------------------------------------------------------------------------
3. EXACT MATCHING IDENTIFIERS (COPIED FROM VICTIM)
--------------------------------------------------------------------------------
The following identifiers on the suspected account match data supplied by victim:

${matchedLines}

Match Confidence Score: ${finding.similarity_score || 'N/A'}%
Finding Type: ${finding.finding_type?.replace(/_/g, ' ').toUpperCase()}
Severity: ${finding.severity?.toUpperCase()}

--------------------------------------------------------------------------------
4. DIGITAL EVIDENCE & DOCUMENTATION
--------------------------------------------------------------------------------
Date First Detected: ${finding.detected_date || finding.created_date}
Evidence Description: ${safe(finding.evidence)}
${finding.suspicious_profile_photo ? `Profile Photo URL: ${finding.suspicious_profile_photo}` : ''}
${finding.matching_photos?.length ? `Matching Photos: ${finding.matching_photos.join(', ')}` : ''}

IMPORTANT: Screenshots should be captured immediately as evidence. 
Recommended: Use archive.org Wayback Machine to create timestamped archive.

--------------------------------------------------------------------------------
5. HARM / RISK ASSESSMENT
--------------------------------------------------------------------------------
Nature of Impersonation: Profile appears to use victim's name, likeness, and/or biographical details.
Severity Level: ${finding.severity?.toUpperCase()}
${finding.ai_recommendations?.length ? `
AI-Assessed Risks:
${finding.ai_recommendations.map(r => `- ${r}`).join('\n')}
` : ''}

--------------------------------------------------------------------------------
6. RECOMMENDED IMMEDIATE ACTIONS
--------------------------------------------------------------------------------
1. Screenshot all pages of the impersonating account immediately
2. Report to platform (${finding.platform}) using their impersonation report form
3. File report with FTC at IdentityTheft.gov
4. Consider filing local police report for identity theft
5. Document any contacts or messages received referencing the fake account

================================================================================
This report was generated by Incognito Privacy Guardian based on automated
detection and data supplied by the victim. All information should be verified.
================================================================================
`.trim();

    // ATTORNEY BRIEFING PACKET
    const attorneyPacket = `
================================================================================
ATTORNEY BRIEFING PACKET – ONLINE IMPERSONATION / IDENTITY MISUSE
================================================================================
Generated: ${now}
Matter Reference: INC-${finding.id.slice(0, 8).toUpperCase()}
PRIVILEGED AND CONFIDENTIAL - ATTORNEY WORK PRODUCT

--------------------------------------------------------------------------------
1. CLIENT INFORMATION
--------------------------------------------------------------------------------
Client Name: ${safe(myName)}
Contact Email(s): ${list(myEmails)}
Contact Phone(s): ${list(myPhones)}
Location: ${list(myAddresses)}

Legitimate Social Media Presence:
${myProfiles.map(p => `- ${p.platform}: @${p.username} (${p.profile_url || 'URL not recorded'})`).join('\n') || '- [No profiles registered]'}

--------------------------------------------------------------------------------
2. INCIDENT SUMMARY
--------------------------------------------------------------------------------
An account on ${finding.platform} has been identified using client's personal 
information without authorization. Detection confidence: ${finding.similarity_score || 'N/A'}%.

Impersonating Account Details:
- Platform: ${finding.platform}
- Username: @${finding.suspicious_username}
- URL: ${finding.suspicious_profile_url || '[not captured]'}
- First Detected: ${finding.detected_date || finding.created_date}

--------------------------------------------------------------------------------
3. EVIDENCE OF MISAPPROPRIATION
--------------------------------------------------------------------------------
The following client data appears on the unauthorized account:

${matchedLines}

Supporting Evidence:
${safe(finding.evidence)}

--------------------------------------------------------------------------------
4. POTENTIAL LEGAL THEORIES
--------------------------------------------------------------------------------
Based on the facts presented, the following causes of action may be available:

A. FEDERAL CLAIMS:
   - Lanham Act § 43(a) (15 U.S.C. § 1125(a)) - False designation of origin
   - Computer Fraud and Abuse Act (18 U.S.C. § 1030) - If unauthorized access involved
   - CAN-SPAM Act - If commercial emails sent using client's identity

B. STATE CLAIMS (jurisdiction dependent):
   - Right of Publicity / Misappropriation of Likeness
   - False Light Invasion of Privacy
   - Intentional Infliction of Emotional Distress
   - Fraud / Fraudulent Misrepresentation
   - Unfair Competition
   - Identity Theft (criminal referral)

C. PLATFORM TERMS OF SERVICE:
   - Violation of ${finding.platform} Terms of Service
   - DMCA takedown for copyrighted photos

--------------------------------------------------------------------------------
5. DAMAGES ASSESSMENT
--------------------------------------------------------------------------------
Potential damages categories to investigate:

□ Actual Damages:
  - Lost business opportunities
  - Cost of remediation efforts
  - Credit monitoring expenses
  - Professional reputation damage

□ Statutory Damages:
  - State identity theft statutes (varies by jurisdiction)
  - Right of publicity statutes

□ Punitive Damages:
  - If willful and malicious conduct can be proven

□ Injunctive Relief:
  - Immediate takedown of impersonating account
  - Prohibition on future use of client's identity

--------------------------------------------------------------------------------
6. RECOMMENDED NEXT STEPS
--------------------------------------------------------------------------------
1. Preserve all evidence (screenshots, archives, communications)
2. Send cease and desist to identifiable parties
3. File DMCA takedown for any copyrighted materials
4. Subpoena platform for account holder information
5. Consider emergency TRO if ongoing harm
6. Evaluate jurisdiction for filing

--------------------------------------------------------------------------------
7. PLATFORM-SPECIFIC REMEDIES
--------------------------------------------------------------------------------
${finding.platform?.toUpperCase()} IMPERSONATION REPORT:
${getPlatformReportInfo(finding.platform)}

================================================================================
DISCLAIMER: This packet is generated for informational purposes. Attorney should
independently verify all facts and assess applicable law in relevant jurisdiction.
================================================================================
`.trim();

    return Response.json({
      success: true,
      findingId,
      caseReference: `INC-${finding.id.slice(0, 8).toUpperCase()}`,
      lawEnforcementPacket,
      attorneyPacket,
      matchedFields,
      generatedAt: now
    });

  } catch (error) {
    console.error('Evidence packet generation error:', error);
    return Response.json({ 
      error: error.message,
      details: 'Failed to generate evidence packet'
    }, { status: 500 });
  }
});

function getPlatformReportInfo(platform) {
  const info = {
    instagram: `Report URL: https://help.instagram.com/contact/636276399721841
- Select "Someone created an account pretending to be me or someone I know"
- Provide your ID and the fake account URL`,
    facebook: `Report URL: https://www.facebook.com/help/contact/169486816475808
- Use "Report an Imposter Account" form
- May require government ID verification`,
    twitter: `Report URL: https://help.twitter.com/forms/impersonation
- File under "Impersonation"
- Provide both your account and the impersonating account`,
    linkedin: `Report URL: https://www.linkedin.com/help/linkedin/ask/TS-NFPI
- Report through "Report/Block" on the fake profile
- Or contact LinkedIn Trust & Safety directly`,
    tiktok: `Report URL: In-app reporting or https://www.tiktok.com/legal/report/privacy
- Select "Impersonation" as report reason
- Provide evidence of your identity`,
    youtube: `Report URL: https://support.google.com/youtube/answer/2801947
- Use "Report user" > "Impersonation"
- Provide channel URLs`,
  };
  return info[platform?.toLowerCase()] || `Contact ${platform || 'the platform'} support directly with impersonation report.`;
}