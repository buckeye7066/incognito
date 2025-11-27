import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { profileId, purpose, website, spendLimit } = await req.json();

    const apiKey = Deno.env.get('PRIVACY_COM_API_KEY');
    
    if (!apiKey) {
      return Response.json({ 
        error: 'Privacy.com API key not configured. Please add PRIVACY_COM_API_KEY in settings.' 
      }, { status: 500 });
    }

    // Create virtual card via Privacy.com API
    const response = await fetch('https://api.privacy.com/v1/card', {
      method: 'POST',
      headers: {
        'Authorization': `api-key ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'SINGLE_USE',
        memo: purpose || 'Incognito Generated',
        spend_limit: spendLimit || 100,
        spend_limit_duration: 'TRANSACTION'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      return Response.json({ error: `Privacy.com API error: ${error}` }, { status: response.status });
    }

    const cardData = await response.json();

    // Store in database
    await base44.asServiceRole.entities.DisposableCredential.create({
      profile_id: profileId,
      credential_type: 'credit_card',
      service_provider: 'Privacy.com',
      credential_value: `****-${cardData.last_four}`,
      purpose: purpose || 'Virtual Card',
      created_for_website: website || '',
      expiry_date: cardData.exp_date,
      is_active: true
    });

    // SECURITY: Never return raw card data - mask all sensitive values
    return Response.json({
      success: true,
      card: {
        masked_pan: `**** **** **** ${cardData.last_four}`,
        last_four: cardData.last_four,
        card_brand: cardData.type || 'VISA',
        created_at: new Date().toISOString()
      }
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});