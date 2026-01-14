/**
 * PII redaction utilities for logs (NOT for user-facing UI).
 * Goal: never emit raw emails/phones/addresses into server logs.
 */

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// Very loose phone matcher; we only use it to redact in logs.
const PHONE_RE = /(\+?\d{1,3}[\s-]?)?(\(?\d{3}\)?[\s-]?)\d{3}[\s-]?\d{4}/g;

export function redactEmail(email: string) {
  if (!email) return '[redacted]';
  const s = String(email);
  const at = s.indexOf('@');
  if (at <= 0) return '[redacted-email]';
  const local = s.slice(0, at);
  const domain = s.slice(at + 1);
  const localKeep = local.slice(0, 2);
  return `${localKeep}***@${domain}`;
}

export function redactPhone(phone: string) {
  if (!phone) return '[redacted]';
  const digits = String(phone).replace(/[^\d]/g, '');
  if (digits.length < 7) return '[redacted-phone]';
  const last4 = digits.slice(-4);
  return `***-***-${last4}`;
}

export function redactAddress(addr: string) {
  if (!addr) return '[redacted]';
  // Conservative: remove street number; leave the rest.
  return String(addr).replace(/^\s*\d+\s+/, '*** ');
}

export function redactFreeformPII(text: string) {
  if (!text) return '';
  return String(text)
    .replace(EMAIL_RE, (m) => redactEmail(m))
    .replace(PHONE_RE, (m) => redactPhone(m));
}

export function redactForLog(value: unknown) {
  if (value === null || value === undefined) return String(value);
  const s = String(value);
  // If it's an email, redact as email.
  if (EMAIL_RE.test(s)) {
    EMAIL_RE.lastIndex = 0;
    return redactFreeformPII(s);
  }
  // If it looks like a phone, redact as phone.
  if (PHONE_RE.test(s)) {
    PHONE_RE.lastIndex = 0;
    return redactFreeformPII(s);
  }
  // Otherwise, return a bounded string to avoid dumping huge payloads.
  return s.length > 120 ? `${s.slice(0, 117)}...` : s;
}
