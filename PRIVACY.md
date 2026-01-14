# Privacy

## Data minimization principles

- **Minimize**: only collect/store what’s needed for the workflow.
- **Avoid client-side PII→LLM**: do not send raw vault values to LLMs from the browser.
- **Prefer structured exports**: legal and evidence exports should prefer structured summaries + hashes over copying raw vault values.

## Vault handling

Vault items are stored under `PersonalData` and may include highly sensitive identifiers. UI masking is applied by default, but you should assume the backing store contains raw values.

## Logging

Logs are treated as **non-secure storage**. Never emit raw PII in logs.

## Legal module constraints (anti-hallucination)

- **No invented cases**: `legalDiscoverCases` only returns a `LegalCaseCandidate` when *all required fields* can be extracted from a real, user-provided source URL.
- **Filing guidance is informational**: `legalGenerateFilingGuidance` provides options and citations to public resources, and always includes **needs attorney review** disclaimers.

