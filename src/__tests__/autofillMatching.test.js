import { describe, it, expect } from 'vitest';
import {
  registrableDomain,
  classifyMatch,
  matchLogins,
  countMatches,
  MATCH_EXACT,
  MATCH_DOMAIN,
} from '@/lib/domainMatch';

describe('domainMatch: registrableDomain', () => {
  it('collapses subdomains to the registrable domain', () => {
    expect(registrableDomain('accounts.google.com')).toBe('google.com');
    expect(registrableDomain('mail.proton.me')).toBe('proton.me');
    expect(registrableDomain('example.com')).toBe('example.com');
  });

  it('accepts full URLs and strips scheme / www / path', () => {
    expect(registrableDomain('https://www.example.com/login?x=1')).toBe('example.com');
    expect(registrableDomain('http://Sub.Example.COM/')).toBe('example.com');
  });

  it('handles multi-part public suffixes', () => {
    expect(registrableDomain('www.example.co.uk')).toBe('example.co.uk');
    expect(registrableDomain('shop.example.com.au')).toBe('example.com.au');
  });

  it('treats github.io-style suffixes as public so user pages stay separate', () => {
    expect(registrableDomain('alice.github.io')).toBe('alice.github.io');
    expect(registrableDomain('bob.github.io')).toBe('bob.github.io');
    expect(registrableDomain('alice.github.io')).not.toBe(registrableDomain('bob.github.io'));
  });

  it('returns single-label hosts and empty input unchanged', () => {
    expect(registrableDomain('localhost')).toBe('localhost');
    expect(registrableDomain('')).toBe('');
    expect(registrableDomain(null)).toBe('');
  });
});

describe('domainMatch: classifyMatch', () => {
  const gh = { service_name: 'GitHub', service_url: 'https://github.com' };

  it('returns exact for identical hostnames', () => {
    expect(classifyMatch(gh, 'https://github.com/login')).toBe(MATCH_EXACT);
  });

  it('returns domain for same-site subdomains', () => {
    const bank = { service_url: 'https://bank.example.com' };
    expect(classifyMatch(bank, 'https://secure.example.com')).toBe(MATCH_DOMAIN);
  });

  it('returns null for unrelated domains', () => {
    expect(classifyMatch(gh, 'https://gitlab.com')).toBeNull();
  });

  it('does not cross-match different github.io user pages', () => {
    const alice = { service_url: 'https://alice.github.io' };
    expect(classifyMatch(alice, 'https://bob.github.io')).toBeNull();
  });

  it('tolerates entry shape variance (url / domain fields)', () => {
    expect(classifyMatch({ url: 'github.com' }, 'github.com')).toBe(MATCH_EXACT);
    expect(classifyMatch({ domain: 'example.com' }, 'login.example.com')).toBe(MATCH_DOMAIN);
  });
});

describe('domainMatch: matchLogins', () => {
  const entries = [
    { id: '1', service_name: 'GitHub', service_url: 'https://github.com' },
    { id: '2', service_name: 'GitHub CI', service_url: 'https://ci.github.com' },
    { id: '3', service_name: 'GitLab', service_url: 'https://gitlab.com' },
    { id: '4', service_name: 'Bank', service_url: 'bank.example.com' },
  ];

  it('returns exact matches ranked above domain matches', () => {
    const m = matchLogins(entries, 'https://github.com');
    expect(m.map((x) => x.entry.id)).toEqual(['1', '2']);
    expect(m[0].tier).toBe(MATCH_EXACT);
    expect(m[1].tier).toBe(MATCH_DOMAIN);
  });

  it('breaks ties within a tier alphabetically by name', () => {
    const two = [
      { id: 'z', service_name: 'Zeta', service_url: 'a.example.com' },
      { id: 'a', service_name: 'Alpha', service_url: 'b.example.com' },
    ];
    const m = matchLogins(two, 'example.com');
    expect(m.map((x) => x.entry.id)).toEqual(['a', 'z']);
  });

  it('respects minTier: exact excludes subdomain-only matches', () => {
    const m = matchLogins(entries, 'https://github.com', { minTier: MATCH_EXACT });
    expect(m.map((x) => x.entry.id)).toEqual(['1']);
  });

  it('returns [] for empty/invalid input', () => {
    expect(matchLogins(entries, '')).toEqual([]);
    expect(matchLogins(null, 'github.com')).toEqual([]);
    expect(matchLogins([], 'github.com')).toEqual([]);
  });

  it('countMatches mirrors matchLogins length', () => {
    expect(countMatches(entries, 'github.com')).toBe(2);
    expect(countMatches(entries, 'nowhere.test')).toBe(0);
  });
});
