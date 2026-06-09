/**
 * Household / family logic for the private-family build.
 *
 * Pure, dependency-free helpers (so they're easy to test and reuse). Persistence
 * is done by pages via `incognito.entities.{Household,HouseholdMember,...}`.
 *
 * IMPORTANT honesty constraint: roles here are GROUPING + WORKFLOW, not
 * cryptographic access control. Every member's secrets share the one vault key.
 * See docs/THREAT_MODEL.md and docs/FAMILY_OPERATIONS.md.
 */

export const ROLES = ['owner', 'spouse', 'adult', 'child', 'dependent', 'emergency_contact'];

export const ROLE_LABELS = {
  owner: 'Owner',
  spouse: 'Spouse',
  adult: 'Adult',
  child: 'Child',
  dependent: 'Dependent',
  emergency_contact: 'Emergency contact',
};

export function isValidRole(role) {
  return ROLES.includes(role);
}

// ── Shared vault items: revocable + expiring ──

export const SHARE_STATUS = { ACTIVE: 'active', REVOKED: 'revoked', EXPIRED: 'expired' };

/**
 * Is a share currently usable? Expired or revoked shares are not.
 * @param {object} share { status, expires_at? (ISO string or ms) }
 * @param {number} [now] ms epoch
 */
export function isShareActive(share, now = Date.now()) {
  if (!share || share.status === SHARE_STATUS.REVOKED) return false;
  if (share.expires_at) {
    const exp = typeof share.expires_at === 'number'
      ? share.expires_at
      : Date.parse(share.expires_at);
    if (!Number.isNaN(exp) && exp <= now) return false;
  }
  return share.status !== SHARE_STATUS.EXPIRED;
}

/** Effective status accounting for expiry (without mutating storage). */
export function effectiveShareStatus(share, now = Date.now()) {
  if (!share) return SHARE_STATUS.REVOKED;
  if (share.status === SHARE_STATUS.REVOKED) return SHARE_STATUS.REVOKED;
  return isShareActive(share, now) ? SHARE_STATUS.ACTIVE : SHARE_STATUS.EXPIRED;
}

// ── Emergency access workflow (state machine) ──

export const EMERGENCY_STATE = {
  REQUESTED: 'requested',
  APPROVED: 'approved',
  DENIED: 'denied',
  REVOKED: 'revoked',
  EXPIRED: 'expired',
};

const EMERGENCY_TRANSITIONS = {
  requested: ['approved', 'denied'],
  approved: ['revoked', 'expired'],
  denied: [],
  revoked: [],
  expired: [],
};

/** Validate + compute the next emergency-access grant state. Throws on illegal. */
export function nextEmergencyState(current, action) {
  const allowed = EMERGENCY_TRANSITIONS[current] || [];
  if (!allowed.includes(action)) {
    throw new Error(`Illegal emergency-access transition: ${current} → ${action}`);
  }
  return action;
}

// ── Per-member privacy score ──

/**
 * Compute a 0–100 privacy score for a member from simple signals. Higher is
 * better. Deterministic + pure so the dashboard and tests agree.
 *
 * @param {object} signals
 * @param {number} [signals.exposures]        active broker/search exposures
 * @param {number} [signals.breaches]         breach/dark-web alerts
 * @param {number} [signals.weakPasswords]
 * @param {number} [signals.reusedPasswords]
 * @param {number} [signals.accountsWithout2fa]
 * @param {boolean}[signals.creditFrozen]
 */
export function computeMemberPrivacyScore(signals = {}) {
  const {
    exposures = 0, breaches = 0, weakPasswords = 0,
    reusedPasswords = 0, accountsWithout2fa = 0, creditFrozen = false,
  } = signals;
  let score = 100;
  score -= Math.min(30, exposures * 5);
  score -= Math.min(30, breaches * 10);
  score -= Math.min(15, weakPasswords * 3);
  score -= Math.min(15, reusedPasswords * 3);
  score -= Math.min(15, accountsWithout2fa * 2);
  if (creditFrozen) score += 5;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function scoreBand(score) {
  if (score >= 85) return 'strong';
  if (score >= 60) return 'fair';
  if (score >= 30) return 'weak';
  return 'critical';
}

/** Aggregate household score = average of member scores (0 members → null). */
export function householdScore(memberScores = []) {
  if (memberScores.length === 0) return null;
  return Math.round(memberScores.reduce((a, b) => a + b, 0) / memberScores.length);
}
