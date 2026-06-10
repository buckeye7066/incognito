/**
 * Cloaked Identity health + status logic (Pass 4).
 *
 * Pure + dependency-free so it's easy to test and reuse. The page resolves the
 * linked resources (password / email / phone / card / totp) and the relevant
 * context (all passwords for reuse detection, domain-matched exposures,
 * unavailable providers) and passes them in. Sensitive values that are redacted
 * when the vault is locked simply read as null here, which degrades gracefully
 * (e.g. password reuse can't be computed while locked — and isn't claimed).
 */

export const IDENTITY_STATUS = {
  ACTIVE: 'active',
  MUTED: 'muted',
  DISABLED: 'disabled',
  ARCHIVED: 'archived',
  COMPROMISED: 'compromised',
};

export const IDENTITY_STATUSES = Object.values(IDENTITY_STATUS);

export function isValidIdentityStatus(s) {
  return IDENTITY_STATUSES.includes(s);
}

// status action → resulting status. Used by the status menu + updateIdentityStatus.
const STATUS_ACTIONS = {
  mute: IDENTITY_STATUS.MUTED,
  unmute: IDENTITY_STATUS.ACTIVE,
  disable: IDENTITY_STATUS.DISABLED,
  enable: IDENTITY_STATUS.ACTIVE,
  archive: IDENTITY_STATUS.ARCHIVED,
  restore: IDENTITY_STATUS.ACTIVE,
  mark_compromised: IDENTITY_STATUS.COMPROMISED,
};

export function statusForAction(action) {
  const next = STATUS_ACTIONS[action];
  if (!next) throw new Error(`Unknown identity status action: ${action}`);
  return next;
}

const OLD_PASSWORD_DAYS = 180;

/** Health issue catalog. severity: critical > warning > info. */
export const HEALTH = {
  COMPROMISED: { code: 'compromised', severity: 'critical', label: 'Marked compromised' },
  EXPOSURE_FOUND: { code: 'exposure_found', severity: 'critical', label: 'Exposure found for this domain' },
  BREACHED_PASSWORD: { code: 'breached_password', severity: 'critical', label: 'Password found in a breach' },
  REUSED_PASSWORD: { code: 'reused_password', severity: 'critical', label: 'Password reused elsewhere' },
  WEAK_PASSWORD: { code: 'weak_password', severity: 'warning', label: 'Weak password' },
  NO_PASSWORD: { code: 'no_password', severity: 'warning', label: 'No password linked' },
  NO_TOTP: { code: 'no_totp', severity: 'warning', label: 'No 2FA / TOTP' },
  ALIAS_DISABLED: { code: 'alias_disabled', severity: 'warning', label: 'Email alias disabled' },
  CARD_PAUSED_CLOSED: { code: 'card_paused_closed', severity: 'warning', label: 'Card paused/closed' },
  PROVIDER_UNAVAILABLE: { code: 'provider_unavailable', severity: 'info', label: 'A provider is not set up' },
  OLD_PASSWORD: { code: 'old_password', severity: 'info', label: 'Password is over 6 months old' },
  NO_EMAIL_ALIAS: { code: 'no_email_alias', severity: 'info', label: 'No email alias' },
  NO_PHONE_ALIAS: { code: 'no_phone_alias', severity: 'info', label: 'No phone alias' },
  NO_CARD: { code: 'no_card', severity: 'info', label: 'No virtual card' },
};

const PAUSED_CLOSED = new Set(['paused', 'closed', 'PAUSED', 'CLOSED']);

/**
 * Compute the health issues for one identity.
 * @param {object} identity
 * @param {object} ctx
 * @param {object|null} ctx.password       linked PasswordEntry (decrypted) or null
 * @param {object|null} ctx.emailAlias
 * @param {object|null} ctx.phoneAlias
 * @param {object|null} ctx.card
 * @param {object|null} ctx.totp           linked TOTPSecret (or placeholder)
 * @param {object[]}    ctx.allPasswords   for reuse detection (decrypted)
 * @param {object[]}    ctx.exposures      findings already filtered to this domain
 * @param {string[]}    ctx.unavailableProviders e.g. ['email','card'] (capability not ready)
 * @returns {Array<{code,severity,label}>}
 */
export function computeIdentityHealth(identity = {}, ctx = {}) {
  const {
    password = null, emailAlias = null, phoneAlias = null, card = null, totp = null,
    allPasswords = [], exposures = [], unavailableProviders = [],
  } = ctx;
  const issues = [];

  if (identity.status === IDENTITY_STATUS.COMPROMISED) issues.push(HEALTH.COMPROMISED);
  if (exposures.length > 0) issues.push(HEALTH.EXPOSURE_FOUND);

  if (!password) {
    issues.push(HEALTH.NO_PASSWORD);
  } else {
    if (password.breach_count > 0) issues.push(HEALTH.BREACHED_PASSWORD);
    // Reuse needs decrypted values; when locked these are null so we skip safely.
    if (password.password) {
      const dupes = allPasswords.filter((p) => p.password && p.password === password.password);
      if (dupes.length > 1) issues.push(HEALTH.REUSED_PASSWORD);
    }
    if (['very_weak', 'weak'].includes(password.strength)) issues.push(HEALTH.WEAK_PASSWORD);
    if (password.last_changed) {
      const days = (Date.now() - Date.parse(password.last_changed)) / 86_400_000;
      if (Number.isFinite(days) && days > OLD_PASSWORD_DAYS) issues.push(HEALTH.OLD_PASSWORD);
    }
  }

  if (!totp || (!totp.secret && totp.pending)) issues.push(HEALTH.NO_TOTP);

  if (!emailAlias) issues.push(HEALTH.NO_EMAIL_ALIAS);
  else if (emailAlias.status === 'disabled') issues.push(HEALTH.ALIAS_DISABLED);

  if (!phoneAlias) issues.push(HEALTH.NO_PHONE_ALIAS);

  if (!card) issues.push(HEALTH.NO_CARD);
  else if (PAUSED_CLOSED.has(card.status)) issues.push(HEALTH.CARD_PAUSED_CLOSED);

  if (unavailableProviders.length > 0) {
    issues.push({ ...HEALTH.PROVIDER_UNAVAILABLE, detail: unavailableProviders.join(', ') });
  }

  return issues;
}

const SEVERITY_RANK = { critical: 3, warning: 2, info: 1 };

/** The worst severity among issues, or null if clean. */
export function worstSeverity(issues = []) {
  let worst = null;
  let rank = 0;
  for (const i of issues) {
    const r = SEVERITY_RANK[i.severity] || 0;
    if (r > rank) { rank = r; worst = i.severity; }
  }
  return worst;
}

/** A compact 0–100 health score (100 = clean). Deterministic + pure. */
export function identityHealthScore(issues = []) {
  let penalty = 0;
  for (const i of issues) penalty += (SEVERITY_RANK[i.severity] || 0) * 10;
  return Math.max(0, 100 - penalty);
}

export function summarizeIdentityHealth(issues = []) {
  return {
    count: issues.length,
    worst: worstSeverity(issues),
    score: identityHealthScore(issues),
    clean: issues.length === 0,
  };
}
