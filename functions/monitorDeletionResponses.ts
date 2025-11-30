import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    
    // Self-test mode
    if (body._selfTest === '1') {
      return Response.json({ ok: true, testMode: true, function: 'monitorDeletionResponses' });
    }
    
    const { profileId } = body;

    // Get all pending/in-progress deletion requests for this profile
    const deletionRequests = await base44.asServiceRole.entities.DeletionRequest.filter({
      profile_id: profileId
    });

    const pendingRequests = deletionRequests.filter(r => 
      ['pending', 'in_progress', 'requires_action'].includes(r.status)
    );

    // Get monitored email accounts
    const emailAccounts = await base44.asServiceRole.entities.MonitoredAccount.filter({
      profile_id: profileId,
      oauth_connected: true
    });

    let responsesDetected = 0;
    const results = [];

    for (const account of emailAccounts) {
      if (account.account_type !== 'gmail') continue;

      try {
        const gmailToken = await base44.asServiceRole.connectors.getAccessToken('gmail');
        
        // Search for emails from data brokers/removal confirmations
        const searchQuery = 'subject:(removal OR deletion OR "data request" OR "privacy request" OR GDPR OR CCPA OR "opt out") newer_than:7d';
        const searchResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(searchQuery)}`,
          {
            headers: { 'Authorization': `Bearer ${gmailToken}` }
          }
        );
        const searchData = await searchResponse.json();

        if (searchData.messages && searchData.messages.length > 0) {
          for (const msg of searchData.messages.slice(0, 20)) {
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
            const snippet = msgData.snippet || '';

            // Use AI to analyze the email and match to deletion request
            const analysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
              prompt: `Analyze this email to determine if it's a response to a data deletion/removal request:

From: ${from}
Subject: ${subject}
Body: ${snippet}

Pending Deletion Requests: ${JSON.stringify(pendingRequests.map(r => ({
  id: r.id,
  source: r.source_name || 'Unknown',
  contact_email: r.contact_email
})))}

Determine:
1. Is this a response to a data deletion request?
2. What type of response (confirmation, rejection, requires_action, in_progress)?
3. Which deletion request ID does it match (if any)?
4. What is the rejection reason (if rejected)?
5. What should the user do next?
6. Alternative contact method if rejected?`,
              response_json_schema: {
                type: 'object',
                properties: {
                  is_deletion_response: { type: 'boolean' },
                  response_type: { type: 'string' },
                  matched_request_id: { type: 'string' },
                  rejection_reason: { type: 'string' },
                  suggested_action: { type: 'string' },
                  alternative_contact: { type: 'string' },
                  confidence: { type: 'number' }
                }
              }
            });

            if (analysis.is_deletion_response && analysis.matched_request_id) {
              // Check if already logged
              const existing = await base44.asServiceRole.entities.DeletionEmailResponse.filter({
                deletion_request_id: analysis.matched_request_id,
                sender_email: from
              });

              if (existing.length === 0) {
                // Create response record
                await base44.asServiceRole.entities.DeletionEmailResponse.create({
                  deletion_request_id: analysis.matched_request_id,
                  response_type: analysis.response_type,
                  sender_email: from,
                  subject: subject,
                  body_snippet: snippet,
                  detected_date: new Date().toISOString(),
                  rejection_reason: analysis.rejection_reason,
                  ai_suggested_action: analysis.suggested_action,
                  alternative_contact_method: analysis.alternative_contact,
                  confidence_score: analysis.confidence || 80
                });

                // Update deletion request status
                let newStatus = 'in_progress';
                if (analysis.response_type === 'confirmation') {
                  newStatus = 'completed';
                } else if (analysis.response_type === 'rejection') {
                  newStatus = 'failed';
                } else if (analysis.response_type === 'requires_action') {
                  newStatus = 'requires_action';
                }

                const deletionReq = await base44.asServiceRole.entities.DeletionRequest.update(
                  analysis.matched_request_id,
                  {
                    status: newStatus,
                    response_received: snippet,
                    next_action: analysis.suggested_action,
                    ...(newStatus === 'completed' && { completion_date: new Date().toISOString().split('T')[0] })
                  }
                );

                // Create notification for user
                const notificationMessages = {
                  confirmation: `✓ Data deletion confirmed from ${from.split('@')[1] || from}`,
                  rejection: `✗ Deletion request rejected by ${from.split('@')[1] || from}`,
                  requires_action: `⚠ Action required for deletion request from ${from.split('@')[1] || from}`,
                  in_progress: `⏳ Deletion request being processed by ${from.split('@')[1] || from}`,
                  partial: `◐ Partial deletion completed by ${from.split('@')[1] || from}`
                };

                await base44.asServiceRole.entities.NotificationAlert.create({
                  profile_id: profileId,
                  alert_type: newStatus === 'completed' ? 'mitigation_reminder' : 'high_risk_alert',
                  title: notificationMessages[analysis.response_type] || 'Deletion Update',
                  message: analysis.suggested_action || snippet.substring(0, 200),
                  severity: newStatus === 'completed' ? 'low' : newStatus === 'failed' ? 'high' : 'medium',
                  is_read: false,
                  action_url: '/DeletionCenter',
                  related_data_ids: [analysis.matched_request_id],
                  confidence_score: analysis.confidence || 80
                });

                // Update scan result if completed
                if (newStatus === 'completed' && deletionReq.scan_result_id) {
                  await base44.asServiceRole.entities.ScanResult.update(
                    deletionReq.scan_result_id,
                    { status: 'removed' }
                  );
                }

                responsesDetected++;
                results.push({
                  request_id: analysis.matched_request_id,
                  response_type: analysis.response_type,
                  from: from,
                  status: newStatus
                });
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error monitoring ${account.account_identifier}:`, error);
      }
    }

    // Send summary email if responses found
    if (responsesDetected > 0) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: user.email,
        subject: `🔔 ${responsesDetected} New Deletion Response${responsesDetected > 1 ? 's' : ''}`,
        body: `You have ${responsesDetected} new response(s) from data brokers:

${results.map(r => `• ${r.from.split('@')[1] || r.from}: ${r.response_type} → ${r.status}`).join('\n')}

View details: ${req.headers.get('origin') || 'https://app.base44.com'}/DeletionCenter`
      });
    }

    return Response.json({
      success: true,
      responsesDetected,
      results
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});