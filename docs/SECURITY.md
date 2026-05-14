# Security Policy — Incognito

## Reporting a vulnerability

Please open a private GitHub Security Advisory on this repository, or email
the maintainers at the address listed in `package.json`. **Do not** open a
public issue for a suspected security problem.

We aim to acknowledge reports within 7 days and ship a fix or workaround
within 30 days, depending on severity and complexity.

## Supported versions

Only the latest `main` branch is supported. Security backports for older
tags are best-effort.

## What we promise

- All sensitive vault values (passwords, TOTP secrets, SSN, card numbers,
  bank info, real email/phone behind aliases, custom-field values) are
  encrypted at rest with the user's master password — see
  `docs/THREAT_MODEL.md`.
- The master password is never written to storage.
- Third-party API keys are encrypted at rest once the vault is initialized.
- External scans never run unless the user has explicitly enabled the
  provider AND consented to each data type sent. See
  `src/lib/consent.js`.
- All third-party API endpoints we call use HTTPS.
- The encryption stack is tested on every CI run; see
  `src/__tests__/vault.test.js`,
  `src/__tests__/consent.test.js`, and
  `src/__tests__/encryptedStorage.test.js`.

## What we cannot promise

- We cannot defend against malware or a hostile browser extension running
  in the same user account on the same device.
- We cannot recover data if the user forgets the master password — the key
  derivation is one-way by design.
- We cannot prevent users from disabling the vault, sharing their master
  password, or pasting secrets into other apps.

## Local-only operation

Incognito is a **local-first** application. It does not phone home. There
is no remote authority that can revoke access, push updates outside the
normal install flow, or recover lost data. Users are responsible for
backups; an exported backup is itself sensitive and should be stored
encrypted.

## Cryptographic primitives

- KDF: PBKDF2-HMAC-SHA-256, 310,000 iterations.
- Cipher: AES-256-GCM with 96-bit random IV per record.
- Salt: 128-bit random per vault.
- All primitives via WebCrypto (`crypto.subtle`).

## Disclosure timeline policy

We will publish a security advisory after a fix has been released, or after
90 days from the original report — whichever comes first.
