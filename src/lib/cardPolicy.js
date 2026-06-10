/**
 * Virtual-card policy + analytics (Pass 9 — Cloaked Pay).
 *
 * Pure. Imports nothing from the app so it can be unit-tested in isolation and
 * reused on a future backend (mirrors lib/phoneCost, lib/aliasRules, etc.).
 *
 * Honesty rules baked in here:
 *  - A card is only "real / fundable" when it carries a Privacy.com token AND
 *    the VIRTUAL_CARD capability is actually usable. Otherwise it is a LOCAL
 *    PLACEHOLDER (a tracker the family can use to plan), never dressed up as a
 *    spendable card number. See cardKind().
 *  - Spend math is period-aware and clamps to the card's own limit; we never
 *    imply "unlimited" when a real limit exists.
 *  - Subscription detection refuses to call a merchant "recurring" on a single
 *    transaction or on wildly irregular charges (see detectSubscriptions()).
 *
 * Amounts are in CENTS throughout (Privacy.com's native unit), matching the
 * VirtualCard entity and the existing CloakedPay UI's formatCents().
 */

import { CAPABILITY_STATUS } from '@/providers/capabilities';

/** Card lifecycle states, mirroring Privacy.com's `state`. */
export const CARD_STATUS = { OPEN: 'OPEN', PAUSED: 'PAUSED', CLOSED: 'CLOSED' };

/** Spend-limit windows, mirroring Privacy.com's `spend_limit_duration`. */
export const SPEND_DURATION = {
  TRANSACTION: 'TRANSACTION',
  MONTHLY: 'MONTHLY',
  ANNUALLY: 'ANNUALLY',
  FOREVER: 'FOREVER',
};

function toCents(n) {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? v : 0;
}

/** "$12.34" from a cents value. Mirrors CloakedPay.formatCents but reusable. */
export function formatCents(cents) {
  return `$${(toCents(cents) / 100).toFixed(2)}`;
}

/**
 * Is this a real, fundable card or a local placeholder/tracker?
 *
 * @param {object} card                 a VirtualCard entity or normalized API card
 * @param {string} [capabilityStatus]   CAPABILITY_STATUS for VIRTUAL_CARD
 * @returns {'real' | 'placeholder'}
 */
export function cardKind(card = {}, capabilityStatus) {
  const hasRealToken =
    Boolean(card.card_token || card.token) && card.source !== 'incognito';
  const providerUsable = capabilityStatus === CAPABILITY_STATUS.READY;
  return hasRealToken && providerUsable ? 'real' : 'placeholder';
}

/**
 * Validate the create-card form. Pure; returns a flat error map so the UI can
 * show field-level messages and disable submit.
 *
 * @returns {{ ok: boolean, errors: Record<string,string> }}
 */
export function validateCardForm(form = {}) {
  const errors = {};
  const name = (form.merchant_name || '').trim();
  const limit = toCents(form.spend_limit);
  const type = form.card_type;

  if (!name) errors.merchant_name = 'Name or purpose is required.';
  if (type === 'MERCHANT_LOCKED' && !name) {
    errors.merchant_name = 'Merchant-locked cards need the merchant name.';
  }
  if (!(limit > 0)) errors.spend_limit = 'Set a spend limit above $0.';
  if (limit > 0 && limit < 100) {
    errors.spend_limit = 'Limit looks too low — amounts are in cents (100 = $1).';
  }
  if (!Object.values(SPEND_DURATION).includes(form.spend_limit_duration)) {
    errors.spend_limit_duration = 'Choose a valid limit window.';
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

/**
 * Period-aware spend summary for one card against its transactions.
 *
 * Only transactions inside the card's current limit *window* count toward the
 * limit (a MONTHLY card resets each calendar month; FOREVER/TRANSACTION count
 * everything). Settled + pending both count — pending money is still committed.
 *
 * @param {object} card
 * @param {Array<{amount:number, created:string|number|Date, status?:string}>} txns
 * @param {Date} [now]  injected for deterministic tests (Date.now is unavailable here)
 * @returns {{ spent:number, limit:number, remaining:number, pct:number, overLimit:boolean }}
 */
export function summarizeSpend(card = {}, txns = [], now = new Date(0)) {
  const limit = toCents(card.spend_limit);
  const duration = card.spend_limit_duration || SPEND_DURATION.MONTHLY;
  const inWindow = (created) => {
    if (duration === SPEND_DURATION.FOREVER || duration === SPEND_DURATION.TRANSACTION) {
      return true;
    }
    const d = new Date(created);
    if (Number.isNaN(d.getTime())) return false;
    if (duration === SPEND_DURATION.MONTHLY) {
      return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
    }
    if (duration === SPEND_DURATION.ANNUALLY) {
      return d.getUTCFullYear() === now.getUTCFullYear();
    }
    return true;
  };

  const spent = (txns || [])
    .filter((t) => t && t.status !== 'DECLINED' && t.status !== 'VOIDED')
    .filter((t) => inWindow(t.created))
    .reduce((sum, t) => sum + toCents(t.amount), 0);

  const remaining = limit > 0 ? Math.max(0, limit - spent) : 0;
  const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
  return { spent, limit, remaining, pct, overLimit: limit > 0 && spent > limit };
}

/**
 * Decide whether a card's self-destruct rule has fired.
 *
 * Precedence is "ANY condition trips it" (matches the UI copy: "close when any
 * of these conditions are met"). Date is evaluated as end-of-day inclusive so a
 * card set to close "on the 5th" survives through the 5th.
 *
 * @param {object} card  expects card.self_destruct = { after_date, after_transactions }
 * @param {{ now?: Date, txnCount?: number }} ctx
 * @returns {{ shouldClose: boolean, reason: string|null }}
 */
export function evaluateSelfDestruct(card = {}, ctx = {}) {
  const rule = card.self_destruct;
  if (!rule || card.status === CARD_STATUS.CLOSED) {
    return { shouldClose: false, reason: null };
  }
  const now = ctx.now || new Date(0);
  const txnCount = Number(ctx.txnCount) || 0;

  if (rule.after_transactions && txnCount >= Number(rule.after_transactions)) {
    return { shouldClose: true, reason: `reached ${rule.after_transactions} transaction(s)` };
  }
  if (rule.after_date) {
    const cutoff = new Date(rule.after_date);
    if (!Number.isNaN(cutoff.getTime())) {
      cutoff.setUTCHours(23, 59, 59, 999);
      if (now.getTime() > cutoff.getTime()) {
        return { shouldClose: true, reason: `past ${rule.after_date}` };
      }
    }
  }
  return { shouldClose: false, reason: null };
}

/** Normalize a raw Privacy.com txn (or local txn) into a stable shape. */
export function normalizeTransaction(txn = {}) {
  return {
    merchant: txn.merchant?.descriptor || txn.merchant?.city || txn.merchant_name || 'Unknown',
    amount: toCents(txn.amount),
    created: txn.created || txn.created_date || null,
    status: txn.status || 'SETTLED',
  };
}

function mean(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function stdev(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

/** Snap an average gap (in days) to the nearest human billing cadence. */
function labelCadence(avgDays) {
  if (avgDays == null) return 'irregular';
  const known = [
    [7, 'weekly'], [14, 'biweekly'], [30, 'monthly'],
    [90, 'quarterly'], [365, 'annual'],
  ];
  let best = null;
  for (const [days, label] of known) {
    const err = Math.abs(avgDays - days) / days;
    if (err <= 0.2 && (!best || err < best.err)) best = { label, err };
  }
  return best ? best.label : 'irregular';
}

/**
 * Detect likely recurring subscriptions from a card's transactions.
 *
 * Heuristic (BALANCED, chosen 2026-06-09): a merchant is "recurring" when it has
 * ≥2 charges whose amounts cluster (spread ≤15% of the average) AND whose
 * inter-charge gaps are fairly regular (stdev ≤40% of the mean gap). This
 * rejects the classic false positive — two unrelated purchases at the same big
 * retailer — that the old `count >= 2` rule produced.
 *
 * Returns merchants sorted by descending confidence. `confidence` ∈ [0,1] blends
 * how many charges we've seen with how tight the amount + cadence are, so the UI
 * can rank and explain each flagged subscription honestly.
 *
 * @param {Array} transactions  raw or normalized transactions
 * @param {object} [opts]
 * @param {number} [opts.amountSpread=0.15]   max (max-min)/avg amount spread
 * @param {number} [opts.intervalCv=0.4]      max stdev/mean of gaps (coeff. of variation)
 * @param {number} [opts.minCount=2]          minimum charges to consider
 * @returns {Array<{merchant,count,total,avgAmount,intervalDays,cadence,confidence,
 *                   firstTransaction,lastTransaction}>}
 */
export function detectSubscriptions(transactions = [], opts = {}) {
  const amountSpread = opts.amountSpread ?? 0.15;
  const intervalCv = opts.intervalCv ?? 0.4;
  const minCount = opts.minCount ?? 2;

  const byMerchant = {};
  for (const raw of transactions || []) {
    const t = normalizeTransaction(raw);
    if (t.status === 'DECLINED' || t.status === 'VOIDED') continue;
    (byMerchant[t.merchant] ||= []).push(t);
  }

  const subs = [];
  for (const [merchant, txns] of Object.entries(byMerchant)) {
    if (txns.length < minCount) continue;

    const sorted = txns
      .filter((t) => t.created != null)
      .sort((a, b) => new Date(a.created) - new Date(b.created));
    if (sorted.length < minCount) continue;

    const amounts = sorted.map((t) => t.amount);
    const avgAmount = mean(amounts);
    const spread = avgAmount > 0 ? (Math.max(...amounts) - Math.min(...amounts)) / avgAmount : 1;

    const gaps = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push((new Date(sorted[i].created) - new Date(sorted[i - 1].created)) / 86_400_000);
    }
    const avgGap = gaps.length ? mean(gaps) : null;
    const cv = avgGap ? stdev(gaps) / avgGap : 0;
    const regular = avgGap == null ? false : cv <= intervalCv;

    if (spread > amountSpread || !regular) continue;

    // Confidence: reward more charges, tighter amounts, steadier cadence.
    const countScore = Math.min(1, sorted.length / 4);
    const amountScore = 1 - Math.min(1, spread / amountSpread);
    const cadenceScore = avgGap == null ? 0 : 1 - Math.min(1, cv / intervalCv);
    const confidence = Math.round((0.4 * countScore + 0.3 * amountScore + 0.3 * cadenceScore) * 100) / 100;

    subs.push({
      merchant,
      count: sorted.length,
      total: sorted.reduce((s, t) => s + t.amount, 0),
      avgAmount: Math.round(avgAmount),
      intervalDays: avgGap == null ? null : Math.round(avgGap),
      cadence: labelCadence(avgGap),
      confidence,
      firstTransaction: sorted[0].created,
      lastTransaction: sorted[sorted.length - 1].created,
    });
  }

  return subs.sort((a, b) => b.confidence - a.confidence || b.total - a.total);
}
