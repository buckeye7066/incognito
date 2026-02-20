/**
 * Check Password Breach (HIBP k-anonymity)
 * Accepts first 5 chars of SHA-1 hash - never sees the full password.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    if (body._selfTest === '1') return Response.json({ ok: true, testMode: true });

    const { prefix } = body;
    if (!prefix || prefix.length !== 5) {
      return Response.json({ ok: false, error: 'prefix must be exactly 5 hex characters' }, { status: 400 });
    }

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix.toUpperCase()}`, {
      headers: { 'Add-Padding': 'true', 'User-Agent': 'Incognito-Privacy-App' }
    });

    if (!res.ok) {
      return Response.json({ ok: false, error: 'HIBP API error' }, { status: 502 });
    }

    const text = await res.text();
    const entries = text.split('\r\n').map(line => {
      const [suffix, count] = line.split(':');
      return { suffix, count: parseInt(count || '0', 10) };
    });

    return Response.json({ ok: true, entries });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});