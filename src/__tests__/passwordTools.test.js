import { describe, it, expect } from 'vitest';
import {
  parseCsv, detectFormat, parsePasswordCsv, findDuplicates, hostnameOf,
} from '@/lib/passwordImport';
import { parseOtpauthUri, buildOtpauthUri, isValidBase32 } from '@/lib/otpauth';
import { sha1Hex, pwnedRange, countFromRangeBody, checkPasswordPwned } from '@/lib/passwordBreach';

const BW_CSV = `folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp
,,login,GitHub,my note,,0,https://github.com,me@example.com,s3cret,JBSWY3DPEHPK3PXP
,,login,Bank,,,0,https://bank.example.com,user1,p@ss,
`;

describe('passwordImport: CSV parsing', () => {
  it('parses quoted fields with embedded commas/newlines', () => {
    const rows = parseCsv('a,"b,c","line1\nline2"\n1,2,3');
    expect(rows[0]).toEqual(['a', 'b,c', 'line1\nline2']);
    expect(rows[1]).toEqual(['1', '2', '3']);
  });

  it('detects formats and unknown headers', () => {
    expect(detectFormat(['folder', 'favorite', 'type', 'name', 'notes', 'fields', 'reprompt', 'login_uri', 'login_username', 'login_password', 'login_totp'])).toBe('bitwarden');
    expect(detectFormat(['email', 'password', 'foo'])).toBe('generic');
    expect(detectFormat(['col1', 'col2'])).toBe('unknown');
  });

  it('normalizes a Bitwarden export', () => {
    const { format, entries, total } = parsePasswordCsv(BW_CSV);
    expect(format).toBe('bitwarden');
    expect(total).toBe(2);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      site: 'GitHub', username: 'me@example.com', password: 's3cret',
      domain: 'github.com', totp_secret: 'JBSWY3DPEHPK3PXP',
    });
  });

  it('hostnameOf strips scheme + www', () => {
    expect(hostnameOf('https://www.github.com/login')).toBe('github.com');
    expect(hostnameOf('bank.example.com')).toBe('bank.example.com');
  });

  it('findDuplicates separates fresh from already-in-vault', () => {
    const { entries } = parsePasswordCsv(BW_CSV);
    const { fresh, duplicates } = findDuplicates(entries, [
      { domain: 'github.com', username: 'me@example.com' },
    ]);
    expect(duplicates.map((e) => e.site)).toEqual(['GitHub']);
    expect(fresh.map((e) => e.site)).toEqual(['Bank']);
  });
});

describe('otpauth parsing', () => {
  it('parses a standard totp URI', () => {
    const d = parseOtpauthUri('otpauth://totp/GitHub:me@example.com?secret=JBSWY3DPEHPK3PXP&issuer=GitHub&digits=6&period=30');
    expect(d).toMatchObject({
      type: 'totp', issuer: 'GitHub', account: 'me@example.com',
      secret: 'JBSWY3DPEHPK3PXP', algorithm: 'SHA1', digits: 6, period: 30,
    });
  });
  it('rejects non-otpauth and bad secrets', () => {
    expect(() => parseOtpauthUri('https://example.com')).toThrow(/otpauth/i);
    expect(() => parseOtpauthUri('otpauth://totp/x?secret=not-base32!')).toThrow(/base32/i);
  });
  it('isValidBase32 distinguishes good/bad secrets', () => {
    expect(isValidBase32('JBSWY3DPEHPK3PXP')).toBe(true);
    // Lenient on case (real QR secrets vary) but rejects non-base32 chars/length.
    expect(isValidBase32('not_base32!')).toBe(false);
    expect(isValidBase32('0189')).toBe(false);
    expect(isValidBase32('123')).toBe(false);
  });
  it('build → parse round-trips', () => {
    const uri = buildOtpauthUri({ account: 'a@b.com', issuer: 'Acme', secret: 'JBSWY3DPEHPK3PXP' });
    const d = parseOtpauthUri(uri);
    expect(d.issuer).toBe('Acme');
    expect(d.secret).toBe('JBSWY3DPEHPK3PXP');
  });
});

describe('passwordBreach: k-anonymity', () => {
  it('SHA-1 matches the known vector for "password"', async () => {
    expect(await sha1Hex('password')).toBe('5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8');
  });
  it('splits into HIBP prefix/suffix', async () => {
    const { prefix, suffix } = await pwnedRange('password');
    expect(prefix).toBe('5BAA6');
    expect(suffix).toBe('1E4C9B93F3F0682250B6CF8331B7EE68FD8');
  });
  it('counts a matching suffix from a range body', () => {
    const body = 'FFFFF:1\n1E4C9B93F3F0682250B6CF8331B7EE68FD8:3730471\nAAAAA:2';
    expect(countFromRangeBody('1E4C9B93F3F0682250B6CF8331B7EE68FD8', body)).toBe(3730471);
    expect(countFromRangeBody('DEADBEEF', body)).toBe(0);
  });
  it('only sends the prefix (k-anonymity) and reports pwned', async () => {
    let requestedUrl = '';
    const fakeFetch = async (url) => {
      requestedUrl = url;
      return { ok: true, text: async () => '1E4C9B93F3F0682250B6CF8331B7EE68FD8:9\nXXXX:1' };
    };
    const res = await checkPasswordPwned('password', { fetchImpl: fakeFetch });
    // Only the 5-char prefix is sent; the suffix/full hash must NOT leave.
    expect(requestedUrl).toBe('https://api.pwnedpasswords.com/range/5BAA6');
    expect(requestedUrl).not.toContain('1E4C9B93F3F0682250B6CF8331B7EE68FD8');
    expect(requestedUrl).not.toContain('5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8');
    expect(res).toEqual({ pwned: true, count: 9 });
  });
});
