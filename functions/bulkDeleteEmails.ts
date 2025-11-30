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
      return Response.json({ ok: true, testMode: true, function: 'bulkDeleteEmails' });
    }
    
    const { emailIds } = body;

    if (!emailIds || emailIds.length === 0) {
      return Response.json({ error: 'emailIds array is required' }, { status: 400 });
    }

    // Get Gmail access token
    const accessToken = await base44.asServiceRole.connectors.getAccessToken('gmail');

    const deletedCount = [];
    const failedCount = [];

    // Delete emails in batches
    for (const emailId of emailIds) {
      try {
        const deleteResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          }
        );

        if (deleteResponse.ok || deleteResponse.status === 204) {
          deletedCount.push(emailId);
        } else {
          failedCount.push(emailId);
        }
      } catch (error) {
        failedCount.push(emailId);
      }
    }

    return Response.json({
      success: true,
      deleted: deletedCount.length,
      failed: failedCount.length,
      total: emailIds.length
    });

  } catch (error) {
    console.error('Bulk delete error:', error);
    return Response.json({ 
      error: error.message,
      details: 'Failed to delete emails'
    }, { status: 500 });
  }
});