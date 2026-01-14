# Security

## Non-negotiable invariants

- **No raw payment card data**: no endpoint may return **PAN** or **CVV** to the client. Virtual card responses must be **masked-only**.
- **PII-safe logging**: server logs must not include raw emails/phones/addresses. Use redaction utilities (`functions/shared/redact.ts`) before logging user identifiers.
- **Audit-friendly lifecycle**: disposable credentials (e.g., email aliases) must support **revoke/deactivate** rather than destructive deletion where possible.
- **No fabrication**: any “legal discovery” that references cases must be **source-backed**. If required fields cannot be extracted from real sources, return empty results.

## Redaction

Do not log raw:
- Email addresses
- Phone numbers
- Physical addresses
- Full names (prefer minimization)

Use:
- `functions/shared/redact.ts` (`redactForLog`, `redactEmail`, `redactPhone`)

## Evidence integrity

When exporting evidence-grade artifacts (e.g., legal intake packet), evidence items must include:
- `source_url`
- `captured_at`
- `sha256`
- `retrieval` metadata (`retrieved_at`, `method`, etc.)

See:
- `functions/shared/evidence.ts`

