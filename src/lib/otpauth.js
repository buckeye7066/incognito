/**
 * otpauth:// URI parsing + validation for the TOTP authenticator.
 *
 * Lets the user import a 2FA secret by pasting the otpauth URI (or scanning a
 * QR that decodes to one). Pure + dependency-free; the actual code generation
 * already lives in src/api/client.js (generateTOTP).
 *
 * Format: otpauth://totp/LABEL?secret=BASE32&issuer=...&algorithm=...&digits=...&period=...
 */

const BASE32 = /^[A-Z2-7]+=*$/;

/** Is `s` a syntactically valid base32 secret (RFC 4648, no lowercase)? */
export function isValidBase32(s) {
  if (!s || typeof s !== 'string') return false;
  const cleaned = s.replace(/\s/g, '').toUpperCase();
  return cleaned.length >= 8 && BASE32.test(cleaned);
}

/**
 * Parse an otpauth URI into a normalized descriptor.
 * @throws if the URI is not a valid otpauth totp/hotp URI or the secret is bad.
 * @returns {{ type, label, issuer, secret, algorithm, digits, period, counter? }}
 */
export function parseOtpauthUri(uri) {
  if (typeof uri !== 'string' || !uri.toLowerCase().startsWith('otpauth://')) {
    throw new Error('Not an otpauth:// URI');
  }
  let parsed;
  try { parsed = new URL(uri); } catch { throw new Error('Malformed otpauth URI'); }

  const type = parsed.host.toLowerCase(); // 'totp' | 'hotp'
  if (type !== 'totp' && type !== 'hotp') {
    throw new Error(`Unsupported otpauth type: ${type}`);
  }

  // Label is the path, percent-decoded; may be "Issuer:account".
  const rawLabel = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  const params = parsed.searchParams;

  const secret = (params.get('secret') || '').replace(/\s/g, '').toUpperCase();
  if (!isValidBase32(secret)) {
    throw new Error('Missing or invalid base32 secret');
  }

  let issuer = params.get('issuer') || '';
  let account = rawLabel;
  if (rawLabel.includes(':')) {
    const [iss, ...rest] = rawLabel.split(':');
    if (!issuer) issuer = iss.trim();
    account = rest.join(':').trim();
  }

  const digits = clampInt(params.get('digits'), 6, 6, 8);
  const period = clampInt(params.get('period'), 30, 10, 120);
  const algorithm = (params.get('algorithm') || 'SHA1').toUpperCase();

  const out = { type, label: rawLabel, account, issuer, secret, algorithm, digits, period };
  if (type === 'hotp') out.counter = clampInt(params.get('counter'), 0, 0, Number.MAX_SAFE_INTEGER);
  return out;
}

function clampInt(v, dflt, min, max) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return dflt;
  return Math.max(min, Math.min(max, n));
}

/** Build an otpauth URI from a descriptor (for export / QR generation). */
export function buildOtpauthUri({ type = 'totp', account = '', issuer = '', secret, algorithm = 'SHA1', digits = 6, period = 30 }) {
  if (!isValidBase32(secret)) throw new Error('Invalid base32 secret');
  const label = issuer ? `${issuer}:${account}` : account;
  const p = new URLSearchParams({ secret: secret.toUpperCase(), algorithm, digits: String(digits), period: String(period) });
  if (issuer) p.set('issuer', issuer);
  return `otpauth://${type}/${encodeURIComponent(label)}?${p.toString()}`;
}
