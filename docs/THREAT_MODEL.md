# Incognito — Threat Model

**Version:** 1.0
**Status:** Authoritative for v1 release
**Audience:** engineering, security review

---

## 1. Product mode

Incognito is a **local-first encrypted vault**. It runs entirely in the user's
browser and persists state to `localStorage` and `IndexedDB` on the same
device. There is no Incognito-operated backend, no server-side session, no
multi-tenant API.

- **Trust boundary:** the user's device. Any attacker who controls the device
  while the vault is unlocked has full access. We do not promise protection
  against malware running on the same machine.
- **Multi-user model:** none cryptographically. The "user" is whoever holds the
  master password. The private-family build (see
  `docs/FAMILY_PRIVATE_BUILD_AUDIT.md`) adds **household members and roles**
  (owner/spouse/adult/child/dependent/emergency_contact), but these are
  **grouping and workflow only** — every member's secrets are protected by the
  **same** vault key. A "child" role is *not* a technical barrier against
  reading an "owner" secret on an unlocked device. Per-member key separation is
  a future, explicitly-scoped change; until it ships, the UI must not imply
  otherwise.
- **Offline:** all primary features work offline. External scans (HIBP,
  LeakCheck, Hunter, Privacy.com, Google Custom Search, OpenAI, NumVerify) are
  optional and require explicit per-provider, per-data-type consent.

This document supersedes any earlier "admin role" implementation. There is no
remote authority that could enforce client-side roles, so we removed the
default `role: 'admin'` flag and replaced it with an opt-in **Developer
Mode** used solely to gate diagnostic UI (see `src/lib/AdminRoute.jsx`).

---

## 2. Assets

| Asset | Sensitivity | Storage |
|---|---|---|
| Master password | Highest | Never persisted |
| Vault key (derived) | Highest | In-memory only |
| Passwords (`PasswordEntry`) | High | Encrypted-at-rest |
| TOTP secrets (`TOTPSecret`) | High | Encrypted-at-rest |
| SSN / passport / DL / tax ID (`CloakedIdentity`) | High | Encrypted-at-rest |
| Card numbers / CVV (`VirtualCard`) | High | Encrypted-at-rest |
| Bank account / routing (`FinancialAccount`) | High | Encrypted-at-rest |
| Email aliases (real address) (`EmailAlias`) | Medium-High | Encrypted-at-rest |
| Phone aliases (real number) (`PhoneAlias`) | Medium-High | Encrypted-at-rest |
| Personal data values (`PersonalData.value`) | High | Encrypted-at-rest |
| Profile metadata (name, label) | Medium | Plaintext (display) |
| Scan results, audit log | Medium | Plaintext (no raw secrets) |
| Third-party API keys | High | Encrypted-at-rest |
| External-scan consent ledger | Low | Plaintext |
| Household member DOB / SSN / notes (`HouseholdMember`) | High | Encrypted-at-rest |
| Task payloads (`PrivacyTask.encrypted_payload`) | High | Encrypted-at-rest |
| Evidence screenshots / notes (`EvidenceItem`) | High | Encrypted-at-rest |
| Shared item payload (`SharedVaultItem.payload`) | High | Encrypted-at-rest |
| Alias message subject/body (`IdentityMessage`) | High | Encrypted-at-rest |
| Recovery packet content / incident notes | High | Encrypted-at-rest |

---

## 3. Adversaries (in scope)

1. **Casual local attacker.** Has temporary physical access to the device but
   does not know the master password.
   - Mitigation: the vault is locked by default. Sensitive entity values are
     encrypted-at-rest and not retrievable without the master password. UI
     for sensitive entities returns redacted placeholders when locked.
2. **Local backup theft / disk forensics.** Adversary obtains a copy of
   `localStorage` / `IndexedDB`.
   - Mitigation: same as (1) — only ciphertext + per-vault salt + verifier
     are written to storage. Encryption is AES-256-GCM with a per-record IV.
3. **Network adversary on the same Wi-Fi.** Can observe outbound traffic.
   - Mitigation: all third-party API calls are HTTPS. NumVerify was migrated
     from `http://` to `https://` in this release. External calls only fire
     after explicit user consent (`requireConsent` in `src/lib/consent.js`).
4. **Hostile third-party API.** A scan provider attempts to harvest more
   data than the user authorized.
   - Mitigation: the consent system is opt-in per provider AND per data
     type. Only the explicitly granted data type is sent.
5. **Cross-site script injection in our own UI.** Defense-in-depth assumed
   imperfect; a successful XSS would have access to the unlocked vault.
   - Mitigation: React escapes by default; the build uses Vite which avoids
     `eval`; we do not use `dangerouslySetInnerHTML` on untrusted input.
     Auto-lock after inactivity bounds the exposure window.

---

## 4. Adversaries (out of scope)

- **Malware / keylogger on the same OS user account.** Cannot be defended
  against by an in-browser app. Documented in `docs/SECURITY.md`.
- **Compromised browser extension with `<all_urls>` permission.** Same
  category — no in-browser app can defend against this.
- **Targeted attacker with both physical access and the master password.**
  By definition the protection model breaks at this point.

---

## 5. Cryptographic design

- **KDF:** PBKDF2-HMAC-SHA-256, **310,000 iterations** (OWASP 2023 floor).
  Per-vault random 16-byte salt.
- **Cipher:** AES-256-GCM. Per-record random 12-byte IV.
- **Verifier:** an encrypted constant string (`incognito_vault_verifier_v1`).
  Lets us detect wrong passwords cleanly during unlock without writing a
  password hash to disk.
- **Master password:** never persisted. Stored only as the in-memory derived
  key. Auto-locked after configurable inactivity (default 10 min).
- **No bespoke crypto.** All primitives are WebCrypto (`crypto.subtle`).

See `src/lib/vault.js` and `src/__tests__/vault.test.js`.

---

## 6. Migration from legacy plaintext

Earlier builds wrote sensitive entity values as plaintext to `localStorage`.
On the first unlock after upgrade, `migrateLegacyPlaintext()` (exported from
`src/api/client.js`) walks each sensitive entity store and re-encrypts every
record with the active vault key. The legacy plaintext API key blob
(`incognito_api_keys`) is removed in the same step.

The migration is idempotent — already-encrypted records are detected via the
ciphertext envelope shape (`{ v: 1, iv, ct }`) and skipped.

---

## 7. Known residual risks

- The vault key lives in JS memory while unlocked. Browser memory is not a
  hardened TEE.
- Auto-lock on inactivity uses `setTimeout` and is best-effort if the tab is
  suspended.
- The default vault inactivity timeout is 10 minutes. Users with stricter
  needs should change it from Settings.
- Migration cannot recover plaintext that was overwritten or removed before
  the user upgraded — it can only encrypt what is currently present.
