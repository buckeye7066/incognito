import { describe, it, expect } from 'vitest';
import {
  isShareActive, effectiveShareStatus, SHARE_STATUS,
  nextEmergencyState, computeMemberPrivacyScore, scoreBand, householdScore,
  isValidRole,
} from '@/lib/household';

describe('household: shared item lifecycle', () => {
  const now = 1_000_000_000_000;

  it('active share with no expiry is usable', () => {
    expect(isShareActive({ status: 'active' }, now)).toBe(true);
  });
  it('revoked share is never usable', () => {
    expect(isShareActive({ status: 'revoked' }, now)).toBe(false);
  });
  it('expired share is not usable', () => {
    expect(isShareActive({ status: 'active', expires_at: now - 1 }, now)).toBe(false);
    expect(isShareActive({ status: 'active', expires_at: now + 1000 }, now)).toBe(true);
  });
  it('effectiveShareStatus reflects expiry without mutation', () => {
    expect(effectiveShareStatus({ status: 'active', expires_at: now - 1 }, now)).toBe(SHARE_STATUS.EXPIRED);
    expect(effectiveShareStatus({ status: 'active' }, now)).toBe(SHARE_STATUS.ACTIVE);
    expect(effectiveShareStatus({ status: 'revoked' }, now)).toBe(SHARE_STATUS.REVOKED);
  });
});

describe('household: emergency access state machine', () => {
  it('allows requested → approved/denied', () => {
    expect(nextEmergencyState('requested', 'approved')).toBe('approved');
    expect(nextEmergencyState('requested', 'denied')).toBe('denied');
  });
  it('allows approved → revoked/expired', () => {
    expect(nextEmergencyState('approved', 'revoked')).toBe('revoked');
  });
  it('rejects illegal transitions', () => {
    expect(() => nextEmergencyState('denied', 'approved')).toThrow(/Illegal/);
    expect(() => nextEmergencyState('requested', 'revoked')).toThrow(/Illegal/);
  });
});

describe('household: scoring', () => {
  it('clean member scores 100', () => {
    expect(computeMemberPrivacyScore({})).toBe(100);
  });
  it('penalizes exposures/breaches and clamps to 0', () => {
    expect(computeMemberPrivacyScore({ breaches: 2 })).toBe(80);
    expect(computeMemberPrivacyScore({
      exposures: 99, breaches: 99, weakPasswords: 99, reusedPasswords: 99, accountsWithout2fa: 99,
    })).toBe(0);
  });
  it('credit freeze gives a small bump (still clamped at 100)', () => {
    expect(computeMemberPrivacyScore({ creditFrozen: true })).toBe(100);
    expect(computeMemberPrivacyScore({ breaches: 1, creditFrozen: true })).toBe(95);
  });
  it('scoreBand maps ranges', () => {
    expect(scoreBand(90)).toBe('strong');
    expect(scoreBand(70)).toBe('fair');
    expect(scoreBand(40)).toBe('weak');
    expect(scoreBand(10)).toBe('critical');
  });
  it('householdScore averages, null when empty', () => {
    expect(householdScore([100, 80])).toBe(90);
    expect(householdScore([])).toBeNull();
  });
});

describe('household: roles', () => {
  it('validates role membership', () => {
    expect(isValidRole('child')).toBe(true);
    expect(isValidRole('superadmin')).toBe(false);
  });
});
