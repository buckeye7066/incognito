# Family Operations Guide

How one household actually runs Incognito day to day.

## Roles (what they mean — and don't)

| Role | Typical use |
|---|---|
| `owner` | You — sets up the vault, providers, backups. |
| `spouse` | Adult with broad shared access (explicitly granted). |
| `adult` | Adult dependent managing their own items. |
| `child` / `dependent` | Profiles you manage on their behalf (extra care with DOB/SSN). |
| `emergency_contact` | Can request emergency access; approved per your workflow. |

> **Honesty:** roles are **grouping + workflow**, not cryptographic walls. Every
> member's secrets use the **same** vault key on an unlocked device. Don't treat
> "child" as a technical barrier. Per-member key separation is a future scoped
> change (see [THREAT_MODEL.md](./THREAT_MODEL.md)).

## Recommended routine

- **Weekly:** check the Dashboard — new breach/dark-web alerts, broker-removal
  tasks needing action, password health, capability/provider warnings.
- **Monthly:** make an encrypted backup; review the consent ledger + audit log;
  rescan brokers for reappearance.
- **On a breach alert:** open the response checklist (password reset → MFA →
  credit freeze / fraud alert → bank/card monitoring → IRS IP PIN guidance).
- **On a new account:** create a Cloaked Identity (alias + password + TOTP, plus
  phone/card where providers are configured).

## Emergency access

If something happens to the owner, the emergency contact requests access; the
approval workflow (and recorded master-password copy from
[BACKUP_AND_RECOVERY.md](./BACKUP_AND_RECOVERY.md)) lets the household recover.
Shared items can be made **revocable** and **expiring**.

## Children & dependents

- Prefer last-4 SSN display; store full SSN only if necessary (it's encrypted).
- Keep a per-child privacy checklist (credit freeze for minors is high value).
- Never send a child's sensitive data to the AI assistant.
