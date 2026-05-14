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

describe('getApiKeys never returns legacy plaintext', () => {
  let client;
  let vault;

  beforeEach(async () => {
    localStorage.clear();
    client = await freshClient();
    vault = (await import('@/lib/vault')).default;
    vault.setInactivityTimeoutMs(0);
  });

  it('returns {} when only legacy plaintext exists and the vault is locked', async () => {
    localStorage.setItem(
      'incognito_api_keys',
      JSON.stringify({ openai_api_key: 'sk-PLAINTEXT-LEGACY', hibp_api_key: 'hibp-LEGACY' }),
    );
    // Re-import after seeding.
    client = await freshClient();

    expect(vault.isUnlocked()).toBe(false);
    const keys = client.getApiKeys();
    expect(keys).toEqual({});
    expect(keys.openai_api_key).toBeUndefined();
  });

  it('returns {} when only legacy plaintext exists and the vault is unlocked but migration has not yet completed (synchronous call)', async () => {
    localStorage.setItem('incognito_api_keys', JSON.stringify({ openai_api_key: 'sk-PLAINTEXT' }));
    client = await freshClient();
    vault = (await import('@/lib/vault')).default;
    vault.setInactivityTimeoutMs(0);
    await vault.init('correct horse battery staple');

    // Synchronous read MUST NOT echo plaintext.
    const sync = client.getApiKeys();
    expect(sync.openai_api_key).toBeUndefined();

    // Drain any pending async migration kicked off by getApiKeys so it does
    // not race the next test's beforeEach.
    await new Promise((r) => setTimeout(r, 50));
  });

  it('after migration completes, plaintext blob is hard-deleted and getApiKeys returns the encrypted-then-decrypted values', async () => {
    localStorage.setItem('incognito_api_keys', JSON.stringify({ openai_api_key: 'sk-MIGRATE-ME' }));
    client = await freshClient();
    vault = (await import('@/lib/vault')).default;
    vault.setInactivityTimeoutMs(0);

    await vault.init('correct horse battery staple');
    expect(vault.isUnlocked()).toBe(true);
    expect(client.legacyPlaintextApiKeysExist()).toBe(true);

    await client.migrateLegacyPlaintext();

    expect(localStorage.getItem('incognito_api_keys_enc_v1')).toBeTruthy();
    expect(localStorage.getItem('incognito_api_keys_enc_v1')).not.toContain('sk-MIGRATE-ME');
    // The legacy plaintext blob MUST be hard-deleted post-migration.
    expect(client.legacyPlaintextApiKeysExist()).toBe(false);
    expect(localStorage.getItem('incognito_api_keys')).toBeNull();

    const keys = client.getApiKeys();
    expect(keys.openai_api_key).toBe('sk-MIGRATE-ME');
  });

  it('migration fails closed when the vault is locked: plaintext stays untouched', async () => {
    localStorage.setItem('incognito_api_keys', JSON.stringify({ openai_api_key: 'sk-LOCKED' }));
    client = await freshClient();
    vault = (await import('@/lib/vault')).default;

    expect(vault.isUnlocked()).toBe(false);
    await expect(client.migrateLegacyPlaintext()).rejects.toThrow(/unlocked/i);
    // Plaintext was not deleted because we never had an encrypted copy.
    expect(localStorage.getItem('incognito_api_keys')).toBeTruthy();
  });

  it('after lock, getApiKeys returns {} even if encrypted blob exists (no ciphertext leak)', async () => {
    await vault.init('correct horse battery staple');
    await client.setApiKeys({ openai_api_key: 'sk-VALID' });
    expect(client.getApiKeys().openai_api_key).toBe('sk-VALID');

    vault.lock();
    const locked = client.getApiKeys();
    expect(locked).toEqual({});
    expect(JSON.stringify(locked)).not.toContain('sk-VALID');
  });
});

describe('consent gating covers every external provider', () => {
  it('catalog lists Twilio, SimpleLogin, addy.io alongside the legacy providers', async () => {
    const { EXTERNAL_PROVIDERS } = await import('@/lib/consent');
    const ids = EXTERNAL_PROVIDERS.map((p) => p.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'hibp', 'leakcheck', 'hunter', 'numverify', 'google_search',
        'privacy_com', 'openai', 'twilio', 'simplelogin', 'addy',
      ]),
    );
  });

  it('requireConsent throws E_CONSENT_REQUIRED for newly-added providers when not granted', async () => {
    const { requireConsent } = await import('@/lib/consent');
    for (const provider of ['twilio', 'simplelogin', 'addy']) {
      try {
        requireConsent(provider, provider === 'twilio' ? 'phone' : 'email');
        throw new Error(`expected ${provider} to throw`);
      } catch (err) {
        expect(err.code).toBe('E_CONSENT_REQUIRED');
        expect(err.providerId).toBe(provider);
      }
    }
  });
});

describe('external scan audit log is persistent', () => {
  beforeEach(async () => {
    localStorage.clear();
    await freshClient();
  });

  it('records ok/error/denied entries with bounded retention', async () => {
    const { withExternalCallAudit, getAuditLog, recordExternalCall } = await import('@/lib/auditLog');

    // ok
    await withExternalCallAudit({ provider: 'hibp', dataType: 'email' }, async () => 'success');
    // error
    await withExternalCallAudit({ provider: 'leakcheck', dataType: 'email' }, async () => {
      throw new Error('boom');
    }).catch(() => {});
    // denied (consent error code)
    await withExternalCallAudit({ provider: 'twilio', dataType: 'phone' }, async () => {
      const err = new Error('consent required');
      err.code = 'E_CONSENT_REQUIRED';
      throw err;
    }).catch(() => {});

    // direct record
    recordExternalCall({ provider: 'openai', dataType: 'profile_summary', status: 'ok' });

    const log = getAuditLog({ limit: 100 });
    const map = Object.fromEntries(log.map((e) => [e.provider, e.status]));
    expect(map.hibp).toBe('ok');
    expect(map.leakcheck).toBe('error');
    expect(map.twilio).toBe('denied');
    expect(map.openai).toBe('ok');
    // Persisted to localStorage so it survives a "reload".
    expect(localStorage.getItem('incognito_external_audit_v1')).toBeTruthy();
  });

  it('caps the log at MAX_ENTRIES', async () => {
    const { recordExternalCall, getAuditLog, __test } = await import('@/lib/auditLog');
    for (let i = 0; i < __test.MAX_ENTRIES + 50; i++) {
      recordExternalCall({ provider: 'hibp', dataType: 'email', status: 'ok' });
    }
    const log = getAuditLog({ limit: __test.MAX_ENTRIES + 100 });
    expect(log.length).toBeLessThanOrEqual(__test.MAX_ENTRIES);
  });
});
