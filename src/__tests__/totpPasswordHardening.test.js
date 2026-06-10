import { describe, it, expect, beforeEach } from 'vitest';

async function freshClient() {
  const vaultMod = await import('@/lib/vault');
  vaultMod.default.lock();
  return import('@/api/client.js?ts=' + Date.now());
}
const invoke = (client, fn, payload) => client.default.functions.invoke(fn, payload);

describe('TOTP hardening (Pass 7)', () => {
  let client, vault;
  beforeEach(async () => {
    localStorage.clear();
    client = await freshClient();
    vault = (await import('@/lib/vault')).default;
    vault.setInactivityTimeoutMs(0);
    await vault.init('correct horse battery staple');
  });

  it('addTOTPFromUri parses a robust otpauth URI and stores it encrypted', async () => {
    const { data } = await invoke(client, 'addTOTPFromUri', {
      uri: 'otpauth://totp/GitHub:me@example.com?secret=JBSWY3DPEHPK3PXP&issuer=GitHub&algorithm=SHA1&digits=6&period=30',
    });
    expect(data.service_name).toBe('GitHub');
    expect(data.account).toBe('me@example.com');
    expect(data.secret).toBe('JBSWY3DPEHPK3PXP');
    // secret encrypted at rest
    expect(localStorage.getItem('incognito_entity_TOTPSecret')).not.toContain('JBSWY3DPEHPK3PXP');
  });

  it('addTOTPFromUri rejects a malformed URI / bad secret', async () => {
    await expect(invoke(client, 'addTOTPFromUri', { uri: 'otpauth://totp/x?secret=not-base32!' })).rejects.toThrow(/base32/i);
    await expect(invoke(client, 'addTOTPFromUri', { uri: 'https://example.com' })).rejects.toThrow(/otpauth/i);
  });

  it('addTOTPSecret validates base32 and encrypts recovery codes', async () => {
    await expect(invoke(client, 'addTOTPSecret', { serviceName: 'X', secret: 'not base32!' })).rejects.toThrow(/base32/i);
    const { data } = await invoke(client, 'addTOTPSecret', { serviceName: 'Y', secret: 'JBSWY3DPEHPK3PXP', recoveryCodes: ['abc-123', 'def-456'] });
    expect(data.recovery_codes).toEqual(['abc-123', 'def-456']);
    const blob = localStorage.getItem('incognito_entity_TOTPSecret');
    expect(blob).not.toContain('abc-123');
  });
});

describe('Password manager hardening (Pass 7)', () => {
  let client, vault;
  beforeEach(async () => {
    localStorage.clear();
    client = await freshClient();
    vault = (await import('@/lib/vault')).default;
    vault.setInactivityTimeoutMs(0);
    await vault.init('correct horse battery staple');
  });

  async function makeEntry(password = 'old-pass') {
    return client.default.entities.PasswordEntry.create({
      service_name: 'Acme', username: 'u', password,
      last_changed: '2020-01-01T00:00:00Z', strength: 'strong',
    });
  }

  it('updatePasswordEntry sets tags and keeps an encrypted password history', async () => {
    const e = await makeEntry('old-pass');
    const r = await invoke(client, 'updatePasswordEntry', { entryId: e.id, password: 'new-pass', tags: ['work', 'banking'] });
    expect(r.data.tags).toEqual(['work', 'banking']);
    expect(r.data.password).toBe('new-pass');
    expect(r.data.password_history[0].password).toBe('old-pass');

    // Neither the old nor new password appears in plaintext at rest.
    const blob = localStorage.getItem('incognito_entity_PasswordEntry');
    expect(blob).not.toContain('old-pass');
    expect(blob).not.toContain('new-pass');
  });

  it('password history is redacted when the vault is locked', async () => {
    const e = await makeEntry('old-pass');
    await invoke(client, 'updatePasswordEntry', { entryId: e.id, password: 'new-pass' });
    vault.lock();
    const locked = (await client.default.entities.PasswordEntry.list()).find((p) => p.id === e.id);
    expect(locked.password).toBeNull();
    expect(locked.password_history).toBeNull();
  });

  it('updating tags only does not create a history entry', async () => {
    const e = await makeEntry('keep');
    const r = await invoke(client, 'updatePasswordEntry', { entryId: e.id, tags: ['x'] });
    expect(r.data.password).toBe('keep');
    expect(r.data.password_history).toBeUndefined();
  });

  it('rotateIdentityPassword records the previous password in history', async () => {
    const bundle = await invoke(client, 'createIdentityBundle', { serviceName: 'Svc', password: { create: true, value: 'first-pw' } });
    const pwId = bundle.data.identity.password_entry_id;
    const rot = await invoke(client, 'rotateIdentityPassword', { identityId: bundle.data.identity.id });
    expect(rot.data.password).not.toBe('first-pw');
    const pw = (await client.default.entities.PasswordEntry.list()).find((p) => p.id === pwId);
    expect(pw.password_history[0].password).toBe('first-pw');
  });
});
