import { matchBreaches, estimateBrokerExposure, fetchLiveBreachList, leakCheckPublic } from './breachDatabase.js';
import vault, { VaultStore } from '@/lib/vault';
import { requireConsent, isProviderAllowed } from '@/lib/consent';

const STORAGE_PREFIX = 'incognito_entity_';
const SETTINGS_KEY = 'incognito_api_keys';
const SETTINGS_KEY_ENCRYPTED = 'incognito_api_keys_enc_v1';

function generateId() {
  return Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
}

// In-memory cache of decrypted API keys. Cleared whenever the vault locks.
let _apiKeysCache = null;
try {
  vault.on('lock', () => {
    _apiKeysCache = null;
  });
  vault.on('destroyed', () => {
    _apiKeysCache = null;
  });
} catch {
  // vault listeners are best-effort
}

export function resolvePersonalDataValue(item) {
  if (!item?.value) return '';
  const v = item.value;
  const t = item.data_type;
  if (typeof v !== 'string') return String(v);
  if (t === 'address' || t === 'dob' || t === 'ssn') {
    try {
      const parsed = JSON.parse(v);
      if (t === 'address') {
        return [parsed.street, parsed.city, parsed.state, parsed.zip].filter(Boolean).join(', ');
      }
      if (t === 'dob') {
        return [parsed.month, parsed.day, parsed.year].filter(Boolean).join('/');
      }
      if (t === 'ssn') {
        return [parsed.area, parsed.group, parsed.serial].filter(Boolean).join('-');
      }
    } catch { /* not JSON — return as-is */ }
  }
  return v;
}

/**
 * Read API keys.
 *
 * Vault-aware behavior:
 *   - If an encrypted API key blob exists at SETTINGS_KEY_ENCRYPTED:
 *       - vault unlocked → returns decrypted keys (memo-cached until lock).
 *       - vault locked   → returns `{}` (do not leak ciphertext).
 *   - If the legacy plaintext SETTINGS_KEY exists, it is returned but ALSO
 *     migrated into the encrypted blob the next time the vault is unlocked.
 *
 * Synchronous: returns from the memo cache when the vault is unlocked. Pages
 * that mutate api keys go through `setApiKeys` which is async-safe.
 */
export function getApiKeys() {
  if (_apiKeysCache && vault.isUnlocked()) return { ..._apiKeysCache };
  let encryptedRaw = null;
  let plainRaw = null;
  try { encryptedRaw = localStorage.getItem(SETTINGS_KEY_ENCRYPTED); } catch {}
  try { plainRaw = localStorage.getItem(SETTINGS_KEY); } catch {}

  if (encryptedRaw) {
    if (!vault.isUnlocked()) return {};
    try {
      const payload = JSON.parse(encryptedRaw);
      // Synchronous read by deriving from the in-memory cache. We populate the
      // cache the first time the vault unlocks via warmApiKeysFromVault().
      if (_apiKeysCache) return { ..._apiKeysCache };
      // First call after unlock — fall through to plaintext (none) and let the
      // caller's next async tick warm the cache.
      void warmApiKeysFromVault().catch(() => {});
      return {};
    } catch {
      return {};
    }
  }

  if (plainRaw) {
    try { return JSON.parse(plainRaw) || {}; } catch { return {}; }
  }
  return {};
}

async function warmApiKeysFromVault() {
  if (!vault.isUnlocked()) return;
  let encryptedRaw = null;
  try { encryptedRaw = localStorage.getItem(SETTINGS_KEY_ENCRYPTED); } catch {}
  if (!encryptedRaw) {
    // Migrate legacy plaintext on first unlock.
    let plainRaw = null;
    try { plainRaw = localStorage.getItem(SETTINGS_KEY); } catch {}
    if (plainRaw) {
      try {
        const parsed = JSON.parse(plainRaw) || {};
        await persistApiKeysEncrypted(parsed);
        try { localStorage.removeItem(SETTINGS_KEY); } catch {}
        _apiKeysCache = parsed;
      } catch {
        _apiKeysCache = {};
      }
    } else {
      _apiKeysCache = {};
    }
    return;
  }
  try {
    const payload = JSON.parse(encryptedRaw);
    const decrypted = await vault.decrypt(payload);
    _apiKeysCache = JSON.parse(decrypted);
  } catch {
    _apiKeysCache = {};
  }
}

async function persistApiKeysEncrypted(keys) {
  if (!vault.isUnlocked()) {
    throw new Error('Vault must be unlocked to persist encrypted API keys');
  }
  const payload = await vault.encrypt(JSON.stringify(keys));
  try {
    localStorage.setItem(SETTINGS_KEY_ENCRYPTED, JSON.stringify(payload));
  } catch (e) {
    console.error('[apiKeys] persist failed', e);
  }
}

export async function unlockApiKeys(masterPassword) {
  if (!vault.isInitialized()) {
    await vault.init(masterPassword);
  } else {
    await vault.unlock(masterPassword);
  }
  await warmApiKeysFromVault();
  return true;
}

export function lockApiKeys() {
  vault.lock();
  _apiKeysCache = null;
}

/**
 * Set or merge API keys.
 *
 * If the vault is unlocked, persists encrypted-at-rest. Otherwise, refuses
 * to write — silent plaintext fallback was the original bug.
 */
export async function setApiKeys(keys) {
  if (!keys || typeof keys !== 'object') throw new Error('keys must be an object');
  if (!vault.isUnlocked()) {
    throw new Error('Vault must be unlocked to set API keys');
  }
  const current = _apiKeysCache || {};
  const next = { ...current, ...keys };
  await persistApiKeysEncrypted(next);
  _apiKeysCache = next;
  return true;
}

/** Returns true iff API keys are stored encrypted-at-rest. */
export function apiKeysAreEncrypted() {
  try { return Boolean(localStorage.getItem(SETTINGS_KEY_ENCRYPTED)); }
  catch { return false; }
}

/** Used by the UI to surface migration status / call-to-action. */
export function legacyPlaintextApiKeysExist() {
  try { return Boolean(localStorage.getItem(SETTINGS_KEY)); }
  catch { return false; }
}

// Re-export vault helpers so consumers don't import from two places.
export { vault, VaultStore };

const CRITICAL_ENTITIES = ['Profile', 'PersonalData', 'UserPreferences'];

// ── Stable user identity ──
//
// Local-first identity. There is no "admin" role on the client — it carries no
// security weight in a local-only app and cannot enforce authorization.
//
// Pages that need elevated access (developer/diagnostic tooling) check the
// separate `developerMode` flag, which the user must explicitly enable from
// Settings → Advanced. See docs/THREAT_MODEL.md.
const USER_KEY = 'incognito_user_identity';
const DEVELOPER_MODE_KEY = 'incognito_developer_mode';

function getStableUserId() {
  let stored = localStorage.getItem(USER_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Migrate any pre-existing record that was stamped with the legacy default
      // `role: 'admin'`. The role is now informational only.
      if (parsed.role === 'admin') {
        parsed.role = 'user';
        try { localStorage.setItem(USER_KEY, JSON.stringify(parsed)); } catch {}
      }
      if (!parsed.role) {
        parsed.role = 'user';
        try { localStorage.setItem(USER_KEY, JSON.stringify(parsed)); } catch {}
      }
      return parsed;
    } catch {}
  }
  const identity = { id: 'local_user', name: 'Local User', role: 'user', created: new Date().toISOString() };
  try { localStorage.setItem(USER_KEY, JSON.stringify(identity)); } catch {}
  return identity;
}

export function isDeveloperModeEnabled() {
  try { return localStorage.getItem(DEVELOPER_MODE_KEY) === 'true'; }
  catch { return false; }
}

export function setDeveloperMode(enabled) {
  try {
    if (enabled) localStorage.setItem(DEVELOPER_MODE_KEY, 'true');
    else localStorage.removeItem(DEVELOPER_MODE_KEY);
  } catch {}
}

// ── IndexedDB helper for critical entity persistence ──
const IDB_NAME = 'incognito_db';
const IDB_VERSION = 1;
const IDB_STORE = 'entities';

let _dbPromise = null;
function openIDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { _dbPromise = null; reject(req.error); };
      req.onblocked = () => { _dbPromise = null; reject(new Error('IDB blocked')); };
    } catch (e) { _dbPromise = null; reject(e); }
  });
  return _dbPromise;
}

async function idbRead(key) {
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(key);
      req.onsuccess = () => {
        const val = req.result;
        resolve(Array.isArray(val) ? val : null);
      };
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

async function idbWrite(key, data) {
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put(data, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch { return false; }
}

// IDB ready promise — awaited by critical entity list() to guarantee recovery finishes first
const _idbRecoveryPromises = {};

// Entities that contain raw secrets/PII whose values must be encrypted at rest.
// The listed fields are encrypted with the vault key on save and decrypted on
// read. When the vault is locked, sensitive entity reads return placeholders
// (no plaintext) and writes are rejected. Adding a new sensitive entity is a
// one-line change here.
const SENSITIVE_ENTITY_FIELDS = {
  PasswordEntry: ['password', 'totp_secret', 'recovery_codes', 'notes'],
  TOTPSecret: ['secret', 'recovery_codes'],
  EmailAlias: ['actual_email'],
  PhoneAlias: ['actual_phone'],
  VirtualCard: ['card_number', 'cvv', 'pin', 'billing_address'],
  FinancialAccount: ['account_number', 'routing_number', 'login_password'],
  PersonalData: ['value'],
  CloakedIdentity: ['ssn', 'passport', 'dl_number', 'tax_id', 'medical_id', 'notes'],
  SharedIdentity: [], // already encrypted at the API level
  IdentityCustomField: ['value'],
  MonitoredAccount: ['account_password', 'recovery_email'],
  DisposableCredential: ['email_address', 'phone_number', 'masked_card_number'],
};

function isSensitiveEntity(name) {
  return Object.prototype.hasOwnProperty.call(SENSITIVE_ENTITY_FIELDS, name);
}

function isVaultCiphertext(value) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      typeof value.iv === 'string' &&
      typeof value.ct === 'string' &&
      value.v === 1,
  );
}

async function encryptSensitiveFields(entityName, item) {
  const fields = SENSITIVE_ENTITY_FIELDS[entityName];
  if (!fields || fields.length === 0) return item;
  if (!vault.isUnlocked()) {
    throw new Error(
      `Vault must be unlocked to write ${entityName} records. ` +
      `Call vault.unlock(masterPassword) first.`,
    );
  }
  const out = { ...item };
  for (const field of fields) {
    const v = out[field];
    if (v == null) continue;
    if (isVaultCiphertext(v)) continue; // already encrypted
    const plaintext = typeof v === 'string' ? v : JSON.stringify(v);
    out[field] = await vault.encrypt(plaintext);
  }
  return out;
}

async function decryptSensitiveFields(entityName, item) {
  const fields = SENSITIVE_ENTITY_FIELDS[entityName];
  if (!fields || fields.length === 0) return item;
  if (!item || typeof item !== 'object') return item;
  if (!vault.isUnlocked()) {
    // Locked: redact sensitive fields. Do NOT leak ciphertext.
    const safe = { ...item };
    for (const field of fields) {
      if (safe[field] != null) safe[field] = null;
    }
    safe.__locked = true;
    return safe;
  }
  const out = { ...item };
  for (const field of fields) {
    const v = out[field];
    if (v == null) continue;
    if (!isVaultCiphertext(v)) continue; // legacy plaintext
    try {
      const plaintext = await vault.decrypt(v);
      try { out[field] = JSON.parse(plaintext); }
      catch { out[field] = plaintext; }
    } catch {
      out[field] = null;
    }
  }
  return out;
}

function createEntityStore(entityName) {
  const storageKey = STORAGE_PREFIX + entityName;
  const backupKey = storageKey + '_bak';
  const isCritical = CRITICAL_ENTITIES.includes(entityName);
  const sensitive = isSensitiveEntity(entityName);
  let _cache = null; // in-memory write-through cache

  function readStorage(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch { return null; }
  }

  function getAll() {
    if (_cache) return _cache;
    let data = readStorage(storageKey);
    if (!data && isCritical) {
      data = readStorage(backupKey);
      if (data) {
        try { localStorage.setItem(storageKey, JSON.stringify(data)); } catch {}
      }
    }
    _cache = data || [];
    return _cache;
  }

  function saveAll(items) {
    _cache = items;
    const json = JSON.stringify(items);
    try {
      localStorage.setItem(storageKey, json);
      if (isCritical) {
        localStorage.setItem(backupKey, json);
      }
    } catch (e) {
      console.error(`[${entityName}] Storage write failed:`, e);
    }
    if (isCritical) {
      idbWrite(storageKey, items).catch(() => {});
    }
  }

  if (isCritical) {
    _idbRecoveryPromises[entityName] = (async () => {
      const current = readStorage(storageKey);
      if (current && current.length > 0) { _cache = current; return; }
      try {
        const idbData = await idbRead(storageKey);
        if (idbData && idbData.length > 0) {
          const lsNow = readStorage(storageKey);
          if (!lsNow || lsNow.length === 0) {
            localStorage.setItem(storageKey, JSON.stringify(idbData));
            localStorage.setItem(backupKey, JSON.stringify(idbData));
            _cache = idbData;
          }
        }
      } catch {}
    })();
  }

  async function decryptList(items) {
    if (!sensitive) return items;
    const out = [];
    for (const item of items) {
      out.push(await decryptSensitiveFields(entityName, item));
    }
    return out;
  }

  return {
    _storageKey: storageKey,
    _isSensitive: sensitive,
    _sensitiveFields: sensitive ? [...SENSITIVE_ENTITY_FIELDS[entityName]] : [],

    async list(sortField, limit) {
      if (isCritical && _idbRecoveryPromises[entityName]) {
        await _idbRecoveryPromises[entityName];
      }
      let items = getAll();
      if (isCritical && items.length === 0) {
        const idbData = await idbRead(storageKey);
        if (idbData && idbData.length > 0) {
          try {
            localStorage.setItem(storageKey, JSON.stringify(idbData));
            localStorage.setItem(backupKey, JSON.stringify(idbData));
          } catch {}
          _cache = idbData;
          items = idbData;
        }
      }
      if (sortField && typeof sortField === 'string') {
        items = items.slice();
        const desc = sortField.startsWith('-');
        const field = desc ? sortField.slice(1) : sortField;
        items.sort((a, b) => {
          const aVal = a[field] ?? '';
          const bVal = b[field] ?? '';
          if (aVal < bVal) return desc ? 1 : -1;
          if (aVal > bVal) return desc ? -1 : 1;
          return 0;
        });
      }
      if (typeof limit === 'number' && limit > 0) {
        items = items.slice(0, limit);
      }
      return decryptList(items);
    },

    async create(data) {
      const items = getAll();
      const now = new Date().toISOString();
      const baseItem = { id: generateId(), ...data, created_date: now, updated_date: now };
      const stored = sensitive ? await encryptSensitiveFields(entityName, baseItem) : baseItem;
      items.push(stored);
      saveAll(items);
      return sensitive ? await decryptSensitiveFields(entityName, stored) : stored;
    },

    async update(id, data) {
      const items = getAll();
      const idx = items.findIndex((item) => item.id === id);
      if (idx === -1) return null;
      const merged = { ...items[idx], ...data, id, updated_date: new Date().toISOString() };
      const stored = sensitive ? await encryptSensitiveFields(entityName, merged) : merged;
      items[idx] = stored;
      saveAll(items);
      return sensitive ? await decryptSensitiveFields(entityName, stored) : stored;
    },

    async delete(id) {
      const items = getAll();
      const filtered = items.filter((item) => item.id !== id);
      if (filtered.length === items.length) return false;
      saveAll(filtered);
      return true;
    },

    async clear() {
      saveAll([]);
    },

    async filter(criteria) {
      const items = getAll();
      // Filter on plaintext-only fields. Filtering on a sensitive field is
      // intentionally unsupported because those values are encrypted at rest.
      const matched = items.filter(item => {
        for (const [key, value] of Object.entries(criteria)) {
          if (sensitive && SENSITIVE_ENTITY_FIELDS[entityName].includes(key)) {
            // Refuse to filter on encrypted fields — would require decrypting
            // the entire collection, which leaks data and is slow.
            return false;
          }
          if (item[key] !== value) return false;
        }
        return true;
      });
      return decryptList(matched);
    },

    /** Internal: returns raw stored items WITHOUT decryption. Used for migration. */
    _rawAll() {
      return getAll().slice();
    },

    /**
     * One-shot migration: encrypt any legacy plaintext sensitive fields using
     * the currently unlocked vault. Returns { migrated, total }.
     */
    async migratePlaintext() {
      if (!sensitive) return { migrated: 0, total: 0 };
      if (!vault.isUnlocked()) {
        throw new Error('Vault must be unlocked to migrate plaintext records');
      }
      const items = getAll();
      let migrated = 0;
      const next = [];
      for (const item of items) {
        const before = JSON.stringify(item);
        const enc = await encryptSensitiveFields(entityName, item);
        const after = JSON.stringify(enc);
        if (after !== before) migrated += 1;
        next.push(enc);
      }
      if (migrated > 0) saveAll(next);
      return { migrated, total: items.length };
    },
  };
}

const ENTITY_NAMES = [
  'Profile', 'PersonalData', 'ScanResult', 'SocialMediaFinding',
  'SocialMediaProfile', 'SocialMediaMention', 'ExposureFixLog',
  'FinancialAccount', 'SuspiciousActivity', 'UserPreferences',
  'SpamIncident', 'NotificationAlert', 'MonitoredAccount',
  'DisposableCredential', 'DeletionRequest', 'DeletionEmailResponse',
  'AIInsight', 'DigitalFootprintReport', 'SearchQueryFinding',
  'Subscription',
  'SettlementCase', 'SettlementMatch', 'SettlementClaim',
  'DebtIssue', 'CreditDispute',
  // Cloaked Identity features
  'CloakedIdentity', 'PasswordEntry', 'TOTPSecret', 'EmailAlias',
  'PhoneAlias', 'VirtualCard', 'SharedIdentity', 'VPNConfig',
  'CallGuardLog', 'SSNMonitorAlert', 'AIDefenseAlert',
  'IdentityCustomField',
  'BrokerRemovalCampaign', 'BrokerRemovalTask',
  'ActionRecommendation', 'RiskFactor', 'MerchantProfile',
  'CreditReport', 'CreditTradeline', 'CreditInquiry', 'CreditCollection',
  'CreditDisputeItem', 'CreditDisputeCase', 'CreditDisputeEvidence',
  'BureauAccount', 'CreditDisputeTimeline',
];

const entities = {};
for (const name of ENTITY_NAMES) {
  entities[name] = createEntityStore(name);
}

/**
 * Migrate legacy plaintext sensitive records into the encrypted form using
 * the unlocked vault. Safe to call multiple times — already-encrypted
 * records are skipped. Should be called once after the user unlocks the
 * vault for the first time after upgrading.
 */
export async function migrateLegacyPlaintext() {
  if (!vault.isUnlocked()) {
    throw new Error('Vault must be unlocked to migrate plaintext records');
  }
  const summary = { entities: {}, total: 0 };
  for (const name of Object.keys(SENSITIVE_ENTITY_FIELDS)) {
    const store = entities[name];
    if (!store?.migratePlaintext) continue;
    try {
      const result = await store.migratePlaintext();
      summary.entities[name] = result;
      summary.total += result.migrated;
    } catch (err) {
      summary.entities[name] = { error: String(err?.message || err) };
    }
  }
  if (legacyPlaintextApiKeysExist()) {
    try { await warmApiKeysFromVault(); } catch {}
  }
  return summary;
}

/** List of entities subject to vault encryption. Useful for UI status. */
export function getSensitiveEntityNames() {
  return Object.keys(SENSITIVE_ENTITY_FIELDS);
}

// No cache invalidation needed — entity stores always read fresh from localStorage

// ---------------------------------------------------------------------------
// LLM Integration (OpenAI-compatible)
// ---------------------------------------------------------------------------
async function invokeLLM({ prompt, response_json_schema, add_context_from_internet }) {
  // Outbound-PII guard: explicit user consent is required.
  requireConsent('openai', 'profile_summary');
  const keys = getApiKeys();
  if (!keys.openai_api_key) {
    throw new Error('OpenAI API key not configured. Go to Settings → API Keys to add it.');
  }

  const messages = [{ role: 'user', content: prompt }];
  const body = {
    model: keys.openai_model || 'gpt-4o-mini',
    messages,
    temperature: 0.3,
  };

  if (response_json_schema) {
    body.response_format = { type: 'json_object' };
    messages[0].content += '\n\nRespond ONLY with valid JSON matching this schema: ' + JSON.stringify(response_json_schema);
  }

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${keys.openai_api_key}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenAI API error (${resp.status}): ${err}`);
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || '';

  if (response_json_schema) {
    try { return JSON.parse(content); } catch {
      console.warn('[invokeLLM] Failed to parse JSON response, returning empty object');
      return {};
    }
  }
  return content;
}

// ---------------------------------------------------------------------------
// Privacy.com API helpers
// ---------------------------------------------------------------------------
async function privacyComApi(endpoint, method = 'GET', body = null) {
  requireConsent('privacy_com', 'address');
  const keys = getApiKeys();
  if (!keys.privacy_com_api_key) {
    throw new Error('Privacy.com API key not configured. Go to Settings → API Keys.');
  }
  const baseUrl = keys.privacy_com_sandbox ? 'https://sandbox.privacy.com/v1' : 'https://api.privacy.com/v1';
  const opts = {
    method,
    headers: {
      'Authorization': `api-key ${keys.privacy_com_api_key}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(`${baseUrl}${endpoint}`, opts);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Privacy.com API error (${resp.status}): ${text}`);
  }
  return resp.json();
}

// ---------------------------------------------------------------------------
// Google Custom Search API
// ---------------------------------------------------------------------------
async function googleSearch(query) {
  if (!isProviderAllowed('google_search')) return null;
  const keys = getApiKeys();
  if (!keys.google_search_api_key || !keys.google_search_cx) return null;
  const url = `https://www.googleapis.com/customsearch/v1?key=${keys.google_search_api_key}&cx=${keys.google_search_cx}&q=${encodeURIComponent(query)}&num=10`;
  const resp = await fetch(url);
  if (!resp.ok) {
    console.warn(`[Google Search] API error (${resp.status})`);
    return null;
  }
  const data = await resp.json();
  return (data.items || []).map(item => ({
    title: item.title,
    url: item.link,
    snippet: item.snippet,
    displayLink: item.displayLink,
  }));
}

// ---------------------------------------------------------------------------
// Hunter.io API
// ---------------------------------------------------------------------------
async function hunterVerifyEmail(email) {
  if (!isProviderAllowed('hunter', 'email')) return null;
  const keys = getApiKeys();
  if (!keys.hunter_api_key) return null;
  const resp = await fetch(`https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${keys.hunter_api_key}`);
  if (!resp.ok) return null;
  const { data } = await resp.json();
  return data;
}

async function hunterDomainSearch(domain) {
  if (!isProviderAllowed('hunter', 'domain')) return null;
  const keys = getApiKeys();
  if (!keys.hunter_api_key) return null;
  const resp = await fetch(`https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${keys.hunter_api_key}`);
  if (!resp.ok) return null;
  const { data } = await resp.json();
  return data;
}

// ---------------------------------------------------------------------------
// LeakCheck.io API
// ---------------------------------------------------------------------------
async function leakCheckLookup(value, type = 'email') {
  if (!isProviderAllowed('leakcheck', type)) return null;
  const keys = getApiKeys();
  if (!keys.leakcheck_api_key) return null;
  const resp = await fetch(`https://leakcheck.io/api/public?check=${encodeURIComponent(value)}`, {
    headers: { 'X-API-Key': keys.leakcheck_api_key },
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.success ? (data.result || []) : null;
}

// ---------------------------------------------------------------------------
// NumVerify API
// ---------------------------------------------------------------------------
async function numVerifyLookup(phone) {
  if (!isProviderAllowed('numverify', 'phone')) return null;
  const keys = getApiKeys();
  if (!keys.numverify_api_key) return null;
  const cleaned = phone.replace(/\D/g, '');
  const resp = await fetch(`https://apilayer.net/api/validate?access_key=${keys.numverify_api_key}&number=${cleaned}&format=1`);
  if (!resp.ok) return null;
  return resp.json();
}

// ---------------------------------------------------------------------------
// HIBP API helpers
// ---------------------------------------------------------------------------
async function hibpApi(endpoint) {
  requireConsent('hibp', 'email');
  const keys = getApiKeys();
  if (!keys.hibp_api_key) {
    throw new Error('HIBP API key not configured. Go to Settings → API Keys.');
  }
  const resp = await fetch(`https://haveibeenpwned.com/api/v3${endpoint}`, {
    headers: {
      'hibp-api-key': keys.hibp_api_key,
    },
  });
  if (resp.status === 404) return [];
  if (resp.status === 429) throw new Error('HIBP rate limit exceeded. Wait 6 seconds and retry.');
  if (!resp.ok) throw new Error(`HIBP API error (${resp.status})`);
  return resp.json();
}

// ---------------------------------------------------------------------------
// Twilio API helpers (Phone Aliases)
// ---------------------------------------------------------------------------
async function twilioApi(endpoint, method = 'GET', body = null) {
  const keys = getApiKeys();
  if (!keys.twilio_account_sid || !keys.twilio_auth_token) {
    throw new Error('Twilio credentials not configured. Go to Settings → API Keys.');
  }
  const baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${keys.twilio_account_sid}`;
  const auth = btoa(`${keys.twilio_account_sid}:${keys.twilio_auth_token}`);
  const opts = {
    method,
    headers: { 'Authorization': `Basic ${auth}` },
  };
  if (body) {
    opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    opts.body = new URLSearchParams(body).toString();
  }
  const resp = await fetch(`${baseUrl}${endpoint}.json`, opts);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Twilio API error (${resp.status}): ${text}`);
  }
  return resp.json();
}

// ---------------------------------------------------------------------------
// SimpleLogin / addy.io API helpers (Email Aliases)
// ---------------------------------------------------------------------------
async function emailAliasApi(endpoint, method = 'GET', body = null) {
  const keys = getApiKeys();
  const provider = keys.email_alias_provider || 'simplelogin';
  let baseUrl, headers;

  if (provider === 'addy') {
    if (!keys.addy_api_key) throw new Error('addy.io API key not configured. Go to Settings → API Keys.');
    baseUrl = 'https://app.addy.io/api/v1';
    headers = { 'Authorization': `Bearer ${keys.addy_api_key}`, 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
  } else {
    if (!keys.simplelogin_api_key) throw new Error('SimpleLogin API key not configured. Go to Settings → API Keys.');
    baseUrl = 'https://app.simplelogin.io/api';
    headers = { 'Authentication': keys.simplelogin_api_key, 'Content-Type': 'application/json' };
  }

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(`${baseUrl}${endpoint}`, opts);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`${provider} API error (${resp.status}): ${text}`);
  }
  return resp.json();
}

// ---------------------------------------------------------------------------
// Crypto helpers for TOTP & Identity Sharing
// ---------------------------------------------------------------------------
function base32Decode(str) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  str = str.replace(/[= ]/g, '').toUpperCase();
  let bits = '';
  for (const c of str) {
    const val = alphabet.indexOf(c);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  }
  return bytes;
}

async function generateTOTP(secret, period = 30, digits = 6) {
  const key = base32Decode(secret);
  const time = Math.floor(Date.now() / 1000 / period);
  const timeBytes = new Uint8Array(8);
  let t = time;
  for (let i = 7; i >= 0; i--) {
    timeBytes[i] = t & 0xff;
    t = Math.floor(t / 256);
  }
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, timeBytes);
  const hmac = new Uint8Array(sig);
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24 | hmac[offset + 1] << 16 | hmac[offset + 2] << 8 | hmac[offset + 3]) % (10 ** digits);
  return code.toString().padStart(digits, '0');
}

function generateSecurePassword(length = 20, options = {}) {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  let charset = '';
  if (options.uppercase !== false) charset += upper;
  if (options.lowercase !== false) charset += lower;
  if (options.numbers !== false) charset += numbers;
  if (options.symbols !== false) charset += symbols;
  if (!charset) charset = upper + lower + numbers;
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset[array[i] % charset.length];
  }
  const required = [];
  if (options.uppercase !== false) required.push(upper);
  if (options.lowercase !== false) required.push(lower);
  if (options.numbers !== false) required.push(numbers);
  if (options.symbols !== false) required.push(symbols);
  const pw = password.split('');
  for (let i = 0; i < required.length && i < pw.length; i++) {
    const randIdx = crypto.getRandomValues(new Uint32Array(1))[0] % required[i].length;
    pw[i] = required[i][randIdx];
  }
  for (let i = pw.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [pw[i], pw[j]] = [pw[j], pw[i]];
  }
  return pw.join('');
}

async function encryptData(data, password) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(data)));
  return {
    salt: Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join(''),
    iv: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(''),
    data: Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join(''),
  };
}

async function decryptData(encObj, password) {
  const enc = new TextEncoder();
  const salt = new Uint8Array(encObj.salt.match(/.{2}/g).map(h => parseInt(h, 16)));
  const iv = new Uint8Array(encObj.iv.match(/.{2}/g).map(h => parseInt(h, 16)));
  const data = new Uint8Array(encObj.data.match(/.{2}/g).map(h => parseInt(h, 16)));
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
  );
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return JSON.parse(new TextDecoder().decode(decrypted));
}

// ---------------------------------------------------------------------------
// Local function implementations
// ---------------------------------------------------------------------------
const localFunctions = {
  async checkHIBP({ email }) {
    const keys = getApiKeys();
    if (keys.hibp_api_key) {
      const breaches = await hibpApi(`/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`);
      return { data: { found: breaches.length > 0, breaches, email } };
    }
    const localMatches = await matchBreaches(email);
    if (localMatches.length > 0) {
      return {
        data: {
          found: true,
          breaches: localMatches.map(m => ({
            Name: m.name, BreachDate: m.date, DataClasses: m.exposed,
            PwnCount: m.records, Description: `Matched via local breach database (${m.match_type}). For exact results, add HIBP API key.`,
          })),
          email,
          source: 'local_database',
        },
      };
    }
    return { data: { found: false, breaches: [], email, source: 'local_database' } };
  },

  async checkBreaches({ emails, profileId }) {
    const keys = getApiKeys();
    const hasHibp = !!keys.hibp_api_key;
    const hasLeakCheck = !!keys.leakcheck_api_key;

    const allBreaches = [];
    const seenKeys = new Set();

    // ── HIBP ──
    if (hasHibp) {
      for (const email of (emails || [])) {
        try {
          const breaches = await hibpApi(`/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`);
          for (const b of breaches) {
            const key = `${b.Name}::${email}`;
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              allBreaches.push({
                source_name: b.Name,
                breach_date: b.BreachDate,
                data_exposed: b.DataClasses || [],
                risk_score: b.DataClasses?.some(d => /password|ssn|credit/i.test(d)) ? 90 : 60,
                email,
                api_source: 'hibp',
              });
            }
          }
          await new Promise(r => setTimeout(r, 1600));
        } catch (e) {
          if (!e.message.includes('404')) console.warn(`[checkBreaches/HIBP] ${email}:`, e.message);
        }
      }
    }

    // ── LeakCheck.io ──
    if (hasLeakCheck) {
      for (const email of (emails || [])) {
        try {
          const results = await leakCheckLookup(email);
          if (results && Array.isArray(results)) {
            for (const r of results) {
              const name = r.source?.name || r.name || 'Unknown Source';
              const key = `${name}::${email}`;
              if (!seenKeys.has(key)) {
                seenKeys.add(key);
                allBreaches.push({
                  source_name: name,
                  breach_date: r.source?.date || '',
                  data_exposed: r.fields || [],
                  risk_score: (r.fields || []).some(f => /password|hash/i.test(f)) ? 85 : 55,
                  email,
                  api_source: 'leakcheck',
                });
              }
            }
          }
        } catch (e) {
          console.warn(`[checkBreaches/LeakCheck] ${email}:`, e.message);
        }
      }
    }

    // ── LeakCheck Free Public API (no key needed) ──
    if (!hasLeakCheck) {
      for (const email of (emails || [])) {
        try {
          const result = await leakCheckPublic(email);
          if (result && result.found > 0) {
            for (const src of result.sources) {
              const name = src.name || 'Unknown Source';
              const key = `${name}::${email}`;
              if (!seenKeys.has(key)) {
                seenKeys.add(key);
                allBreaches.push({
                  source_name: name,
                  breach_date: src.date || '',
                  data_exposed: result.fields || ['credentials'],
                  risk_score: (result.fields || []).some(f => /password|hash/i.test(f)) ? 80 : 55,
                  email,
                  api_source: 'leakcheck_free',
                });
              }
            }
          }
          await new Promise(r => setTimeout(r, 1100)); // respect 1 req/sec
        } catch (e) {
          console.warn(`[checkBreaches/LeakCheckFree] ${email}:`, e.message);
        }
      }
    }

    // ── Local breach database + live HIBP list (always runs for uncovered emails) ──
    for (const email of (emails || [])) {
      const localMatches = await matchBreaches(email);
      for (const m of localMatches) {
        const key = `${m.name}::${email}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          allBreaches.push({
            source_name: m.name,
            breach_date: m.date,
            data_exposed: m.exposed,
            risk_score: m.severity,
            email,
            api_source: m.source || 'local_database',
          });
        }
      }
    }

    // Deduplicate against existing scan results to prevent inflated counts on rescan
    const existingScans = profileId ? await entities.ScanResult.filter({ profile_id: profileId }) : [];
    const existingKeys = new Set(existingScans.map(s => `${s.source_name}::${s.metadata?.email || ''}`));
    let newCount = 0;

    for (const b of allBreaches) {
      const key = `${b.source_name}::${b.email}`;
      if (existingKeys.has(key)) continue;
      await entities.ScanResult.create({
        profile_id: profileId,
        source_name: b.source_name,
        source_type: 'breach_database',
        risk_score: b.risk_score,
        data_exposed: b.data_exposed,
        breach_date: b.breach_date,
        status: 'new',
        scan_date: new Date().toISOString().split('T')[0],
        metadata: { email: b.email, api_source: b.api_source },
      });
      newCount++;
    }

    return { data: { total: allBreaches.length, new_count: newCount, breaches: allBreaches } };
  },

  async verifyPhoneNumbers({ phones, profileId }) {
    const keys = getApiKeys();
    if (!keys.numverify_api_key) {
      const results = (phones || []).map(phone => {
        const digits = phone.replace(/\D/g, '');
        const isUS = digits.length === 10 || (digits.length === 11 && digits[0] === '1');
        return {
          phone, valid: isUS, country: isUS ? 'US' : 'Unknown',
          carrier: 'Unknown (add NumVerify key for carrier lookup)',
          line_type: digits.length >= 10 ? 'mobile or landline' : 'invalid format',
          location: isUS ? 'United States' : 'Unknown',
          source: 'local_validation',
        };
      });
      return { data: { results, source: 'local_validation' } };
    }
    const results = [];
    for (const phone of (phones || []).slice(0, 5)) {
      try {
        const data = await numVerifyLookup(phone);
        if (data) {
          results.push({
            phone,
            valid: data.valid,
            carrier: data.carrier || 'Unknown',
            line_type: data.line_type || 'unknown',
            location: data.location || '',
            country: data.country_name || '',
          });
        }
      } catch (e) { console.warn(`[verifyPhone] ${phone}:`, e.message); }
    }
    return { data: { results } };
  },

  async checkPasswordBreach({ password }) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    const prefix = hashHex.slice(0, 5);
    const suffix = hashHex.slice(5);

    const resp = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
    const text = await resp.text();
    const match = text.split('\n').find(line => line.startsWith(suffix));
    const count = match ? parseInt(match.split(':')[1]) : 0;
    return { data: { compromised: count > 0, count, hash_prefix: prefix } };
  },

  async listCards() {
    const result = await privacyComApi('/card?page_size=50');
    return { data: result.data || [] };
  },

  async listSubscriptions({ cardToken }) {
    const result = await privacyComApi(`/transaction?card_token=${cardToken}&page_size=100`);
    const txns = result.data || [];

    const merchantMap = {};
    for (const txn of txns) {
      const merchant = txn.merchant?.descriptor || txn.merchant?.city || 'Unknown';
      if (!merchantMap[merchant]) {
        merchantMap[merchant] = { merchant, count: 0, total: 0, transactions: [], card_token: cardToken };
      }
      merchantMap[merchant].count++;
      merchantMap[merchant].total += txn.amount || 0;
      merchantMap[merchant].transactions.push(txn);
    }

    const subs = Object.values(merchantMap)
      .filter(m => m.count >= 2)
      .map(m => {
        const sorted = m.transactions.sort((a, b) => new Date(a.created) - new Date(b.created));
        const intervals = [];
        for (let i = 1; i < sorted.length; i++) {
          intervals.push((new Date(sorted[i].created) - new Date(sorted[i - 1].created)) / 86400000);
        }
        const avgInterval = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : null;
        return {
          merchant: m.merchant,
          count: m.count,
          total: m.total,
          card_token: m.card_token,
          first_transaction: sorted[0]?.created,
          last_transaction: sorted[sorted.length - 1]?.created,
          estimated_interval_days: avgInterval,
        };
      })
      .sort((a, b) => b.total - a.total);

    return { data: subs };
  },

  async generateVirtualCard({ purpose, website, spendLimit }) {
    const result = await privacyComApi('/card', 'POST', {
      type: 'MERCHANT_LOCKED',
      memo: purpose || `Card for ${website}`,
      spend_limit: spendLimit || 10000,
      spend_limit_duration: 'MONTHLY',
    });
    return { data: { card: result } };
  },

  async closeCard({ cardToken }) {
    const result = await privacyComApi(`/card`, 'PUT', { card_token: cardToken, state: 'CLOSED' });
    return { data: result };
  },

  async pauseCard({ cardToken }) {
    const currentCards = await privacyComApi('/card?page_size=50');
    const card = (currentCards.data || []).find(c => c.token === cardToken);
    const newState = card?.state === 'PAUSED' ? 'OPEN' : 'PAUSED';
    const result = await privacyComApi(`/card`, 'PUT', { card_token: cardToken, state: newState });
    return { data: result };
  },

  async detectSearchQueries({ profileId, fullName, emails, phones, addresses }) {
    const keys = getApiKeys();
    const exposures = [];
    const BROKER_DOMAINS = [
      'spokeo.com','whitepages.com','beenverified.com','intelius.com','truepeoplesearch.com',
      'fastpeoplesearch.com','thatsthem.com','radaris.com','mylife.com','peoplefinder.com',
      'usphonebook.com','yellowpages.com','411.com','anywho.com','zabasearch.com',
      'pipl.com','peekyou.com','instantcheckmate.com','ussearch.com','peoplesmart.com',
      'familytreenow.com','nuwber.com','cyberbackgroundchecks.com','publicrecordsnow.com',
    ];

    // ── PHASE 1: Real Google Custom Search (if configured) ──
    if (keys.google_search_api_key && keys.google_search_cx) {
      const queries = [];
      if (fullName) queries.push(`"${fullName}"`);
      for (const email of (emails || []).slice(0, 3)) queries.push(`"${email}"`);
      for (const phone of (phones || []).slice(0, 2)) queries.push(`"${phone}"`);

      for (const q of queries) {
        try {
          const results = await googleSearch(q);
          if (results) {
            for (const r of results) {
              const domain = (r.displayLink || '').toLowerCase();
              const isBroker = BROKER_DOMAINS.some(bd => domain.includes(bd));
              const dataFound = [];
              const snippet = (r.snippet || '').toLowerCase();
              if (fullName && snippet.includes(fullName.toLowerCase())) dataFound.push('name');
              if (emails?.some(e => snippet.includes(e.toLowerCase()))) dataFound.push('email');
              if (phones?.some(p => snippet.includes(p.replace(/\D/g, '').slice(-7)))) dataFound.push('phone');
              if (addresses?.some(a => a && snippet.includes(a.split(',')[0]?.toLowerCase()))) dataFound.push('address');
              if (dataFound.length === 0) dataFound.push('possible match');

              exposures.push({
                site_name: r.displayLink || new URL(r.url).hostname,
                site_url: r.url,
                data_found: dataFound,
                risk_level: isBroker ? 'high' : dataFound.length > 1 ? 'medium' : 'low',
                removal_difficulty: isBroker ? 'medium' : 'unknown',
                removal_url: isBroker ? `https://www.google.com/search?q=${encodeURIComponent(domain + ' opt out')}` : '',
                source: 'google_search',
                snippet: r.snippet,
              });
            }
          }
          await new Promise(r => setTimeout(r, 300));
        } catch (e) { console.warn('[detectSearchQueries] Google search error:', e.message); }
      }
    }

    // ── PHASE 2: Hunter.io email intelligence (if configured) ──
    if (keys.hunter_api_key) {
      for (const email of (emails || []).slice(0, 3)) {
        try {
          const verification = await hunterVerifyEmail(email);
          if (verification) {
            const sources = verification.sources || [];
            for (const src of sources) {
              exposures.push({
                site_name: src.domain || 'Unknown',
                site_url: src.uri || `https://${src.domain}`,
                data_found: ['email'],
                risk_level: 'medium',
                removal_difficulty: 'medium',
                removal_url: '',
                source: 'hunter_io',
              });
            }
          }
        } catch (e) { console.warn('[detectSearchQueries] Hunter.io error:', e.message); }
      }
    }

    // ── PHASE 3: AI analysis enhancement (if OpenAI configured) ──
    if (keys.openai_api_key) {
      try {
        const googleContext = exposures.length > 0
          ? `\n\nReal search results already found:\n${exposures.slice(0, 10).map(e => `- ${e.site_name}: ${e.site_url} [${e.data_found.join(', ')}]`).join('\n')}`
          : '';

        const result = await invokeLLM({
          prompt: `Analyze the exposure risk for this person on data broker sites and people-search engines.

Person: ${fullName}
Emails: ${(emails || []).join(', ')}
Phones: ${(phones || []).join(', ')}
Addresses: ${(addresses || []).join(', ')}
${googleContext}

Based on this information, identify ADDITIONAL likely exposures on data broker and people-search sites that were not already found above. For each, provide:
- site_name, site_url, data_found (array), risk_level (high/medium/low), removal_difficulty (easy/medium/hard), removal_url`,
          response_json_schema: {
            type: 'object',
            properties: {
              exposures: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    site_name: { type: 'string' },
                    site_url: { type: 'string' },
                    data_found: { type: 'array', items: { type: 'string' } },
                    risk_level: { type: 'string' },
                    removal_difficulty: { type: 'string' },
                    removal_url: { type: 'string' },
                  },
                },
              },
            },
          },
        });

        for (const exp of (result.exposures || [])) {
          const alreadyFound = exposures.some(e => e.site_name?.toLowerCase() === exp.site_name?.toLowerCase());
          if (!alreadyFound) {
            exposures.push({ ...exp, source: 'ai_analysis' });
          }
        }
      } catch (e) { console.warn('[detectSearchQueries] AI analysis error:', e.message); }
    }

    // ── PHASE 4: Local data broker exposure engine (always runs) ──
    {
      const profileData = (await entities.PersonalData.list()).filter(d => d.profile_id === profileId);
      const brokerExposures = estimateBrokerExposure(profileData);
      for (const broker of brokerExposures) {
        const alreadyFound = exposures.some(e =>
          e.site_name?.toLowerCase().includes(broker.name.toLowerCase()) ||
          (e.site_url || '').toLowerCase().includes(new URL(broker.url).hostname)
        );
        if (!alreadyFound) {
          const dataFound = [];
          if (broker.matchedTypes.includes('name')) dataFound.push('name');
          if (broker.matchedTypes.includes('address')) dataFound.push('address');
          if (broker.matchedTypes.includes('phone')) dataFound.push('phone');
          if (broker.matchedTypes.includes('email')) dataFound.push('email');
          if (broker.matchedTypes.includes('SSN')) dataFound.push('SSN');
          if (dataFound.length === 0) dataFound.push('profile data');

          exposures.push({
            site_name: broker.name,
            site_url: broker.url,
            data_found: dataFound,
            risk_level: broker.riskLevel,
            removal_difficulty: broker.difficulty,
            removal_url: broker.optOutUrl,
            source: 'local_broker_database',
            likelihood: broker.likelihood,
            turnaround: broker.turnaround,
          });
        }
      }
    }

    // ── Deduplicate by URL ──
    const seen = new Set();
    const deduped = exposures.filter(e => {
      const key = (e.site_url || e.site_name || '').toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Deduplicate against existing records to prevent inflated counts on rescan
    const existing = await entities.SearchQueryFinding.filter({ profile_id: profileId });
    const existingUrls = new Set(existing.map(e => (e.site_url || e.site_name || '').toLowerCase()));
    let newCount = 0;

    for (const exp of deduped) {
      const key = (exp.site_url || exp.site_name || '').toLowerCase();
      if (existingUrls.has(key)) continue;
      await entities.SearchQueryFinding.create({
        profile_id: profileId,
        site_name: exp.site_name,
        site_url: exp.site_url,
        data_found: exp.data_found,
        risk_level: exp.risk_level,
        removal_difficulty: exp.removal_difficulty,
        removal_url: exp.removal_url,
        status: 'new',
        source: exp.source,
      });
      newCount++;
    }

    return { data: { total: deduped.length, new_count: newCount, existing_count: existing.length, exposures: deduped } };
  },

  async monitorSocialMedia({ profileId, fullName, usernames }) {
    const keys = getApiKeys();
    if (!keys.openai_api_key) {
      const SOCIAL_PLATFORMS = [
        { platform: 'Facebook', urlTemplate: 'https://www.facebook.com/search/people/?q=', risk: 'Check for impersonation accounts or public profile exposure' },
        { platform: 'Instagram', urlTemplate: 'https://www.instagram.com/', risk: 'Potential impersonation or tagged photo exposure' },
        { platform: 'Twitter/X', urlTemplate: 'https://x.com/search?q=', risk: 'Public mentions, impersonation, or data exposure' },
        { platform: 'LinkedIn', urlTemplate: 'https://www.linkedin.com/search/results/people/?keywords=', risk: 'Professional data exposure, employment history' },
        { platform: 'TikTok', urlTemplate: 'https://www.tiktok.com/search?q=', risk: 'Video mentions or impersonation accounts' },
        { platform: 'Reddit', urlTemplate: 'https://www.reddit.com/search/?q=', risk: 'Username mentions, personal data in posts/comments' },
        { platform: 'Pinterest', urlTemplate: 'https://www.pinterest.com/search/users/?q=', risk: 'Profile exposure, associated images' },
        { platform: 'YouTube', urlTemplate: 'https://www.youtube.com/results?search_query=', risk: 'Video mentions, channel impersonation' },
      ];
      const findings = [];
      if (fullName) {
        for (const p of SOCIAL_PLATFORMS) {
          findings.push({
            platform: p.platform,
            username: fullName,
            profile_url: p.urlTemplate + encodeURIComponent(fullName),
            match_type: 'potential_exposure',
            confidence: 50,
            description: `${p.risk}. Search "${fullName}" on ${p.platform} to verify.`,
          });
        }
      }
      for (const uname of (usernames || []).slice(0, 5)) {
        for (const p of SOCIAL_PLATFORMS.slice(0, 4)) {
          findings.push({
            platform: p.platform,
            username: uname,
            profile_url: p.urlTemplate + encodeURIComponent(uname),
            match_type: 'username_search',
            confidence: 45,
            description: `Username "${uname}" should be checked on ${p.platform} for impersonation or exposure.`,
          });
        }
      }
      for (const f of findings) {
        if (f.match_type !== 'legitimate') {
          await entities.SocialMediaFinding.create({
            profile_id: profileId, platform: f.platform, suspicious_username: f.username,
            profile_url: f.profile_url, match_type: f.match_type, confidence: f.confidence,
            description: f.description, status: 'new',
          });
        }
      }
      return { data: { total: findings.length, findings, source: 'local_analysis' } };
    }
    const result = await invokeLLM({
      prompt: `Search for social media accounts and mentions of this person. Look for impersonation, unauthorized use of their name/photo, and mentions in concerning contexts.

Person: ${fullName}
Known usernames: ${(usernames || []).join(', ')}

For each finding:
- platform: Social media platform
- username: The account username found
- profile_url: URL to the profile
- match_type: "impersonation", "mention", "data_exposure", "legitimate"
- confidence: 0-100
- description: What was found`,
      response_json_schema: {
        type: 'object',
        properties: {
          findings: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                platform: { type: 'string' },
                username: { type: 'string' },
                profile_url: { type: 'string' },
                match_type: { type: 'string' },
                confidence: { type: 'number' },
                description: { type: 'string' },
              },
            },
          },
        },
      },
    });

    const findings = result.findings || [];
    for (const f of findings) {
      if (f.match_type !== 'legitimate') {
        await entities.SocialMediaFinding.create({
          profile_id: profileId,
          platform: f.platform,
          suspicious_username: f.username,
          profile_url: f.profile_url,
          match_type: f.match_type,
          confidence: f.confidence,
          description: f.description,
          status: 'new',
        });
      }
    }

    return { data: { total: findings.length, findings } };
  },

  async runIdentityScan({ profileId, fullName, emails, phones, addresses }) {
    const keys = getApiKeys();
    if (!keys.openai_api_key) {
      const findings = [];
      const profileData = (await entities.PersonalData.list()).filter(d => d.profile_id === profileId);
      const brokerExposures = estimateBrokerExposure(profileData);

      for (const broker of brokerExposures.filter(b => b.likelihood >= 40)) {
        findings.push({
          source_name: broker.name,
          source_type: 'data_broker',
          risk_score: broker.likelihood,
          data_exposed: broker.matchedTypes,
          description: `${broker.name} likely has your ${broker.matchedTypes.join(', ')}. They collect from: ${broker.collectsFrom}.`,
          remediation_steps: `Visit ${broker.optOutUrl} to opt out. Expected turnaround: ${broker.turnaround}.`,
        });
      }

      for (const email of (emails || [])) {
        const breaches = await matchBreaches(email);
        for (const b of breaches.slice(0, 5)) {
          findings.push({
            source_name: b.name,
            source_type: 'breach_database',
            risk_score: b.severity,
            data_exposed: b.exposed.slice(0, 5),
            description: `${b.name} was breached on ${b.date}${b.records > 0 ? ` — ${(b.records / 1e6).toFixed(0)}M records exposed` : ''}.`,
            remediation_steps: `Change your password on ${b.name}. Enable 2FA. Check if your credentials were reused on other sites.`,
          });
        }
      }

      if (fullName) {
        findings.push({
          source_name: 'Public Records', source_type: 'public_records', risk_score: 55,
          data_exposed: ['name', 'address', 'property records'],
          description: 'Property records, voter registration, and court records are publicly searchable and likely contain your information.',
          remediation_steps: 'Request removal from county clerk websites. Consider a privacy PO Box for future records.',
        });
      }

      if (phones?.length) {
        findings.push({
          source_name: 'Phone Directory Exposure', source_type: 'phone_directory', risk_score: 50,
          data_exposed: ['phone', 'name', 'address'],
          description: 'Phone numbers are commonly listed in reverse-lookup directories and data broker sites.',
          remediation_steps: 'Request unlisting from your carrier. Opt out of CallerID databases like CallerIDTest, TrueCaller.',
        });
      }

      const overallRisk = findings.length > 15 ? 'critical' : findings.length > 8 ? 'high' : findings.length > 3 ? 'medium' : 'low';
      for (const f of findings) {
        await entities.ScanResult.create({
          profile_id: profileId, source_name: f.source_name, source_type: f.source_type,
          risk_score: f.risk_score, data_exposed: f.data_exposed, description: f.description,
          status: 'new', scan_date: new Date().toISOString().split('T')[0],
        });
      }
      return {
        data: {
          scan_summary: `Found ${findings.length} exposure points across data brokers, breaches, and public records.`,
          overall_risk: overallRisk, findings, source: 'local_analysis',
        },
      };
    }
    const result = await invokeLLM({
      prompt: `Perform a comprehensive identity exposure scan for this person. Check for:
1. Data broker listings (Spokeo, WhitePages, BeenVerified, etc.)
2. Public records exposure
3. Social media presence that reveals PII
4. Possible identity cloning indicators
5. Dark web mentions (based on known breach databases)

Person: ${fullName}
Emails: ${(emails || []).join(', ')}
Phones: ${(phones || []).join(', ')}
Addresses: ${(addresses || []).join(', ')}

For each finding provide: source_name, source_type, risk_score (0-100), data_exposed (array), description, remediation_steps`,
      response_json_schema: {
        type: 'object',
        properties: {
          scan_summary: { type: 'string' },
          overall_risk: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          findings: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                source_name: { type: 'string' },
                source_type: { type: 'string' },
                risk_score: { type: 'number' },
                data_exposed: { type: 'array', items: { type: 'string' } },
                description: { type: 'string' },
                remediation_steps: { type: 'string' },
              },
            },
          },
        },
      },
    });

    for (const f of (result.findings || [])) {
      await entities.ScanResult.create({
        profile_id: profileId,
        source_name: f.source_name,
        source_type: f.source_type || 'identity_scan',
        risk_score: f.risk_score,
        data_exposed: f.data_exposed,
        description: f.description,
        status: 'new',
        scan_date: new Date().toISOString().split('T')[0],
      });
    }

    return { data: result };
  },

  async correlateProfileData({ profileId }) {
    const keys = getApiKeys();
    if (!keys.openai_api_key) {
      const [scanResults, socialFindings, searchFindings] = await Promise.all([
        entities.ScanResult.filter({ profile_id: profileId }),
        entities.SocialMediaFinding.filter({ profile_id: profileId }),
        entities.SearchQueryFinding.filter({ profile_id: profileId }),
      ]);

      const totalFindings = scanResults.length + socialFindings.length + searchFindings.length;
      const avgRisk = scanResults.length > 0
        ? Math.round(scanResults.reduce((s, r) => s + (r.risk_score || 0), 0) / scanResults.length) : 30;

      const correlations = [];
      const highRiskSites = new Set();
      for (const sr of scanResults) if (sr.risk_score >= 70) highRiskSites.add(sr.source_name);
      for (const sf of searchFindings) if (sf.risk_level === 'high') highRiskSites.add(sf.site_name);

      if (highRiskSites.size > 1) {
        correlations.push({ pattern: `Your data appears on ${highRiskSites.size} high-risk sources`, severity: 'high', sources: Array.from(highRiskSites).slice(0, 10) });
      }
      if (scanResults.some(r => (r.data_exposed || []).some(d => /ssn|social security/i.test(d)))) {
        correlations.push({ pattern: 'SSN exposed in at least one breach — identity theft risk is elevated', severity: 'critical', sources: scanResults.filter(r => (r.data_exposed || []).some(d => /ssn|social security/i.test(d))).map(r => r.source_name) });
      }
      if (scanResults.some(r => (r.data_exposed || []).some(d => /credit card|payment/i.test(d)))) {
        correlations.push({ pattern: 'Financial data exposed — monitor credit reports and bank statements', severity: 'high', sources: scanResults.filter(r => (r.data_exposed || []).some(d => /credit card|payment/i.test(d))).map(r => r.source_name) });
      }

      const priorityActions = [];
      if (highRiskSites.size > 0) priorityActions.push(`Request removal from ${highRiskSites.size} high-risk data brokers`);
      priorityActions.push('Enable credit monitoring on all three bureaus');
      if (scanResults.some(r => (r.data_exposed || []).some(d => /password/i.test(d)))) priorityActions.push('Change passwords on all breached services immediately');
      priorityActions.push('Set up fraud alerts with Equifax, Experian, and TransUnion');
      if (searchFindings.length > 3) priorityActions.push(`Opt out from ${searchFindings.length} data broker sites found in search detection`);

      return {
        data: {
          overall_risk_score: Math.min(avgRisk + correlations.length * 10, 100),
          correlations,
          identity_clone_risk: { level: avgRisk > 70 ? 'high' : avgRisk > 40 ? 'medium' : 'low', explanation: `Based on ${totalFindings} findings across ${new Set([...scanResults.map(r => r.source_name), ...searchFindings.map(f => f.site_name)]).size} unique sources.` },
          priority_actions: priorityActions,
          matches: scanResults.slice(0, 10).map(r => ({ id: r.id, source: r.source_name, data: (r.data_exposed || []).join(', '), risk: r.risk_score > 70 ? 'high' : 'medium' })),
          source: 'local_analysis',
        },
      };
    }
    const [scanResults, socialFindings, searchFindings] = await Promise.all([
      entities.ScanResult.filter({ profile_id: profileId }),
      entities.SocialMediaFinding.filter({ profile_id: profileId }),
      entities.SearchQueryFinding.filter({ profile_id: profileId }),
    ]);

    const result = await invokeLLM({
      prompt: `Analyze these identity scan results and find correlations, patterns, and risk indicators.

Scan Results: ${JSON.stringify(scanResults.slice(0, 20))}
Social Findings: ${JSON.stringify(socialFindings.slice(0, 10))}
Search Findings: ${JSON.stringify(searchFindings.slice(0, 10))}

Provide:
- overall_risk_score: 0-100
- correlations: Array of patterns found (e.g., same data appearing on multiple sites)
- identity_clone_risk: "high", "medium", "low" with explanation
- priority_actions: Array of recommended next steps
- matches: Array of linked findings that show the same exposure across sources`,
      response_json_schema: {
        type: 'object',
        properties: {
          overall_risk_score: { type: 'number' },
          correlations: { type: 'array', items: { type: 'object', properties: { pattern: { type: 'string' }, severity: { type: 'string' }, sources: { type: 'array', items: { type: 'string' } } } } },
          identity_clone_risk: { type: 'object', properties: { level: { type: 'string' }, explanation: { type: 'string' } } },
          priority_actions: { type: 'array', items: { type: 'string' } },
          matches: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, source: { type: 'string' }, data: { type: 'string' }, risk: { type: 'string' } } } },
        },
      },
    });

    return { data: result };
  },

  async checkClassActions({ companyName }) {
    const keys = getApiKeys();
    if (!keys.openai_api_key) {
      const KNOWN_SETTLEMENTS = [
        { title: 'Equifax Data Breach Settlement', matched_company: 'Equifax', status: 'settled', court: 'Northern District of Georgia', deadline: '2024-01-22', url: 'https://www.equifaxbreachsettlement.com', how_to_join: 'Visit the settlement website and file a claim', description: 'Up to $20,000 for out-of-pocket losses. $125 for credit monitoring.' },
        { title: 'Facebook Privacy Settlement', matched_company: 'Facebook', status: 'settled', court: 'Northern District of California', deadline: '2024-08-17', url: 'https://www.facebookuserprivacysettlement.com', how_to_join: 'Submit claim online with Facebook account verification', description: 'Settlement over tracking users after logout. $200-$5,000 per claimant.' },
        { title: 'T-Mobile Data Breach Settlement', matched_company: 'T-Mobile', status: 'settled', court: 'Western District of Missouri', deadline: '2023-01-23', url: 'https://www.t-mobilesettlement.com', how_to_join: 'File a claim at the settlement website', description: '$350M fund. $25+ for affected customers.' },
        { title: 'Yahoo Data Breach Settlement', matched_company: 'Yahoo', status: 'settled', court: 'Northern District of California', deadline: '2020-07-20', url: 'https://yahoodatabreachsettlement.com', how_to_join: 'Claim period may have ended — check website', description: '$117.5M settlement. $100-$358 per claimant.' },
        { title: 'Capital One Data Breach Settlement', matched_company: 'Capital One', status: 'settled', court: 'Eastern District of Virginia', deadline: '2023-09-30', url: 'https://www.capitalonesettlement.com', how_to_join: 'Submit claim online', description: '$190M fund. $25-$25,000 depending on losses.' },
        { title: 'Marriott Data Breach Settlement', matched_company: 'Marriott', status: 'settled', court: 'District of Maryland', deadline: '2023-02-22', url: 'https://www.marriottbreachsettlement.com', how_to_join: 'File at settlement website', description: '$52M fund for affected guests.' },
        { title: 'Ticketmaster Data Breach (Live Nation)', matched_company: 'Ticketmaster', status: 'pending', court: 'TBD', deadline: 'Ongoing', url: 'https://www.classaction.org/ticketmaster-data-breach-lawsuit', how_to_join: 'Lawsuits being filed — monitor for class certification', description: '560M records exposed in 2024 breach.' },
        { title: 'AT&T Data Breach Lawsuits', matched_company: 'AT&T', status: 'active', court: 'Multiple jurisdictions', deadline: 'Ongoing', url: 'https://www.classaction.org/att-data-breach-lawsuit', how_to_join: 'Contact a class action attorney', description: '73M records with SSNs exposed.' },
        { title: 'LastPass Security Incident Lawsuits', matched_company: 'LastPass', status: 'active', court: 'District of Massachusetts', deadline: 'Ongoing', url: 'https://www.classaction.org/lastpass-data-breach-lawsuit', how_to_join: 'Contact a class action attorney', description: 'Encrypted vault data and master password hashes stolen.' },
        { title: 'MOVEit Transfer Data Breach Lawsuits', matched_company: 'MOVEit', status: 'active', court: 'Multiple jurisdictions', deadline: 'Ongoing', url: 'https://www.classaction.org/moveit-data-breach-lawsuit', how_to_join: 'Check if your employer/provider used MOVEit', description: '77M+ affected across thousands of organizations.' },
        { title: 'Google Location Tracking Settlement', matched_company: 'Google', status: 'settled', court: 'Northern District of California', deadline: '2024', url: 'https://www.classaction.org/google-location-tracking-lawsuit', how_to_join: 'Eligible Google users received email notices', description: '$62M settlement over location tracking practices.' },
        { title: 'Uber Data Breach Cover-Up Settlement', matched_company: 'Uber', status: 'settled', court: 'Northern District of California', deadline: '2023', url: 'https://www.classaction.org/uber-data-breach-lawsuit', how_to_join: 'Check settlement website', description: 'Settlement for 2016 breach affecting 57M users.' },
      ];
      const cn = (companyName || '').toLowerCase();
      const matched = KNOWN_SETTLEMENTS.filter(s =>
        cn.includes(s.matched_company.toLowerCase()) || s.matched_company.toLowerCase().includes(cn)
      );
      const searchUrl = `https://www.classaction.org/search?query=${encodeURIComponent(companyName)}`;
      if (matched.length === 0) {
        matched.push({
          title: `Search for ${companyName} lawsuits`,
          matched_company: companyName,
          status: 'unknown',
          court: 'N/A',
          deadline: 'N/A',
          url: searchUrl,
          how_to_join: `Search classaction.org for current lawsuits involving ${companyName}`,
          description: `No known settlement found in local database. Search online for the latest: ${searchUrl}`,
        });
      }
      return { data: { litigation: matched, source: 'local_database' } };
    }
    const result = await invokeLLM({
      prompt: `Search for active class action lawsuits or settlements involving "${companyName}" related to data breaches, privacy violations, or identity theft. Only return REAL, verified lawsuits. If none exist, return an empty array.

For each lawsuit: title, status (active/settled/pending), court, deadline, url, how_to_join, matched_company, description`,
      response_json_schema: {
        type: 'object',
        properties: {
          litigation: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' }, status: { type: 'string' }, court: { type: 'string' },
                deadline: { type: 'string' }, url: { type: 'string' }, how_to_join: { type: 'string' },
                matched_company: { type: 'string' }, description: { type: 'string' },
              },
            },
          },
        },
      },
    });
    return { data: result };
  },

  async findAttorneys({ exposureType }) {
    const keys = getApiKeys();
    if (!keys.openai_api_key) {
      const type = exposureType || 'identity theft';
      return {
        data: {
          attorneys: [
            { name: 'National Association of Consumer Advocates', firm: 'NACA Directory', location: 'Nationwide', phone: '', email: '', website: 'https://www.consumeradvocates.org/find-an-attorney', specialties: ['identity theft','data breach','consumer protection','privacy'], free_consultation: true },
            { name: 'Identity Theft Resource Center', firm: 'ITRC', location: 'Nationwide', phone: '888-400-5530', email: '', website: 'https://www.idtheftcenter.org/', specialties: ['identity theft','fraud recovery','credit repair'], free_consultation: true },
            { name: 'Legal Services Corporation', firm: 'LSC', location: 'Nationwide', phone: '', email: '', website: 'https://www.lsc.gov/about-lsc/what-legal-aid/get-legal-help', specialties: ['consumer protection','civil rights','legal aid'], free_consultation: true },
            { name: 'Morgan & Morgan', firm: 'Morgan & Morgan', location: 'Nationwide', phone: '855-282-2843', email: '', website: 'https://www.forthepeople.com/data-breach-lawyer/', specialties: ['data breach','class action','privacy'], free_consultation: true },
            { name: 'ClassAction.org Attorney Network', firm: 'ClassAction.org', location: 'Nationwide', phone: '', email: '', website: `https://www.classaction.org/search?query=${encodeURIComponent(type)}`, specialties: ['class action','data breach','consumer privacy'], free_consultation: true },
          ],
          source: 'local_directory',
          note: `Search results for "${type}". For local attorneys, try your state bar association\'s lawyer referral service.`,
        },
      };
    }
    const result = await invokeLLM({
      prompt: `Find attorneys or law firms specializing in ${exposureType || 'identity theft'} and data privacy law. Only return REAL attorneys with verifiable contact info. If unsure, return an empty array.

For each: name, firm, location, phone, email, website, specialties (array), free_consultation (boolean)`,
      response_json_schema: {
        type: 'object',
        properties: {
          attorneys: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' }, firm: { type: 'string' }, location: { type: 'string' },
                phone: { type: 'string' }, email: { type: 'string' }, website: { type: 'string' },
                specialties: { type: 'array', items: { type: 'string' } }, free_consultation: { type: 'boolean' },
              },
            },
          },
        },
      },
    });
    return { data: result };
  },

  async generateEvidencePacket({ findingId, profileId, type }) {
    const [profiles, scanResults, socialFindings] = await Promise.all([
      entities.Profile.list(),
      entities.ScanResult.list(),
      entities.SocialMediaFinding.list(),
    ]);
    const profile = profiles.find(p => p.id === profileId) || profiles[0];
    const finding = socialFindings.find(f => f.id === findingId) || scanResults.find(r => r.id === findingId);

    if (!finding) return { data: { error: 'Finding not found' } };

    const keys = getApiKeys();
    if (!keys.openai_api_key) {
      const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const victimName = profile?.full_name || '[Your Name]';
      const sourceName = finding.source_name || finding.platform || 'Unknown Source';
      const isLaw = type === 'law_enforcement';
      const title = isLaw ? 'LAW ENFORCEMENT IDENTITY THEFT REPORT' : 'ATTORNEY CONSULTATION EVIDENCE PACKET';
      const packet = `${title}\nDate: ${today}\n\n══════════════════════════════════════\nCASE SUMMARY\n══════════════════════════════════════\nVictim: ${victimName}\nIncident Type: ${finding.match_type || finding.source_type || 'Data Exposure / Identity Concern'}\nSource: ${sourceName}\nRisk Level: ${finding.risk_score || finding.confidence || 'Medium'}\nDate Discovered: ${finding.scan_date || finding.created_date || today}\n\n══════════════════════════════════════\nEVIDENCE COLLECTED\n══════════════════════════════════════\n- Source: ${sourceName}\n- URL: ${finding.profile_url || finding.site_url || 'N/A'}\n- Data Exposed: ${(finding.data_exposed || finding.data_found || []).join(', ') || 'Personal information'}\n- Description: ${finding.description || 'Unauthorized exposure of personal data'}\n\n══════════════════════════════════════\nRECOMMENDED ACTIONS\n══════════════════════════════════════\n${isLaw ? '1. File an Identity Theft Report at identitytheft.gov\n2. File a police report with local law enforcement\n3. Place a fraud alert with all three credit bureaus\n4. Freeze your credit at Equifax, Experian, and TransUnion\n5. Request a copy of your credit reports\n6. Document all fraudulent accounts or charges' : '1. Consult with a consumer protection attorney\n2. Preserve all evidence (screenshots, emails, records)\n3. Send cease & desist / CCPA deletion requests\n4. File complaints with FTC and state AG if needed\n5. Consider class action eligibility\n6. Document all financial harm for damages calculation'}\n\n══════════════════════════════════════\nLEGAL REFERENCES\n══════════════════════════════════════\n- Fair Credit Reporting Act (FCRA), 15 U.S.C. § 1681\n- Identity Theft and Assumption Deterrence Act, 18 U.S.C. § 1028\n- California Consumer Privacy Act (CCPA)\n- GDPR Article 17 (Right to Erasure)\n- FTC Act Section 5 (Unfair/Deceptive Practices)\n${isLaw ? '- Computer Fraud and Abuse Act (CFAA), 18 U.S.C. § 1030' : '- State consumer protection statutes'}`;

      const key = isLaw ? 'lawEnforcementPacket' : 'attorneyPacket';
      return { data: { [key]: packet } };
    }

    const result = await invokeLLM({
      prompt: `Generate a formal ${type === 'law_enforcement' ? 'law enforcement report' : 'attorney consultation'} evidence packet for an identity theft / impersonation case.

Victim: ${profile?.full_name || 'Unknown'}
Finding: ${JSON.stringify(finding)}

The packet should be formatted as a professional document with:
- Case summary
- Timeline of events
- Evidence collected
- Recommended actions
- Legal references`,
    });

    const key = type === 'law_enforcement' ? 'lawEnforcementPacket' : 'attorneyPacket';
    return { data: { [key]: result } };
  },

  async fixExposure({ exposureId, profileId, action }) {
    const keys = getApiKeys();
    if (!keys.openai_api_key) {
      const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      return {
        data: {
          steps: [
            'Find the site\'s privacy policy or data removal page.',
            'Submit a formal CCPA / GDPR data deletion request via their online form or email.',
            'If they have an opt-out URL, visit it directly and follow the prompts.',
            'If no response within 15 days, send a follow-up email referencing your original request.',
            'If still no response in 30 days, file complaints with: FTC (reportfraud.ftc.gov), your state Attorney General, and the BBB.',
            'Save all correspondence as evidence.',
          ],
          removal_letter: `${today}\n\nTo Whom It May Concern,\n\nPursuant to the California Consumer Privacy Act (CCPA) and the EU General Data Protection Regulation (GDPR), I hereby request the complete deletion of all personal data you hold relating to me.\n\nI request that you:\n1. Delete all personal information associated with me\n2. Direct any service providers to delete my data\n3. Confirm deletion in writing within 45 days\n\nFailure to comply may result in complaints filed with the FTC and applicable state authorities.\n\nSincerely,\n[Your Name]`,
          estimated_time: '2-6 weeks',
          difficulty: 'medium',
        },
      };
    }
    const result = await invokeLLM({
      prompt: `Generate step-by-step instructions and a pre-written removal request for fixing this data exposure.

Action requested: ${action || 'remove'}
Exposure ID: ${exposureId}
Profile ID: ${profileId}

Provide:
- steps: Array of action steps
- removal_letter: A formal CCPA/GDPR removal request letter
- estimated_time: How long the process takes
- difficulty: easy/medium/hard`,
      response_json_schema: {
        type: 'object',
        properties: {
          steps: { type: 'array', items: { type: 'string' } },
          removal_letter: { type: 'string' },
          estimated_time: { type: 'string' },
          difficulty: { type: 'string' },
        },
      },
    });
    return { data: result };
  },

  async automateDataDeletion({ siteName, siteUrl, profileId, personalData }) {
    const keys = getApiKeys();
    if (!keys.openai_api_key) {
      const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const name = siteName || 'the site';
      const privacyEmail = `privacy@${(name).toLowerCase().replace(/[\s.]+/g, '')}.com`;
      return {
        data: {
          subject_line: `CCPA / GDPR Data Deletion Request — Immediate Action Required — ${today}`,
          email_body: `To Whom It May Concern,\n\nI am writing to exercise my rights under the California Consumer Privacy Act (Cal. Civ. Code § 1798.100 et seq.) and the General Data Protection Regulation (Article 17) to request the deletion of all personal data you hold about me.\n\nMy information that may be on your site:\n${(personalData || []).map(d => `- ${d.data_type}: ${d.value}`).join('\n') || '- [Your personal details]'}\n\nSite: ${siteUrl || name}\n\nI request that you:\n1. Delete all personal data associated with me from all systems, databases, and backups\n2. Direct all third parties to whom you have sold or shared my data to delete it\n3. Confirm completion of this deletion in writing within 45 calendar days\n\nPlease note:\n- Under CCPA, you have 45 days to respond (with one 45-day extension upon notice)\n- Under GDPR, you must respond "without undue delay" and within one month\n- Failure to comply may result in regulatory complaints and legal action\n\nDate of request: ${today}\n\nSincerely,\n[Your Name]\n[Your Email]`,
          deletion_url: siteUrl ? `${siteUrl}/privacy` : `https://www.google.com/search?q=${encodeURIComponent(name + ' delete my data privacy request')}`,
          legal_basis: 'CCPA (California), GDPR (EU), Virginia CDPA, Colorado Privacy Act, Connecticut DPA, and applicable state privacy laws',
          expected_response_time: '45 days under CCPA, 30 days under GDPR',
          mailto_url: `mailto:${privacyEmail}?subject=${encodeURIComponent(`CCPA / GDPR Data Deletion Request — ${today}`)}&body=${encodeURIComponent(`I am requesting deletion of all my personal data under CCPA and GDPR. Site: ${siteUrl || name}. Please confirm deletion within the legally required timeframe.`)}`,
        },
      };
    }
    const result = await invokeLLM({
      prompt: `Generate a CCPA/GDPR data deletion request for ${siteName} (${siteUrl}).

Personal data to request deletion of: ${JSON.stringify(personalData)}

Provide:
- subject_line: Email subject
- email_body: The full formal deletion request letter (attorney-level quality)
- deletion_url: Direct link to submit the request (if known)
- legal_basis: Which law applies (CCPA, GDPR, state law)
- expected_response_time: How long they have to respond`,
      response_json_schema: {
        type: 'object',
        properties: {
          subject_line: { type: 'string' },
          email_body: { type: 'string' },
          deletion_url: { type: 'string' },
          legal_basis: { type: 'string' },
          expected_response_time: { type: 'string' },
        },
      },
    });
    return { data: result };
  },

  async automateGDPRDeletion({ targetSite, personalData }) {
    return localFunctions.automateDataDeletion({ siteName: targetSite, siteUrl: targetSite, personalData });
  },

  async automateBrokerOptOut({ broker, personalData }) {
    const keys = getApiKeys();
    if (!keys.openai_api_key) {
      return {
        data: localFunctions._generateFallbackOptOut(broker, personalData),
      };
    }
    const dataDescription = (personalData || [])
      .map(d => `${d.data_type}: ${d.value}`)
      .join('\n');
    const result = await invokeLLM({
      prompt: `You are a privacy attorney assistant. Generate a complete opt-out/data deletion request for the data broker "${broker.name}" (${broker.type}).

Broker opt-out URL: ${broker.opt_out_url}
Broker difficulty: ${broker.difficulty}
Broker notes: ${broker.notes || 'None'}
Requires ID: ${broker.requires_id ? 'Yes' : 'No'}

The user's personal data that may be listed on this broker:
${dataDescription || 'Not provided — generate a generic template'}

Generate:
1. step_by_step: Array of specific numbered steps to opt out of THIS particular broker. Be specific to their process (web form, email, phone call, fax, etc.)
2. email_to: The best privacy/removal email address for this company (research this)
3. email_subject: Professional subject line for a CCPA/GDPR deletion request
4. email_body: Full formal deletion request letter citing CCPA and GDPR, requesting complete removal. Include the user's data details. Write at attorney quality.
5. privacy_contact: Object with fields: email, phone, address (any known contact info)
6. special_requirements: Array of things to watch out for (ID needed, notarization, phone call required, etc.)
7. estimated_time: How long the removal typically takes
8. tips: Array of helpful tips specific to this broker`,
      response_json_schema: {
        type: 'object',
        properties: {
          step_by_step: { type: 'array', items: { type: 'string' } },
          email_to: { type: 'string' },
          email_subject: { type: 'string' },
          email_body: { type: 'string' },
          privacy_contact: {
            type: 'object',
            properties: {
              email: { type: 'string' },
              phone: { type: 'string' },
              address: { type: 'string' },
            },
          },
          special_requirements: { type: 'array', items: { type: 'string' } },
          estimated_time: { type: 'string' },
          tips: { type: 'array', items: { type: 'string' } },
        },
      },
    });
    return { data: result };
  },

  _generateFallbackOptOut(broker, personalData) {
    const name = (personalData || []).find(d => d.data_type === 'full_name')?.value || '[YOUR FULL NAME]';
    const email = (personalData || []).find(d => d.data_type === 'email')?.value || '[YOUR EMAIL]';
    const address = (personalData || []).find(d => d.data_type === 'address')?.value || '[YOUR ADDRESS]';

    const steps = [];
    if (broker.opt_out_url) steps.push(`Go to the opt-out page: ${broker.opt_out_url}`);
    if (broker.requires_id) steps.push('Prepare a government-issued ID — this broker requires identity verification.');
    if (broker.difficulty === 'easy') {
      steps.push('Search for your listing on their site.');
      steps.push('Follow the on-screen removal form to submit your opt-out request.');
      steps.push('Check your email for a verification link and click it.');
    } else if (broker.difficulty === 'medium') {
      steps.push('Create an account if required.');
      steps.push('Search for your listing and locate your record.');
      steps.push('Submit the opt-out form with your details.');
      steps.push('Check email/phone for verification and complete it.');
      steps.push('Follow up in 48-72 hours if no confirmation received.');
    } else {
      steps.push('Visit their privacy policy page for removal instructions.');
      steps.push('Send the formal deletion request email (generated below).');
      steps.push('If a phone call is required, call their privacy department.');
      steps.push('Keep records of all communications.');
      steps.push('Follow up every 7 days until confirmation is received.');
    }

    const emailBody = `Dear Privacy Department,

I am writing to formally request the immediate deletion of all personal information pertaining to me from your databases, in accordance with the California Consumer Privacy Act (CCPA) and the General Data Protection Regulation (GDPR).

My identifying information:
- Full Name: ${name}
- Email: ${email}
- Address: ${address}

I request that you:
1. Delete all personal data you hold about me
2. Direct any service providers or third parties who have received my data to delete it
3. Confirm completion of this deletion within 45 days as required by CCPA

Failure to comply within the legally mandated timeframe may result in a complaint filed with the appropriate regulatory authorities.

Sincerely,
${name}`;

    return {
      step_by_step: steps,
      email_to: `privacy@${broker.name.toLowerCase().replace(/[\s.]+/g, '')}.com`,
      email_subject: `Data Deletion Request — ${name} — ${broker.name}`,
      email_body: emailBody,
      privacy_contact: { email: `privacy@${broker.name.toLowerCase().replace(/[\s.]+/g, '')}.com` },
      special_requirements: broker.requires_id ? ['Government-issued photo ID required'] : [],
      estimated_time: broker.difficulty === 'easy' ? '24-48 hours' : broker.difficulty === 'medium' ? '3-7 days' : '14-30 days',
      tips: [
        'Save a screenshot of your listing before requesting removal for your records.',
        'Set a calendar reminder to verify removal after the estimated time.',
        broker.notes || 'Check the broker\'s site to confirm removal after processing.',
      ],
    };
  },

  async analyzeBreachMatch({ prompt }) {
    const keys = getApiKeys();
    if (!keys.openai_api_key) {
      return {
        data: {
          includes_me: true,
          my_data_found: ['email', 'name'],
          explanation: 'Based on breach scope and your profile data, your information was likely included. Most large-scale breaches affect all users of the affected service. For precise confirmation, add an OpenAI or HIBP key in Settings.',
          recommendation: 'Assume your data was included and take protective action: change passwords, enable 2FA, and monitor your credit.',
        },
      };
    }
    const result = await invokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          includes_me: { type: 'boolean' },
          my_data_found: { type: 'array', items: { type: 'string' } },
          explanation: { type: 'string' },
        },
      },
    });
    return { data: result };
  },

  async analyzeLegalAction({ finding, dataAnalysis }) {
    const keys = getApiKeys();
    if (!keys.openai_api_key) {
      const exposed = (finding.data_exposed || []).map(d => d.toLowerCase());
      const hasSSN = exposed.some(d => /ssn|social security/i.test(d));
      const hasFinancial = exposed.some(d => /credit card|bank|financial|payment/i.test(d));
      const hasHealth = exposed.some(d => /medical|health|hipaa/i.test(d));

      const laws = [
        { law_name: 'Fair Credit Reporting Act (FCRA)', why_applicable: 'Applies to entities that report or use consumer credit data', damages_available: '$100-$1,000 per violation (statutory); actual damages unlimited' },
        { law_name: 'State Data Breach Notification Laws', why_applicable: 'All 50 states require timely breach notification', damages_available: 'Varies by state; some allow statutory damages' },
      ];
      if (hasSSN || hasFinancial) {
        laws.push({ law_name: 'Gramm-Leach-Bliley Act (GLBA)', why_applicable: 'Financial institutions must protect customer data', damages_available: 'Up to $100,000 per violation' });
      }
      if (hasHealth) {
        laws.push({ law_name: 'HIPAA', why_applicable: 'Healthcare entities must protect medical information', damages_available: '$100-$50,000 per violation' });
      }
      laws.push(
        { law_name: 'California Consumer Privacy Act (CCPA)', why_applicable: 'California residents can sue for data breaches due to inadequate security', damages_available: '$100-$750 per consumer per incident (statutory)' },
        { law_name: 'FTC Act Section 5', why_applicable: 'Prohibits unfair or deceptive data security practices', damages_available: 'FTC enforcement; supports private class actions' },
      );

      return {
        data: {
          company_legal_name: finding.source_name || 'Unknown',
          applicable_laws: laws,
          legal_basis: `Your data (${(finding.data_exposed || ['personal information']).join(', ')}) was exposed in a breach by ${finding.source_name || 'this company'}. Multiple federal and state laws may apply.`,
          legal_basis_strength: (finding.risk_score || 50) > 70 ? 'Strong' : 'Moderate',
          potential_damages: hasSSN ? 'Potentially significant (SSN exposure)' : hasFinancial ? 'Moderate to significant (financial data)' : 'Statutory minimums plus actual damages',
          damages_breakdown: { statutory_damages: '$100-$1,000 per violation (FCRA/CCPA)', actual_damages: 'Document all out-of-pocket expenses', estimated_recovery_low: '$100', estimated_recovery_high: hasSSN ? '$20,000' : '$5,000' },
          attorney_name: 'National Association of Consumer Advocates',
          attorney_firm: 'NACA Directory',
          attorney_location: 'Nationwide',
          attorney_phone: '',
          attorney_email: '',
          attorney_website: 'https://www.consumeradvocates.org/find-an-attorney',
          existing_class_action: false,
          class_action_details: `Search classaction.org for current lawsuits: https://www.classaction.org/search?query=${encodeURIComponent(finding.source_name || '')}`,
          statute_deadline: 'Varies by state — typically 2-6 years from discovery. Act promptly.',
          legally_required_steps: [
            { step_title: 'Document Everything', explanation: 'Save all evidence of the breach, notifications received, and any financial harm.' },
            { step_title: 'File an FTC Report', explanation: 'Report at reportfraud.ftc.gov. This creates an official record.' },
            { step_title: 'File an Identity Theft Report', explanation: 'If SSN or financial data exposed, file at identitytheft.gov.' },
            { step_title: 'Freeze Your Credit', explanation: 'Place security freezes at Equifax (1-800-685-1111), Experian (1-888-397-3742), and TransUnion (1-888-909-8872).' },
            { step_title: 'Consult an Attorney', explanation: 'Many consumer protection attorneys offer free consultations for data breach cases.' },
            { step_title: 'Check for Class Actions', explanation: `Search classaction.org for ${finding.source_name || 'this company'} to see if you can join an existing case.` },
          ],
          source: 'local_analysis',
        },
      };
    }
    const prompt = `You are an expert data breach attorney assistant. Provide comprehensive legal action information for this breach.

DATA BREACH DETAILS:
- Company/Source: ${finding.source_name}
- Type: ${finding.source_type?.replace(/_/g, ' ')}
- Data Exposed: ${(finding.data_exposed || []).join(', ') || 'personal information'}
- Risk Level: ${finding.risk_score}/100
- Discovered: ${finding.scan_date || 'Recently'}
${dataAnalysis || ''}

Provide: company_legal_name, applicable_laws (array with law_name, why_applicable, damages_available), legal_basis, legal_basis_strength, potential_damages, damages_breakdown (statutory_damages, actual_damages, estimated_recovery_low, estimated_recovery_high), attorney_name, attorney_firm, attorney_location, attorney_phone, attorney_email, existing_class_action (boolean), class_action_details, statute_deadline, legally_required_steps (array with step_title, explanation).`;
    const result = await invokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          company_legal_name: { type: 'string' },
          applicable_laws: { type: 'array', items: { type: 'object', properties: { law_name: { type: 'string' }, why_applicable: { type: 'string' }, damages_available: { type: 'string' } } } },
          existing_class_action: { type: 'boolean' },
          class_action_details: { type: 'string' },
          attorney_name: { type: 'string' },
          attorney_firm: { type: 'string' },
          attorney_location: { type: 'string' },
          attorney_phone: { type: 'string' },
          attorney_email: { type: 'string' },
          legal_basis: { type: 'string' },
          legal_basis_strength: { type: 'string' },
          potential_damages: { type: 'string' },
          damages_breakdown: { type: 'object', properties: { statutory_damages: { type: 'string' }, actual_damages: { type: 'string' }, estimated_recovery_low: { type: 'string' }, estimated_recovery_high: { type: 'string' } } },
          legally_required_steps: { type: 'array', items: { type: 'object', properties: { step_title: { type: 'string' }, explanation: { type: 'string' } } } },
          statute_deadline: { type: 'string' },
        },
      },
    });
    return { data: result };
  },

  async generateCancellationEmail({ serviceName, serviceUrl, userName, accountInfo }) {
    const keys = getApiKeys();
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const name = serviceName || 'this service';
    const supportEmail = `support@${(name).toLowerCase().replace(/[\s.]+/g, '')}.com`;

    if (!keys.openai_api_key) {
      const subject = `Cancellation Request — ${name} — Immediate Action Required`;
      const body = `To Whom It May Concern,

I am writing to formally request the immediate cancellation of my subscription/membership with ${name}.

Account holder: ${userName || '[Your Name]'}
${accountInfo ? `Account reference: ${accountInfo}` : ''}
Date of request: ${today}

I request that you:
1. Cancel my subscription/membership effective immediately
2. Stop all future recurring charges to my payment method
3. Send written confirmation of this cancellation to my email address
4. Process any applicable prorated refund

Under the FTC's "Click-to-Cancel" rule (effective 2025) and applicable state consumer protection laws, you are required to make cancellation at least as easy as sign-up. If I signed up online, I expect to be able to cancel online or via this email without being required to call or chat.

If this cancellation is not confirmed within 3 business days, I will:
- File a complaint with the Federal Trade Commission (FTC)
- File a complaint with my state Attorney General
- Dispute all future charges with my bank as unauthorized

Please confirm this cancellation in writing.

Sincerely,
${userName || '[Your Name]'}`;

      return {
        data: {
          subject,
          body,
          to: supportEmail,
          mailto_url: `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
        },
      };
    }

    const result = await invokeLLM({
      prompt: `Generate a professional cancellation email for ${name} (${serviceUrl || 'N/A'}).
Account holder: ${userName || 'the user'}
Account info: ${accountInfo || 'N/A'}
Date: ${today}

The email should:
- Be firm but professional
- Cite FTC Click-to-Cancel rule and consumer protection laws
- Demand immediate cancellation and charge cessation
- Request written confirmation
- Warn of FTC/AG complaints and bank disputes if ignored
- Be ready to send as-is

Return: subject, body, to (support email address)`,
      response_json_schema: {
        type: 'object',
        properties: { subject: { type: 'string' }, body: { type: 'string' }, to: { type: 'string' } },
      },
    });
    const to = result.to || supportEmail;
    return {
      data: {
        ...result,
        to,
        mailto_url: `mailto:${to}?subject=${encodeURIComponent(result.subject || '')}&body=${encodeURIComponent(result.body || '')}`,
      },
    };
  },

  async generateFakeIdentity() {
    const firstNames = ['Alex', 'Jordan', 'Morgan', 'Casey', 'Riley', 'Taylor', 'Quinn', 'Avery', 'Cameron', 'Dakota', 'Harper', 'Skyler', 'Reese', 'Phoenix', 'Sage'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Martinez', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson', 'White'];
    const domains = ['protonmail.com', 'tutanota.com', 'guerrillamail.com', 'tempmail.org', 'sharklasers.com'];
    const streets = ['Oak', 'Maple', 'Cedar', 'Pine', 'Elm', 'Birch', 'Walnut', 'Spruce', 'Willow', 'Ash'];
    const cities = ['Portland', 'Austin', 'Denver', 'Raleigh', 'Boise', 'Tucson', 'Tampa', 'Omaha', 'Madison', 'Reno'];
    const states = ['OR', 'TX', 'CO', 'NC', 'ID', 'AZ', 'FL', 'NE', 'WI', 'NV'];
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const randNum = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    const firstName = pick(firstNames);
    const lastName = pick(lastNames);
    const stateIdx = randNum(0, states.length - 1);

    return {
      data: {
        full_name: `${firstName} ${lastName}`,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randNum(10, 999)}@${pick(domains)}`,
        phone: `(${randNum(200, 999)}) ${randNum(200, 999)}-${randNum(1000, 9999)}`,
        address: `${randNum(100, 9999)} ${pick(streets)} ${pick(['St', 'Ave', 'Blvd', 'Dr', 'Ln'])}`,
        city: cities[stateIdx],
        state: states[stateIdx],
        zip: String(randNum(10000, 99999)),
        dob: `${randNum(1, 12)}/${randNum(1, 28)}/${randNum(1970, 2000)}`,
      },
    };
  },

  async matchSettlements({ profileData, breaches, subscriptions }) {
    const keys = getApiKeys();
    const breachList = (breaches || []).map(b => b.source_name).filter(Boolean).join(', ');
    const subList = (subscriptions || []).map(s => s.service_name).filter(Boolean).join(', ');
    const emails = (profileData || []).filter(d => d.data_type === 'email').map(d => d.value).join(', ');
    if (!keys.openai_api_key) {
      const cases = [];
      const knownSettlements = [
        { company: 'Equifax', case_name: 'Equifax Data Breach Settlement', deadline: '2024-01-22', payout: '$125-$20,000', no_proof: true, url: 'https://www.equifaxbreachsettlement.com', category: 'data_breach' },
        { company: 'Facebook', case_name: 'Facebook Privacy Settlement', deadline: '2024-08-17', payout: '$200-$5,000', no_proof: false, url: 'https://www.facebookuserprivacysettlement.com', category: 'privacy' },
        { company: 'T-Mobile', case_name: 'T-Mobile Data Breach Settlement', deadline: '2023-01-23', payout: '$25-$25,000', no_proof: true, url: 'https://www.t-mobilesettlement.com', category: 'data_breach' },
        { company: 'Yahoo', case_name: 'Yahoo Data Breach Settlement', deadline: '2020-07-20', payout: '$100-$358', no_proof: true, url: 'https://yahoodatabreachsettlement.com', category: 'data_breach' },
        { company: 'Capital One', case_name: 'Capital One Data Breach Settlement', deadline: '2023-09-30', payout: '$25-$25,000', no_proof: true, url: 'https://www.capitalonesettlement.com', category: 'data_breach' },
      ];
      const allCompanies = [...(breaches || []).map(b => b.source_name), ...(subscriptions || []).map(s => s.service_name)].filter(Boolean);
      for (const s of knownSettlements) {
        const matched = allCompanies.some(c => c?.toLowerCase().includes(s.company.toLowerCase()));
        cases.push({ ...s, confidence: matched ? 'likely_eligible' : 'possible_match', matched_via: matched ? 'breach/subscription data' : 'general eligibility' });
      }
      return { data: { cases } };
    }
    const result = await invokeLLM({
      prompt: `You are a settlement and class action research assistant. Given the user's data, find all potentially relevant settlements and class actions.

USER DATA:
- Breached companies: ${breachList || 'None found'}
- Subscription services: ${subList || 'None tracked'}
- Email addresses: ${emails || 'Not provided'}

For each potential case, provide:
- case_name: Official name
- company: Defendant company
- category: data_breach, privacy, consumer_fraud, product_liability, employment, financial
- deadline: Claim deadline (YYYY-MM-DD or "open" or "closed")
- payout: Estimated payout range
- no_proof: boolean - can claim without proof of purchase/membership?
- proof_required: What proof is needed if any
- eligibility: Who qualifies
- url: Official settlement website
- confidence: likely_eligible, possible_match, needs_proof, or unlikely
- matched_via: What user data triggered this match

Find 5-15 relevant cases. Prioritize open settlements with approaching deadlines.`,
      response_json_schema: {
        type: 'object',
        properties: {
          cases: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                case_name: { type: 'string' }, company: { type: 'string' },
                category: { type: 'string' }, deadline: { type: 'string' },
                payout: { type: 'string' }, no_proof: { type: 'boolean' },
                proof_required: { type: 'string' }, eligibility: { type: 'string' },
                url: { type: 'string' }, confidence: { type: 'string' },
                matched_via: { type: 'string' },
              },
            },
          },
        },
      },
    });
    return { data: result };
  },

  async generateDisputeLetter({ issueType, creditor, amount, accountNumber, reason, bureaus }) {
    const keys = getApiKeys();
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    if (!keys.openai_api_key) {
      const templates = {
        dispute: `${today}\n\n[Your Name]\n[Your Address]\n\nTo: ${(bureaus || ['Equifax, Experian, TransUnion']).join(', ')}\n\nRE: Formal Dispute of Inaccurate Information\nCreditor: ${creditor || '[Creditor Name]'}\nAccount: ${accountNumber || '[Account Number]'}\nAmount: ${amount ? '$' + amount : '[Amount]'}\n\nI am writing pursuant to the Fair Credit Reporting Act (FCRA), 15 U.S.C. § 1681i, to dispute the following inaccurate information on my credit report.\n\nReason for Dispute: ${reason || 'This account contains inaccurate information that must be investigated and corrected.'}\n\nI request that you investigate this matter within 30 days as required by law. If you cannot verify this information, it must be removed from my credit report immediately.\n\nPlease send me written confirmation of the results of your investigation.\n\nSincerely,\n[Your Signature]\n[Your Name]`,
        debt_validation: `${today}\n\nTo: ${creditor || '[Collection Agency]'}\n\nRE: Debt Validation Request — FDCPA § 1692g\nAlleged Amount: ${amount ? '$' + amount : '[Amount]'}\nReference: ${accountNumber || '[Reference Number]'}\n\nI am writing to formally request validation of this alleged debt pursuant to the Fair Debt Collection Practices Act.\n\nPlease provide:\n1. Original signed agreement\n2. Complete payment history\n3. Proof you are licensed to collect in my state\n4. Name and address of original creditor\n5. Amount owed with itemized fees\n\nUntil this debt is validated, cease all collection activity.\n\nSincerely,\n[Your Name]`,
        goodwill: `${today}\n\nTo: ${creditor || '[Creditor]'}\nAccount: ${accountNumber || '[Account Number]'}\n\nRE: Goodwill Adjustment Request\n\nI am writing to respectfully request a goodwill adjustment to remove the late payment(s) reported on my account.\n\n${reason || 'I experienced a temporary hardship but have since maintained a perfect payment history.'}\n\nI value my relationship with your company and would greatly appreciate this adjustment. My credit history shows consistent responsibility otherwise.\n\nThank you for your consideration.\n\nSincerely,\n[Your Name]`,
        cease_contact: `${today}\n\nTo: ${creditor || '[Collection Agency]'}\n\nRE: Cease Communication — FDCPA § 1692c\nReference: ${accountNumber || '[Reference Number]'}\n\nPursuant to the Fair Debt Collection Practices Act, I hereby demand that you cease all further communication with me regarding this alleged debt.\n\nThis is not an acknowledgment of the debt. Any further contact except to confirm cessation or notify of legal action will be reported to the FTC and my state Attorney General.\n\nSincerely,\n[Your Name]`,
      };
      return { data: { letter: templates[issueType] || templates.dispute, type: issueType } };
    }
    const result = await invokeLLM({
      prompt: `Generate a professional ${issueType} letter for credit/debt purposes.
Type: ${issueType} (dispute, debt_validation, goodwill, cease_contact, identity_theft)
Creditor: ${creditor || 'Unknown'}
Amount: ${amount || 'Unknown'}
Account: ${accountNumber || 'Unknown'}
Reason: ${reason || 'Inaccurate reporting'}
Bureaus: ${(bureaus || []).join(', ') || 'All three'}

Generate a complete, ready-to-send letter citing relevant laws (FCRA, FDCPA, etc.). Include placeholders for personal info as [Your Name], [Your Address], etc.`,
      response_json_schema: {
        type: 'object',
        properties: { letter: { type: 'string' }, type: { type: 'string' }, laws_cited: { type: 'array', items: { type: 'string' } } },
      },
    });
    return { data: result };
  },

  async parseCreditReport({ text, bureau }) {
    const keys = getApiKeys();
    if (!keys.openai_api_key) {
      const lines = (text || '').split('\n').filter(l => l.trim());
      const tradelines = [];
      const inquiries = [];
      const collections = [];
      const personalInfo = {};

      const bureauNorm = (bureau || 'unknown').toLowerCase();
      let section = '';
      for (const raw of lines) {
        const line = raw.trim();
        const lower = line.toLowerCase();
        if (/account|tradeline|credit\s+account/i.test(lower)) section = 'tradeline';
        if (/inquir/i.test(lower)) section = 'inquiry';
        if (/collection/i.test(lower)) section = 'collection';

        if (section === 'tradeline' && /\$[\d,.]+/.test(line)) {
          const amtMatch = line.match(/\$[\d,.]+/);
          tradelines.push({
            creditor: line.split(/\s{2,}|\t/)[0]?.trim() || line.slice(0, 30),
            balance: amtMatch ? amtMatch[0] : 'N/A',
            account_number: line.match(/\b\d{4,}\b/)?.[0] || '',
            status: /closed|paid/i.test(line) ? 'closed' : /delinquent|late|past\s*due/i.test(line) ? 'delinquent' : 'open',
            account_type: /mortgage/i.test(line) ? 'mortgage' : /auto|car/i.test(line) ? 'auto_loan' : /student/i.test(line) ? 'student_loan' : /card|revolving/i.test(line) ? 'credit_card' : 'other',
            raw_text: line,
          });
        }
        if (section === 'inquiry') {
          if (line.length > 5 && !/^inquir/i.test(line)) {
            inquiries.push({
              creditor: line.split(/\s{2,}|\t/)[0]?.trim() || line.slice(0, 30),
              date: line.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/)?.[0] || '',
              type: /hard/i.test(line) ? 'hard' : 'soft',
              raw_text: line,
            });
          }
        }
        if (section === 'collection') {
          if (/\$[\d,.]+/.test(line)) {
            const amtMatch = line.match(/\$[\d,.]+/);
            collections.push({
              agency: line.split(/\s{2,}|\t/)[0]?.trim() || line.slice(0, 30),
              amount: amtMatch ? amtMatch[0] : 'N/A',
              original_creditor: '',
              status: /paid/i.test(line) ? 'paid' : 'open',
              raw_text: line,
            });
          }
        }
      }
      return { data: { bureau: bureauNorm, tradelines, inquiries, collections, personalInfo, parsed_method: 'heuristic', item_count: tradelines.length + inquiries.length + collections.length } };
    }
    const result = await invokeLLM({
      prompt: `You are a credit report parsing specialist. Parse the following ${bureau || 'credit'} report text into structured data.

TEXT:
${(text || '').slice(0, 8000)}

Extract and return ALL items:
1. tradelines: creditor, account_number, account_type, balance, credit_limit, payment_status, date_opened, date_reported, payment_history_summary, status (open/closed/delinquent), remarks
2. inquiries: creditor, date, type (hard/soft)
3. collections: agency, amount, original_creditor, date_opened, status (open/paid)
4. personal_info: name, address, ssn_last4, dob if visible
5. public_records: any judgments, liens, bankruptcies

Be thorough — capture every tradeline and inquiry even if formatting is inconsistent.`,
      response_json_schema: {
        type: 'object',
        properties: {
          bureau: { type: 'string' },
          tradelines: { type: 'array', items: { type: 'object', properties: { creditor: { type: 'string' }, account_number: { type: 'string' }, account_type: { type: 'string' }, balance: { type: 'string' }, credit_limit: { type: 'string' }, payment_status: { type: 'string' }, date_opened: { type: 'string' }, date_reported: { type: 'string' }, status: { type: 'string' }, remarks: { type: 'string' } } } },
          inquiries: { type: 'array', items: { type: 'object', properties: { creditor: { type: 'string' }, date: { type: 'string' }, type: { type: 'string' } } } },
          collections: { type: 'array', items: { type: 'object', properties: { agency: { type: 'string' }, amount: { type: 'string' }, original_creditor: { type: 'string' }, status: { type: 'string' } } } },
          personal_info: { type: 'object' },
          public_records: { type: 'array', items: { type: 'object' } },
          item_count: { type: 'number' },
        },
      },
    });
    return { data: { ...result, bureau: (bureau || 'unknown').toLowerCase(), parsed_method: 'ai' } };
  },

  async analyzeCreditDisputes({ tradelines, inquiries, collections, bureau }) {
    const keys = getApiKeys();
    if (!keys.openai_api_key) {
      const items = [];
      for (const t of (tradelines || [])) {
        const reasons = [];
        let confidence = 40;
        if (t.status === 'delinquent' || /late|past.due/i.test(t.payment_status || '')) {
          reasons.push('incorrect_late_payment');
          confidence = 55;
        }
        if (!t.balance || t.balance === 'N/A') {
          reasons.push('incorrect_balance');
          confidence = 50;
        }
        if (/unknown|unverified/i.test(t.remarks || '')) {
          reasons.push('not_mine');
          confidence = 60;
        }
        if (reasons.length === 0) reasons.push('incorrect_account_status');

        items.push({
          item_type: 'tradeline',
          creditor: t.creditor,
          account_number: t.account_number || '',
          dispute_categories: reasons,
          confidence,
          rationale: `This ${t.account_type || 'account'} with ${t.creditor} may have reporting inaccuracies. Review the balance (${t.balance}), status (${t.status}), and payment history for discrepancies.`,
          evidence_needed: ['Copy of credit report showing the item', 'Any correspondence from creditor', 'Payment receipts if applicable'],
          dispute_path: 'bureau_and_furnisher',
          risk_notes: 'Bureau must investigate within 30 days under FCRA § 1681i.',
          bureau: bureau || 'unknown',
        });
      }

      for (const inq of (inquiries || [])) {
        if (inq.type === 'hard') {
          items.push({
            item_type: 'inquiry',
            creditor: inq.creditor,
            account_number: '',
            dispute_categories: ['inquiry_not_authorized'],
            confidence: 45,
            rationale: `Hard inquiry by ${inq.creditor} on ${inq.date || 'unknown date'}. If you did not authorize this, dispute it.`,
            evidence_needed: ['Statement that you did not apply for credit with this company'],
            dispute_path: 'bureau_only',
            risk_notes: 'Inquiries fall off after 2 years. Disputing may or may not remove.',
            bureau: bureau || 'unknown',
          });
        }
      }

      for (const c of (collections || [])) {
        items.push({
          item_type: 'collection',
          creditor: c.agency,
          account_number: '',
          dispute_categories: c.status === 'paid' ? ['incorrect_account_status'] : ['not_mine', 'incorrect_balance'],
          confidence: c.status === 'paid' ? 65 : 50,
          rationale: `Collection by ${c.agency} for ${c.amount}${c.original_creditor ? ` (original: ${c.original_creditor})` : ''}. ${c.status === 'paid' ? 'Should be updated to reflect paid status.' : 'Validate this debt and dispute inaccuracies.'}`,
          evidence_needed: ['Debt validation letter', 'Proof of payment if paid', 'Identity theft report if not yours'],
          dispute_path: 'bureau_and_furnisher',
          risk_notes: 'Send debt validation request within 30 days of first contact.',
          bureau: bureau || 'unknown',
        });
      }

      return { data: { items, analysis_method: 'rule_based' } };
    }
    const itemSummary = [
      ...(tradelines || []).map(t => `TRADELINE: ${t.creditor} | bal:${t.balance} | status:${t.status} | type:${t.account_type} | remarks:${t.remarks || 'none'}`),
      ...(inquiries || []).map(i => `INQUIRY: ${i.creditor} | date:${i.date} | type:${i.type}`),
      ...(collections || []).map(c => `COLLECTION: ${c.agency} | amt:${c.amount} | orig:${c.original_creditor} | status:${c.status}`),
    ].join('\n');

    const result = await invokeLLM({
      prompt: `You are a credit dispute analyst. Analyze these ${bureau || 'credit report'} items and identify disputable issues.

ITEMS:
${itemSummary}

For EACH item, determine:
- item_type: tradeline, inquiry, or collection
- creditor: company name
- dispute_categories: array of applicable categories from: not_mine, duplicate_account, identity_theft, incorrect_balance, incorrect_late_payment, incorrect_account_status, obsolete_information, mixed_file, inaccurate_personal_info, inquiry_not_authorized, inconsistent_cross_bureau
- confidence: 0-100 score for dispute success likelihood
- rationale: why this might be disputable
- evidence_needed: array of supporting documents
- dispute_path: bureau_only, furnisher_only, or bureau_and_furnisher
- risk_notes: caveats or legal considerations
- bureau: ${bureau || 'unknown'}

Prioritize items with highest dispute success likelihood. Be specific about why each item is disputable.`,
      response_json_schema: {
        type: 'object',
        properties: {
          items: { type: 'array', items: { type: 'object', properties: {
            item_type: { type: 'string' }, creditor: { type: 'string' },
            dispute_categories: { type: 'array', items: { type: 'string' } },
            confidence: { type: 'number' }, rationale: { type: 'string' },
            evidence_needed: { type: 'array', items: { type: 'string' } },
            dispute_path: { type: 'string' }, risk_notes: { type: 'string' },
            bureau: { type: 'string' },
          } } },
          analysis_method: { type: 'string' },
        },
      },
    });
    return { data: result };
  },

  async generateBureauDisputeKit({ bureau, items, personalInfo }) {
    const keys = getApiKeys();
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const bureauAddresses = {
      experian: 'Experian\nP.O. Box 4500\nAllen, TX 75013',
      equifax: 'Equifax Information Services LLC\nP.O. Box 740256\nAtlanta, GA 30374',
      transunion: 'TransUnion LLC\nConsumer Dispute Center\nP.O. Box 2000\nChester, PA 19016',
    };
    const bureauOnline = {
      experian: { url: 'https://www.experian.com/disputes/main.html', notes: 'Sign in or create account → Disputes → Select items → Submit' },
      equifax: { url: 'https://www.equifax.com/personal/credit-report-services/credit-dispute/', notes: 'Sign in → Review report → Open dispute → Select reason' },
      transunion: { url: 'https://www.transunion.com/credit-disputes/dispute-your-credit', notes: 'Sign in → View report → Select item → File dispute' },
    };
    const b = (bureau || 'experian').toLowerCase();
    const addr = bureauAddresses[b] || bureauAddresses.experian;
    const online = bureauOnline[b] || bureauOnline.experian;

    const itemList = (items || []).map((item, i) =>
      `${i + 1}. ${item.creditor || 'Unknown'} — Account: ${item.account_number || 'N/A'}\n   Dispute Reason: ${(item.dispute_categories || []).join(', ')}\n   Details: ${item.rationale || 'Inaccurate information'}`
    ).join('\n\n');

    const letter = `${today}

[Your Full Name]
[Your Address]
[City, State ZIP]
[Your SSN Last 4: XXX-XX-____]
[Your Date of Birth]

${addr}

RE: Formal Dispute of Inaccurate Credit Report Information
    FCRA § 1681i — Request for Investigation

Dear ${bureau ? bureau.charAt(0).toUpperCase() + bureau.slice(1) : 'Credit Bureau'} Dispute Department,

I am writing pursuant to the Fair Credit Reporting Act, 15 U.S.C. § 1681i, to formally dispute the following inaccurate items on my credit report. I request that you conduct a reasonable investigation and correct or remove these items within 30 days as required by law.

DISPUTED ITEMS:

${itemList || '[List disputed items here]'}

REQUESTED ACTION:
For each item listed above, I request that you:
1. Conduct a thorough investigation as required under FCRA § 1681i
2. Forward all relevant information to the furnisher for verification
3. Correct or delete any information that cannot be verified
4. Provide me with written notice of the results within 30 days
5. Send an updated copy of my credit report reflecting any changes

I am enclosing copies of supporting documentation as indicated. Please do not treat this as a frivolous dispute — each item identified has specific factual inaccuracies that require investigation.

Under the FCRA, you must complete this investigation within 30 days (or 45 days if I submit additional information). If the disputed information cannot be verified, it must be promptly deleted or modified.

Sincerely,

_______________________________
[Your Printed Name]

Enclosures:
- Copy of government-issued photo ID
- Copy of utility bill or bank statement (proof of address)
- Copy of Social Security card (optional but recommended)
${(items || []).some(i => (i.evidence_needed || []).length > 0) ? '- Supporting evidence as noted above' : ''}`;

    const onlineCopy = (items || []).map((item, i) =>
      `Item ${i + 1}: ${item.creditor || 'Unknown'}\nAccount: ${item.account_number || 'N/A'}\nReason: ${(item.dispute_categories || []).map(c => c.replace(/_/g, ' ')).join(', ')}\nExplanation: ${item.rationale || 'This information is inaccurate and should be investigated.'}`
    ).join('\n\n---\n\n');

    if (!keys.openai_api_key) {
      return {
        data: {
          bureau: b,
          mail_letter: letter,
          online_copy: onlineCopy,
          online_info: online,
          mail_address: addr,
          checklist: [
            'Print the dispute letter',
            'Sign the letter',
            'Make a copy of your government-issued photo ID',
            'Make a copy of a utility bill or bank statement showing your address',
            'Gather any supporting evidence for each disputed item',
            'Make copies of everything for your records',
            'Send via certified mail with return receipt requested',
            `Track your certified mail delivery at usps.com`,
            'Set calendar reminder for 30 days from mailing date',
            'If no response in 30 days, escalate to CFPB complaint',
          ],
          furnisher_letter: items?.length > 0 ? `${today}\n\n[Your Name]\n[Your Address]\n\nTo: ${items[0].creditor || '[Furnisher Name]'}\n\nRE: Direct Dispute Under FCRA § 1681s-2(b)\n\nI am writing to dispute information you are furnishing to the credit bureaus regarding my account.\n\nAccount: ${items[0].account_number || '[Account Number]'}\nIssue: ${(items[0].dispute_categories || []).join(', ')}\n\nPlease investigate and correct this reporting. Under FCRA § 1681s-2(b), you must conduct a reasonable investigation upon receiving notice of a dispute.\n\nSincerely,\n[Your Name]` : null,
          follow_up_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        },
      };
    }
    const result = await invokeLLM({
      prompt: `Generate a complete dispute kit for ${bureau} credit bureau. Items to dispute:\n${itemList}\n\nProvide:\n1. mail_letter: Complete, professional dispute letter\n2. online_copy: Text formatted for online dispute forms\n3. checklist: Array of preparation and mailing steps\n4. furnisher_letter: Direct dispute letter to the furnisher if applicable\n5. follow_up_date: 30 days from today\n6. bureau: ${b}\n7. tips: Array of strategic tips`,
      response_json_schema: {
        type: 'object',
        properties: {
          bureau: { type: 'string' }, mail_letter: { type: 'string' },
          online_copy: { type: 'string' },
          checklist: { type: 'array', items: { type: 'string' } },
          furnisher_letter: { type: 'string' },
          follow_up_date: { type: 'string' },
          tips: { type: 'array', items: { type: 'string' } },
        },
      },
    });
    return { data: { ...result, bureau: b, online_info: online, mail_address: addr } };
  },

  async generateBrokerCampaign({ profileData, brokers }) {
    const keys = getApiKeys();
    const dataItems = (profileData || []).map(d => `${d.data_type}: ${d.value?.slice(0, 20)}...`).join(', ');
    const brokerList = (brokers || []).map(b => b.site_name || b.name).join(', ');
    if (!keys.openai_api_key) {
      const tasks = (brokers || []).map(b => ({
        broker_name: b.site_name || b.name || 'Unknown Broker',
        opt_out_url: b.removal_url || b.opt_out_url || '',
        method: b.removal_url ? 'online_form' : 'email',
        estimated_time: '2-4 weeks',
        difficulty: b.removal_difficulty || 'medium',
        steps: [
          `Visit ${b.site_name || b.name}'s opt-out page`,
          'Search for your listing using your name and location',
          'Submit the opt-out/removal request',
          'Verify your identity if required',
          'Save confirmation and set reminder to verify in 30 days',
        ],
      }));
      return { data: { campaign_name: `Privacy Cleanup — ${new Date().toLocaleDateString()}`, tasks, total_brokers: tasks.length } };
    }
    const result = await invokeLLM({
      prompt: `Generate a data broker removal campaign. Create step-by-step tasks for removing personal data from these brokers: ${brokerList || 'common people-search sites'}.

User data to remove: ${dataItems || 'name, email, phone, address'}

For each broker, provide:
- broker_name
- opt_out_url: direct URL
- method: online_form, email, mail, phone
- email_template: ready-to-send removal email if method is email
- estimated_time
- difficulty: easy, medium, hard
- steps: array of specific instructions
- id_proof_required: boolean
- recheck_days: number of days before rechecking`,
      response_json_schema: {
        type: 'object',
        properties: {
          campaign_name: { type: 'string' },
          tasks: { type: 'array', items: { type: 'object', properties: {
            broker_name: { type: 'string' }, opt_out_url: { type: 'string' },
            method: { type: 'string' }, email_template: { type: 'string' },
            estimated_time: { type: 'string' }, difficulty: { type: 'string' },
            steps: { type: 'array', items: { type: 'string' } },
            id_proof_required: { type: 'boolean' }, recheck_days: { type: 'number' },
          }}},
          total_brokers: { type: 'number' },
        },
      },
    });
    return { data: result };
  },

  async blockExposureSource({ sourceName, sourceUrl, sourceType, personalData }) {
    const keys = getApiKeys();
    const dataDesc = (personalData || []).map(d => `${d.data_type}: ${d.value}`).join(', ');
    if (!keys.openai_api_key) {
      const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      return {
        data: {
          removal_email: {
            subject: `URGENT: Data Removal / CCPA & GDPR Deletion Request — ${sourceName}`,
            body: `To Whom It May Concern,\n\nPursuant to the California Consumer Privacy Act (CCPA), the General Data Protection Regulation (GDPR), and applicable state privacy laws, I am requesting the immediate and complete deletion of all personal data you hold about me.\n\nData to be removed:\n${dataDesc || 'All personal information associated with my identity.'}\n\nSource: ${sourceUrl || sourceName}\n\nI demand that you:\n1. Delete all personal data you hold about me\n2. Cease any further collection, sale, or sharing of my data\n3. Confirm deletion within 30 days as required by law\n4. Provide written confirmation that my data has been purged from all systems\n\nFailure to comply may result in legal action and regulatory complaints.\n\nDate: ${today}\n\nRegards,\n[Your Name]`,
          },
          block_steps: [
            `Search for your profile on ${sourceName} and note the exact URL.`,
            `Look for an opt-out or removal page on ${sourceUrl || sourceName + '.com'}.`,
            'Submit the opt-out form with your information.',
            'Send the removal email (above) to their privacy or support address.',
            'File a complaint with the FTC at reportfraud.ftc.gov if they do not comply within 30 days.',
            'Consider filing a GDPR complaint with your local data protection authority.',
            'Set a calendar reminder to verify removal in 30 days.',
          ],
          opt_out_url: sourceUrl || `https://www.google.com/search?q=${encodeURIComponent(sourceName + ' opt out remove my data')}`,
          legal_basis: ['CCPA (California Consumer Privacy Act)', 'GDPR Article 17 (Right to Erasure)', 'State Privacy Laws'],
        },
      };
    }
    const result = await invokeLLM({
      prompt: `You are a privacy rights expert. Generate a comprehensive data removal/blocking package for "${sourceName}" (${sourceUrl || 'N/A'}).

The user's personal data found on this source: ${dataDesc || 'various personal information'}
Source type: ${sourceType || 'data broker / online service'}

Generate:
1. removal_email: { subject, body } — A formal CCPA/GDPR deletion demand email ready to send
2. block_steps: Array of specific step-by-step instructions to remove data from this specific source
3. opt_out_url: Direct URL to the source's opt-out / removal page (if known)
4. support_email: The source's privacy/DPO email address
5. legal_basis: Array of laws that compel this source to delete the data
6. escalation_steps: Array of steps if they refuse (FTC complaint, state AG, etc.)
7. estimated_removal_time: How long removal typically takes for this source
8. difficulty: "easy", "medium", or "hard"`,
      response_json_schema: {
        type: 'object',
        properties: {
          removal_email: {
            type: 'object',
            properties: { subject: { type: 'string' }, body: { type: 'string' } },
          },
          block_steps: { type: 'array', items: { type: 'string' } },
          opt_out_url: { type: 'string' },
          support_email: { type: 'string' },
          legal_basis: { type: 'array', items: { type: 'string' } },
          escalation_steps: { type: 'array', items: { type: 'string' } },
          estimated_removal_time: { type: 'string' },
          difficulty: { type: 'string' },
        },
      },
    });
    return { data: result };
  },

  async generateCancelInstructions({ serviceName, serviceUrl }) {
    const keys = getApiKeys();
    if (!keys.openai_api_key) {
      const name = serviceName || 'this service';
      return {
        data: {
          steps: [
            `Go to ${serviceUrl || name + '.com'} and log in to your account.`,
            'Navigate to Account Settings or Billing.',
            'Look for "Cancel Subscription" or "Manage Plan".',
            'Follow the cancellation flow — decline any retention offers.',
            'Take a screenshot of the cancellation confirmation.',
            'Check your email for a cancellation confirmation.',
            'If no online option, email their support requesting cancellation.',
            'Update your billing info to fake data BEFORE cancelling to prevent re-billing.',
          ],
          cancel_url: serviceUrl || `https://www.google.com/search?q=${encodeURIComponent(name + ' cancel subscription')}`,
          support_email: `support@${(serviceName || 'service').toLowerCase().replace(/[\s.]+/g, '')}.com`,
          difficulty: 'medium',
          tips: [
            'Replace your real info with fake data before cancelling.',
            'Some services let you "pause" instead of cancel — always choose full cancellation.',
            'If they require calling, say "I want to cancel" firmly and decline all offers.',
          ],
        },
      };
    }
    const result = await invokeLLM({
      prompt: `You are a subscription cancellation expert. Provide detailed cancellation instructions for "${serviceName}" (${serviceUrl || 'N/A'}).

Generate:
1. steps: Array of specific step-by-step instructions to cancel this subscription
2. cancel_url: Direct URL to the cancellation page (if known)
3. support_email: Customer support email
4. support_phone: Customer support phone number
5. difficulty: "easy", "medium", or "hard"
6. tips: Array of tips specific to cancelling this service
7. dark_patterns: Array of any dark patterns or retention tactics this service uses
8. refund_possible: boolean — is it usually possible to get a refund?
9. refund_instructions: How to request a refund if applicable`,
      response_json_schema: {
        type: 'object',
        properties: {
          steps: { type: 'array', items: { type: 'string' } },
          cancel_url: { type: 'string' },
          support_email: { type: 'string' },
          support_phone: { type: 'string' },
          difficulty: { type: 'string' },
          tips: { type: 'array', items: { type: 'string' } },
          dark_patterns: { type: 'array', items: { type: 'string' } },
          refund_possible: { type: 'boolean' },
          refund_instructions: { type: 'string' },
        },
      },
    });
    return { data: result };
  },

  async automatedPlatformDeletion({ platform, accountUrl }) {
    const keys = getApiKeys();
    if (!keys.openai_api_key) {
      const KNOWN_DELETIONS = {
        'facebook': { direct_url: 'https://www.facebook.com/help/delete_account', data_download_url: 'https://www.facebook.com/dyi', estimated_time: '30 days', steps: ['Go to Settings & Privacy → Settings','Click "Your Facebook Information"','Click "Deactivation and Deletion"','Select "Permanently Delete Account"','Click Continue to Account Deletion','Enter password and click Delete Account'] },
        'instagram': { direct_url: 'https://www.instagram.com/accounts/remove/request/permanent/', data_download_url: 'https://www.instagram.com/download/request/', estimated_time: '30 days', steps: ['Go to Delete Your Account page','Select a reason from the dropdown','Re-enter your password','Click "Permanently delete my account"'] },
        'twitter': { direct_url: 'https://twitter.com/settings/deactivate', data_download_url: 'https://twitter.com/settings/download_your_data', estimated_time: '30 days', steps: ['Go to Settings → Your Account','Click "Deactivate your account"','Read the deactivation information','Click "Deactivate"','Enter your password to confirm','Account is deleted after 30 days of deactivation'] },
        'google': { direct_url: 'https://myaccount.google.com/delete-services-or-account', data_download_url: 'https://takeout.google.com/', estimated_time: 'Immediate to 2 months', steps: ['Go to Google Account → Data & Privacy','Scroll to "More options"','Click "Delete your Google Account"','Download your data first via Google Takeout','Follow the prompts to delete'] },
        'linkedin': { direct_url: 'https://www.linkedin.com/psettings/account-management', data_download_url: 'https://www.linkedin.com/psettings/member-data', estimated_time: 'Up to 14 days', steps: ['Go to Settings → Account Management','Click "Close account"','Select a reason','Click "Next" and confirm your password','Click "Close Account"'] },
        'tiktok': { direct_url: 'https://www.tiktok.com/setting', data_download_url: 'https://www.tiktok.com/setting/download-your-data', estimated_time: '30 days', steps: ['Open app → Profile → Settings','Tap "Manage Account"','Tap "Delete Account"','Follow verification steps','Confirm deletion'] },
        'reddit': { direct_url: 'https://www.reddit.com/settings', data_download_url: 'https://www.reddit.com/settings/data-request', estimated_time: 'Immediate', steps: ['Go to User Settings','Scroll to bottom','Click "Delete Account"','Enter username and password','Check confirmation box','Click Delete'] },
        'snapchat': { direct_url: 'https://accounts.snapchat.com/accounts/delete_account', data_download_url: 'https://accounts.snapchat.com/accounts/downloadmydata', estimated_time: '30 days', steps: ['Visit accounts.snapchat.com','Log in and go to Delete My Account','Enter credentials again','Account is deactivated for 30 days then deleted'] },
        'amazon': { direct_url: 'https://www.amazon.com/privacy/data-deletion', data_download_url: 'https://www.amazon.com/gp/privacycentral/dsar/preview.html', estimated_time: 'Up to 30 days', steps: ['Go to Account → Your Account','Select "Close Your Amazon Account"','Or contact customer service','Request account and data deletion','Download your data first'] },
      };
      const pkey = (platform || '').toLowerCase().replace(/[^a-z]/g, '');
      const known = Object.entries(KNOWN_DELETIONS).find(([k]) => pkey.includes(k));
      if (known) {
        return { data: { ...known[1], notes: `Download your data before deleting. Deletion may take up to ${known[1].estimated_time}. Some data in backups may persist longer.` } };
      }
      return {
        data: {
          steps: [
            `Go to ${platform}'s website and log in`,
            'Navigate to Account Settings or Privacy Settings',
            'Look for "Delete Account", "Close Account", or "Deactivate Account"',
            'Download your data first if the option is available',
            'Follow the deletion prompts and confirm',
            'If no self-service option exists, email their support/privacy team requesting account deletion under CCPA/GDPR',
          ],
          direct_url: accountUrl || `https://www.google.com/search?q=${encodeURIComponent(platform + ' delete account')}`,
          data_download_url: `https://www.google.com/search?q=${encodeURIComponent(platform + ' download my data')}`,
          estimated_time: '7-30 days',
          notes: 'Always download your data before deleting. Send a CCPA/GDPR request email if no self-service deletion is available.',
        },
      };
    }
    const result = await invokeLLM({
      prompt: `Provide step-by-step instructions to delete an account on ${platform} (${accountUrl || ''}).

Include:
- steps: Numbered steps to delete the account
- direct_url: Direct link to account deletion page
- data_download_url: Link to download your data first (if available)
- estimated_time: How long deletion takes
- notes: Important caveats`,
      response_json_schema: {
        type: 'object',
        properties: {
          steps: { type: 'array', items: { type: 'string' } },
          direct_url: { type: 'string' },
          data_download_url: { type: 'string' },
          estimated_time: { type: 'string' },
          notes: { type: 'string' },
        },
      },
    });
    return { data: result };
  },

  async checkSocialMediaImpersonation({ profileId, fullName, usernames }) {
    return localFunctions.monitorSocialMedia({ profileId, fullName, usernames });
  },

  async searchNoProofSettlements({ profileId }) {
    const scanResults = await entities.ScanResult.list();
    const profileScans = scanResults.filter(s => s.profile_id === profileId);
    const companies = [...new Set(profileScans.map(s => s.source_name).filter(Boolean))];

    const keys = getApiKeys();
    if (!keys.openai_api_key) {
      const KNOWN_NO_PROOF = [
        { settlement_name: 'Equifax Data Breach Settlement', company: 'Equifax', category: 'data_breach', settlement_amount: '$700M', estimated_individual_payout: '$125-$20,000', proof_required: 'None for credit monitoring / minimal for cash', proof_difficulty: 'none', eligibility: 'Anyone affected by 2017 Equifax breach', claim_deadline: '2024-01-22', claim_url: 'https://www.equifaxbreachsettlement.com', website: 'https://www.equifaxbreachsettlement.com', court: 'N.D. Georgia', status: 'settled', filing_time_estimate: '5 minutes', confidence: 85 },
        { settlement_name: 'Facebook Privacy Settlement', company: 'Facebook', category: 'privacy', settlement_amount: '$725M', estimated_individual_payout: '$200-$5,000', proof_required: 'Facebook account ownership', proof_difficulty: 'minimal', eligibility: 'US Facebook users 2007-2022', claim_deadline: '2024-08-17', claim_url: 'https://www.facebookuserprivacysettlement.com', website: 'https://www.facebookuserprivacysettlement.com', court: 'N.D. California', status: 'settled', filing_time_estimate: '10 minutes', confidence: 85 },
        { settlement_name: 'Google Location Tracking Settlement', company: 'Google', category: 'privacy', settlement_amount: '$62M', estimated_individual_payout: '$10-$100', proof_required: 'Google account', proof_difficulty: 'none', eligibility: 'Google users with location tracking enabled', claim_deadline: 'Check website', claim_url: 'https://www.classaction.org/google-location-tracking-lawsuit', website: 'https://www.classaction.org/google-location-tracking-lawsuit', court: 'N.D. California', status: 'settled', filing_time_estimate: '5 minutes', confidence: 75 },
        { settlement_name: 'T-Mobile Data Breach Settlement', company: 'T-Mobile', category: 'data_breach', settlement_amount: '$350M', estimated_individual_payout: '$25-$25,000', proof_required: 'T-Mobile account holder status', proof_difficulty: 'minimal', eligibility: 'Current/former T-Mobile customers', claim_deadline: '2023-01-23', claim_url: 'https://www.t-mobilesettlement.com', website: 'https://www.t-mobilesettlement.com', court: 'W.D. Missouri', status: 'settled', filing_time_estimate: '10 minutes', confidence: 80 },
        { settlement_name: 'Capital One Data Breach Settlement', company: 'Capital One', category: 'data_breach', settlement_amount: '$190M', estimated_individual_payout: '$25-$25,000', proof_required: 'Account holder status', proof_difficulty: 'minimal', eligibility: 'Capital One applicants/customers affected in 2019 breach', claim_deadline: '2023-09-30', claim_url: 'https://www.capitalonesettlement.com', website: 'https://www.capitalonesettlement.com', court: 'E.D. Virginia', status: 'settled', filing_time_estimate: '10 minutes', confidence: 80 },
      ];
      const tagged = KNOWN_NO_PROOF.map(s => {
        const match = companies.some(c => (s.company || '').toLowerCase().includes(c.toLowerCase()));
        return { ...s, profile_match: match, match_reason: match ? 'Found in your breach history' : null };
      });
      tagged.sort((a, b) => (b.profile_match ? 1 : 0) - (a.profile_match ? 1 : 0));
      return {
        data: {
          settlements: tagged,
          stats: { total_found: tagged.length, profile_matches: tagged.filter(s => s.profile_match).length },
          source: 'local_database',
          tip: 'For the latest open settlements, visit classaction.org, topclassactions.com, or consumerfinance.gov',
        },
      };
    }

    const result = await invokeLLM({
      prompt: `Find currently OPEN class action settlements that require NO PROOF OF PURCHASE or minimal proof. Only return REAL, verified settlements with actual claim URLs. An empty array is better than fabricated results.

User's known companies/breaches: ${companies.join(', ') || 'none'}

For each verified settlement:
- settlement_name, company, category, settlement_amount, estimated_individual_payout
- proof_required, proof_difficulty (none/minimal/moderate), eligibility
- claim_deadline, claim_url, website, court, status, filing_time_estimate, confidence (0-100)`,
      response_json_schema: {
        type: 'object',
        properties: {
          settlements: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                settlement_name: { type: 'string' }, company: { type: 'string' },
                category: { type: 'string' }, settlement_amount: { type: 'string' },
                estimated_individual_payout: { type: 'string' }, proof_required: { type: 'string' },
                proof_difficulty: { type: 'string' }, eligibility: { type: 'string' },
                claim_deadline: { type: 'string' }, claim_url: { type: 'string' },
                website: { type: 'string' }, court: { type: 'string' },
                status: { type: 'string' }, filing_time_estimate: { type: 'string' },
                confidence: { type: 'number' },
              },
            },
          },
          search_metadata: { type: 'object', properties: { total_found: { type: 'number' } } },
        },
      },
    });

    const settlements = (result.settlements || []).filter(s => s.confidence >= 65 && s.settlement_name);
    const tagged = settlements.map(s => {
      const match = companies.some(c => (s.company || '').toLowerCase().includes(c.toLowerCase()));
      return { ...s, profile_match: match, match_reason: match ? 'Found in your breach history' : null };
    });
    tagged.sort((a, b) => (b.profile_match ? 1 : 0) - (a.profile_match ? 1 : 0));

    return {
      data: {
        settlements: tagged,
        stats: {
          total_found: tagged.length,
          profile_matches: tagged.filter(s => s.profile_match).length,
          no_proof_count: tagged.filter(s => s.proof_difficulty === 'none').length,
          minimal_proof_count: tagged.filter(s => s.proof_difficulty === 'minimal').length,
          categories: [...new Set(tagged.map(s => s.category))],
          profile_companies_checked: companies,
        },
        metadata: result.search_metadata,
      },
    };
  },

  async analyzeBreachNotice({ noticeText, profileId }) {
    const keys = getApiKeys();
    let analysis;

    if (keys.openai_api_key) {
      analysis = await invokeLLM({
        prompt: `Analyze this DATA BREACH NOTIFICATION. Extract: company_name, breach_date, data_types_exposed (array), affected_count, breach_description, remediation_offered, remediation_provider, claim_deadline, severity_assessment (critical/high/medium/low), class_action_mentioned (boolean), class_action_details.

--- BREACH NOTICE ---
${(noticeText || '').slice(0, 8000)}
--- END ---`,
        response_json_schema: {
          type: 'object',
          properties: {
            company_name: { type: 'string' }, breach_date: { type: 'string' },
            data_types_exposed: { type: 'array', items: { type: 'string' } },
            affected_count: { type: 'string' }, breach_description: { type: 'string' },
            remediation_offered: { type: 'string' }, remediation_provider: { type: 'string' },
            claim_deadline: { type: 'string' }, severity_assessment: { type: 'string' },
            class_action_mentioned: { type: 'boolean' },
            class_action_details: { type: 'object', properties: { case_name: { type: 'string' }, settlement_url: { type: 'string' } } },
          },
        },
      });
      if (typeof analysis === 'string') analysis = {};
    } else {
      const text = (noticeText || '').toLowerCase();
      const companyMatch = (noticeText || '').match(/(?:from|at|by|regarding)\s+([A-Z][A-Za-z\s&.]+?)(?:\s+(?:has|was|is|we|data|breach|incident|security))/);
      const dateMatch = (noticeText || '').match(/(?:on|around|approximately|in)\s+((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i);
      const dataTypes = [];
      if (/email/i.test(text)) dataTypes.push('email');
      if (/password/i.test(text)) dataTypes.push('password');
      if (/social\s*security|ssn/i.test(text)) dataTypes.push('SSN');
      if (/credit\s*card|payment\s*card|debit/i.test(text)) dataTypes.push('payment_card');
      if (/name/i.test(text)) dataTypes.push('name');
      if (/address/i.test(text)) dataTypes.push('address');
      if (/phone/i.test(text)) dataTypes.push('phone');
      if (/date\s*of\s*birth|dob/i.test(text)) dataTypes.push('date_of_birth');
      if (/driver.*license/i.test(text)) dataTypes.push('drivers_license');
      if (/medical|health/i.test(text)) dataTypes.push('medical_records');
      if (dataTypes.length === 0) dataTypes.push('personal_information');

      const hasSsn = dataTypes.includes('SSN');
      const hasFinancial = dataTypes.includes('payment_card');
      const severity = hasSsn ? 'critical' : hasFinancial ? 'high' : dataTypes.length > 3 ? 'high' : 'medium';

      analysis = {
        company_name: companyMatch ? companyMatch[1].trim() : 'Unknown Company',
        breach_date: dateMatch ? dateMatch[1] : 'Unknown',
        data_types_exposed: dataTypes,
        affected_count: 'Unknown',
        breach_description: `Breach notice analyzed locally. ${dataTypes.length} data types identified in the notice text.`,
        remediation_offered: /credit\s*monitoring|identity\s*(theft\s*)?protection/i.test(text) ? 'Credit monitoring / identity protection mentioned' : 'None mentioned',
        remediation_provider: '',
        claim_deadline: /deadline|by\s+\w+\s+\d{1,2}/i.test(text) ? 'Check notice for specific deadline' : 'Not specified',
        severity_assessment: severity,
        class_action_mentioned: /class\s*action|lawsuit|settlement/i.test(text),
        class_action_details: {},
      };
    }

    let classActions = [];
    if (analysis.company_name) {
      try {
        const caResult = await localFunctions.checkClassActions({ companyName: analysis.company_name });
        classActions = caResult.data?.litigation || [];
      } catch { /* continue */ }
    }

    if (profileId && analysis.company_name) {
      await entities.ScanResult.create({
        profile_id: profileId,
        source_name: analysis.company_name,
        source_type: 'breach_notice',
        risk_score: analysis.severity_assessment === 'critical' ? 95 : analysis.severity_assessment === 'high' ? 80 : 60,
        data_exposed: analysis.data_types_exposed || [],
        breach_date: analysis.breach_date,
        status: 'new',
        scan_date: new Date().toISOString().split('T')[0],
      });
    }

    return {
      data: {
        analysis,
        class_actions: { total_found: classActions.length, combined: classActions },
        profile_impact: {
          severity: analysis.severity_assessment,
          data_at_risk: analysis.data_types_exposed || [],
          action_required: ['critical', 'high'].includes(analysis.severity_assessment),
          has_class_action: classActions.length > 0,
          has_remediation: !!analysis.remediation_offered,
        },
      },
    };
  },

  async generateEmailAlias({ profileId, purpose, website }) {
    const ts = Date.now().toString(36);
    const alias = `incognito+${purpose?.replace(/\s+/g, '') || 'alias'}_${ts}@protonmail.com`;
    await entities.DisposableCredential.create({
      profile_id: profileId,
      type: 'email_alias',
      value: alias,
      purpose,
      website,
    });
    return { data: { alias } };
  },

  async monitorDeletionResponses() {
    return { data: { message: 'Gmail monitoring requires OAuth setup. Check your email manually for deletion confirmation responses.' } };
  },

  async getFunctionDetails({ functionName }) {
    return { data: { name: functionName, status: 'local', description: `Function ${functionName} runs locally` } };
  },

  async testAllFunctions() {
    const results = {};
    for (const name of Object.keys(localFunctions)) {
      results[name] = { status: 'available' };
    }
    return { data: results };
  },

  async listClassActions({ company }) {
    const result = await localFunctions.checkClassActions({ companyName: company || '' });
    const litigation = result.data?.litigation || [];
    return { data: { lawsuits: litigation } };
  },

  async listBills() {
    const subs = await entities.Subscription.list();
    const bills = subs.filter(s => s.status === 'active').map(s => ({
      id: s.id,
      name: s.name || s.service_name,
      amount: s.monthly_cost || s.amount || 0,
      frequency: s.billing_cycle || 'monthly',
      next_due: s.next_billing_date || 'Unknown',
      category: s.category || 'subscription',
    }));
    return { data: bills };
  },

  async calculateAdvancedRiskScore({ profileId }) {
    const [scans, social, search] = await Promise.all([
      entities.ScanResult.filter({ profile_id: profileId }),
      entities.SocialMediaFinding.filter({ profile_id: profileId }),
      entities.SearchQueryFinding.filter({ profile_id: profileId }),
    ]);
    const totalFindings = scans.length + social.length + search.length;
    const highRisk = scans.filter(s => s.risk_score > 70).length;
    const score = Math.min(100, Math.round((highRisk * 15) + (totalFindings * 3)));
    return { data: { risk_score: score, total_findings: totalFindings, high_risk_count: highRisk } };
  },

  async checkBreachAlerts({ profileId }) {
    let emails = [];
    if (profileId) {
      const personalData = await entities.PersonalData.filter({ profile_id: profileId });
      emails = personalData.filter(d => d.data_type === 'email' && d.value).map(d => d.value);
    }
    if (emails.length === 0) {
      const allPd = await entities.PersonalData.list();
      emails = allPd.filter(d => d.data_type === 'email' && d.value).map(d => d.value);
    }
    return localFunctions.checkBreaches({ profileId, emails });
  },

  async autoBreachCheck() {
    return { data: { message: 'Auto breach check not configured' } };
  },

  async fetchInboxEmails() {
    return { data: { message: 'Gmail OAuth not configured' } };
  },

  async bulkDeleteEmails() {
    return { data: { message: 'Gmail OAuth not configured' } };
  },

  async monitorEmails() {
    return { data: { message: 'Gmail OAuth not configured' } };
  },

  async deleteEmailAlias({ aliasId }) {
    await entities.DisposableCredential.delete(aliasId);
    return { data: { deleted: true } };
  },

  // =========================================================================
  // CLOAKED IDENTITY FUNCTIONS
  // =========================================================================

  async createCloakedIdentity({ profileId, serviceName, serviceUrl, category, autoGenerate = true }) {
    const identity = {
      profile_id: profileId,
      service_name: serviceName,
      service_url: serviceUrl,
      category: category || 'general',
      status: 'active',
      email_alias_id: null,
      phone_alias_id: null,
      password_entry_id: null,
      totp_secret_id: null,
      virtual_card_id: null,
      custom_fields: {},
      notes: '',
    };

    if (autoGenerate) {
      const password = generateSecurePassword(20);
      const pwEntry = await entities.PasswordEntry.create({
        profile_id: profileId,
        service_name: serviceName,
        service_url: serviceUrl,
        username: '',
        password,
        strength: 'strong',
        last_changed: new Date().toISOString(),
        breach_checked: false,
      });
      identity.password_entry_id = pwEntry.id;
    }

    const created = await entities.CloakedIdentity.create(identity);
    return { data: created };
  },

  async toggleIdentityStatus({ identityId }) {
    const all = await entities.CloakedIdentity.list();
    const identity = all.find(i => i.id === identityId);
    if (!identity) throw new Error('Identity not found');
    const newStatus = identity.status === 'active' ? 'muted' : 'active';
    const updated = await entities.CloakedIdentity.update(identityId, { status: newStatus });
    return { data: updated };
  },

  // =========================================================================
  // PASSWORD MANAGER FUNCTIONS
  // =========================================================================

  async generatePassword({ length = 20, uppercase = true, lowercase = true, numbers = true, symbols = true }) {
    const password = generateSecurePassword(length, { uppercase, lowercase, numbers, symbols });
    return { data: { password } };
  },

  async checkPasswordStrength({ password }) {
    let score = 0;
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    if (password.length >= 20) score += 1;
    const levels = ['very_weak', 'weak', 'fair', 'good', 'strong', 'very_strong'];
    const strength = levels[Math.min(Math.floor(score / 1.5), levels.length - 1)];
    return { data: { score, strength, length: password.length } };
  },

  async importPasswords({ csvData, source }) {
    const lines = csvData.split('\n').filter(l => l.trim());
    if (lines.length < 2) return { data: { imported: 0 } };
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    const columnMap = {
      '1password': { name: 'title', url: 'url', username: 'username', password: 'password' },
      'lastpass': { name: 'name', url: 'url', username: 'username', password: 'password' },
      'bitwarden': { name: 'name', url: 'login_uri', username: 'login_username', password: 'login_password' },
      'chrome': { name: 'name', url: 'url', username: 'username', password: 'password' },
      'dashlane': { name: 'title', url: 'url', username: 'username', password: 'password' },
      'keeper': { name: 'title', url: 'web address', username: 'login', password: 'password' },
    };
    const map = columnMap[source] || columnMap.chrome;
    let imported = 0;
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].match(/(".*?"|[^,]+)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || [];
      const row = {};
      headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
      await entities.PasswordEntry.create({
        service_name: row[map.name] || 'Unknown',
        service_url: row[map.url] || '',
        username: row[map.username] || '',
        password: row[map.password] || '',
        strength: 'unknown',
        imported_from: source,
        last_changed: new Date().toISOString(),
        breach_checked: false,
      });
      imported++;
    }
    return { data: { imported } };
  },

  // =========================================================================
  // TOTP AUTHENTICATOR FUNCTIONS
  // =========================================================================

  async addTOTPSecret({ profileId, identityId, serviceName, secret, algorithm = 'SHA1', digits = 6, period = 30 }) {
    const entry = await entities.TOTPSecret.create({
      profile_id: profileId,
      identity_id: identityId || null,
      service_name: serviceName,
      secret: secret.replace(/\s/g, '').toUpperCase(),
      algorithm,
      digits,
      period,
    });
    return { data: entry };
  },

  async getTOTPCode({ secret, period = 30, digits = 6 }) {
    const code = await generateTOTP(secret, period, digits);
    const timeLeft = period - (Math.floor(Date.now() / 1000) % period);
    return { data: { code, timeLeft, period } };
  },

  // =========================================================================
  // EMAIL ALIAS FUNCTIONS (SimpleLogin / addy.io)
  // =========================================================================

  async createEmailAliasReal({ profileId, identityId, description }) {
    const keys = getApiKeys();
    const provider = keys.email_alias_provider || 'simplelogin';
    let alias;
    try {
      if (provider === 'addy') {
        const result = await emailAliasApi('/aliases', 'POST', {
          domain: keys.addy_domain || 'anonaddy.me',
          description: description || 'Incognito alias',
        });
        alias = result.data?.email || result.email;
      } else {
        const result = await emailAliasApi('/alias/random/new', 'POST', {
          note: description || 'Incognito alias',
        });
        alias = result.alias;
      }
    } catch (e) {
      const ts = Date.now().toString(36);
      alias = `incognito.${ts}@protonmail.com`;
    }

    const entry = await entities.EmailAlias.create({
      profile_id: profileId,
      identity_id: identityId || null,
      alias_email: alias,
      description,
      provider: keys.email_alias_provider || 'local',
      forwarding_enabled: true,
      status: 'active',
    });
    return { data: entry };
  },

  async toggleEmailAlias({ aliasId }) {
    const all = await entities.EmailAlias.list();
    const alias = all.find(a => a.id === aliasId);
    if (!alias) throw new Error('Alias not found');
    const newStatus = alias.status === 'active' ? 'disabled' : 'active';
    const updated = await entities.EmailAlias.update(aliasId, { status: newStatus });
    return { data: updated };
  },

  async listEmailAliasesFromProvider() {
    const keys = getApiKeys();
    const provider = keys.email_alias_provider || 'simplelogin';
    try {
      if (provider === 'addy') {
        const result = await emailAliasApi('/aliases');
        return { data: result.data || [] };
      } else {
        const result = await emailAliasApi('/v2/aliases?page_id=0');
        return { data: result.aliases || [] };
      }
    } catch {
      return { data: [] };
    }
  },

  // =========================================================================
  // PHONE ALIAS FUNCTIONS (Twilio)
  // =========================================================================

  async listAvailablePhoneNumbers({ areaCode, country = 'US' }) {
    try {
      const endpoint = `/AvailablePhoneNumbers/${country}/Local?AreaCode=${areaCode || ''}&PageSize=10`;
      const result = await twilioApi(endpoint);
      return { data: result.available_phone_numbers || [] };
    } catch (e) {
      return { data: [], error: e.message };
    }
  },

  async purchasePhoneNumber({ phoneNumber, profileId, identityId, purpose }) {
    const result = await twilioApi('/IncomingPhoneNumbers', 'POST', {
      PhoneNumber: phoneNumber,
      FriendlyName: `Incognito: ${purpose || 'alias'}`,
    });
    const entry = await entities.PhoneAlias.create({
      profile_id: profileId,
      identity_id: identityId || null,
      phone_number: result.phone_number,
      twilio_sid: result.sid,
      purpose,
      forwarding_enabled: true,
      forwarding_number: '',
      sms_enabled: true,
      voice_enabled: true,
      status: 'active',
    });
    return { data: entry };
  },

  async configurePhoneForwarding({ phoneAliasSid, forwardingNumber }) {
    const twiml = `<Response><Dial>${forwardingNumber}</Dial></Response>`;
    await twilioApi(`/IncomingPhoneNumbers/${phoneAliasSid}`, 'POST', {
      VoiceUrl: `https://handler.twilio.com/twiml/${encodeURIComponent(twiml)}`,
      SmsUrl: `https://handler.twilio.com/twiml/${encodeURIComponent('<Response><Message>Forwarded from Incognito</Message></Response>')}`,
    });
    return { data: { configured: true } };
  },

  async sendSMS({ fromAliasSid, to, body }) {
    const alias = await entities.PhoneAlias.list();
    const phone = alias.find(a => a.twilio_sid === fromAliasSid);
    if (!phone) throw new Error('Phone alias not found');
    const result = await twilioApi('/Messages', 'POST', {
      From: phone.phone_number,
      To: to,
      Body: body,
    });
    return { data: result };
  },

  // =========================================================================
  // VIRTUAL CARD (CLOAKED PAY) FUNCTIONS
  // =========================================================================

  async createVirtualCard({ profileId, identityId, merchantName, spendLimit, spendLimitDuration = 'MONTHLY', cardType = 'MERCHANT_LOCKED' }) {
    const result = await privacyComApi('/card', 'POST', {
      type: cardType,
      memo: `Incognito: ${merchantName || 'Card'}`,
      spend_limit: spendLimit || 10000,
      spend_limit_duration: spendLimitDuration,
    });
    const entry = await entities.VirtualCard.create({
      profile_id: profileId,
      identity_id: identityId || null,
      card_token: result.token,
      merchant_name: merchantName,
      last_four: result.last_four,
      spend_limit: spendLimit || 10000,
      spend_limit_duration: spendLimitDuration,
      card_type: cardType,
      status: result.state || 'OPEN',
      self_destruct: null,
    });
    return { data: entry };
  },

  async updateCardLimit({ cardToken, spendLimit, spendLimitDuration }) {
    await privacyComApi('/card', 'PUT', {
      card_token: cardToken,
      spend_limit: spendLimit,
      spend_limit_duration: spendLimitDuration,
    });
    return { data: { updated: true } };
  },

  async setCardSelfDestruct({ cardId, destroyAfterDate, destroyAfterTransactions }) {
    const updated = await entities.VirtualCard.update(cardId, {
      self_destruct: { after_date: destroyAfterDate, after_transactions: destroyAfterTransactions },
    });
    return { data: updated };
  },

  // =========================================================================
  // IDENTITY SHARING FUNCTIONS
  // =========================================================================

  async createShareLink({ identityId, fields, expiresInHours = 24, password }) {
    const identity = (await entities.CloakedIdentity.list()).find(i => i.id === identityId);
    if (!identity) throw new Error('Identity not found');

    const shareData = { identity_id: identityId, service_name: identity.service_name, fields: {} };
    for (const field of fields) {
      if (field === 'email') {
        const alias = (await entities.EmailAlias.list()).find(a => a.id === identity.email_alias_id);
        shareData.fields.email = alias?.alias_email || '';
      } else if (field === 'phone') {
        const phone = (await entities.PhoneAlias.list()).find(p => p.id === identity.phone_alias_id);
        shareData.fields.phone = phone?.phone_number || '';
      } else if (field === 'password') {
        const pw = (await entities.PasswordEntry.list()).find(p => p.id === identity.password_entry_id);
        shareData.fields.username = pw?.username || '';
        shareData.fields.password = pw?.password || '';
      }
    }

    const sharePassword = password || generateSecurePassword(12, { symbols: false });
    const encrypted = await encryptData(shareData, sharePassword);
    const shareId = generateId();
    const expiresAt = new Date(Date.now() + expiresInHours * 3600000).toISOString();

    await entities.SharedIdentity.create({
      share_id: shareId,
      identity_id: identityId,
      encrypted_data: encrypted,
      expires_at: expiresAt,
      password_protected: !!password,
      access_count: 0,
      max_accesses: 10,
      status: 'active',
    });

    return { data: { shareId, password: sharePassword, expiresAt } };
  },

  async accessShareLink({ shareId, password }) {
    const shares = await entities.SharedIdentity.list();
    const share = shares.find(s => s.share_id === shareId);
    if (!share) throw new Error('Share link not found');
    if (share.status !== 'active') throw new Error('Share link expired or revoked');
    if (new Date(share.expires_at) < new Date()) throw new Error('Share link expired');
    if (share.access_count >= share.max_accesses) throw new Error('Max accesses reached');

    const decrypted = await decryptData(share.encrypted_data, password);
    await entities.SharedIdentity.update(share.id, { access_count: share.access_count + 1 });
    return { data: decrypted };
  },

  async revokeShareLink({ shareId }) {
    const shares = await entities.SharedIdentity.list();
    const share = shares.find(s => s.share_id === shareId);
    if (share) await entities.SharedIdentity.update(share.id, { status: 'revoked' });
    return { data: { revoked: true } };
  },

  // =========================================================================
  // VPN MANAGEMENT FUNCTIONS
  // =========================================================================

  async checkIPLeak() {
    try {
      const resp = await fetch('https://api.ipify.org?format=json');
      const data = await resp.json();
      return { data: { ip: data.ip, vpn_active: false } };
    } catch {
      return { data: { ip: 'unknown', vpn_active: false } };
    }
  },

  async saveVPNConfig({ name, type, configData }) {
    const entry = await entities.VPNConfig.create({
      name,
      type: type || 'wireguard',
      config_data: configData,
      status: 'disconnected',
      last_connected: null,
    });
    return { data: entry };
  },

  // =========================================================================
  // CALL GUARD (AI CALL SCREENING) FUNCTIONS
  // =========================================================================

  async screenCall({ callerNumber, profileId }) {
    const result = await invokeLLM({
      prompt: `Analyze this phone number for potential scam/spam risk: ${callerNumber}
Return: risk_level (high/medium/low), likely_type (scam, spam, robocall, telemarketer, legitimate, unknown), recommended_action (block, screen, allow), reasoning.`,
      response_json_schema: {
        type: 'object',
        properties: {
          risk_level: { type: 'string' },
          likely_type: { type: 'string' },
          recommended_action: { type: 'string' },
          reasoning: { type: 'string' },
        },
      },
    });

    const log = await entities.CallGuardLog.create({
      profile_id: profileId,
      caller_number: callerNumber,
      risk_level: result.risk_level,
      likely_type: result.likely_type,
      action_taken: result.recommended_action,
      reasoning: result.reasoning,
      transcript: null,
      screened_at: new Date().toISOString(),
    });
    return { data: log };
  },

  async getCallGuardStats({ profileId }) {
    const logs = await entities.CallGuardLog.filter({ profile_id: profileId });
    const blocked = logs.filter(l => l.action_taken === 'block').length;
    const screened = logs.filter(l => l.action_taken === 'screen').length;
    const allowed = logs.filter(l => l.action_taken === 'allow').length;
    return { data: { total: logs.length, blocked, screened, allowed } };
  },

  // =========================================================================
  // SSN MONITORING FUNCTIONS
  // =========================================================================

  async checkSSNExposure({ ssnLast4, profileId }) {
    const result = await invokeLLM({
      prompt: `Based on known data breaches and dark web intelligence, assess the risk level for a Social Security Number ending in ${ssnLast4}.
Consider recent major breaches (Equifax 2017, National Public Data 2024, etc.) and return:
- risk_level: critical/high/medium/low
- known_breaches: array of breach names that may have included SSNs
- recommended_actions: array of specific steps to take
- credit_freeze_recommended: boolean`,
      response_json_schema: {
        type: 'object',
        properties: {
          risk_level: { type: 'string' },
          known_breaches: { type: 'array', items: { type: 'string' } },
          recommended_actions: { type: 'array', items: { type: 'string' } },
          credit_freeze_recommended: { type: 'boolean' },
        },
      },
    });

    const alert = await entities.SSNMonitorAlert.create({
      profile_id: profileId,
      ssn_last4: ssnLast4,
      risk_level: result.risk_level,
      known_breaches: result.known_breaches,
      recommended_actions: result.recommended_actions,
      credit_freeze_recommended: result.credit_freeze_recommended,
      checked_at: new Date().toISOString(),
      status: 'new',
    });
    return { data: alert };
  },

  // =========================================================================
  // AI DEFENSE FUNCTIONS
  // =========================================================================

  async analyzeAIThreat({ content, contentType, profileId }) {
    const result = await invokeLLM({
      prompt: `Analyze this ${contentType} content for AI-generated threats:
Content: ${content}

Check for:
1. Deepfake indicators (if image/video/audio description)
2. AI-generated phishing text patterns
3. Voice clone indicators
4. Social engineering using AI-generated content

Return: threat_type, confidence (0-100), indicators (array), recommended_action, description`,
      response_json_schema: {
        type: 'object',
        properties: {
          threat_type: { type: 'string' },
          confidence: { type: 'number' },
          indicators: { type: 'array', items: { type: 'string' } },
          recommended_action: { type: 'string' },
          description: { type: 'string' },
        },
      },
    });

    const alert = await entities.AIDefenseAlert.create({
      profile_id: profileId,
      content_type: contentType,
      threat_type: result.threat_type,
      confidence: result.confidence,
      indicators: result.indicators,
      recommended_action: result.recommended_action,
      description: result.description,
      status: 'new',
    });
    return { data: alert };
  },
};

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
// Pre-fetch the free HIBP breach list on app load (700+ breaches, no key needed)
fetchLiveBreachList().catch(() => {});

export const incognito = {
  auth: {
    me: async () => getStableUserId(),
    requireUser: () => getStableUserId(),
    signOut: async () => {},
    logout: () => {},
    redirectToLogin: () => {},
  },
  entities,
  functions: {
    invoke: async (functionName, payload = {}) => {
      const fn = localFunctions[functionName];
      if (!fn) {
        console.warn(`[functions] Unknown function: ${functionName}`);
        return { data: null, error: `Function ${functionName} not implemented` };
      }
      console.log(`[functions] Invoking ${functionName}`, Object.keys(payload));
      return fn(payload);
    },
  },
  integrations: {
    Core: {
      InvokeLLM: invokeLLM,
    },
  },
  appLogs: {
    logUserInApp: async () => {},
  },
  asServiceRole: { entities },
};

// Exported utilities for direct use in components
export { generateTOTP, generateSecurePassword, encryptData, decryptData };

export default incognito;
