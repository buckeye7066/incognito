/**
 * Email-alias rule logic (Pass 5).
 *
 * Pure + dependency-free. Rules live on the EmailAlias entity as a plain object
 * so the (optional) backend can enforce them on inbound mail; client-side these
 * helpers decide what *would* happen and drive the rules UI. Honesty note: real
 * enforcement (actually dropping/forwarding mail) requires the alias provider or
 * the optional backend — locally these rules are intent + display only.
 */

export const DEFAULT_ALIAS_RULES = {
  forward: true,
  muted: false,
  blocked_senders: [],
  allowed_senders: [],
};

export function normalizeSender(s) {
  return String(s || '').trim().toLowerCase();
}

/** Merge a possibly-partial/legacy rules object with defaults. */
export function normalizeRules(rules) {
  const r = rules && typeof rules === 'object' ? rules : {};
  return {
    forward: r.forward !== false,
    muted: Boolean(r.muted),
    blocked_senders: Array.isArray(r.blocked_senders) ? r.blocked_senders.map(normalizeSender).filter(Boolean) : [],
    allowed_senders: Array.isArray(r.allowed_senders) ? r.allowed_senders.map(normalizeSender).filter(Boolean) : [],
  };
}

/** Allowlist wins over blocklist. */
export function isSenderBlocked(rules, sender) {
  const r = normalizeRules(rules);
  const s = normalizeSender(sender);
  if (!s) return false;
  if (r.allowed_senders.includes(s)) return false;
  return r.blocked_senders.includes(s);
}

/** Would a message from `sender` be forwarded to the real inbox? */
export function shouldForward(rules, sender) {
  const r = normalizeRules(rules);
  if (!r.forward || r.muted) return false;
  return !isSenderBlocked(r, sender);
}

function addTo(list, sender) {
  const s = normalizeSender(sender);
  if (!s) return list;
  return list.includes(s) ? list : [...list, s];
}
function removeFrom(list, sender) {
  const s = normalizeSender(sender);
  return list.filter((x) => x !== s);
}

/**
 * Apply a single rule change and return a NEW normalized rules object.
 * @param {object} rules
 * @param {{ type: string, sender?: string }} change
 *   type: 'forward_on'|'forward_off'|'mute'|'unmute'|'block'|'unblock'|'allow'|'unallow'
 */
export function applyRuleChange(rules, change) {
  const r = normalizeRules(rules);
  const sender = change?.sender;
  switch (change?.type) {
    case 'forward_on': return { ...r, forward: true };
    case 'forward_off': return { ...r, forward: false };
    case 'mute': return { ...r, muted: true };
    case 'unmute': return { ...r, muted: false };
    case 'block': return { ...r, blocked_senders: addTo(r.blocked_senders, sender), allowed_senders: removeFrom(r.allowed_senders, sender) };
    case 'unblock': return { ...r, blocked_senders: removeFrom(r.blocked_senders, sender) };
    case 'allow': return { ...r, allowed_senders: addTo(r.allowed_senders, sender), blocked_senders: removeFrom(r.blocked_senders, sender) };
    case 'unallow': return { ...r, allowed_senders: removeFrom(r.allowed_senders, sender) };
    default: throw new Error(`Unknown alias rule change: ${change?.type}`);
  }
}

/** A short human summary for the alias card. */
export function summarizeRules(rules) {
  const r = normalizeRules(rules);
  if (r.muted) return 'Muted';
  if (!r.forward) return 'Forwarding off';
  const parts = [];
  if (r.blocked_senders.length) parts.push(`${r.blocked_senders.length} blocked`);
  if (r.allowed_senders.length) parts.push(`${r.allowed_senders.length} allowed`);
  return parts.length ? `Forwarding · ${parts.join(', ')}` : 'Forwarding';
}
