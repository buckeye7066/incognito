/**
 * Email alias inbound webhook helpers (shared-secret authenticated).
 *
 * Alias providers (or a mail forwarder) POST inbound-email events here. We keep
 * only minimal metadata; bodies should be sent already-redacted or stored as an
 * encrypted opaque blob the client decrypts.
 */
import crypto from 'node:crypto';

export function verifyEmailWebhook(provided, expected) {
  if (!expected || !provided) return false;
  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(expected));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function emailToEvent(params) {
  return {
    type: 'email_inbound',
    alias: params.alias || params.to || '',
    from: params.from || '',
    subject: params.subject || '',
    received_at: new Date().toISOString(),
  };
}
