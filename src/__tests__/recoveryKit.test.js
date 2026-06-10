import { describe, it, expect } from 'vitest';
import {
  computeChecksum,
  summarizeBackup,
  verifyBackupStructure,
  assessRecoveryReadiness,
  BACKUP_VERSION,
} from '@/lib/recoveryKit';

const DAY = 86_400_000;
const NOW = 1_700_000_000_000; // fixed epoch for deterministic day math

describe('recoveryKit: checksum', () => {
  it('is deterministic and order-independent for the same content', () => {
    expect(computeChecksum('hello')).toBe(computeChecksum('hello'));
    expect(computeChecksum('hello')).not.toBe(computeChecksum('world'));
  });

  it('returns 8 hex chars', () => {
    expect(computeChecksum('anything')).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('recoveryKit: summarizeBackup', () => {
  it('counts records per type and overall', () => {
    const m = summarizeBackup({ PasswordEntry: [{}, {}], EmailAlias: [{}], Empty: [] });
    expect(m.totalRecords).toBe(3);
    expect(m.byType).toEqual({ PasswordEntry: 2, EmailAlias: 1 });
    expect(m.checksum).toMatch(/^[0-9a-f]{8}$/);
  });

  it('produces a stable checksum regardless of key order', () => {
    const a = summarizeBackup({ A: [{ x: 1 }], B: [{ y: 2 }] });
    const b = summarizeBackup({ B: [{ y: 2 }], A: [{ x: 1 }] });
    expect(a.checksum).toBe(b.checksum);
  });
});

describe('recoveryKit: verifyBackupStructure', () => {
  it('rejects non-Incognito files', () => {
    expect(verifyBackupStructure(null).ok).toBe(false);
    expect(verifyBackupStructure({ app: 'other' }).ok).toBe(false);
  });

  it('rejects backups from a newer app version', () => {
    const r = verifyBackupStructure({ app: 'incognito', version: BACKUP_VERSION + 1, entities: {} });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/newer/i);
  });

  it('accepts a plaintext backup with entities', () => {
    const r = verifyBackupStructure({ app: 'incognito', version: 1, entities: { Profile: [] } });
    expect(r).toEqual({ ok: true, encrypted: false });
  });

  it('accepts an encrypted backup with a payload, rejects one without', () => {
    expect(verifyBackupStructure({ app: 'incognito', encrypted: true, payload: { iv: 'x' } }))
      .toEqual({ ok: true, encrypted: true });
    expect(verifyBackupStructure({ app: 'incognito', encrypted: true }).ok).toBe(false);
  });
});

describe('recoveryKit: assessRecoveryReadiness', () => {
  it('flags a brand-new vault with no backup as at risk', () => {
    const r = assessRecoveryReadiness({ now: NOW });
    expect(r.level).toBe('at_risk');
    expect(r.items.find((i) => i.id === 'backup').severity).toBe('danger');
    expect(r.items.find((i) => i.id === 'password').severity).toBe('danger');
  });

  it('scores a fully-prepared family as protected', () => {
    const r = assessRecoveryReadiness({
      lastBackupAt: new Date(NOW - DAY).toISOString(),
      masterPasswordRecorded: true,
      recoveryCodesSaved: true,
      now: NOW,
    });
    expect(r.level).toBe('protected');
    expect(r.score).toBe(100);
    expect(r.items.every((i) => i.done)).toBe(true);
  });

  it('treats a stale backup as a warning with partial credit', () => {
    const r = assessRecoveryReadiness({
      lastBackupAt: new Date(NOW - 45 * DAY).toISOString(),
      masterPasswordRecorded: true,
      now: NOW,
    });
    const backup = r.items.find((i) => i.id === 'backup');
    expect(backup.severity).toBe('warn');
    expect(backup.done).toBe(false);
    expect(r.daysSinceBackup).toBe(45);
    // password (40) + stale backup partial (45*0.4≈18) = 58 → partial
    expect(r.level).toBe('partial');
  });

  it('surfaces concrete next actions only for unmet items', () => {
    const r = assessRecoveryReadiness({ now: NOW, masterPasswordRecorded: true });
    expect(r.items.find((i) => i.id === 'password').action).toBeNull();
    expect(r.items.find((i) => i.id === 'backup').action).toMatch(/backup/i);
  });
});
