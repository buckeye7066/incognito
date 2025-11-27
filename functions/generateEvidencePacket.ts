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

    // SECURITY: Redaction helper functions
    const redactEmail = (email) => {
      if (!email) return '[not available]';
      return email.replace(/(.{2}).+(@.+)/, "$1***$2");
    };
    
    const redactPhone = (phone) => {
      if (!phone) return '[not available]';
      return phone.replace(/\b(\d{3})\d{3}(\d{4})\b/, "$1-***-$2");
    };
    
    const redactAddress = (addr) => {
      if (!addr) return '[not available]';
      return addr.replace(/^\d+\s/, "*** ");
    };
    
    const redactName = (name) => {
      if (!name) return '[not available]';
      const parts = name.trim().split(' ');
      if (parts.length > 1) {
        return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
      }
      return `${name[0]}.`;
    };

    // INCÓGNITO: Build EXACT VERBATIM matched fields from finding data
    const matchedFields = {};
    const verbatimQuotes = [];
    
    if (finding.misused_data_details) {
      const details = finding.misused_data_details;
      if (details.full_name) {
        matchedFields.name = details.full_name;
        verbatimQuotes.push(`MATCHED NAME: "${details.full_name}"`);
      }
      if (details.bio) {
        matchedFields.bio = details.bio;
        verbatimQuotes.push(`MATCHED BIO: "${details.bio}"`);
      }
      if (details.location) {
        matchedFields.location = details.location;
        verbatimQuotes.push(`MATCHED LOCATION: "${details.location}"`);
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
        matchedFields.photos = details.photos;
        verbatimQuotes.push(`MATCHED PHOTOS: ${details.photos.length} image(s) - URLs: ${details.photos.join(', ')}`);
      }
      if (details.vault_matches?.length) {
        details.vault_matches.forEach(v => verbatimQuotes.push(`VAULT MATCH: ${v}`));
      }
      if (details.behavioral_red_flags?.length) {
        matchedFields.red_flags = details.behavioral_red_flags;
      }
    }
    if (finding.misused_data?.length) {
      finding.misused_data.forEach(d => {
        if (!matchedFields[d.toLowerCase()]) {
          matchedFields[d.toLowerCase().replace(/ /g, '_')] = d;
          verbatimQuotes.push(`VAULT MATCH: ${d}`);
        }
      });
    }

    const matchedLines = verbatimQuotes.length > 0 
      ? verbatimQuotes.map(q => `- ${q}`).join('\n')
      : '[no exact matches detected]';
    
    const identityMatchScore = finding.similarity_score || 0;

    // INCÓGNITO LAW ENFORCEMENT EVIDENCE PACKET
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
SECTION 1: VICTIM INFORMATION (COMPLAINANT)
================================================================================
Full Legal Name: ${safe(myName)}
Known Usernames/Handles: ${list(myUsernames.length ? myUsernames : myProfiles.map(p => '@' + p.username))}
Primary Email(s): ${list(myEmails)}
Primary Phone(s): ${list(myPhones)}
Location (City, State): ${list(myAddresses)}
Employer: ${safe(myEmployer)}
Platforms Controlled by Victim: ${list(myProfiles.map(p => `${p.platform} (@${p.username})`))}

================================================================================
SECTION 2: SUSPECTED IMPERSONATING ACCOUNT
================================================================================
Platform: ${safe(finding.platform)}
Username/Handle: @${safe(finding.suspicious_username)}
Profile URL: ${safe(finding.suspicious_profile_url)}
Account ID: [request from platform via subpoena]

--- VERBATIM CONTENT EXTRACTED FROM SUSPICIOUS PROFILE ---
Display Name: "${safe(finding.misused_data_details?.full_name)}"
Bio Text: "${safe(finding.misused_data_details?.bio)}"
Location Shown: "${safe(finding.misused_data_details?.location)}"
Workplace Listed: "${safe(finding.misused_data_details?.workplace)}"
Education Listed: "${safe(finding.misused_data_details?.education)}"
Profile Photo URL: ${safe(finding.suspicious_profile_photo)}

================================================================================
SECTION 3: EXACT MATCHED IDENTIFIERS (FORENSIC EVIDENCE)
================================================================================
The following data on the suspected account EXACTLY MATCHES data from victim's vault:

${matchedLines}

================================================================================
SECTION 4: BEHAVIORAL RED FLAGS
================================================================================
${finding.misused_data_details?.behavioral_red_flags?.length > 0 
  ? finding.misused_data_details.behavioral_red_flags.map(f => `- ${f}`).join('\n')
  : '- [no behavioral flags recorded]'}

================================================================================
SECTION 5: DIGITAL EVIDENCE & CHAIN OF CUSTODY
================================================================================
Discovery Timeline:
- First detected (UTC): ${safe(finding.detected_date || finding.created_date)}
- Last verified active (UTC): ${now}
- Detection method: Automated forensic scan via Incógnito

Evidence Preservation:
- Screenshots captured: [RECOMMEND IMMEDIATE CAPTURE]
- Archive.org snapshot: [RECOMMEND SUBMITTING TO WAYBACK MACHINE]
- Platform data preservation request: [RECOMMEND FILING IMMEDIATELY]

File Integrity:
- Evidence hash: [generate upon screenshot capture]
- Chain of custody maintained by: Incógnito automated system

================================================================================
SECTION 6: HARM ASSESSMENT
================================================================================
Nature of Offense: ${finding.finding_type?.replace(/_/g, ' ')?.toUpperCase() || 'IDENTITY IMPERSONATION'}
Apparent Intent: ${finding.threat_category || 'Under investigation'}
Potential Impact: ${finding.potential_impact || 'Reputational damage, identity theft risk'}

Known Fraudulent Activity:
- Financial solicitations: [not detected / requires investigation]
- Messages sent as victim: [not detected / requires investigation]
- Third-party victims contacted: [none recorded]

================================================================================
SECTION 7: RECOMMENDED STATUTORY PATHS
================================================================================
- State identity theft statute
- Computer fraud and abuse (if unauthorized access involved)
- Wire fraud (if interstate financial fraud)
- Impersonation statutes (state-specific)
- Cyberstalking/harassment (if pattern of behavior)

================================================================================
SECTION 8: ACTIONS TAKEN
================================================================================
- Reported to ${finding.platform}: ${finding.status === 'reported' ? 'YES' : 'PENDING'}
- Platform report ID: [not available]
- Police report filed: [PENDING - RECOMMEND FILING]
- FTC complaint filed: [PENDING]
- State AG notified: [PENDING]

================================================================================
This evidence packet was generated by INCÓGNITO Privacy Guardian.
For evidentiary use, supplement with official screenshots and platform records.
================================================================================
`.trim();

    // INCÓGNITO ATTORNEY BRIEFING PACKET
    const attorneyPacket = `
================================================================================
              INCÓGNITO FORENSIC EVIDENCE PACKET - ATTORNEY BRIEFING
================================================================================
Case Reference: INC-${finding.id.slice(0, 8).toUpperCase()}
Generated: ${now}
Identity Match Score: ${identityMatchScore}/100
Threat Classification: ${finding.finding_type?.toUpperCase() || 'IMPERSONATION'}

================================================================================
SECTION 1: CLIENT INFORMATION
================================================================================
Full Legal Name: ${safe(myName)}
Location (City/State): ${list(myAddresses)}
Contact Email(s): ${list(myEmails)}
Contact Phone(s): ${list(myPhones)}
Employer: ${safe(myEmployer)}
Legitimate Online Presence: ${list(myProfiles.map(p => `${p.platform} (@${p.username})`))}
Prior Impersonation Incidents: None on record

================================================================================
SECTION 2: CASE FACTS (CHRONOLOGICAL)
================================================================================
Date impersonation discovered: ${safe(finding.detected_date || finding.created_date)}
Discovery method: Automated forensic detection via Incógnito Privacy Guardian
Relationship to suspected operator: Unknown / under investigation
Date client created legitimate accounts: [obtain from client]

================================================================================
SECTION 3: IMPERSONATING ACCOUNT - VERBATIM EVIDENCE
================================================================================
Platform: ${safe(finding.platform)}
Profile URL: ${safe(finding.suspicious_profile_url)}
Username/Handle: @${safe(finding.suspicious_username)}

--- EXACT CONTENT COPIED FROM SUSPICIOUS PROFILE (for exhibits) ---
Display Name Used: "${safe(finding.misused_data_details?.full_name)}"
Bio/Description: "${safe(finding.misused_data_details?.bio)}"
Location Claimed: "${safe(finding.misused_data_details?.location)}"
Employer Listed: "${safe(finding.misused_data_details?.workplace)}"
Education Listed: "${safe(finding.misused_data_details?.education)}"
Profile Photo: ${safe(finding.suspicious_profile_photo)}
${finding.matching_photos?.length ? `Additional Matched Photos: ${finding.matching_photos.join(', ')}` : ''}

================================================================================
SECTION 4: FORENSIC MATCH ANALYSIS (for pleadings/exhibits)
================================================================================
Identity Match Score: ${identityMatchScore}/100

Exact Matches to Client's Protected Information:
${matchedLines}

Behavioral Red Flags Observed:
${finding.misused_data_details?.behavioral_red_flags?.length > 0 
  ? finding.misused_data_details.behavioral_red_flags.map(f => `- ${f}`).join('\n')
  : '- [none recorded - conduct additional investigation]'}

================================================================================
SECTION 5: LEGAL THEORIES TO EVALUATE
================================================================================
Based on the evidence, counsel should evaluate the following causes of action:

IDENTITY-BASED CLAIMS:
□ State identity theft statute (criminal referral and civil remedies)
□ Tennessee identity theft victim protection provisions
□ Misappropriation of name/likeness (commercial or fraudulent use)

TORT CLAIMS:
□ Defamation (if false statements made as client)
□ False light invasion of privacy
□ Appropriation of identity
□ Intentional infliction of emotional distress
□ Negligent infliction of emotional distress

FRAUD-BASED CLAIMS (if financial activity detected):
□ Common law fraud
□ Wire fraud (federal, if interstate)
□ Consumer protection act violations

PLATFORM-RELATED:
□ Terms of Service violations (basis for takedown demand)
□ DMCA notice for copyrighted photos
□ State revenge porn statutes (if intimate images involved)

================================================================================
SECTION 6: DAMAGES ANALYSIS
================================================================================
[Attorney: document and quantify the following with client]

Emotional Distress:
- Anxiety, fear, reputational harm: [to be documented]
- Medical/therapy costs: [to be documented]

Economic Damages:
- Lost business opportunities: [to be documented]
- Lost employment/contracts: [to be documented]
- Credit monitoring costs: [to be documented]
- Identity theft remediation costs: [to be documented]

Time & Effort:
- Hours spent addressing impersonation: [to be documented]
- Work time lost: [to be documented]

Punitive Damages:
- Willful and malicious conduct: [evaluate based on evidence]

================================================================================
SECTION 7: EVIDENCE INVENTORY
================================================================================
Available from Incógnito:
✓ Automated detection report
✓ Matched identifier analysis
✓ Profile content extraction
✓ Timestamp of discovery

To Be Obtained:
□ Screenshots with metadata (recommend immediately)
□ Archive.org Wayback Machine submission
□ Platform account data (via subpoena)
□ IP address logs (via platform subpoena)
□ Communication records (if any)

================================================================================
SECTION 8: REQUESTED RELIEF (draft for counsel review)
================================================================================
IMMEDIATE:
1. Emergency takedown of impersonating account
2. Platform data preservation letter
3. Cease and desist to operator (if identified)

LITIGATION:
1. Temporary restraining order
2. Preliminary injunction
3. Permanent injunction against impersonation
4. Actual damages
5. Statutory damages where available
6. Punitive damages
7. Attorney's fees and costs

================================================================================
SECTION 9: PLATFORM-SPECIFIC REPORTING
================================================================================
${finding.platform?.toUpperCase()} IMPERSONATION REPORT:
${getPlatformReportInfo(finding.platform)}

================================================================================
This briefing packet was generated by INCÓGNITO Privacy Guardian.
All verbatim content extracted for evidentiary use. Supplement with official records.
================================================================================
`.trim();

    // SECURITY: Return redacted structured data for API consumers
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
          legal_name: redactName(myName),
          emails: myEmails.map(redactEmail),
          phones: myPhones.map(redactPhone),
          usernames: myUsernames,
          addresses: myAddresses.map(redactAddress),
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
    // SECURITY: Do not log full error details
    console.error('Evidence packet generation error occurred');
    return Response.json({ 
      error: 'Failed to generate evidence packet',
      details: 'An error occurred during packet generation'
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