/**
 * Recovery kit — backup integrity + recovery-readiness scoring (Pass 14).
 *
 * Incognito is local-first: the family's vault lives in one browser profile on
 * one device. That privacy strength is a DURABILITY RISK — forget the master
 * password or lose the device and the data is gone, because there is no server
 * to restore from (see docs/BACKUP_AND_RECOVERY.md).
 *
 * This module is the honest core of the Recovery Center: it scores how well a
 * family is actually protected against data loss and validates backup files
 * before a restore. It is PURE (no crypto, no storage, no app imports) so the
 * scoring is unit-testable and the same checksum logic runs on export + import.
 *
 * Note on the checksum: FNV-1a is an INTEGRITY check (did the file get
 * truncated / corrupted?), NOT a security primitive. The backup's
 * confidentiality comes from the vault's AES-GCM encryption, applied separately.
 */

export const BACKUP_VERSION = 1;
const DAY_MS = 86_400_000;

/** Deterministic 32-bit FNV-1a hash → 8-char hex. Integrity only, not crypto. */
export function computeChecksum(str) {
  let h = 0x811c9dc5;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Summarize an entities map into a manifest: per-type counts, total, checksum.
 * @param {Record<string, any[]>} entitiesMap
 */
export function summarizeBackup(entitiesMap = {}) {
  const byType = {};
  let totalRecords = 0;
  // Sort keys so the checksum is stable regardless of insertion order.
  for (const name of Object.keys(entitiesMap).sort()) {
    const n = Array.isArray(entitiesMap[name]) ? entitiesMap[name].length : 0;
    if (n > 0) byType[name] = n;
    totalRecords += n;
  }
  const canonical = JSON.stringify(entitiesMap, Object.keys(entitiesMap).sort());
  return { totalRecords, byType, checksum: computeChecksum(canonical) };
}

/**
 * Validate a parsed backup file's structure before attempting a restore.
 * @returns {{ ok: boolean, reason?: string, encrypted?: boolean }}
 */
export function verifyBackupStructure(parsed) {
  if (!parsed || typeof parsed !== 'object') return { ok: false, reason: 'Not a valid backup file.' };
  if (parsed.app !== 'incognito') return { ok: false, reason: 'This file is not an Incognito backup.' };
  if (typeof parsed.version === 'number' && parsed.version > BACKUP_VERSION) {
    return { ok: false, reason: 'Backup is newer than this app supports — update Incognito first.' };
  }
  const encrypted = Boolean(parsed.encrypted);
  if (encrypted) {
    if (!parsed.payload) return { ok: false, reason: 'Encrypted backup is missing its payload.' };
  } else if (!parsed.entities || typeof parsed.entities !== 'object') {
    return { ok: false, reason: 'Backup contains no data.' };
  }
  return { ok: true, encrypted };
}

const READINESS_WEIGHTS = { backup: 45, password: 40, codes: 15 };

/**
 * Score how protected a family is against losing their vault, and return the
 * prioritized gaps. Two items are CRITICAL (a missing backup or an unrecorded
 * master password each mean permanent data loss); recovery codes are important
 * but recoverable, so they weigh less.
 *
 * Note: `masterPasswordRecorded` / `recoveryCodesSaved` are user attestations —
 * the app genuinely cannot verify you wrote your password in a safe, so it
 * asks honestly rather than inferring.
 *
 * @param {object} state
 * @param {?string} state.lastBackupAt          ISO time of last backup, or null
 * @param {boolean} state.masterPasswordRecorded
 * @param {boolean} state.recoveryCodesSaved
 * @param {number}  [state.recordCount]         records currently in the vault
 * @param {number}  [state.now]                 ms epoch (injected for testing)
 * @param {number}  [state.staleAfterDays=30]
 */
export function assessRecoveryReadiness({
  lastBackupAt = null,
  masterPasswordRecorded = false,
  recoveryCodesSaved = false,
  recordCount = 0,
  now = 0,
  staleAfterDays = 30,
} = {}) {
  const reference = now || 0;
  const hasBackup = Boolean(lastBackupAt);
  const daysSinceBackup = hasBackup && reference
    ? Math.floor((reference - new Date(lastBackupAt).getTime()) / DAY_MS)
    : (hasBackup ? 0 : null);
  const backupStale = hasBackup && daysSinceBackup > staleAfterDays;

  const items = [];
  items.push({
    id: 'backup',
    label: !hasBackup
      ? 'No encrypted backup yet'
      : backupStale
        ? `Last backup was ${daysSinceBackup} days ago (stale)`
        : daysSinceBackup === 0 ? 'Backed up recently' : `Backed up ${daysSinceBackup}d ago`,
    done: hasBackup && !backupStale,
    severity: !hasBackup ? 'danger' : backupStale ? 'warn' : 'good',
    action: hasBackup && !backupStale ? null : 'Download an encrypted backup',
  });
  items.push({
    id: 'password',
    label: masterPasswordRecorded
      ? 'Master password recorded somewhere safe'
      : 'Master password not recorded — if forgotten, the vault is unrecoverable',
    done: masterPasswordRecorded,
    severity: masterPasswordRecorded ? 'good' : 'danger',
    action: masterPasswordRecorded ? null : 'Store it in a safe or a second password manager',
  });
  items.push({
    id: 'codes',
    label: recoveryCodesSaved
      ? 'Account recovery codes saved offline'
      : 'Recovery codes not saved yet',
    done: recoveryCodesSaved,
    severity: recoveryCodesSaved ? 'good' : 'warn',
    action: recoveryCodesSaved ? null : 'Save your TOTP / account recovery codes offline',
  });

  let score = 0;
  for (const it of items) if (it.done) score += READINESS_WEIGHTS[it.id] || 0;
  // A stale-but-present backup still protects most data → partial credit.
  if (hasBackup && backupStale) score += Math.round(READINESS_WEIGHTS.backup * 0.4);
  score = Math.min(100, score);

  const level = score >= 85 ? 'protected' : score >= 50 ? 'partial' : 'at_risk';

  return { score, level, daysSinceBackup, hasBackup, recordCount, items };
}

export const READINESS_LABELS = {
  protected: 'Protected',
  partial: 'Partially protected',
  at_risk: 'At risk',
};

export default {
  BACKUP_VERSION,
  computeChecksum,
  summarizeBackup,
  verifyBackupStructure,
  assessRecoveryReadiness,
  READINESS_LABELS,
};
