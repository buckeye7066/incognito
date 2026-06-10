/**
 * Monitoring schedule + coverage honesty (Pass 11 — dark-web / SSN monitoring).
 *
 * Pure. Imports nothing from the app so it can be unit-tested without a clock or
 * network and reused by the optional backend scheduler (mirrors lib/cardPolicy,
 * lib/phoneCost, …). `now` is always injected — Date.now() is intentionally not
 * called here.
 *
 * The honesty rule this module enforces: in this app "monitoring" means
 * SCHEDULED RE-CHECKS of on-demand breach lookups, never a live dark-web feed
 * (see providers/breach/*). So the scheduler's job is purely "which watched
 * items are due for another lookup, and when is the next one" — and
 * summarizeMonitoring() reports coverage honestly based on whether a real
 * provider is connected vs. only manual/on-demand checks are possible.
 */

/** Severity ordering shared by alerts across the app. Higher = worse. */
export const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

export function severityRank(level) {
  return SEVERITY_RANK[String(level || '').toLowerCase()] ?? 0;
}

/** Sort alerts worst-first, then most-recent-first. Non-mutating. */
export function sortBySeverity(alerts = []) {
  return [...alerts].sort((a, b) => {
    const d = severityRank(b.risk_level || b.severity) - severityRank(a.risk_level || a.severity);
    if (d !== 0) return d;
    return new Date(b.checked_at || b.created_date || 0) - new Date(a.checked_at || a.created_date || 0);
  });
}

const HOUR_MS = 3_600_000;

/** Read whatever "last checked" timestamp an item carries (entities vary). */
export function lastCheckedAt(item = {}) {
  return item.last_checked_at || item.checked_at || item.last_scan || item.last_checked || null;
}

/**
 * Severity-adaptive re-check interval (HOURS).
 *
 * DESIGN CHOICE (2026-06-09): higher-risk items are re-checked sooner. The item's
 * own `check_frequency_hours` is the BASELINE for a low-risk item; we shorten it
 * by a severity multiplier so a `critical` finding is re-checked ~4× more often
 * than a quiet low-risk one. This is privacy-protective (act fast where it
 * matters) without hammering a rate-limited provider for everything. To get a
 * plain fixed interval instead, pass { adaptive: false }.
 *
 * @param {object} item   monitored item; uses item.check_frequency_hours (default 24)
 * @param {string} level  current severity/risk of the item
 * @param {object} [opts] { adaptive?: boolean, minHours?: number }
 */
export function intervalHours(item = {}, level = 'low', opts = {}) {
  const adaptive = opts.adaptive !== false;
  const minHours = opts.minHours ?? 1;
  const base = Number(item.check_frequency_hours) > 0 ? Number(item.check_frequency_hours) : 24;
  if (!adaptive) return Math.max(minHours, base);
  const divisor = { critical: 4, high: 2, medium: 1.5, low: 1, info: 1 }[
    String(level || 'low').toLowerCase()
  ] || 1;
  return Math.max(minHours, base / divisor);
}

/** When is this item next due? Returns a Date, or null if never checked. */
export function nextCheckAt(item = {}, level = 'low', opts = {}) {
  const last = lastCheckedAt(item);
  if (!last) return null; // never checked → due now (see isDue)
  const t = new Date(last).getTime();
  if (Number.isNaN(t)) return null;
  return new Date(t + intervalHours(item, level, opts) * HOUR_MS);
}

/**
 * Is this monitored item due for a re-check?
 * An item that's enabled and has never been checked is always due.
 *
 * @param {object} item
 * @param {Date} now
 * @param {object} [opts] forwarded to intervalHours; pass opts.level to override
 */
export function isDue(item = {}, now = new Date(0), opts = {}) {
  if (item.monitoring_enabled === false) return false;
  const level = opts.level || item.risk_level || item.severity || 'low';
  const next = nextCheckAt(item, level, opts);
  if (next === null) return true; // never checked
  return now.getTime() >= next.getTime();
}

/** All items currently due (enabled + past their next-check). Non-mutating. */
export function dueItems(items = [], now = new Date(0), opts = {}) {
  return (items || []).filter((it) => isDue(it, now, opts));
}

/**
 * Honest coverage summary for a monitoring surface.
 *
 * `monitoringReal` is true only when a provider that can do scheduled re-checks
 * is actually usable (DARKWEB_MONITOR === 'ready'). Otherwise the UI must say
 * "manual / on-demand checks only" rather than implying continuous monitoring.
 *
 * @param {Array} items
 * @param {object} ctx
 * @param {boolean} ctx.darkwebReady   DARKWEB_MONITOR capability is READY
 * @param {boolean} ctx.breachReady    BREACH_CHECK capability is usable
 * @param {Date}    ctx.now
 */
export function summarizeMonitoring(items = [], ctx = {}) {
  const now = ctx.now || new Date(0);
  const enabled = (items || []).filter((it) => it.monitoring_enabled !== false);
  const checked = enabled.filter((it) => lastCheckedAt(it));
  const due = dueItems(enabled, now);
  return {
    total: (items || []).length,
    enabled: enabled.length,
    everChecked: checked.length,
    dueCount: due.length,
    monitoringReal: Boolean(ctx.darkwebReady),
    canCheck: Boolean(ctx.darkwebReady || ctx.breachReady),
    // honest one-liner the UI can show verbatim
    coverageLabel: ctx.darkwebReady
      ? 'Scheduled re-checks active'
      : ctx.breachReady
        ? 'Manual / on-demand checks only'
        : 'No breach provider connected — local checks only',
  };
}

/* --------------------------- SSN display helpers --------------------------- */

/** Keep only digits. */
function digits(s) {
  return String(s || '').replace(/\D/g, '');
}

/** Last 4 digits of an SSN (the only part we ever display by default). */
export function ssnLast4(ssn) {
  return digits(ssn).slice(-4);
}

/**
 * Mask an SSN for display. Full SSN stays encrypted at rest; the UI shows
 * `XXX-XX-1234`. Given only a 4-digit last-4, still renders the masked form.
 */
export function maskSSN(ssnOrLast4) {
  const d = digits(ssnOrLast4);
  const last4 = d.slice(-4);
  if (!last4) return '';
  return `XXX-XX-${last4.padStart(4, '•')}`;
}
