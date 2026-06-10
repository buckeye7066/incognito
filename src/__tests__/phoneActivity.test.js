import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULT_PHONE_RULES } from '@/lib/phoneRules';

async function freshClient() {
  const vaultMod = await import('@/lib/vault');
  vaultMod.default.lock();
  return import('@/api/client.js?ts=' + Date.now());
}
const invoke = (client, fn, payload) => client.default.functions.invoke(fn, payload);

describe('phone aliases — local functions (Pass 6)', () => {
  let client, vault;

  beforeEach(async () => {
    localStorage.clear();
    client = await freshClient();
    vault = (await import('@/lib/vault')).default;
    vault.setInactivityTimeoutMs(0);
    await vault.init('correct horse battery staple');
  });

  // Create an alias directly (purchase needs Twilio; the local fns don't).
  async function makeAlias(extra = {}) {
    return client.default.entities.PhoneAlias.create({
      phone_number: '+15551234567', twilio_sid: null, status: 'active',
      forwarding_number: '', rules: { ...DEFAULT_PHONE_RULES }, ...extra,
    });
  }

  it('setPhoneRule applies forward + block/allow changes', async () => {
    const a = await makeAlias();
    let r = await invoke(client, 'setPhoneRule', { aliasId: a.id, change: { type: 'block', number: '+1 555 000 1111' } });
    expect(r.data.rules.blocked_numbers).toEqual(['5550001111']);
    r = await invoke(client, 'setPhoneRule', { aliasId: a.id, change: { type: 'calls_off' } });
    expect(r.data.rules.forward_calls).toBe(false);
  });

  it('updatePhoneAlias sets forwarding number, member, purpose', async () => {
    const a = await makeAlias();
    const r = await invoke(client, 'updatePhoneAlias', { aliasId: a.id, forwardingNumber: '+15559998888', householdMemberId: 'm1', purpose: 'Shopping' });
    expect(r.data.forwarding_number).toBe('+15559998888');
    expect(r.data.household_member_id).toBe('m1');
    expect(r.data.purpose).toBe('Shopping');
  });

  it('releasePhoneNumber deletes the local record (no Twilio sid → no Twilio call)', async () => {
    const a = await makeAlias();
    const r = await invoke(client, 'releasePhoneNumber', { aliasId: a.id });
    expect(r.data.released).toBe(true);
    expect((await client.default.entities.PhoneAlias.list()).some((p) => p.id === a.id)).toBe(false);
  });

  it('getPhoneActivity is unavailable without the optional backend', async () => {
    const r = await invoke(client, 'getPhoneActivity', { phoneNumber: '+15551234567' });
    expect(r.data.activityAvailable).toBe(false);
    expect(r.data.messages).toEqual([]);
    expect(r.data.calls).toEqual([]);
  });

  it('getPhoneActivity returns filtered SMS + calls when the backend is configured', async () => {
    localStorage.setItem('incognito_backend_url', 'https://backend.example.com');
    await client.setApiKeys({ backend_shared_secret: 's3cret' });
    const fetchImpl = async () => ({
      ok: true,
      json: async () => ([
        { id: 's1', type: 'sms_inbound', to: '+15551234567', from: '+15550000001', received_at: '2026-01-01T00:00:00Z' },
        { id: 'c1', type: 'call_inbound', to: '+15551234567', from: '+15550000002', received_at: '2026-01-02T00:00:00Z' },
        { id: 's2', type: 'sms_inbound', to: '+15559999999', from: '+15550000003', received_at: '2026-01-03T00:00:00Z' },
        { id: 'e1', type: 'email_inbound', alias: 'x@y', received_at: '2026-01-04T00:00:00Z' },
      ]),
    });
    const r = await invoke(client, 'getPhoneActivity', { phoneNumber: '+15551234567', fetchImpl });
    expect(r.data.activityAvailable).toBe(true);
    expect(r.data.messages).toHaveLength(1);
    expect(r.data.calls).toHaveLength(1);
    expect(r.data.calls[0].from).toBe('+15550000002');
  });
});
