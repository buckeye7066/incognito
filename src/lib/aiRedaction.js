/**
 * AI redaction guard (Pass 15, hardened).
 *
 * Before ANY data goes to an LLM it is redacted and the user sees a preview.
 * This module provides the redaction + a hard `assertSafeForLLM` gate that
 * throws if restricted data survives — defense in depth so a coding mistake
 * can't silently exfiltrate a family member's SSN/card/address to a third party.
 *
 * BY DEFAULT the live LLM path redacts: SSN, card number, full DOB, email,
 * phone, and street address (all pattern-detectable), plus any child/dependent
 * NAMES the caller supplies. Feature-specific exceptions are opt-in ONLY via an
 * explicit `allow` list (e.g. caller-risk screening allows 'phone'). Passwords/
 * secrets are never in AI payloads by construction; private notes are dropped by
 * `buildSafeProfileSummary` (free-text notes can't be pattern-detected, so the
 * rule is "don't put them in the prompt", enforced by dropping note-ish fields).
 */

const PATTERNS = [
  { type: 'ssn', re: /\b\d{3}[- ]\d{2}[- ]\d{4}\b/g, tag: '[SSN]' },
  { type: 'card', re: /\b(?:\d[ -]?){13,16}\b/g, tag: '[CARD]' },
  { type: 'email', re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, tag: '[EMAIL]' },
  { type: 'phone', re: /\b(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}\b/g, tag: '[PHONE]' },
  { type: 'dob', re: /\b(?:0?[1-9]|1[0-2])[/-](?:0?[1-9]|[12]\d|3[01])[/-](?:19|20)\d{2}\b/g, tag: '[DOB]' },
  {
    type: 'address',
    // street number + (optional words) + a street-type suffix.
    re: /\b\d{1,6}\s+(?:[A-Za-z0-9.'#-]+\s+){0,4}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Way|Place|Pl|Terrace|Ter|Circle|Cir|Highway|Hwy|Parkway|Pkwy|Suite|Ste|Apt|Unit)\b\.?/gi,
    tag: '[ADDRESS]',
  },
];

/** The types redacted from every outbound LLM prompt unless explicitly allowed. */
export const DEFAULT_LLM_REDACT = ['ssn', 'card', 'email', 'phone', 'dob', 'address'];

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyPatterns(text, types) {
  let out = String(text ?? '');
  for (const { type, re, tag } of PATTERNS) {
    if (types.includes(type)) out = out.replace(re, tag);
  }
  return out;
}

function applyNames(text, names) {
  let out = text;
  for (const name of names || []) {
    const n = String(name || '').trim();
    if (n.length < 2) continue; // never redact single chars
    out = out.replace(new RegExp(`\\b${escapeRegExp(n)}\\b`, 'gi'), '[NAME]');
  }
  return out;
}

/**
 * Full redaction of all detectable PII patterns. Used by buildSafeProfileSummary
 * and containsRestricted.
 * @returns {{ redacted: string, found: string[] }}
 */
export function redactText(input, { names = [] } = {}) {
  let text = String(input ?? '');
  const found = new Set();
  for (const { type, re, tag } of PATTERNS) {
    text = text.replace(re, () => { found.add(type); return tag; });
  }
  const before = text;
  text = applyNames(text, names);
  if (text !== before) found.add('name');
  return { redacted: text, found: [...found] };
}

/** True if `text` still contains any restricted pattern. */
export function containsRestricted(text) {
  return redactText(text).found.length > 0;
}

/**
 * Which restricted types remain in `text`, honoring an allowlist + name list.
 * Uses non-global probes so regex state never leaks between calls.
 */
export function findRestricted(text, { allow = [], names = [] } = {}) {
  const types = DEFAULT_LLM_REDACT.filter((t) => !allow.includes(t));
  const s = String(text ?? '');
  const found = new Set();
  for (const { type, re } of PATTERNS) {
    if (!types.includes(type)) continue;
    const probe = new RegExp(re.source, re.flags.replace('g', ''));
    if (probe.test(s)) found.add(type);
  }
  for (const name of names) {
    const n = String(name || '').trim();
    if (n.length >= 2 && new RegExp(`\\b${escapeRegExp(n)}\\b`, 'i').test(s)) found.add('name');
  }
  return [...found];
}

/**
 * Default redaction applied to EVERY outbound LLM prompt (defense in depth).
 * Redacts all DEFAULT_LLM_REDACT types except those explicitly allowed, plus
 * any supplied child/dependent names.
 * @param {string} text
 * @param {{ allow?: string[], names?: string[] }} [opts]
 */
export function redactForLLM(text, { allow = [], names = [] } = {}) {
  const types = DEFAULT_LLM_REDACT.filter((t) => !allow.includes(t));
  return applyNames(applyPatterns(text, types), names);
}

/**
 * Hard gate. Throws E_RESTRICTED_DATA if any non-allowed restricted data
 * remains. Call this immediately before handing anything to the LLM provider.
 * @param {unknown} payload
 * @param {{ allow?: string[], names?: string[] }} [opts]
 */
export function assertSafeForLLM(payload, { allow = [], names = [] } = {}) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload ?? '');
  const found = findRestricted(text, { allow, names });
  if (found.length > 0) {
    const err = new Error(`Refusing to send restricted data to an LLM: ${found.join(', ')}`);
    err.code = 'E_RESTRICTED_DATA';
    err.found = found;
    throw err;
  }
  return true;
}

/**
 * Build a safe, redacted profile summary for the assistant. Explicitly drops
 * children's records and any private/secret field; redacts the rest.
 * @returns {{ summary: object, redactedFields: string[] }}
 */
export function buildSafeProfileSummary(profile = {}, { includeChildren = false } = {}) {
  const redactedFields = [];
  const summary = {};
  for (const [key, value] of Object.entries(profile)) {
    if (key === 'children' && !includeChildren) { redactedFields.push('children'); continue; }
    if (/password|secret|ssn|card|cvv|pin|note|address|dob|dependent/i.test(key)) {
      redactedFields.push(key);
      continue;
    }
    if (typeof value === 'string') {
      const { redacted, found } = redactText(value);
      if (found.length) redactedFields.push(key);
      summary[key] = redacted;
    } else {
      summary[key] = value;
    }
  }
  return { summary, redactedFields };
}
