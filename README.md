# Incognito – Local‑first Privacy Vault

> 👋 **New here? Start with [WELCOME.md](./WELCOME.md)** — a plain‑language tour
> of what every part of the app does and how to get going in your first 10
> minutes. The rest of this file is for developers.

Incognito is a private, **local‑first** identity protection and digital
footprint management tool.  It runs entirely in the user's browser and
persists state to `localStorage` and `IndexedDB` on the same device.  There
is **no** Incognito‑hosted backend and no multi‑tenant API: all data
stays on your machine unless you explicitly consent to sending it to
third‑party services for scans.

## Private family build

Incognito is built for **one private household** (owner, spouse, children/
dependents) — not a public SaaS. There is no billing, no public signup, no
multi‑tenant backend, and no marketing or insurance claims. The goal is honest
Cloaked‑style parity on top of the local‑first encrypted vault, where every
feature clearly states whether it is local‑only, provider‑backed, optional‑
backend, native‑bridge, browser‑extension, manual, or demo/mock.

Start here:
- [docs/FAMILY_PRIVATE_BUILD_AUDIT.md](docs/FAMILY_PRIVATE_BUILD_AUDIT.md) — what exists / is partial / is missing, per feature.
- [docs/FAMILY_PRIVATE_IMPLEMENTATION_PLAN.md](docs/FAMILY_PRIVATE_IMPLEMENTATION_PLAN.md) — the build order.
- [docs/FEATURE_CAPABILITIES.md](docs/FEATURE_CAPABILITIES.md) — the capability/status vocabulary.
- [docs/PROVIDER_SETUP.md](docs/PROVIDER_SETUP.md) · [docs/OPTIONAL_BACKEND.md](docs/OPTIONAL_BACKEND.md) · [docs/BACKUP_AND_RECOVERY.md](docs/BACKUP_AND_RECOVERY.md) · [docs/FAMILY_OPERATIONS.md](docs/FAMILY_OPERATIONS.md)

## What this project does

Incognito encrypts sensitive records—passwords, TOTP secrets, SSNs,
passport numbers, virtual card details, bank account numbers, email
aliases, phone aliases, and custom identity fields—and stores them
in the browser.  It also keeps an audit log of outbound requests and
maintains a consent ledger so that only the data types you opt into
are sent to scan providers (e.g. Have I Been Pwned, LeakCheck, Hunter,
NumVerify, Privacy.com, Google Custom Search).  By default, the
application works **offline**; external calls are optional and
explicitly gated.

## Threat model summary

The full threat model is documented in `docs/THREAT_MODEL.md`.  Key
points for v1:

- **Local‑first:** the vault lives in the browser.  There is no server
  component, session, or multi‑user model.  The only trust boundary
  is the device itself.
- **Encryption at rest:** sensitive fields are encrypted using
  PBKDF2‑HMAC‑SHA‑256 (310k iterations) to derive a key from your
  master password and AES‑256‑GCM for record encryption.  A per‑record
  random IV and per‑vault random salt ensure that identical values
  never produce the same ciphertext【86134006127696†L89-L99】.
- **Master password never persisted:** it is used to derive the vault key
  in memory and is discarded after unlock.  The vault auto‑locks
  after a period of inactivity (configurable, default 10 minutes)
 【86134006127696†L120-L125】.
- **Locked reads redact:** when the vault is locked, only
  non‑sensitive metadata (e.g. record names) is returned.  Sensitive
  values remain encrypted and cannot be retrieved without the master
  password【86134006127696†L53-L61】.
- **Adversaries in scope:** casual local attackers without the master
  password, disk forensics of localStorage/IndexedDB, same‑Wi‑Fi
  eavesdroppers, hostile third‑party APIs, and cross‑site script
  injections are considered.  Mitigations include locked-by-default
  state, encrypted‑at‑rest storage, HTTPS for external calls, per-
  provider consent gating, React’s escaping of untrusted input, and
  auto‑lock on inactivity【86134006127696†L51-L75】.
- **Adversaries out of scope:** malware on the same machine,
  compromised browser extensions with `<all_urls>` permission, and
  attackers who know your master password are explicitly not
  mitigated【86134006127696†L78-L86】.

## Limitations and residual risks

Although the vault encrypts sensitive data and refuses to persist the
master password, it cannot defend against malware or keyloggers on
your device.  Browser memory is not a hardened enclave, and the
vault key remains in memory while unlocked【86134006127696†L118-L124】.  If
an attacker gains control of your browser while the vault is unlocked,
they can access its contents.  Auto‑lock mitigates this window, but
cannot eliminate it entirely.

Also note that earlier versions of Incognito stored some values as
plaintext in localStorage.  On the first unlock after upgrading to
v1, `migrateLegacyPlaintext()` re‑encrypts these values and removes
the legacy plaintext API key blob【86134006127696†L105-L115】.

## Developer notes

This project is intended as a starting point for a local‑first privacy
vault, **not** as a full password manager or enterprise secret
management solution.  Before deploying in a high‑risk environment,
perform a formal security review, add end‑to‑end tests for XSS and
unlock flows, and consider commissioning an external audit.  See
`docs/THREAT_MODEL.md` and `docs/SECURITY.md` for more detail on the
intended scope and security posture.
