import { describe, it, expect, beforeEach } from 'vitest';

async function freshClient() {
  const vaultMod = await import('@/lib/vault');
  vaultMod.default.lock();
  return import('@/api/client.js?ts=' + Date.now());
}

const invoke = (client, fn, payload) => client.default.functions.invoke(fn, payload);

describe('Cloaked Identity bundle (Pass 4)', () => {
  let client, vault;

  beforeEach(async () => {
    localStorage.clear();
    client = await freshClient();
    vault = (await import('@/lib/vault')).default;
    vault.setInactivityTimeoutMs(0);
    await vault.init('correct horse battery staple');
  });

  it('creates local parts and does NOT fake provider resources when not ready', async () => {
    const { data } = await invoke(client, 'createIdentityBundle', {
      serviceName: 'Acme', serviceUrl: 'https://acme.example.com', category: 'shopping',
      username: 'acme.user',
      password: { create: true },
      email: { create: true }, card: { create: true },
      totp: { placeholder: true },
      readiness: { email: false, card: false },
    });
    expect(data.created).toContain('password');
    expect(data.created).toContain('totp_placeholder');
    const skippedResources = data.skipped.map((s) => s.resource);
    expect(skippedResources).toEqual(expect.arrayContaining(['email', 'card']));

    // No fake alias/card records were created.
    expect(await client.default.entities.EmailAlias.list()).toHaveLength(0);
    expect(await client.default.entities.VirtualCard.list()).toHaveLength(0);
    expect(data.identity.email_alias_id).toBeNull();
    expect(data.identity.virtual_card_id).toBeNull();
    // Password + TOTP placeholder were linked.
    expect(data.identity.password_entry_id).toBeTruthy();
    expect(data.identity.totp_secret_id).toBeTruthy();
  });

  it('keeps the linked password encrypted at rest and redacts it when locked', async () => {
    const { data } = await invoke(client, 'createIdentityBundle', {
      serviceName: 'VaultTest', password: { create: true, value: 'sup3rSecret!' },
    });
    const raw = localStorage.getItem('incognito_entity_PasswordEntry');
    expect(raw).not.toContain('sup3rSecret!');

    // Unlocked: decrypts.
    const pw = (await client.default.entities.PasswordEntry.list()).find((p) => p.id === data.identity.password_entry_id);
    expect(pw.password).toBe('sup3rSecret!');

    // Locked: redacted.
    vault.lock();
    const lockedPw = (await client.default.entities.PasswordEntry.list()).find((p) => p.id === data.identity.password_entry_id);
    expect(lockedPw.password).toBeNull();
    expect(lockedPw.__locked).toBe(true);
  });

  it('encrypts custom_fields and redacts them when locked', async () => {
    await invoke(client, 'createIdentityBundle', {
      serviceName: 'Custom', password: { create: false },
      customFields: { recovery_pin: '4321' },
    });
    expect(JSON.stringify(JSON.parse(localStorage.getItem('incognito_entity_CloakedIdentity')))).not.toContain('4321');
    const unlocked = (await client.default.entities.CloakedIdentity.list())[0];
    expect(unlocked.custom_fields.recovery_pin).toBe('4321');
    vault.lock();
    const locked = (await client.default.entities.CloakedIdentity.list())[0];
    expect(locked.custom_fields).toBeNull();
  });

  it('validates status transitions', async () => {
    const { data } = await invoke(client, 'createIdentityBundle', { serviceName: 'S', password: { create: false } });
    const id = data.identity.id;
    const muted = await invoke(client, 'updateIdentityStatus', { identityId: id, status: 'muted' });
    expect(muted.data.status).toBe('muted');
    await expect(invoke(client, 'updateIdentityStatus', { identityId: id, status: 'bogus' })).rejects.toThrow(/Invalid/);
  });

  it('unlink keeps the record by default and deletes it on request', async () => {
    const { data } = await invoke(client, 'createIdentityBundle', { serviceName: 'U', password: { create: true } });
    const id = data.identity.id;
    const pwId = data.identity.password_entry_id;

    await invoke(client, 'unlinkIdentityResource', { identityId: id, resourceType: 'password', deleteRecord: false });
    let identity = (await client.default.entities.CloakedIdentity.list()).find((i) => i.id === id);
    expect(identity.password_entry_id).toBeNull();
    expect((await client.default.entities.PasswordEntry.list()).some((p) => p.id === pwId)).toBe(true);

    // Re-link then delete the record.
    await invoke(client, 'linkIdentityResource', { identityId: id, resourceType: 'password', resourceId: pwId });
    await invoke(client, 'unlinkIdentityResource', { identityId: id, resourceType: 'password', deleteRecord: true });
    expect((await client.default.entities.PasswordEntry.list()).some((p) => p.id === pwId)).toBe(false);
  });

  it('delete unlink-only keeps linked records; cascade deletes them', async () => {
    const a = await invoke(client, 'createIdentityBundle', { serviceName: 'Keep', password: { create: true } });
    await invoke(client, 'deleteIdentity', { identityId: a.data.identity.id, mode: 'unlink' });
    expect((await client.default.entities.CloakedIdentity.list()).some((i) => i.id === a.data.identity.id)).toBe(false);
    expect((await client.default.entities.PasswordEntry.list()).some((p) => p.id === a.data.identity.password_entry_id)).toBe(true);

    const b = await invoke(client, 'createIdentityBundle', { serviceName: 'Cascade', password: { create: true } });
    await invoke(client, 'deleteIdentity', { identityId: b.data.identity.id, mode: 'cascade' });
    expect((await client.default.entities.PasswordEntry.list()).some((p) => p.id === b.data.identity.password_entry_id)).toBe(false);
  });

  it('rotates the linked password locally to a new value', async () => {
    const { data } = await invoke(client, 'createIdentityBundle', { serviceName: 'Rot', password: { create: true, value: 'old-one' } });
    const res = await invoke(client, 'rotateIdentityPassword', { identityId: data.identity.id });
    expect(res.data.password).not.toBe('old-one');
    const pw = (await client.default.entities.PasswordEntry.list()).find((p) => p.id === data.identity.password_entry_id);
    expect(pw.password).toBe(res.data.password);
  });
});
