/**
 * Phone-alias rule logic (Pass 6).
 *
 * Pure + dependency-free. Mirrors lib/aliasRules but for phone numbers: forward
 * calls/texts independently, plus block/allow caller numbers (allowlist wins).
 * Real enforcement (actually dropping/forwarding a call or text) is done by
 * Twilio + the optional webhook backend; locally these are intent + display.
 */

export const DEFAULT_PHONE_RULES = {
  forward_calls: true,
  forward_texts: true,
  blocked_numbers: [],
  allowed_numbers: [],
};

/** Normalize to the last 10 digits so +1/formatting differences still match. */
export function normalizePhone(n) {
  const d = String(n || '').replace(/\D/g, '');
  return d.length > 10 ? d.slice(-10) : d;
}

export function normalizeRules(rules) {
  const r = rules && typeof rules === 'object' ? rules : {};
  const list = (a) => (Array.isArray(a) ? a.map(normalizePhone).filter(Boolean) : []);
  return {
    forward_calls: r.forward_calls !== false,
    forward_texts: r.forward_texts !== false,
    blocked_numbers: list(r.blocked_numbers),
    allowed_numbers: list(r.allowed_numbers),
  };
}

export function isNumberBlocked(rules, number) {
  const r = normalizeRules(rules);
  const n = normalizePhone(number);
  if (!n) return false;
  if (r.allowed_numbers.includes(n)) return false;
  return r.blocked_numbers.includes(n);
}

export function shouldForwardCall(rules, from) {
  const r = normalizeRules(rules);
  return r.forward_calls && !isNumberBlocked(r, from);
}
export function shouldForwardText(rules, from) {
  const r = normalizeRules(rules);
  return r.forward_texts && !isNumberBlocked(r, from);
}

function addTo(list, number) {
  const n = normalizePhone(number);
  if (!n) return list;
  return list.includes(n) ? list : [...list, n];
}
function removeFrom(list, number) {
  const n = normalizePhone(number);
  return list.filter((x) => x !== n);
}

/**
 * @param {object} rules
 * @param {{type:string, number?:string}} change
 *   type: 'calls_on'|'calls_off'|'texts_on'|'texts_off'|'block'|'unblock'|'allow'|'unallow'
 */
export function applyPhoneRuleChange(rules, change) {
  const r = normalizeRules(rules);
  const number = change?.number;
  switch (change?.type) {
    case 'calls_on': return { ...r, forward_calls: true };
    case 'calls_off': return { ...r, forward_calls: false };
    case 'texts_on': return { ...r, forward_texts: true };
    case 'texts_off': return { ...r, forward_texts: false };
    case 'block': return { ...r, blocked_numbers: addTo(r.blocked_numbers, number), allowed_numbers: removeFrom(r.allowed_numbers, number) };
    case 'unblock': return { ...r, blocked_numbers: removeFrom(r.blocked_numbers, number) };
    case 'allow': return { ...r, allowed_numbers: addTo(r.allowed_numbers, number), blocked_numbers: removeFrom(r.blocked_numbers, number) };
    case 'unallow': return { ...r, allowed_numbers: removeFrom(r.allowed_numbers, number) };
    default: throw new Error(`Unknown phone rule change: ${change?.type}`);
  }
}

export function summarizePhoneRules(rules) {
  const r = normalizeRules(rules);
  const fw = [];
  if (r.forward_calls) fw.push('calls');
  if (r.forward_texts) fw.push('texts');
  const base = fw.length ? `Forwarding ${fw.join(' + ')}` : 'Forwarding off';
  const extra = [];
  if (r.blocked_numbers.length) extra.push(`${r.blocked_numbers.length} blocked`);
  if (r.allowed_numbers.length) extra.push(`${r.allowed_numbers.length} allowed`);
  return extra.length ? `${base} · ${extra.join(', ')}` : base;
}
