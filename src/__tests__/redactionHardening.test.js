import { describe, it, expect } from 'vitest';
import {
  redactText, redactForLLM, assertSafeForLLM, findRestricted,
  DEFAULT_LLM_REDACT, buildSafeProfileSummary,
} from '@/lib/aiRedaction';

describe('redaction hardening', () => {
  it('detects street addresses', () => {
    const { redacted, found } = redactText('I live at 742 Evergreen Terrace');
    expect(redacted).toContain('[ADDRESS]');
    expect(found).toContain('address');
  });

  it('DEFAULT_LLM_REDACT covers all six required types', () => {
    expect(DEFAULT_LLM_REDACT).toEqual(
      expect.arrayContaining(['ssn', 'card', 'dob', 'email', 'phone', 'address']),
    );
  });

  it('findRestricted respects the allowlist', () => {
    const t = 'email a@b.com phone 555-123-4567';
    expect(findRestricted(t)).toEqual(expect.arrayContaining(['email', 'phone']));
    expect(findRestricted(t, { allow: ['phone'] })).not.toContain('phone');
    expect(findRestricted(t, { allow: ['phone'] })).toContain('email');
  });

  it('findRestricted has no leaked regex state across calls', () => {
    const t = 'ssn 123-45-6789';
    expect(findRestricted(t)).toContain('ssn');
    expect(findRestricted(t)).toContain('ssn'); // would fail if /g lastIndex leaked
  });

  it('assertSafeForLLM throws by default but passes with the matching allow', () => {
    expect(() => assertSafeForLLM('call 555-123-4567')).toThrow(/restricted/i);
    expect(assertSafeForLLM('call 555-123-4567', { allow: ['phone'] })).toBe(true);
  });

  it('assertSafeForLLM still blocks a non-allowed type even with another allowed', () => {
    expect(() => assertSafeForLLM('555-123-4567 and ssn 123-45-6789', { allow: ['phone'] }))
      .toThrow(/ssn/i);
  });

  it('redactForLLM redacts names but assertSafeForLLM flags them too', () => {
    expect(redactForLLM('hi Timmy', { names: ['Timmy'] })).toContain('[NAME]');
    expect(findRestricted('hi Timmy', { names: ['Timmy'] })).toContain('name');
  });

  it('buildSafeProfileSummary drops address/dob/dependent-ish keys', () => {
    const { summary, redactedFields } = buildSafeProfileSummary({
      city: 'Springfield', home_address: '742 Evergreen Terrace',
      dob: '01/02/1990', dependent_name: 'Timmy',
    });
    expect(summary.home_address).toBeUndefined();
    expect(summary.dob).toBeUndefined();
    expect(summary.dependent_name).toBeUndefined();
    expect(summary.city).toBe('Springfield');
    expect(redactedFields).toEqual(expect.arrayContaining(['home_address', 'dob', 'dependent_name']));
  });
});
