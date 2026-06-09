/**
 * HIBP "Pwned Passwords" k-anonymity check.
 *
 * The password is NEVER sent. We SHA-1 it locally, send only the first 5 hex
 * chars of the hash to api.pwnedpasswords.com/range/{prefix}, and match the
 * remaining suffix against the returned list locally. This is the standard
 * k-anonymity model — the server never learns which password (or even which
 * full hash) was checked.
 *
 * Pure helpers are exported separately so they can be unit-tested without
 * network; checkPasswordPwned takes an injectable fetch for the same reason.
 */

/** SHA-1 hex (uppercase) of a string via WebCrypto. */
export async function sha1Hex(text) {
  const data = new TextEncoder().encode(String(text));
  const buf = await crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/** Split a password's SHA-1 into the {prefix (5), suffix (35)} used by HIBP. */
export async function pwnedRange(password) {
  const hash = await sha1Hex(password);
  return { prefix: hash.slice(0, 5), suffix: hash.slice(5), hash };
}

/**
 * Given the HIBP range response body (lines "SUFFIX:COUNT") and our suffix,
 * return how many times the password appears in breaches (0 = not found).
 */
export function countFromRangeBody(suffix, body) {
  if (!body) return 0;
  const target = String(suffix).toUpperCase();
  for (const line of body.split('\n')) {
    const [s, count] = line.trim().split(':');
    if (s && s.toUpperCase() === target) {
      const n = parseInt(count, 10);
      return Number.isNaN(n) ? 0 : n;
    }
  }
  return 0;
}

/**
 * Full check. Only the 5-char hash prefix leaves the device.
 * @param {string} password
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 * @returns {Promise<{ pwned: boolean, count: number }>}
 */
export async function checkPasswordPwned(password, { fetchImpl = fetch } = {}) {
  const { prefix, suffix } = await pwnedRange(password);
  const resp = await fetchImpl(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: { 'Add-Padding': 'true' },
  });
  if (!resp || !resp.ok) throw new Error(`Pwned Passwords request failed (${resp?.status})`);
  const body = await resp.text();
  const count = countFromRangeBody(suffix, body);
  return { pwned: count > 0, count };
}
