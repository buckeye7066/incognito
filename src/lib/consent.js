/**
 * Local user-consent ledger.
 *
 * External scans / lookups must not silently transmit personal data. Each
 * external provider is gated on (a) being explicitly enabled by the user,
 * and (b) per-data-type consent. The ledger is kept in localStorage and
 * is intentionally additive (revoking consent removes the entry).
 *
 * Audit-log entries are persisted via the `ExternalScanAudit` entity store
 * (see `src/api/client.js`) — consent.js itself only stores the decisions.
 */

const CONSENT_KEY = 'incognito_external_consent_v1';

const DEFAULT_CONSENT = {
  providers: {}, // providerId -> { enabled: boolean, dataTypes: string[], updated_at }
};

function readStorage() {
  try {
    const raw = (typeof localStorage !== 'undefined' ? localStorage.getItem(CONSENT_KEY) : null);
    if (!raw) return { ...DEFAULT_CONSENT };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.providers) {
      return { ...DEFAULT_CONSENT };
    }
    return parsed;
  } catch {
    return { ...DEFAULT_CONSENT };
  }
}

function writeStorage(state) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CONSENT_KEY, JSON.stringify(state));
    }
  } catch {
    // ignore quota errors — consent is best-effort persistence
  }
}

export function getConsentState() {
  return readStorage();
}

export function setProviderEnabled(providerId, enabled) {
  if (!providerId) throw new Error('providerId is required');
  const state = readStorage();
  const existing = state.providers[providerId] || { enabled: false, dataTypes: [] };
  state.providers[providerId] = {
    ...existing,
    enabled: Boolean(enabled),
    updated_at: new Date().toISOString(),
  };
  writeStorage(state);
  return state.providers[providerId];
}

export function setDataTypeConsent(providerId, dataType, granted) {
  if (!providerId || !dataType) {
    throw new Error('providerId and dataType are required');
  }
  const state = readStorage();
  const existing = state.providers[providerId] || { enabled: false, dataTypes: [] };
  const set = new Set(existing.dataTypes || []);
  if (granted) set.add(dataType);
  else set.delete(dataType);
  state.providers[providerId] = {
    ...existing,
    dataTypes: Array.from(set),
    updated_at: new Date().toISOString(),
  };
  writeStorage(state);
  return state.providers[providerId];
}

export function isProviderAllowed(providerId, dataType) {
  if (!providerId) return false;
  const state = readStorage();
  const entry = state.providers[providerId];
  if (!entry || !entry.enabled) return false;
  if (!dataType) return true;
  return Array.isArray(entry.dataTypes) && entry.dataTypes.includes(dataType);
}

/**
 * Throws a typed error if the provider/dataType combination is not consented.
 * Use this inside any code path that sends personal data outbound.
 */
export function requireConsent(providerId, dataType) {
  if (!isProviderAllowed(providerId, dataType)) {
    const err = new Error(
      `Consent required: provider "${providerId}" is not enabled for data type "${dataType}". ` +
      `User must enable this in Settings → Privacy → External Scans.`,
    );
    err.code = 'E_CONSENT_REQUIRED';
    err.providerId = providerId;
    err.dataType = dataType;
    throw err;
  }
}

export function clearAllConsent() {
  writeStorage({ ...DEFAULT_CONSENT });
}

// Provider catalog — declared centrally so the UI can render a settings
// screen without touching client.js. Every external HTTP integration the app
// can drive MUST appear here so the consent gate can refuse outbound calls
// until the user opts in to the specific provider + data type.
export const EXTERNAL_PROVIDERS = [
  { id: 'hibp',           label: 'Have I Been Pwned',     dataTypes: ['email'] },
  { id: 'leakcheck',      label: 'LeakCheck.io',          dataTypes: ['email', 'username'] },
  { id: 'hunter',         label: 'Hunter.io',             dataTypes: ['email', 'domain'] },
  { id: 'numverify',      label: 'NumVerify',             dataTypes: ['phone'] },
  { id: 'google_search',  label: 'Google Custom Search',  dataTypes: ['email', 'phone', 'name'] },
  { id: 'privacy_com',    label: 'Privacy.com',           dataTypes: ['address'] },
  { id: 'openai',         label: 'OpenAI',                dataTypes: ['profile_summary'] },
  { id: 'twilio',         label: 'Twilio (phone aliases)', dataTypes: ['phone'] },
  { id: 'simplelogin',    label: 'SimpleLogin (email aliases)', dataTypes: ['email'] },
  { id: 'addy',           label: 'addy.io (email aliases)',     dataTypes: ['email'] },
];
