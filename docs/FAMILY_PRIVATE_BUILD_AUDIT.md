# Incognito — Private Family Build Audit

**Audience:** one private household (owner, spouse, children/dependents).
**Not** a public SaaS. No billing, no public signup, no multi-tenant backend, no
marketing or insurance-underwriting claims. See
[FAMILY_PRIVATE_IMPLEMENTATION_PLAN.md](./FAMILY_PRIVATE_IMPLEMENTATION_PLAN.md)
for the build order and [FEATURE_CAPABILITIES.md](./FEATURE_CAPABILITIES.md) for
the live capability/status vocabulary.

This audit answers, per feature: does it exist, is it partial or missing, what
does it require (provider / optional backend / browser extension / native
bridge / manual), what sensitive data it stores, and whether that data is
encrypted at rest.

## Legend

- **Status:** ✅ exists · 🟡 partial · ⛔ missing
- **Delivery:** `local` · `provider` · `backend` · `extension` · `native` ·
  `manual` · `mock`
- **Encrypted?** answers "is every sensitive field on this feature in the vault
  encryption/redaction registry (`SENSITIVE_ENTITY_FIELDS` in
  `src/api/client.js`)?"

## A. Foundation (already strong — preserve)

| Area | Status | Delivery | Sensitive data stored | Encrypted? |
|---|---|---|---|---|
| Local-first storage (localStorage + IndexedDB) | ✅ | local | all entities | n/a (per-field) |
| Encrypted vault (PBKDF2 310k + AES-256-GCM) | ✅ | local | derived key in memory only; master password never stored | ✅ |
| Sensitive-field registry (encrypt-on-write, redact-on-lock) | ✅ | local | password, totp, ssn, card, bank, forwarding email/phone, notes | ✅ |
| Consent ledger (`src/lib/consent.js`) | ✅ | local | provider/data-type decisions | n/a |
| External-call audit log (`src/lib/auditLog.js`) | ✅ | local | metadata only (never payloads) | n/a |
| Profiles | ✅ | local | profile PII | partial (per field) |
| API keys encrypted-at-rest + legacy plaintext migration | ✅ | local | provider secrets | ✅ |

## B. Cloaked-parity features

| Feature | Status | Delivery | Notes / honesty | Sensitive data | Encrypted? |
|---|---|---|---|---|---|
| Email aliases | 🟡 | provider / local-placeholder | Real via SimpleLogin/addy.io key; otherwise a clearly-labelled local placeholder. Send-as-alias is provider/plan-gated. | forwarding (`actual_email`) | ✅ |
| Phone aliases | 🟡 | provider (+backend) | Number search/purchase via Twilio. SMS inbox / call logs / live screening need the **optional backend** webhook. | forwarding (`actual_phone`) | ✅ |
| Call Guard | 🟡 | provider+backend / native | Today: risk lookup + logging. Real-time screen/block needs Twilio+backend or a native bridge. Must say "risk lookup only" otherwise. | caller numbers, transcripts | partial → harden |
| Password manager | ✅ | local | Strong. Add import (Chrome/Bitwarden/1P/LastPass/…), history, folders, HIBP k-anonymity. | password, totp, recovery, notes | ✅ |
| TOTP authenticator | ✅ | local | Real RFC-6238. Add otpauth URI + QR import, recovery-code encryption tests. | secret, recovery codes | ✅ |
| Cloaked Identities | 🟡 | local + provider | Exists; needs full one-click bundle linking password+alias+phone+card+TOTP and health scoring. | per linked item | ✅ (per item) |
| Virtual cards / Cloaked Pay | 🟡 | provider | Real via Privacy.com. No fabricated usable numbers; mock only in explicit demo mode. | card no/cvv/pin/billing | ✅ |
| Data-broker scan & removal | 🟡 | local + provider + manual | Directory + likelihood + campaigns exist. Removal is **guided/manual**; "removed" only when confirmed. No fabricated "removed". | member PII used to file | via PrivacyTask payload ✅ |
| Google search removal | ⛔ | manual | New guided workflow; never auto-submits. | result URLs, evidence | screenshot/notes ✅ |
| Dark-web / SSN monitoring | 🟡 | provider / local-breach-db | Local DB = breach_check, **not** live dark-web. Live needs LeakCheck/provider. SSN default last-4; full SSN encrypted. | email/phone/ssn/dob | ✅ |
| FTC Do-Not-Call / spam | 🟡 | manual | Track numbers + guided registration checklist. No fake "submitted to gov". | family phone numbers | plaintext (matching) — documented |
| VPN | 🟡 | local + native | Config manager + leak checker = local/ready. Connect = **native bridge** only; never claim "connected" without it. | WireGuard/OpenVPN configs | ✅ (config_data → add to registry, see gaps) |
| Identity-theft recovery | 🟡 | local + manual | Recovery center, not an insurance company. No "$1M covered" claim. Policy details encrypted only if user enters them. | incident notes, packets | ✅ |
| AI privacy assistant | 🟡 | provider | Redact-by-default, per-call preview + consent, proposes local tasks only, never auto-acts. | redacted summaries only | n/a (nothing secret sent) |
| Dashboard | 🟡 | local | Make it the family command center with per-member scores + capability/provider warnings. | aggregates | n/a |
| Settings | ✅ | local | Add household, provider setup + test, consent review, audit viewer, backup. | api keys | ✅ |

## C. Family/household features (mostly new)

| Feature | Status | Delivery | Sensitive data | Encrypted? |
|---|---|---|---|---|
| Household + members (owner/spouse/adult/child/dependent/emergency_contact) | 🟡 entities added | local | member DOB, SSN, notes | ✅ (`HouseholdMember`) |
| Per-member privacy score | ⛔ | local | aggregates | n/a |
| Child/dependent privacy checklist | ⛔ | local/manual | — | n/a |
| Shared vault items (spouse access) | 🟡 entity added | local | shared payload | ✅ (`SharedVaultItem.payload`) |
| Emergency access request/approval | 🟡 entity added | local | grant metadata | n/a |
| Revocable / expiring sharing | ⛔ | local | — | n/a |
| Access audit for shared secrets | 🟡 | local | metadata | n/a |

> **Honesty note on roles:** local UI roles (owner/spouse/child/…) are
> **grouping and workflow**, not cryptographic access control. Every member's
> secrets are protected by the **same** vault key. A separate per-member key
> hierarchy is a future, explicitly-scoped change; until then the UI must not
> imply that "child" cannot technically read "owner" secrets on the same
> unlocked device. Documented in
> [THREAT_MODEL.md](./THREAT_MODEL.md).

## D. Infrastructure added in this pass

| Component | Status | Purpose |
|---|---|---|
| Provider registry (`src/providers/`) | ✅ new | Declares each provider's capabilities, required secrets, consent data types, and backend/native/extension needs. |
| Capability/status model (`src/providers/capabilities.js`) | ✅ new | One honest vocabulary: ready / needs_provider / needs_backend / needs_native_bridge / needs_browser_extension / manual_only / mock_only / disabled / error. |
| `PrivacyTask` entity (durable task queue) | ✅ new | Broker removals, search removals, rescans, sync, checklists. Payload encrypted. |
| `EvidenceItem` entity | ✅ new | Broker findings, search results, breach alerts, recovery/legal packets. Screenshot+notes encrypted. |
| Extension bridge contract (`src/lib/extensionBridge.js`) | ✅ new | Honest autofill contract; rejects with `E_NO_EXTENSION` when absent. |
| Native bridge contract (`src/lib/nativeBridge.js`) | ✅ new | VPN connect / native commands; rejects with `E_NO_NATIVE_BRIDGE` when absent. |
| Optional backend (`server/`) | ⛔ planned | Twilio/email webhooks, scheduler. OFF by default; see [OPTIONAL_BACKEND.md](./OPTIONAL_BACKEND.md). |

## E. The 10 audit questions, summarized

1. **Exist:** vault, consent, audit, profiles, passwords, TOTP, identities,
   aliases, virtual-card concept, scan/removal, monitoring, VPN config, legal/
   recovery, dashboard, settings.
2. **Partial:** aliases (provider gap), phone/SMS/call (backend gap), Call Guard,
   identities bundle, virtual cards (provider), broker removal lifecycle,
   dark-web vs breach distinction, VPN connect, recovery, AI assistant
   redaction, dashboard command-center, household sharing lifecycle.
3. **Missing:** Google search removal workflow, per-member scoring, child
   checklist, revocable/expiring sharing UI, optional backend, CSV password
   import, otpauth/QR import, full capability surfacing in UI.
4. **Require a provider:** email aliases (SimpleLogin/addy), phone (Twilio),
   virtual cards (Privacy.com), exact breach (HIBP), dark-web (LeakCheck),
   discovery (Google CSE), AI (OpenAI-compatible).
5. **Require optional backend:** inbound SMS inbox, call logs, live call
   screening, scheduled monitoring/webhooks, multi-device sync.
6. **Require browser extension:** true autofill / save-on-signup / create-
   identity-from-signup-page.
7. **Require native/mobile bridge:** system VPN connect/disconnect, OS-level
   call blocking.
8. **Best handled manually for a family:** broker opt-outs without paid
   automation, Google result removal, FTC Do-Not-Call, police/FTC reports,
   credit freezes.
9. **Sensitive data per feature:** tabulated above.
10. **Every sensitive field encrypted?** Yes for all registered entities.
    Outstanding registry additions tracked in *Gaps* below.

## F. Gaps to close (tracked, not yet done)

- Add `VPNConfig.config_data`, `FinancialAccount` extras, and any new
  card/transaction fields to `SENSITIVE_ENTITY_FIELDS` as those passes land,
  each with a test (security rule #2).
- Implement per-member key separation **or** keep documenting roles as grouping.
- Replace any remaining mock/demo data on feature pages with explicit
  `mock_only` labelling driven by the provider registry.
