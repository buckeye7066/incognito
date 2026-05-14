import { describe, it, expect } from 'vitest';
import {
  getConsentState,
  setProviderEnabled,
  setDataTypeConsent,
  isProviderAllowed,
  requireConsent,
  clearAllConsent,
  EXTERNAL_PROVIDERS,
} from '@/lib/consent';

describe('consent ledger', () => {
  it('starts empty', () => {
    const state = getConsentState();
    expect(state.providers).toEqual({});
  });

  it('refuses by default', () => {
    expect(isProviderAllowed('hibp', 'email')).toBe(false);
    expect(() => requireConsent('hibp', 'email')).toThrow(/Consent required/);
  });

  it('honors per-provider enable + per-data-type consent', () => {
    setProviderEnabled('hibp', true);
    expect(isProviderAllowed('hibp', 'email')).toBe(false); // dataType not granted yet
    setDataTypeConsent('hibp', 'email', true);
    expect(isProviderAllowed('hibp', 'email')).toBe(true);
    expect(() => requireConsent('hibp', 'email')).not.toThrow();
  });

  it('disabling a provider revokes consent even if dataType is granted', () => {
    setProviderEnabled('leakcheck', true);
    setDataTypeConsent('leakcheck', 'email', true);
    expect(isProviderAllowed('leakcheck', 'email')).toBe(true);
    setProviderEnabled('leakcheck', false);
    expect(isProviderAllowed('leakcheck', 'email')).toBe(false);
  });

  it('requireConsent throws a typed error', () => {
    try {
      requireConsent('openai', 'profile_summary');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err.code).toBe('E_CONSENT_REQUIRED');
      expect(err.providerId).toBe('openai');
      expect(err.dataType).toBe('profile_summary');
    }
  });

  it('clearAllConsent resets the ledger', () => {
    setProviderEnabled('hibp', true);
    setDataTypeConsent('hibp', 'email', true);
    clearAllConsent();
    expect(isProviderAllowed('hibp', 'email')).toBe(false);
  });

  it('declares a non-empty provider catalog', () => {
    expect(EXTERNAL_PROVIDERS.length).toBeGreaterThan(0);
    for (const p of EXTERNAL_PROVIDERS) {
      expect(p.id).toBeTypeOf('string');
      expect(Array.isArray(p.dataTypes)).toBe(true);
    }
  });
});
