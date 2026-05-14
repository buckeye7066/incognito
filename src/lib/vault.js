/**
 * Incognito local-first encrypted vault.
 *
 * Threat model and product mode are documented in `docs/THREAT_MODEL.md`. In
 * short: this is a local-first privacy app. The user supplies a master
 * password; we derive an AES-GCM key from it via PBKDF2 and use that key to
 * encrypt sensitive records before they are written to localStorage /
 * IndexedDB. The master password is never persisted. The derived key only
 * lives in memory, never in storage.
 *
 * Key properties:
 *   - WebCrypto only (`crypto.subtle`). No bespoke crypto.
 *   - PBKDF2-SHA256, 310,000 iterations (OWASP 2023 minimum at time of
 *     writing) for key derivation.
 *   - Per-vault random salt (16 bytes).
 *   - Per-record random IV/nonce (12 bytes for AES-GCM).
 *   - A non-secret "verifier" ciphertext is stored on init so we can fail
 *     unlock cleanly with the wrong password instead of silently producing
 *     garbage on decrypt.
 *   - Auto-lock after a configurable inactivity timeout (default 10 min).
 *   - All inputs are typed and validated.
 */

const STORAGE_PREFIX = 'incognito_vault_v1_';
export const VAULT_SALT_KEY = `${STORAGE_PREFIX}salt`;
export const VAULT_VERIFIER_KEY = `${STORAGE_PREFIX}verifier`;
export const VAULT_META_KEY = `${STORAGE_PREFIX}meta`;
export const PBKDF2_ITERATIONS = 310_000;
const VERIFIER_PLAINTEXT = 'incognito_vault_verifier_v1';

const subtle = () => {
  const c = (typeof globalThis !== 'undefined' && globalThis.crypto) || null;
  if (!c?.subtle) {
    throw new Error('WebCrypto (crypto.subtle) is not available in this environment.');
  }
  return c.subtle;
};

const randomBytes = (n) => {
  const c = (typeof globalThis !== 'undefined' && globalThis.crypto) || null;
  if (!c?.getRandomValues) {
    throw new Error('crypto.getRandomValues is not available in this environment.');
  }
  return c.getRandomValues(new Uint8Array(n));
};

const enc = new TextEncoder();
const dec = new TextDecoder();

const toHex = (bytes) =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

const fromHex = (hex) => {
  if (typeof hex !== 'string' || hex.length % 2 !== 0) {
    throw new Error('Invalid hex string');
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
};

async function deriveKey(password, salt) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Master password must be a non-empty string');
  }
  if (!(salt instanceof Uint8Array) || salt.length === 0) {
    throw new Error('Salt must be a non-empty Uint8Array');
  }
  const baseKey = await subtle().importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return subtle().deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encryptWithKey(key, plaintext) {
  const iv = randomBytes(12);
  const cipher = await subtle().encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext)),
  );
  return {
    v: 1,
    iv: toHex(iv),
    ct: toHex(new Uint8Array(cipher)),
  };
}

async function decryptWithKey(key, payload) {
  if (!payload || typeof payload !== 'object' || !payload.iv || !payload.ct) {
    throw new Error('Invalid ciphertext payload');
  }
  const iv = fromHex(payload.iv);
  const ct = fromHex(payload.ct);
  const buf = await subtle().decrypt({ name: 'AES-GCM', iv }, key, ct);
  return dec.decode(buf);
}

class VaultStore {
  constructor(storage) {
    this._storage = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    this._key = null;
    this._lockedAt = null;
    this._unlockedAt = null;
    this._inactivityTimeoutMs = 10 * 60 * 1000;
    this._inactivityTimer = null;
    this._listeners = new Set();
    this._lastActivity = 0;
  }

  _readStorage(key) {
    if (!this._storage) return null;
    try {
      return this._storage.getItem(key);
    } catch {
      return null;
    }
  }

  _writeStorage(key, value) {
    if (!this._storage) return false;
    try {
      this._storage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  _removeStorage(key) {
    if (!this._storage) return false;
    try {
      this._storage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }

  isInitialized() {
    return Boolean(this._readStorage(VAULT_SALT_KEY) && this._readStorage(VAULT_VERIFIER_KEY));
  }

  isUnlocked() {
    return this._key !== null;
  }

  state() {
    if (!this.isInitialized()) return 'unset';
    return this.isUnlocked() ? 'unlocked' : 'locked';
  }

  on(event, handler) {
    const wrapped = { event, handler };
    this._listeners.add(wrapped);
    return () => this._listeners.delete(wrapped);
  }

  _emit(event, payload) {
    for (const l of this._listeners) {
      if (l.event === event) {
        try {
          l.handler(payload);
        } catch {
          // listener errors must not break the vault
        }
      }
    }
  }

  setInactivityTimeoutMs(ms) {
    if (typeof ms !== 'number' || ms < 0) {
      throw new Error('inactivity timeout must be a non-negative number');
    }
    this._inactivityTimeoutMs = ms;
    if (this.isUnlocked()) this._resetInactivityTimer();
  }

  recordActivity() {
    if (!this.isUnlocked()) return;
    this._lastActivity = Date.now();
    this._resetInactivityTimer();
  }

  _resetInactivityTimer() {
    if (this._inactivityTimer) {
      clearTimeout(this._inactivityTimer);
      this._inactivityTimer = null;
    }
    if (!this._inactivityTimeoutMs || !this.isUnlocked()) return;
    this._inactivityTimer = setTimeout(() => {
      this.lock();
    }, this._inactivityTimeoutMs);
    if (typeof this._inactivityTimer?.unref === 'function') {
      this._inactivityTimer.unref();
    }
  }

  /**
   * Initialize a fresh vault. Throws if a vault already exists, unless
   * `{ overwrite: true }` is passed (which is destructive).
   */
  async init(masterPassword, options = {}) {
    if (this.isInitialized() && !options.overwrite) {
      throw new Error('Vault already initialized');
    }
    if (typeof masterPassword !== 'string' || masterPassword.length < 8) {
      throw new Error('Master password must be at least 8 characters');
    }
    const salt = randomBytes(16);
    const key = await deriveKey(masterPassword, salt);
    const verifier = await encryptWithKey(key, VERIFIER_PLAINTEXT);
    this._writeStorage(VAULT_SALT_KEY, toHex(salt));
    this._writeStorage(VAULT_VERIFIER_KEY, JSON.stringify(verifier));
    this._writeStorage(
      VAULT_META_KEY,
      JSON.stringify({ created_at: new Date().toISOString(), iterations: PBKDF2_ITERATIONS }),
    );
    this._key = key;
    this._unlockedAt = Date.now();
    this._lastActivity = this._unlockedAt;
    this._resetInactivityTimer();
    this._emit('initialized', null);
    this._emit('unlock', null);
    return true;
  }

  async unlock(masterPassword) {
    if (!this.isInitialized()) {
      throw new Error('Vault is not initialized');
    }
    if (typeof masterPassword !== 'string' || masterPassword.length === 0) {
      throw new Error('Master password is required');
    }
    const saltHex = this._readStorage(VAULT_SALT_KEY);
    const verifierRaw = this._readStorage(VAULT_VERIFIER_KEY);
    if (!saltHex || !verifierRaw) {
      throw new Error('Vault storage is corrupted');
    }
    const salt = fromHex(saltHex);
    let verifier;
    try {
      verifier = JSON.parse(verifierRaw);
    } catch {
      throw new Error('Vault verifier is corrupted');
    }
    const key = await deriveKey(masterPassword, salt);
    let verified;
    try {
      verified = await decryptWithKey(key, verifier);
    } catch {
      throw new Error('Invalid master password');
    }
    if (verified !== VERIFIER_PLAINTEXT) {
      throw new Error('Invalid master password');
    }
    this._key = key;
    this._unlockedAt = Date.now();
    this._lastActivity = this._unlockedAt;
    this._resetInactivityTimer();
    this._emit('unlock', null);
    return true;
  }

  lock() {
    if (this._inactivityTimer) {
      clearTimeout(this._inactivityTimer);
      this._inactivityTimer = null;
    }
    this._key = null;
    this._lockedAt = Date.now();
    this._emit('lock', null);
  }

  /**
   * Destroy the vault. Removes salt + verifier + meta. Requires an unlocked
   * vault unless `{ force: true }` is passed (which makes encrypted records
   * unrecoverable).
   */
  destroy(options = {}) {
    if (this.isInitialized() && !this.isUnlocked() && !options.force) {
      throw new Error('Vault must be unlocked to be destroyed');
    }
    this.lock();
    this._removeStorage(VAULT_SALT_KEY);
    this._removeStorage(VAULT_VERIFIER_KEY);
    this._removeStorage(VAULT_META_KEY);
    this._emit('destroyed', null);
  }

  async encrypt(value) {
    if (!this.isUnlocked()) throw new Error('Vault is locked');
    this.recordActivity();
    return encryptWithKey(this._key, value);
  }

  async decrypt(payload) {
    if (!this.isUnlocked()) throw new Error('Vault is locked');
    this.recordActivity();
    return decryptWithKey(this._key, payload);
  }

  /** Encrypt and JSON.stringify for storage as a single field. */
  async encryptJson(value) {
    return JSON.stringify(await this.encrypt(value));
  }

  /** Read JSON.stringify(encryptValue(...)) form. */
  async decryptJson(raw) {
    if (typeof raw !== 'string') throw new Error('decryptJson expects a string');
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('decryptJson received invalid JSON');
    }
    return this.decrypt(parsed);
  }

  /** Returns true if the given value looks like vault ciphertext. */
  static isCiphertext(value) {
    return Boolean(
      value &&
        typeof value === 'object' &&
        typeof value.iv === 'string' &&
        typeof value.ct === 'string' &&
        value.v === 1,
    );
  }
}

const _singleton = new VaultStore();

export { VaultStore, deriveKey, encryptWithKey, decryptWithKey };
export default _singleton;
