# Security Backlog

Tracked, deliberately-deferred security improvements. Each is an accepted v1
residual risk documented elsewhere (`THREAT_MODEL.md`,
`ENTITY_ENCRYPTION_DECISIONS.md`) and surfaced here so it isn't forgotten.

## SB-1 — Encrypted or redacted email subjects (optional backend)

**Status:** open · **Severity:** low–medium · **Area:** `server/`

Inbound email **bodies** are protected by the storage policy (default
metadata-only; opt-in `encrypted`). **Subjects** and the envelope (`from`/`to`/
`alias`) are still retained as routing metadata, even in `metadata` mode. A
subject line can carry sensitive content ("Your lab results", "Divorce filing").

**Proposed fix:** route the subject through the same `bodyFields` policy (so
`metadata` keeps only a subject length / redacted preview, and `encrypted`
stores `subject_enc`). Optionally run the frontend redaction patterns over the
subject before storage. Add tests proving subjects aren't persisted in plaintext
under `metadata` mode.

Code anchor: `server/src/emailWebhook.js` (`emailToEvent`), `TODO(security): SB-1`.

## SB-2 — HMAC / blind-index matching for contact phone numbers

**Status:** open · **Severity:** low–medium · **Area:** `src/api/client.js`

`TrustedContact` and `BlockedContact` store phone numbers in **plaintext**
because Call Guard must match an incoming number against the lists, and you
can't equality-match on per-record-IV ciphertext. A stolen
`incognito_entity_TrustedContact` blob therefore reveals the family's contacts.

**Proposed fix:** store a **blind index** instead of the raw number — e.g.
`phone_bi = HMAC-SHA256(vaultDerivedMatchKey, normalize(phone))` — and match on
that. Matching stays O(1) and exact, but a stolen blob is just opaque HMACs.
Keep the displayable number encrypted (a new sensitive field) and decrypt only
for the UI when unlocked. Derive the match key from the vault (separate from the
record-encryption key). Add tests: same number → same index; blob contains no
raw phone; match still works.

Code anchor: `src/api/client.js` `SENSITIVE_ENTITY_FIELDS` (TrustedContact /
BlockedContact), `TODO(security): SB-2`.

## SB-3 — Redaction recall (LLM path)

**Status:** open · **Severity:** low · **Area:** `src/lib/aiRedaction.js`

Pattern-based redaction is recall-limited (spelled-out SSNs, intl phone/address
formats, names not in the household list). It is defense-in-depth, not a
guarantee. Consider: per-feature structured prompt builders (only known-safe
fields), and a user-visible preview-before-send in the assistant UI.

## SB-4 — react-router moderate advisories

**Status:** open · **Severity:** moderate · **Area:** deps

`npm audit` reports 2 moderate react-router advisories; `npm audit fix` resolves
them. Deferred out of the hardening PR to keep the diff focused.
