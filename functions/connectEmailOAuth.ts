import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { accountId, accountType } = await req.json();

    if (!accountId || !accountType) {
      return Response.json({ error: 'Missing accountId or accountType' }, { status: 400 });
    }

    // Get the appropriate OAuth access token based on account type
    let accessToken;
    let integrationType;

    try {
      if (accountType === 'gmail') {
        integrationType = 'google';
        accessToken = await base44.asServiceRole.connectors.getAccessToken('google');
      } else if (accountType === 'outlook') {
        integrationType = 'microsoft';
        accessToken = await base44.asServiceRole.connectors.getAccessToken('microsoft');
      } else if (accountType === 'icloud') {
        return Response.json({ 
          error: 'iCloud requires app-specific password setup. Please use Settings > App-Specific Passwords in your Apple ID account.',
          requiresManualSetup: true 
        }, { status: 400 });
      } else {
        return Response.json({ error: 'Unsupported account type' }, { status: 400 });
      }
    } catch (error) {
      // OAuth not set up yet
      return Response.json({ 
        error: `Please authorize ${accountType} access first. Contact your administrator to set up OAuth integration.`,
        needsAuth: true,
        integrationType 
      }, { status: 403 });
    }

    if (!accessToken) {
      return Response.json({ 
        error: 'OAuth not authorized. Please authorize the app first.',
        needsAuth: true,
        integrationType 
      }, { status: 403 });
    }

    // Test the connection by fetching a sample message
    let testSuccess = false;
    
    if (accountType === 'gmail') {
      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      });
      testSuccess = response.ok;
    } else if (accountType === 'outlook') {
      const response = await fetch('https://graph.microsoft.com/v1.0/me/messages?$top=1', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      });
      testSuccess = response.ok;
    }

    if (!testSuccess) {
      return Response.json({ 
        error: 'Failed to connect to email service. Please try re-authorizing.',
        needsReauth: true 
      }, { status: 500 });
    }

    return Response.json({ 
      success: true,
      message: 'Email account connected successfully',
      integrationType 
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});