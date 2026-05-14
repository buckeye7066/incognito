import { describe, it, expect, beforeEach } from 'vitest';
import {
  VaultStore,
  VAULT_SALT_KEY,
  VAULT_VERIFIER_KEY,
} from '@/lib/vault';

function makeStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    _raw: store,
  };
}

describe('VaultStore', () => {
  let storage;
  let vault;

  beforeEach(() => {
    storage = makeStorage();
    vault = new VaultStore(storage);
    vault.setInactivityTimeoutMs(0); // disable auto-lock in tests
  });

  it('starts in unset state', () => {
    expect(vault.state()).toBe('unset');
    expect(vault.isUnlocked()).toBe(false);
  });

  it('refuses init with a short master password', async () => {
    await expect(vault.init('short')).rejects.toThrow(/at least 8/);
    expect(vault.isInitialized()).toBe(false);
  });

  it('initializes, persists salt+verifier, and is immediately unlocked', async () => {
    await vault.init('correct horse battery staple');
    expect(vault.isInitialized()).toBe(true);
    expect(vault.isUnlocked()).toBe(true);
    expect(storage.getItem(VAULT_SALT_KEY)).toBeTruthy();
    expect(storage.getItem(VAULT_VERIFIER_KEY)).toBeTruthy();
  });

  it('refuses to init twice without overwrite', async () => {
    await vault.init('correct horse battery staple');
    await expect(vault.init('different password!')).rejects.toThrow(/already initialized/);
  });

  it('roundtrips encrypt/decrypt', async () => {
    await vault.init('correct horse battery staple');
    const ct = await vault.encrypt('the launch codes are 4-8-15-16-23-42');
    expect(ct.iv).toMatch(/^[0-9a-f]+$/);
    expect(ct.ct).toMatch(/^[0-9a-f]+$/);
    const pt = await vault.decrypt(ct);
    expect(pt).toBe('the launch codes are 4-8-15-16-23-42');
  });

  it('two encryptions of the same value produce different ciphertext (random IV)', async () => {
    await vault.init('correct horse battery staple');
    const a = await vault.encrypt('hello');
    const b = await vault.encrypt('hello');
    expect(a.iv).not.toEqual(b.iv);
    expect(a.ct).not.toEqual(b.ct);
  });

  it('unlock with the correct password succeeds after a fresh VaultStore loads existing state', async () => {
    await vault.init('correct horse battery staple');
    const ct = await vault.encrypt('secret');
    vault.lock();

    const v2 = new VaultStore(storage);
    v2.setInactivityTimeoutMs(0);
    expect(v2.isInitialized()).toBe(true);
    expect(v2.isUnlocked()).toBe(false);

    await v2.unlock('correct horse battery staple');
    expect(v2.isUnlocked()).toBe(true);
    const pt = await v2.decrypt(ct);
    expect(pt).toBe('secret');
  });

  it('unlock fails with the wrong password and stays locked', async () => {
    await vault.init('correct horse battery staple');
    vault.lock();
    await expect(vault.unlock('wrong password!')).rejects.toThrow(/Invalid master password/);
    expect(vault.isUnlocked()).toBe(false);
  });

  it('lock clears the in-memory key', async () => {
    await vault.init('correct horse battery staple');
    vault.lock();
    expect(vault.isUnlocked()).toBe(false);
    await expect(vault.encrypt('x')).rejects.toThrow(/locked/);
  });

  it('emits lock and unlock events', async () => {
    const events = [];
    vault.on('unlock', () => events.push('unlock'));
    vault.on('lock', () => events.push('lock'));
    await vault.init('correct horse battery staple');
    vault.lock();
    expect(events).toEqual(['unlock', 'lock']);
  });

  it('destroy removes vault state', async () => {
    await vault.init('correct horse battery staple');
    vault.destroy();
    expect(vault.isInitialized()).toBe(false);
    expect(vault.isUnlocked()).toBe(false);
  });

  it('detects ciphertext via VaultStore.isCiphertext', async () => {
    await vault.init('correct horse battery staple');
    const ct = await vault.encrypt('hello');
    expect(VaultStore.isCiphertext(ct)).toBe(true);
    expect(VaultStore.isCiphertext('hello')).toBe(false);
    expect(VaultStore.isCiphertext({ iv: 'x' })).toBe(false);
  });
});
