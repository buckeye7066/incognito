/**
 * Persistent audit log for external network calls.
 *
 * Every outbound call to a third-party API (HIBP, LeakCheck, Hunter, OpenAI,
 * Twilio, SimpleLogin, addy.io, …) records a structured event here so the
 * user can review what data left their device and when.
 *
 * Storage: localStorage (`incognito_external_audit_v1`). Capped at 500
 * entries — the oldest are pruned. Each entry is small (provider id, data
 * type label, timestamp, status, optional bytes-out estimate).
 *
 * Importantly: we never log raw PII payloads — only metadata. The whole
 * point of this log is to let the user verify privacy claims, so sticking
 * the data we are auditing into it would be self-defeating.
 */

const AUDIT_KEY = 'incognito_external_audit_v1';
const MAX_ENTRIES = 500;

function readStorage() {
  try {
    const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem(AUDIT_KEY) : null;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStorage(entries) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(AUDIT_KEY, JSON.stringify(entries));
    }
  } catch {
    // out of quota — silently truncate harder next time
  }
}

/**
 * Record a successful or failed external call.
 *
 * @param {object} entry
 * @param {string} entry.provider     e.g. 'hibp', 'twilio'
 * @param {string} entry.dataType     e.g. 'email', 'phone'
 * @param {string} entry.action       e.g. 'lookup', 'send_sms'
 * @param {'ok' | 'denied' | 'error'} entry.status
 * @param {string} [entry.error]      short error message (no payload)
 * @param {number} [entry.payloadSize] optional outbound size estimate
 */
export function recordExternalCall(entry) {
  if (!entry || !entry.provider || !entry.dataType || !entry.status) return;
  const sanitized = {
    provider: String(entry.provider),
    dataType: String(entry.dataType),
    action: entry.action ? String(entry.action) : 'lookup',
    status: entry.status,
    error: entry.error ? String(entry.error).slice(0, 200) : undefined,
    payloadSize: typeof entry.payloadSize === 'number' ? entry.payloadSize : undefined,
    ts: new Date().toISOString(),
  };
  const entries = readStorage();
  entries.push(sanitized);
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
  writeStorage(entries);
}

/**
 * Wrap an async outbound call in a single audit record. Returns the inner
 * promise's result (or rethrows). The audit entry captures status + any
 * error message but never the request/response body.
 */
export async function withExternalCallAudit(meta, fn) {
  try {
    const result = await fn();
    recordExternalCall({ ...meta, status: 'ok' });
    return result;
  } catch (err) {
    if (err && err.code === 'E_CONSENT_REQUIRED') {
      recordExternalCall({ ...meta, status: 'denied', error: 'consent required' });
    } else {
      recordExternalCall({ ...meta, status: 'error', error: err?.message || String(err) });
    }
    throw err;
  }
}

export function getAuditLog({ limit = 100 } = {}) {
  const entries = readStorage();
  return entries.slice(-limit).reverse();
}

export function clearAuditLog() {
  writeStorage([]);
}

export const __test = { AUDIT_KEY, MAX_ENTRIES };
