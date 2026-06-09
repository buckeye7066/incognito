# Entity Encryption Decisions (private-family build)

Every entity added to `ENTITY_NAMES` in `src/api/client.js` must have a
deliberate encryption decision. Sensitive fields are listed in
`SENSITIVE_ENTITY_FIELDS` (encrypt-on-write, redact-on-locked-read). Everything
else is plaintext **on purpose** — usually because the field is non-sensitive
metadata, or must stay queryable for matching/grouping.

> Reviewed for the security-hardening pass. Pre-existing entities (Profile,
> PasswordEntry, TOTPSecret, VirtualCard, FinancialAccount, etc.) were decided
> in the original build and are documented in `docs/THREAT_MODEL.md`.

| Entity | Encrypted fields | Plaintext (deliberate) | Rationale |
|---|---|---|---|
| `Household` | — | `name` | Household label; non-sensitive. |
| `HouseholdMember` | `date_of_birth`, `ssn`, `notes` | `display_name`, `role`, `email`, `phone` | DOB/SSN/notes are high-value (esp. children). Name/role group the UI; email/phone are kept queryable (and are the member's own contact info). |
| `EmergencyAccessGrant` | — | `member_id`, `status`, timestamps | Workflow metadata only; no secret content. |
| `SharedVaultItem` | `payload` | `to_member_id`, `status`, `expires_at` | The payload **is** the shared secret → encrypted. Status/expiry drive revocation logic and must be readable when locked. |
| `PrivacyTask` | `encrypted_payload` | `type`, `title`, `status`, `provider_id`, `*_summary`, `last_error` | Sensitive task input (e.g. the address used to file an opt-out) is encrypted; the rest must stay queryable for the queue UI. Summaries are intentionally non-sensitive. |
| `EvidenceItem` | `screenshot_data_url`, `notes` | `source_url`, `title`, `hash`, `redacted_text` | A screenshot/free-text note can embed PII → encrypted. `redacted_text` is the **already-redacted** safe summary, deliberately readable when locked. |
| `DataBroker` | — | all | Public broker directory data (name/domains/opt-out URL). Not user PII. |
| `IdentityMessage` | `subject`, `body` | `thread_id`, `from`, `received_at` | Alias inbox message content can be anything → encrypted. Envelope is routing metadata. |
| `IdentityMessageThread` | `subject`, `snippet` | `alias_id`, `participants`, counts | Subject/preview are derived from message content → encrypted. |
| `TrustedContact` | — | `name`, `phone` | Phone must stay plaintext for Call Guard **matching** (can't match on an encrypted value). The user's own contact list; documented residual. |
| `BlockedContact` | — | `name`, `phone` | Same as TrustedContact — plaintext phone is required for blocklist matching. |
| `CallGuardRule` | — | rule config | Rule logic/thresholds; no secret content. |
| `VirtualCardTransaction` | — | `merchant`, `amount`, `date`, `last4`, `status` | Transaction metadata; the full card number/CVV live (encrypted) on `VirtualCard`, never here. |
| `DarkWebAlert` | — | `source_name`, `exposed_fields`, `severity`, dates | Alert metadata about a breach — not the raw leaked secret. |
| `IdentityTheftIncident` | `notes`, `details` | `type`, `status`, dates | Incident narrative can contain full PII → encrypted. Type/status drive the checklist UI. |
| `RecoveryChecklistItem` | — | `step`, `status`, `done_at` | Checklist progress; no secret content. |
| `RecoveryPacket` | `content` | `kind`, `created_at` | Generated packet (police/attorney/insurance) embeds full PII → encrypted. |
| `ProviderConnection` | — | `provider_id`, `status`, `last_used` | Status/metadata ONLY. Provider **secrets** live in the encrypted `incognito_api_keys_enc_v1` blob, never duplicated here. |
| `CapabilityStatusRecord` | — | capability/status cache | Derived status cache; no PII. |

## Residual risks (documented, accepted for v1)

- `TrustedContact` / `BlockedContact` phone numbers are plaintext because Call
  Guard must match against them. This is a deliberate trade-off; a future
  blind-index scheme (HMAC of the number) could remove it.
- `HouseholdMember.email` / `phone` are plaintext (member's own contact info,
  used for matching/aliasing). DOB/SSN/notes — the high-value fields — are
  encrypted.
- Subjects/envelopes for messages are retained as routing metadata; run the
  optional backend in `encrypted` mode if even subjects are sensitive to you.
