import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PHONE_RULES, normalizePhone, normalizeRules, isNumberBlocked,
  shouldForwardCall, shouldForwardText, applyPhoneRuleChange, summarizePhoneRules,
} from '@/lib/phoneRules';
import { estimateMonthlyCost, formatUsd } from '@/lib/phoneCost';

describe('phoneRules', () => {
  it('normalizes to last 10 digits so +1/formatting match', () => {
    expect(normalizePhone('+1 (555) 123-4567')).toBe('5551234567');
    expect(normalizePhone('555.123.4567')).toBe('5551234567');
  });

  it('allowlist overrides blocklist', () => {
    const r = { blocked_numbers: ['5551234567'], allowed_numbers: ['+15551234567'] };
    expect(isNumberBlocked(r, '555-123-4567')).toBe(false);
    expect(isNumberBlocked({ blocked_numbers: ['5551234567'] }, '+1 555 123 4567')).toBe(true);
  });

  it('shouldForwardCall/Text respect toggles + block', () => {
    expect(shouldForwardCall({}, '5551112222')).toBe(true);
    expect(shouldForwardCall({ forward_calls: false }, '5551112222')).toBe(false);
    expect(shouldForwardText({ forward_texts: false }, '5551112222')).toBe(false);
    expect(shouldForwardCall({ blocked_numbers: ['5551112222'] }, '555-111-2222')).toBe(false);
  });

  it('applyPhoneRuleChange handles all types', () => {
    let r = applyPhoneRuleChange(undefined, { type: 'calls_off' });
    expect(r.forward_calls).toBe(false);
    r = applyPhoneRuleChange(r, { type: 'block', number: '+1 555 999 0000' });
    expect(r.blocked_numbers).toEqual(['5559990000']);
    r = applyPhoneRuleChange(r, { type: 'allow', number: '5559990000' });
    expect(r.allowed_numbers).toEqual(['5559990000']);
    expect(r.blocked_numbers).toEqual([]);
    expect(() => applyPhoneRuleChange(r, { type: 'nope' })).toThrow(/Unknown/);
  });

  it('summarizes rules', () => {
    expect(summarizePhoneRules(DEFAULT_PHONE_RULES)).toContain('calls + texts');
    expect(summarizePhoneRules({ forward_calls: false, forward_texts: false })).toBe('Forwarding off');
    expect(normalizeRules(undefined)).toEqual(DEFAULT_PHONE_RULES);
  });
});

describe('phoneCost', () => {
  it('estimates base + usage', () => {
    const c = estimateMonthlyCost({ numberCount: 2, smsCount: 100, callMinutes: 50 });
    expect(c.base).toBe(2.30);
    expect(c.total).toBeGreaterThan(c.base);
    expect(c.perNumber).toBe(1.15);
  });
  it('zero usage = base only; formatUsd', () => {
    expect(estimateMonthlyCost({ numberCount: 1 }).total).toBe(1.15);
    expect(formatUsd(1.1)).toBe('$1.10');
  });
});
