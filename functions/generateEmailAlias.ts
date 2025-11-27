import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { profileId, purpose, website, note } = await req.json();

    // Get SimpleLogin access token
    const simpleLoginToken = await base44.asServiceRole.connectors.getAccessToken('simplelogin');

    if (!simpleLoginToken) {
      return Response.json({ 
        error: 'SimpleLogin not connected. Please authorize SimpleLogin first.' 
      }, { status: 401 });
    }

    // Create alias via SimpleLogin API
    const response = await fetch('https://app.simplelogin.io/api/alias/random/new', {
      method: 'POST',
      headers: {
        'Authentication': simpleLoginToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        hostname: website || '',
        note: note || purpose || 'Created via Incognito'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      return Response.json({ error: `SimpleLogin API error: ${error}` }, { status: response.status });
    }

    const aliasData = await response.json();

    // Store in database
    await base44.asServiceRole.entities.DisposableCredential.create({
      profile_id: profileId,
      credential_type: 'email',
      service_provider: 'SimpleLogin',
      credential_value: aliasData.email,
      purpose: purpose || 'Email Alias',
      created_for_website: website || '',
      is_active: true
    });

    return Response.json({
      success: true,
      alias: aliasData.email
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});