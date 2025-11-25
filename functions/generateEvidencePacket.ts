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
EVIDENCE SUMMARY – SUSPECTED ONLINE IMPERSONATION / POSSIBLE IDENTITY THEFT
Generated: ${now}

1. Reporting Victim (Complainant)
- Full legal name: ${safe(myName)}
- Known usernames / handles: ${list(myUsernames.length ? myUsernames : myProfiles.map(p => '@' + p.username))}
- Primary email(s): ${list(myEmails)}
- Primary phone(s): ${list(myPhones)}
- Location (city, state): ${list(myAddresses)}
- Platforms actually controlled by victim: ${list(myProfiles.map(p => `${p.platform} (@${p.username})`))}

2. Suspected Impersonating Account
- Platform: ${safe(finding.platform)}
- Profile name: ${safe(finding.misused_data_details?.full_name)}
- Username / handle: @${safe(finding.suspicious_username)}
- Profile URL: ${safe(finding.suspicious_profile_url)}
- Account ID (if available): [not available]
- Location shown on profile: ${safe(finding.misused_data_details?.location)}
- Bio text: ${safe(finding.misused_data_details?.bio)}
- Links / contact info in bio: [not available]
- Other known accounts tied to suspect: [not available]

3. Exact Matching Identifiers (Copied from Victim)
The following identifiers on the suspected account match data supplied by the victim:

${matchedLines}

4. Digital Evidence & Chain of Custody
- Screenshots captured: [recommend capturing immediately]
- Raw HTML / scrape stored at vault path: [not available]
- File hashes (for integrity verification):
  - [no hashes recorded - recommend using archive.org Wayback Machine]
- First time victim discovered impersonation (UTC): ${safe(finding.detected_date || finding.created_date)}
- Most recent verification that account is still active (UTC): ${now}

5. Harm / Risk Description (short form)
- Nature of impersonation: Profile appears to use victim's name, likeness, and/or biographical details.
- Intended or apparent purpose: Unknown / under investigation
- Any known messages sent to others while impersonating victim: [not available]
- Any known financial requests / scams: [not available]
- Known victims contacted via impersonation: [none recorded]

6. Actions Already Taken
- Reported to platform (e.g., ${finding.platform}): ${finding.status === 'reported' ? 'Yes' : 'No'}
- Platform ticket / report ID: [not available]
- Credit / identity monitoring notified: [not available]
- Local police report filed: [not available]
- Other agencies contacted (FTC, state AG, etc.): [none recorded]

This report is generated automatically by the Incognito system based on data supplied by the victim and automated capture of the suspected account.
`.trim();

    // ATTORNEY BRIEFING PACKET
    const attorneyPacket = `
ATTORNEY BRIEFING PACKET – SUSPECTED ONLINE IMPERSONATION / IDENTITY MISUSE
Generated: ${now}

1. Client Information
- Name: ${safe(myName)}
- Address (city/state): ${list(myAddresses)}
- Preferred contact: ${list(myEmails)}
- Known online presence (owned accounts): ${list(myProfiles.map(p => `${p.platform} (@${p.username})`))}
- Any prior incidents of impersonation: none reported

2. Facts in Brief (Chronological Summary)
- Date client created legitimate account(s): [not available]
- Date client first learned of impersonating account: ${safe(finding.detected_date || finding.created_date)}
- How client learned of impersonation: Automated detection via Incognito Privacy Guardian
- Whether client has any personal relationship with suspected operator: unknown

3. Impersonating Account Details
- Platform: ${safe(finding.platform)}
- URL: ${safe(finding.suspicious_profile_url)}
- Username / Handle: @${safe(finding.suspicious_username)}
- Display Name: ${safe(finding.misused_data_details?.full_name)}
- Bio text: ${safe(finding.misused_data_details?.bio)}
- Contact info on profile: [not available]
- Evidence of use of client's photos or likeness: ${finding.matching_photos?.length ? `${finding.matching_photos.length} photo(s) matched` : finding.suspicious_profile_photo ? 'Profile photo detected' : '[not available]'}
- Evidence of use of client's biographical info (work, education, church, etc.): ${safe(finding.misused_data_details?.workplace || finding.misused_data_details?.education ? 'Yes - see matched identifiers' : '[not available]')}

4. Exact Matches to Client Identifiers (for pleading / exhibits)
From automated comparison:

${matchedLines}

5. Harm and Damages (Client-Reported)
[Attorney: confirm and expand]
- Emotional distress (anxiety, reputational harm, time spent responding): [to be documented]
- Lost opportunities (jobs, contracts, ministry, etc.): [to be documented]
- Out-of-pocket costs (identity monitoring, credit freezes, travel, etc.): [to be documented]
- Any fraudulent accounts opened or charges made in client's name: [to be documented]
- Time lost from work to deal with incident (hours): [to be documented]

6. Potential Legal Theories to Evaluate (for Tennessee / federal counsel)
[This is a checklist for your attorney to consider; not a legal conclusion.]

- State identity theft / identity fraud statute(s)
- Civil remedies under Tennessee identity theft victim provisions
- Tort claims: defamation, false light, invasion of privacy, intentional infliction of emotional distress
- Misappropriation of name or likeness for commercial or fraudulent purposes
- Possible federal claims if interstate or financial fraud is involved
- Platform contract / ToS issues and any relevant statutory notice requirements

7. Evidence Inventory (available from Incognito)
- Screenshots: [recommend capturing immediately]
- Raw HTML / JSON capture: [not available]
- Hashes for evidentiary integrity: see law_enforcement packet section 4
- Log of when client accessed and viewed the impersonating account: [not available]

8. Requested Relief (to be refined by counsel)
[Client draft – for attorney to revise]
- Immediate takedown / preservation of platform data
- Criminal investigation of impersonating party if identity theft or fraud is supported
- Injunction preventing further impersonation and ordering deletion of data
- Monetary damages for financial loss, emotional distress, and costs of mitigation
- Attorney's fees and costs as permitted by statute

9. Platform-Specific Remedies
${finding.platform?.toUpperCase()} IMPERSONATION REPORT:
${getPlatformReportInfo(finding.platform)}
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
      structured: {
        victim: {
          legal_name: myName,
          emails: myEmails,
          phones: myPhones,
          usernames: myUsernames,
          addresses: myAddresses,
          owned_platforms: myProfiles.map(p => `${p.platform} (@${p.username})`)
        },
        suspect: {
          platform: finding.platform,
          username: finding.suspicious_username,
          profile_url: finding.suspicious_profile_url,
          display_name: finding.misused_data_details?.full_name,
          bio: finding.misused_data_details?.bio,
          location: finding.misused_data_details?.location,
          first_seen_utc: finding.detected_date || finding.created_date
        },
        matches: matchedFields
      },
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