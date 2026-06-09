/**
 * AI redaction guard (Pass 15).
 *
 * Before ANY data goes to an LLM, it must be redacted and the user must see a
 * preview. This module provides the redaction + a hard `assertSafeForLLM` gate
 * that throws if restricted data slips through — defense in depth so a coding
 * mistake can't silently exfiltrate a family member's SSN to a third party.
 *
 * Restricted (never sent, even redacted-in-place is a last resort): SSNs,
 * card numbers, full DOB, emails, phone numbers, and anything the caller marks
 * as a private note / child record. Passwords/secrets are never in AI payloads
 * by construction (they live encrypted and aren't part of summaries).
 */

const PATTERNS = [
  { type: 'ssn', re: /\b\d{3}[- ]\d{2}[- ]\d{4}\b/g, tag: '[SSN]' },
  { type: 'card', re: /\b(?:\d[ -]?){13,16}\b/g, tag: '[CARD]' },
  { type: 'email', re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, tag: '[EMAIL]' },
  { type: 'phone', re: /\b(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}\b/g, tag: '[PHONE]' },
  { type: 'dob', re: /\b(?:0?[1-9]|1[0-2])[/-](?:0?[1-9]|[12]\d|3[01])[/-](?:19|20)\d{2}\b/g, tag: '[DOB]' },
];

/**
 * Redact restricted patterns in free text.
 * @returns {{ redacted: string, found: string[] }}
 */
export function redactText(input) {
  let text = String(input ?? '');
  const found = new Set();
  // SSN first (more specific than the phone/card shapes), then card, then the rest.
  for (const { type, re, tag } of PATTERNS) {
    text = text.replace(re, () => { found.add(type); return tag; });
  }
  return { redacted: text, found: [...found] };
}

/** True if `text` still contains any restricted pattern. */
export function containsRestricted(text) {
  return redactText(text).found.length > 0;
}

/**
 * Hard gate. Throws E_RESTRICTED_DATA if the payload (stringified) still
 * contains restricted data after the caller's own redaction. Call this
 * immediately before handing anything to the LLM provider.
 */
export function assertSafeForLLM(payload) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload ?? '');
  const { found } = redactText(text);
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
 * children's records and any field the caller flags private; redacts the rest.
 * @returns {{ summary: object, redactedFields: string[] }}
 */
export function buildSafeProfileSummary(profile = {}, { includeChildren = false } = {}) {
  const redactedFields = [];
  const summary = {};
  for (const [key, value] of Object.entries(profile)) {
    if (key === 'children' && !includeChildren) { redactedFields.push('children'); continue; }
    if (/password|secret|ssn|card|cvv|pin|note/i.test(key)) { redactedFields.push(key); continue; }
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
