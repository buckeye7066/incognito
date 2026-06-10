/**
 * Rough Twilio cost estimate for held phone aliases (Pass 6).
 *
 * Pure. These are APPROXIMATE US rates for display only — the UI must label it
 * as an estimate, and actual charges come from Twilio. Rates are overridable so
 * the household can set their own.
 */

export const DEFAULT_PHONE_RATES = {
  numberMonthly: 1.15, // per local number / month
  smsOut: 0.0079,      // per outbound SMS segment
  smsIn: 0.0079,       // per inbound SMS segment
  callPerMin: 0.014,   // per minute (in or out)
};

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * @param {object} p
 * @param {number} [p.numberCount]   held numbers
 * @param {number} [p.smsCount]      messages this period (in+out)
 * @param {number} [p.callMinutes]   call minutes this period
 * @param {object} [p.rates]         override DEFAULT_PHONE_RATES
 * @returns {{ base:number, usage:number, total:number, perNumber:number, rates:object }}
 */
export function estimateMonthlyCost({ numberCount = 0, smsCount = 0, callMinutes = 0, rates } = {}) {
  const r = { ...DEFAULT_PHONE_RATES, ...(rates || {}) };
  const base = numberCount * r.numberMonthly;
  const usage = smsCount * r.smsOut + callMinutes * r.callPerMin;
  return {
    base: round2(base),
    usage: round2(usage),
    total: round2(base + usage),
    perNumber: round2(r.numberMonthly),
    rates: r,
  };
}

/** "$1.15/mo" style label for a single number. */
export function formatUsd(n) {
  return `$${(Number(n) || 0).toFixed(2)}`;
}
