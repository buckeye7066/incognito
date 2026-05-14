import { describe, it, expect, beforeEach } from 'vitest';

// We import client.js via dynamic import so the singleton vault picks up the
// freshly-cleared localStorage between tests.
async function freshClient() {
  // Reset the module cache so the singleton vault state is rebuilt against the
  // empty localStorage.
  const vaultMod = await import('@/lib/vault');
  vaultMod.default.lock();
  return import('@/api/client.js?ts=' + Date.now());
}

describe('vault-encrypted storage', () => {
  let client;
  let vault;

  beforeEach(async () => {
    localStorage.clear();
    client = await freshClient();
    vault = (await import('@/lib/vault')).default;
    vault.setInactivityTimeoutMs(0);
  });

  it('refuses to write API keys when the vault is locked', async () => {
    await expect(client.setApiKeys({ openai_api_key: 'sk-test' })).rejects.toThrow(/locked/i);
    expect(localStorage.getItem('incognito_api_keys')).toBeNull();
    expect(localStorage.getItem('incognito_api_keys_enc_v1')).toBeNull();
  });

  it('writes API keys encrypted-at-rest when the vault is unlocked', async () => {
    await vault.init('correct horse battery staple');
    await client.setApiKeys({ openai_api_key: 'sk-test' });
    const raw = localStorage.getItem('incognito_api_keys_enc_v1');
    expect(raw).toBeTruthy();
    // Must NOT contain the plaintext value anywhere in the blob.
    expect(raw).not.toContain('sk-test');
    expect(client.apiKeysAreEncrypted()).toBe(true);
  });

  it('refuses to create sensitive entities when the vault is locked', async () => {
    await expect(
      client.default.entities.PasswordEntry.create({
        site: 'example.com',
        username: 'user@example.com',
        password: 'hunter2',
      }),
    ).rejects.toThrow(/locked/i);
    const raw = localStorage.getItem('incognito_entity_PasswordEntry');
    // Either nothing was written, or the array is still empty.
    if (raw) {
      const parsed = JSON.parse(raw);
      expect(parsed).toEqual([]);
    }
  });

  it('encrypts sensitive fields on create and decrypts on list when unlocked', async () => {
    await vault.init('correct horse battery staple');
    const created = await client.default.entities.PasswordEntry.create({
      site: 'example.com',
      username: 'user@example.com',
      password: 'hunter2',
      notes: 'do not share',
    });
    expect(created.password).toBe('hunter2');
    expect(created.notes).toBe('do not share');

    const raw = JSON.parse(localStorage.getItem('incognito_entity_PasswordEntry'));
    expect(raw).toHaveLength(1);
    expect(raw[0].password).toMatchObject({ iv: expect.any(String), ct: expect.any(String) });
    const blob = JSON.stringify(raw);
    expect(blob).not.toContain('hunter2');
    expect(blob).not.toContain('do not share');

    const list = await client.default.entities.PasswordEntry.list();
    expect(list[0].password).toBe('hunter2');
    expect(list[0].notes).toBe('do not share');
  });

  it('locked reads return placeholders, not ciphertext, for sensitive entities', async () => {
    await vault.init('correct horse battery staple');
    await client.default.entities.PasswordEntry.create({
      site: 'example.com',
      username: 'u',
      password: 'hunter2',
    });
    vault.lock();
    const list = await client.default.entities.PasswordEntry.list();
    expect(list).toHaveLength(1);
    expect(list[0].password).toBeNull();
    expect(list[0].__locked).toBe(true);
    expect(list[0].site).toBe('example.com');
  });

  it('migrateLegacyPlaintext encrypts pre-existing plaintext records', async () => {
    // Seed plaintext records before the vault exists (legacy state).
    localStorage.setItem(
      'incognito_entity_PasswordEntry',
      JSON.stringify([
        { id: 'old1', site: 'a.com', username: 'u', password: 'plaintext_old', created_date: 'x', updated_date: 'x' },
      ]),
    );
    localStorage.setItem('incognito_api_keys', JSON.stringify({ openai_api_key: 'sk-legacy' }));

    // Re-import client to pick up the seeded state.
    client = await freshClient();
    vault = (await import('@/lib/vault')).default;
    vault.setInactivityTimeoutMs(0);

    await vault.init('correct horse battery staple');
    const summary = await client.migrateLegacyPlaintext();
    expect(summary.entities.PasswordEntry.migrated).toBe(1);

    const raw = JSON.parse(localStorage.getItem('incognito_entity_PasswordEntry'));
    expect(raw[0].password).toMatchObject({ iv: expect.any(String), ct: expect.any(String) });
    expect(JSON.stringify(raw)).not.toContain('plaintext_old');

    // Legacy plaintext API key blob should be removed after warming.
    expect(localStorage.getItem('incognito_api_keys')).toBeNull();
    expect(localStorage.getItem('incognito_api_keys_enc_v1')).toBeTruthy();
  });

  it('non-sensitive entities are unaffected by vault state', async () => {
    // Profile is in CRITICAL_ENTITIES but not in SENSITIVE_ENTITY_FIELDS.
    const profile = await client.default.entities.Profile.create({ name: 'Alice', is_default: true });
    expect(profile.name).toBe('Alice');
    const list = await client.default.entities.Profile.list();
    expect(list).toHaveLength(1);
  });

  it('exposes the sensitive entity name list for the UI', () => {
    const names = client.getSensitiveEntityNames();
    expect(names).toContain('PasswordEntry');
    expect(names).toContain('TOTPSecret');
    expect(names).toContain('VirtualCard');
  });
});
