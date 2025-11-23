import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { maxResults = 100 } = await req.json();

    // Get Gmail access token
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('gmail');

    // Fetch emails from Gmail API
    const messagesResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    if (!messagesResponse.ok) {
      throw new Error('Failed to fetch emails from Gmail');
    }

    const messagesData = await messagesResponse.json();
    const messages = messagesData.messages || [];

    // Fetch details for each message
    const emailDetails = [];
    for (const message of messages.slice(0, 50)) { // Limit to 50 for performance
      const detailResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      if (detailResponse.ok) {
        const detail = await detailResponse.json();
        const headers = detail.payload.headers;
        
        const fromHeader = headers.find(h => h.name === 'From');
        const subjectHeader = headers.find(h => h.name === 'Subject');
        const dateHeader = headers.find(h => h.name === 'Date');

        // Extract email address from "Name <email@domain.com>" format
        const fromValue = fromHeader?.value || '';
        const emailMatch = fromValue.match(/<(.+?)>/) || fromValue.match(/([^\s]+@[^\s]+)/);
        const senderEmail = emailMatch ? emailMatch[1] : fromValue;

        emailDetails.push({
          id: message.id,
          from: fromValue,
          senderEmail: senderEmail.toLowerCase().trim(),
          subject: subjectHeader?.value || '(No Subject)',
          date: dateHeader?.value || '',
          threadId: detail.threadId
        });
      }
    }

    // Group emails by sender
    const groupedBySender = {};
    emailDetails.forEach(email => {
      const sender = email.senderEmail;
      if (!groupedBySender[sender]) {
        groupedBySender[sender] = {
          senderEmail: sender,
          senderName: email.from,
          count: 0,
          emails: []
        };
      }
      groupedBySender[sender].count++;
      groupedBySender[sender].emails.push(email);
    });

    // Convert to array and sort by count
    const senderGroups = Object.values(groupedBySender)
      .sort((a, b) => b.count - a.count);

    return Response.json({
      success: true,
      totalEmails: emailDetails.length,
      senderGroups,
      groupCount: senderGroups.length
    });

  } catch (error) {
    console.error('Fetch emails error:', error);
    return Response.json({ 
      error: error.message,
      details: 'Failed to fetch inbox emails'
    }, { status: 500 });
  }
});