import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const HIBP_API_KEY = Deno.env.get("HIBP_API_KEY");

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
      return Response.json({ ok: true, testMode: true, function: 'checkHIBP' });
    }
    
    const { email } = body;
    
    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    // Call Have I Been Pwned API
    const response = await fetch(
      `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`,
      {
        headers: {
          'hibp-api-key': HIBP_API_KEY,
          'user-agent': 'Incognito-Privacy-App'
        }
      }
    );

    if (response.status === 404) {
      // No breaches found - this is good news
      return Response.json({ found: false, breaches: [] });
    }

    if (response.status === 401) {
      return Response.json({ error: 'Invalid HIBP API key' }, { status: 401 });
    }

    if (response.status === 429) {
      return Response.json({ error: 'Rate limited - try again later' }, { status: 429 });
    }

    if (!response.ok) {
      return Response.json({ error: `HIBP API error: ${response.status}` }, { status: response.status });
    }

    const breaches = await response.json();

    // Return real breach data
    return Response.json({
      found: true,
      breaches: breaches.map(b => ({
        name: b.Name,
        title: b.Title,
        domain: b.Domain,
        breachDate: b.BreachDate,
        addedDate: b.AddedDate,
        modifiedDate: b.ModifiedDate,
        pwnCount: b.PwnCount,
        description: b.Description,
        dataClasses: b.DataClasses,
        isVerified: b.IsVerified,
        isSensitive: b.IsSensitive,
        logoPath: b.LogoPath ? `https://haveibeenpwned.com${b.LogoPath}` : null
      }))
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});