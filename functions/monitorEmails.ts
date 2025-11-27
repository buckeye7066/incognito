import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// SECURITY: Helper to mask email addresses
const maskEmail = (email) => {
  if (!email) return '[redacted]';
  return email.replace(/^(.)(.*)(@.+)$/, '$1***$3');
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { profileId } = await req.json();

    // Get monitored accounts for this profile
    const accounts = await base44.asServiceRole.entities.MonitoredAccount.filter({
      profile_id: profileId,
      is_active: true,
      oauth_connected: true
    });

    let totalSpamFound = 0;
    const results = [];

    for (const account of accounts) {
      try {
        let spamEmails = [];

        if (account.account_type === 'gmail') {
          // Get Gmail access token
          const gmailToken = await base44.asServiceRole.connectors.getAccessToken('gmail');
          
          // Search for spam/suspicious emails in the last 24 hours
          const searchQuery = 'in:spam OR in:junk newer_than:1d';
          const searchResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(searchQuery)}`,
            {
              headers: { 'Authorization': `Bearer ${gmailToken}` }
            }
          );
          const searchData = await searchResponse.json();

          if (searchData.messages && searchData.messages.length > 0) {
            // Get details of each message
            for (const msg of searchData.messages.slice(0, 10)) {
              const msgResponse = await fetch(
                `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
                {
                  headers: { 'Authorization': `Bearer ${gmailToken}` }
                }
              );
              const msgData = await msgResponse.json();

              const headers = msgData.payload.headers;
              const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
              const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
              const date = new Date(parseInt(msgData.internalDate));

              spamEmails.push({
                from,
                subject,
                date: date.toISOString().split('T')[0],
                snippet: msgData.snippet
              });
            }
          }
        }

        // Auto-log spam incidents
        if (spamEmails.length > 0 && account.auto_log_spam) {
          for (const email of spamEmails) {
            // Check if already logged (avoid duplicates)
            const existing = await base44.asServiceRole.entities.SpamIncident.filter({
              profile_id: profileId,
              source_identifier: email.from,
              date_received: email.date
            });

            if (existing.length === 0) {
              await base44.asServiceRole.entities.SpamIncident.create({
                profile_id: profileId,
                incident_type: 'email',
                source_identifier: email.from,
                category: 'phishing',
                date_received: email.date,
                content_summary: `${email.subject} - ${email.snippet}`,
                suspected_data_source: 'Unknown - Auto-detected'
              });
              totalSpamFound++;
            }
          }
        }

        // Update last check time
        await base44.asServiceRole.entities.MonitoredAccount.update(account.id, {
          last_check: new Date().toISOString()
        });

        // SECURITY FIX: Only return masked account identifier
        results.push({
          account: maskEmail(account.account_identifier),
          spamFound: spamEmails.length,
          logged: account.auto_log_spam ? spamEmails.length : 0
        });

      } catch (error) {
        // SECURITY FIX: Never log actual email addresses
        console.error('Error monitoring mailbox for account');
        results.push({
          account: maskEmail(account.account_identifier),
          error: 'Processing failed'
        });
      }
    }

    return Response.json({
      success: true,
      totalSpamFound,
      accountsChecked: accounts.length,
      results
    });

  } catch (error) {
    console.error('Email monitoring error occurred');
    return Response.json({ error: error.message }, { status: 500 });
  }
});