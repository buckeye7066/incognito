import { describe, it, expect, beforeEach } from 'vitest';

/**
 * End-to-end test for the Recovery Center backup/restore (Pass 14), exercising
 * the real vault crypto. Reloads the client module against fresh localStorage so
 * the singleton vault starts clean between cases.
 */
async function freshClient() {
  const vaultMod = await import('@/lib/vault');
  vaultMod.default.lock();
  return import('@/api/client.js?ts=' + Date.now());
}

describe('encrypted backup round-trip', () => {
  let client;
  let vault;

  beforeEach(async () => {
    localStorage.clear();
    client = await freshClient();
    vault = (await import('@/lib/vault')).default;
    vault.setInactivityTimeoutMs(0);
  });

  it('refuses to export or restore while the vault is locked', async () => {
    await expect(client.exportEncryptedBackup()).rejects.toThrow(/unlock/i);
    await expect(client.importEncryptedBackup({ app: 'incognito', encrypted: true, payload: {} }))
      .rejects.toThrow(/unlock/i);
  });

  it('exports encrypted (no plaintext secret) and restores after a wipe', async () => {
    await vault.init('correct horse battery staple');
    await client.incognito.entities.PasswordEntry.create({
      service_name: 'GitHub', service_url: 'https://github.com', username: 'me', password: 's3cret-pw',
    });

    const envelope = await client.exportEncryptedBackup();
    expect(envelope.encrypted).toBe(true);
    expect(envelope.manifest.totalRecords).toBeGreaterThanOrEqual(1);
    // The whole payload is ciphertext — the secret must not appear anywhere.
    expect(JSON.stringify(envelope)).not.toContain('s3cret-pw');

    // Simulate data loss (clear records, keep the same vault key).
    const before = await client.incognito.entities.PasswordEntry.list();
    for (const e of before) await client.incognito.entities.PasswordEntry.delete(e.id);
    expect(await client.incognito.entities.PasswordEntry.list()).toHaveLength(0);

    const result = await client.importEncryptedBackup(envelope, { mode: 'merge' });
    expect(result.imported).toBeGreaterThanOrEqual(1);

    const restored = await client.incognito.entities.PasswordEntry.list();
    expect(restored.find((p) => p.password === 's3cret-pw')).toBeTruthy();
  });

  it('rejects a non-Incognito / plaintext file', async () => {
    await vault.init('correct horse battery staple');
    await expect(client.importEncryptedBackup({ app: 'other' })).rejects.toThrow(/not an Incognito/i);
    await expect(client.importEncryptedBackup({ app: 'incognito', version: 1, entities: {} }))
      .rejects.toThrow(/plaintext/i);
  });

  it('fails a tampered backup on the integrity check', async () => {
    await vault.init('correct horse battery staple');
    await client.incognito.entities.PasswordEntry.create({ service_name: 'X', service_url: 'https://x.com', username: 'u', password: 'p' });
    const envelope = await client.exportEncryptedBackup();
    // Corrupt the stored checksum so decrypt succeeds but integrity fails.
    const tampered = { ...envelope, manifest: { ...envelope.manifest } };
    // Re-encrypt an inner payload whose embedded checksum won't match its data.
    const badInner = JSON.stringify({ entities: { PasswordEntry: [{ id: 'z', password: 'mutated' }] }, checksum: 'deadbeef' });
    tampered.payload = await vault.encrypt(badInner);
    await expect(client.importEncryptedBackup(tampered)).rejects.toThrow(/integrity/i);
  });
});
