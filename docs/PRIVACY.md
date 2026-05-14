# Privacy Notice — Incognito

**Effective date:** 2026-05-13

## Summary

Incognito is a local-first privacy app. Your data lives on your device, in
your browser. We do not operate a backend, we do not have an account
system, and we do not run analytics on your usage.

## What we store on your device

| Category | Where | Form |
|---|---|---|
| Profile metadata (display names, labels) | `localStorage` | Plaintext |
| Sensitive vault records (passwords, TOTP, SSN, cards, bank, real email/phone) | `localStorage` | **Encrypted** with your master password |
| Third-party API keys | `localStorage` | **Encrypted** with your master password |
| External-scan consent decisions | `localStorage` | Plaintext (no PII) |
| Audit log of external scans | `localStorage` | Plaintext metadata only — no full secret values |

## What we send off-device

By default: **nothing**.

The app integrates with optional third-party providers (Have I Been Pwned,
LeakCheck, Hunter.io, Privacy.com, Google Custom Search, NumVerify, OpenAI).
Each provider must be:

1. enabled by you in **Settings → Privacy → External Scans**, AND
2. consented for each specific data type that will be sent (e.g. "send
   emails to HIBP").

If either is missing, the call is short-circuited and no data leaves your
device. See `src/lib/consent.js`.

## What we do not store

- Your master password.
- Plaintext copies of password / TOTP / SSN / bank / card values once the
  vault is initialized.
- Any analytics, telemetry, crash reports, or tracking IDs.

## Cookies and tracking

Incognito sets **no** cookies. It does not load Google Analytics, Sentry,
or any third-party telemetry SDK.

## Data retention

Data is retained on your device until you delete it. Uninstalling the
browser, clearing site data, or destroying the vault from Settings will
remove it.

## Your rights

You can export, edit, or delete any data on your device at any time. If
you revoke a third-party provider in Settings, all future calls to that
provider stop immediately.

## Contact

Open an issue on GitHub or use the contact information in `package.json`.
