/**
 * Family call-coverage helpers — map the app's CallCoverage entities to the
 * backend coverage shape consumed by src/lib/callRouting.js, plus small display
 * helpers. Pure + tested so the UI stays thin and the sync payload is correct.
 *
 * App entity shape (CallCoverage):
 *   { id, label, twilio_number, forward_to, contacts, blocked,
 *     auto_block_high_risk, voicemail_on_screen, record }
 * Backend shape (callRouting):
 *   { twilioNumber, label, forwardTo, contacts[], blocked[], policy{...} }
 */
import { normalizePhone } from './phoneRules.js';

/** A coverage entry is usable only with both a published number and a real one. */
export function coverageEntryValid(e) {
  return Boolean(normalizePhone(e?.twilio_number) && normalizePhone(e?.forward_to));
}

/** Accept either an array of numbers or a comma/newline-separated string. */
export function splitNumbers(v) {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  return String(v || '')
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Mask a number for display — keep only the last 4 digits. */
export function maskPhone(n) {
  const d = String(n || '').replace(/\D/g, '');
  if (d.length < 4) return String(n || '');
  return `•••‑${d.slice(-4)}`;
}

/** Map one CallCoverage entity to the backend coverage entry. */
export function entityToBackend(e) {
  return {
    twilioNumber: e.twilio_number || '',
    label: e.label || '',
    forwardTo: e.forward_to || '',
    contacts: splitNumbers(e.contacts),
    blocked: splitNumbers(e.blocked),
    policy: {
      autoBlockHighRisk: Boolean(e.auto_block_high_risk),
      voicemailOnScreen: Boolean(e.voicemail_on_screen),
      record: Boolean(e.record),
    },
  };
}

/** Map + validate a list of entities into the backend coverage payload. */
export function toBackendCoverage(entities) {
  return (Array.isArray(entities) ? entities : [])
    .filter(coverageEntryValid)
    .map(entityToBackend);
}

export default { coverageEntryValid, splitNumbers, maskPhone, entityToBackend, toBackendCoverage };
