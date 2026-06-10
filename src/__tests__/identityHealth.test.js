import { describe, it, expect } from 'vitest';
import {
  computeIdentityHealth, worstSeverity, identityHealthScore, summarizeIdentityHealth,
  isValidIdentityStatus, statusForAction, IDENTITY_STATUS,
} from '@/lib/identityHealth';

const cleanCtx = {
  password: { password: 'Str0ng!pw', strength: 'strong', breach_count: 0, last_changed: new Date().toISOString() },
  emailAlias: { status: 'active' },
  phoneAlias: { phone_number: '+15550001111' },
  card: { status: 'OPEN' },
  totp: { secret: 'JBSWY3DPEHPK3PXP' },
  allPasswords: [],
  exposures: [],
  unavailableProviders: [],
};

const codes = (issues) => issues.map((i) => i.code);

describe('computeIdentityHealth', () => {
  it('returns no issues for a fully healthy identity', () => {
    const ctx = { ...cleanCtx, allPasswords: [cleanCtx.password] };
    expect(computeIdentityHealth({ status: 'active' }, ctx)).toEqual([]);
  });

  it('flags a missing password and 2FA', () => {
    const c = codes(computeIdentityHealth({ status: 'active' }, { ...cleanCtx, password: null, totp: null }));
    expect(c).toContain('no_password');
    expect(c).toContain('no_totp');
  });

  it('flags weak, breached, reused, and old passwords', () => {
    const weak = computeIdentityHealth({ status: 'active' }, { ...cleanCtx, password: { password: 'p', strength: 'weak', breach_count: 0 } });
    expect(codes(weak)).toContain('weak_password');

    const breached = computeIdentityHealth({ status: 'active' }, { ...cleanCtx, password: { password: 'p', strength: 'strong', breach_count: 3 } });
    expect(codes(breached)).toContain('breached_password');

    const shared = { password: 'dupe', strength: 'strong', breach_count: 0 };
    const reused = computeIdentityHealth({ status: 'active' }, { ...cleanCtx, password: shared, allPasswords: [shared, { password: 'dupe' }] });
    expect(codes(reused)).toContain('reused_password');

    const old = computeIdentityHealth({ status: 'active' }, { ...cleanCtx, password: { password: 'x', strength: 'strong', breach_count: 0, last_changed: new Date(Date.now() - 200 * 86400000).toISOString() } });
    expect(codes(old)).toContain('old_password');
  });

  it('flags compromised status, exposures, disabled alias, paused card, provider gaps', () => {
    expect(codes(computeIdentityHealth({ status: 'compromised' }, cleanCtx))).toContain('compromised');
    expect(codes(computeIdentityHealth({ status: 'active' }, { ...cleanCtx, exposures: [{ id: 1 }] }))).toContain('exposure_found');
    expect(codes(computeIdentityHealth({ status: 'active' }, { ...cleanCtx, emailAlias: { status: 'disabled' } }))).toContain('alias_disabled');
    expect(codes(computeIdentityHealth({ status: 'active' }, { ...cleanCtx, card: { status: 'PAUSED' } }))).toContain('card_paused_closed');
    expect(codes(computeIdentityHealth({ status: 'active' }, { ...cleanCtx, unavailableProviders: ['email'] }))).toContain('provider_unavailable');
  });

  it('treats a TOTP placeholder (no secret) as no 2FA', () => {
    const c = codes(computeIdentityHealth({ status: 'active' }, { ...cleanCtx, totp: { pending: true, secret: null } }));
    expect(c).toContain('no_totp');
  });

  it('cannot compute reuse when the vault is locked (password redacted to null)', () => {
    // Locked: password object present but password value null → no reuse claim.
    const c = codes(computeIdentityHealth({ status: 'active' }, { ...cleanCtx, password: { password: null, strength: 'strong', breach_count: 0 }, allPasswords: [] }));
    expect(c).not.toContain('reused_password');
  });
});

describe('health scoring + status helpers', () => {
  it('worstSeverity / score / summarize', () => {
    const issues = computeIdentityHealth({ status: 'compromised' }, { ...cleanCtx, password: null });
    expect(worstSeverity(issues)).toBe('critical');
    expect(identityHealthScore([])).toBe(100);
    expect(identityHealthScore(issues)).toBeLessThan(100);
    expect(summarizeIdentityHealth([]).clean).toBe(true);
  });

  it('validates statuses and actions', () => {
    expect(isValidIdentityStatus('archived')).toBe(true);
    expect(isValidIdentityStatus('nope')).toBe(false);
    expect(statusForAction('mark_compromised')).toBe(IDENTITY_STATUS.COMPROMISED);
    expect(() => statusForAction('frobnicate')).toThrow(/Unknown/);
  });
});
