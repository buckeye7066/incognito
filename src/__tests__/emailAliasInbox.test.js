import { describe, it, expect, beforeEach } from 'vitest';

async function freshClient() {
  const vaultMod = await import('@/lib/vault');
  vaultMod.default.lock();
  return import('@/api/client.js?ts=' + Date.now());
}
const invoke = (client, fn, payload) => client.default.functions.invoke(fn, payload);

describe('email aliases + inbox (Pass 5)', () => {
  let client, vault;

  beforeEach(async () => {
    localStorage.clear();
    client = await freshClient();
    vault = (await import('@/lib/vault')).default;
    vault.setInactivityTimeoutMs(0);
    await vault.init('correct horse battery staple');
  });

  it('creates a clearly-labelled placeholder (not a fake real address) when no provider', async () => {
    const { data } = await invoke(client, 'createEmailAliasReal', { description: 'Shopping' });
    expect(data.placeholder).toBe(true);
    expect(data.provider).toBe('local_placeholder');
    expect(data.alias_email).toMatch(/@placeholder\.invalid$/);
    expect(data.alias_email).not.toContain('protonmail');
    expect(data.rules).toMatchObject({ forward: true, muted: false });
  });

  it('applies rule changes (block/allow/forward) to an alias', async () => {
    const { data } = await invoke(client, 'createEmailAliasReal', { description: 'X' });
    const id = data.id;
    let r = await invoke(client, 'setAliasRule', { aliasId: id, change: { type: 'block', sender: 'Spam@x.com' } });
    expect(r.data.rules.blocked_senders).toEqual(['spam@x.com']);
    r = await invoke(client, 'setAliasRule', { aliasId: id, change: { type: 'forward_off' } });
    expect(r.data.rules.forward).toBe(false);
  });

  it('updates description + household member', async () => {
    const { data } = await invoke(client, 'createEmailAliasReal', { description: 'old' });
    const r = await invoke(client, 'updateEmailAlias', { aliasId: data.id, description: 'new', householdMemberId: 'm1' });
    expect(r.data.description).toBe('new');
    expect(r.data.household_member_id).toBe('m1');
  });

  it('inbox is unavailable without the optional backend', async () => {
    const r = await invoke(client, 'getAliasInbox', { aliasEmail: 'a@b.com' });
    expect(r.data.inboxAvailable).toBe(false);
    expect(r.data.messages).toEqual([]);
  });

  it('inbox returns filtered messages when the backend is configured', async () => {
    localStorage.setItem('incognito_backend_url', 'https://backend.example.com');
    await client.setApiKeys({ backend_shared_secret: 's3cret' });
    let sentHeader = null;
    const fetchImpl = async (url, opts) => {
      sentHeader = opts?.headers?.['X-Incognito-Secret'];
      return {
        ok: true,
        json: async () => ([
          { id: '1', type: 'email_inbound', alias: 'me@alias.io', from: 'a@x.com', subject: 'Hi', received_at: '2026-01-01T00:00:00Z' },
          { id: '2', type: 'email_inbound', alias: 'other@alias.io', from: 'b@x.com', subject: 'No', received_at: '2026-01-02T00:00:00Z' },
          { id: '3', type: 'sms_inbound', from: 'c', received_at: '2026-01-03T00:00:00Z' },
        ]),
      };
    };
    const r = await invoke(client, 'getAliasInbox', { aliasEmail: 'me@alias.io', fetchImpl });
    expect(r.data.inboxAvailable).toBe(true);
    expect(sentHeader).toBe('s3cret');
    expect(r.data.messages).toHaveLength(1);
    expect(r.data.messages[0]).toMatchObject({ from: 'a@x.com', subject: 'Hi' });
  });

  it('EMAIL_INBOX capability is needs_backend by default', async () => {
    const { getCapabilityStatus, CAPABILITY, CAPABILITY_STATUS } = await import('@/providers/index.js');
    expect(getCapabilityStatus(CAPABILITY.EMAIL_INBOX).status).toBe(CAPABILITY_STATUS.NEEDS_BACKEND);
  });
});
