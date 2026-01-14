# Incognito

Incognito is a Base44 + Vite + React app focused on **identity theft monitoring**, **data broker removal workflows**, and **evidence-grade exports**. This repo adds a dedicated **legal branch** for discovery + filing guidance with strict anti-fabrication constraints.

## Quickstart

```bash
npm install
npm run dev
```

## Key modules

- **Identity workflows**: vault (`PersonalData`), scans (`ScanResult`), impersonation findings (`SocialMediaFinding`), deletion/removal tasks (`DeletionRequest`, `ExposureFixLog`).
- **Legal branch**:
  - **Case discovery**: `legalDiscoverCases` only returns cases when required fields can be extracted from **user-provided source URLs**.
  - **Filing guidance**: `legalGenerateFilingGuidance` generates options + reasoning with citations and “needs attorney review” disclaimers.
  - **Legal Intake Packet**: `generateLegalIntakePacket` exports a timeline plus hashed evidence items.

## Testing

```bash
npm test
```

## Security / privacy

See `SECURITY.md` and `PRIVACY.md`.
