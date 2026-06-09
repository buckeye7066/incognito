/**
 * Event-storage privacy policy for the optional backend.
 *
 * Inbound SMS/email BODIES are sensitive. By default we DO NOT persist them at
 * all — only metadata (envelope + a length). The household can opt into either:
 *   - 'metadata'  (default): store only body_len, never the content
 *   - 'encrypted': store an opaque AES-256-GCM blob (needs MESSAGE_ENCRYPTION_KEY)
 *   - 'plaintext': explicit, discouraged — stores the raw body
 *
 * This guarantees a stolen events.json never reveals message contents unless the
 * operator explicitly chose plaintext, or also stole the encryption key.
 */
import crypto from 'node:crypto';

export const STORE_MODES = ['metadata', 'encrypted', 'plaintext'];

/**
 * Build an encryptor from a key (hex/base64/utf8). Returns null if no usable
 * key, so 'encrypted' mode safely falls back to metadata-only rather than
 * storing plaintext.
 */
export function makeEncryptor(rawKey) {
  if (!rawKey) return null;
  let key;
  try {
    key = /^[0-9a-fA-F]{64}$/.test(rawKey)
      ? Buffer.from(rawKey, 'hex')
      : crypto.createHash('sha256').update(String(rawKey)).digest(); // derive 32 bytes
  } catch { return null; }
  return function encrypt(plaintext) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { v: 1, alg: 'aes-256-gcm', iv: iv.toString('hex'), tag: tag.toString('hex'), ct: ct.toString('hex') };
  };
}

/**
 * Return the body-related fields to merge into a stored event, per policy.
 * @param {string} body
 * @param {{ mode?: string, encrypt?: (s:string)=>object|null }} opts
 */
export function bodyFields(body, { mode = 'metadata', encrypt = null } = {}) {
  if (body == null || body === '') return {};
  if (mode === 'plaintext') return { body };
  if (mode === 'encrypted' && typeof encrypt === 'function') {
    return { body_enc: encrypt(body) };
  }
  // default / fallback: metadata only — never the content.
  return { body_len: String(body).length };
}
