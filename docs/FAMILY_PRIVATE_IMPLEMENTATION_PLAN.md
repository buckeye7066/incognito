# Incognito — Private Family Implementation Plan

This is the build map for turning Incognito into a **private family privacy
command center** with honest Cloaked parity, preserving the local-first
encrypted vault. Scope guardrails: no billing, no public signup, no enterprise
RBAC, no marketing/insurance claims, no fabricated provider results.

Each pass is independently shippable and must end green on `npm run release:check`.

## Pass 1 — Foundation ✅ (this commit)
- Audit + plan + capabilities + provider-setup docs.
- Capability/status model (`src/providers/capabilities.js`).
- Provider registry (`src/providers/**`) over the existing consent-gated
  client functions.
- Durable task queue entity `PrivacyTask` + evidence entity `EvidenceItem`.
- Household data model entities (`Household`, `HouseholdMember`,
  `EmergencyAccessGrant`, `SharedVaultItem`) with sensitive fields registered.
- Bridge contracts (`extensionBridge.js`, `nativeBridge.js`).
- Tests: pure capability logic, registry status, new-entity encryption/redaction.

## Pass 2 — Settings & capability surfacing
- Provider setup cards (key entry → encrypted) + **Test connection**.
- Consent review + revoke; audit-log viewer.
- A reusable `CapabilityBadge` + `useCapabilities()` hook reading the registry.
- Capability panel on Settings, Dashboard, and System Self-Check.

## Pass 3 — Household / family
- Family dashboard; member CRUD; per-member privacy score.
- Emergency access request/approve; revocable + expiring shared items.
- Access audit for shared secrets. (Roles = grouping until per-member keys.)

## Pass 4 — Cloaked Identities (one-click bundle)
- Create identity → username + password (+ alias/phone/card/TOTP when provider
  ready, else clearly-labelled local placeholder).
- Identity detail drawer; health (weak/reused/breached/no-2FA/exposed); actions.

## Pass 5 — Email aliases + inbox architecture
- SimpleLogin + addy providers; create/list/enable/disable/delete; rules.
- Dedicated inbox/compose only where provider/backend supports; else
  "receive/forward only".

## Pass 6 — Phone aliases + optional Twilio backend
- Search/purchase/release/forward; SMS send; inbox/call-logs via backend webhook.
- Monthly cost estimate; compliance limitations surfaced.

## Pass 7 — Password manager + TOTP hardening
- CSV import (Chrome/Bitwarden/1Password/LastPass/Dashlane/Keeper/generic) with
  preview + duplicate detection; folders/tags; history; HIBP k-anonymity.
- otpauth URI + QR import; recovery-code encryption; TOTP tests.

## Pass 8 — Browser-extension bridge
- Finalize protocol + a minimal reference extension (separate, optional).

## Pass 9 — Cloaked Pay / virtual cards
- Privacy.com create/pause/close/limit/merchant-lock/single-use/recurring;
  transaction sync; subscription detection; alerts.

## Pass 10 — Broker scan/removal + Google removal
- Curated broker directory (import/update); campaigns + task state machine;
  evidence capture; rescan/reappearance; guided Google removal.

## Pass 11 — Dark-web / SSN monitoring
- HIBP + LeakCheck providers; scheduled re-checks (local scheduler/backend);
  alert + response checklists; SSN last-4 default, full SSN encrypted.

## Pass 12 — Call Guard
- Trusted/blocked contacts; rules; provider/backend-aware UI ("risk lookup
  only" vs real screening); call logs + notifications.

## Pass 13 — VPN
- Config import/encrypt/export; native bridge connect/disconnect; IP/WebRTC/DNS
  leak checks; never claim "connected" without the bridge.

## Pass 14 — Recovery center + reports
- Incidents, checklists, packets (recovery/attorney/police/insurance-if-configured);
  household + per-member privacy reports.

## Pass 15 — AI assistant
- Redaction layer + per-call data preview + consent; approval queue for
  suggested local tasks; never auto-acts; never sends restricted data.

## Pass 16 — Dashboard polish, reports, a11y, test hardening
- Final command-center UX; "what was/ wasn't scanned, by which provider";
  accessibility pass; broaden tests; `release:check` green.

## Definition of done (whole project)
Local-first default; family-optimized; existing features intact; sensitive data
encrypted; locked vault redacts; provider features honest about requirements; no
fake production features; household/sharing/emergency exist; Cloaked categories
represented honestly; `release:check` passes; docs explain setup/limits/backup.
