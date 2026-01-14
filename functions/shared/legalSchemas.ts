import { z } from 'npm:zod@3.24.2';

export const LegalCaseCandidateSchema = z
  .object({
    case_name: z.string().min(1),
    court: z.string().min(1),
    case_number: z.string().min(1),
    filing_date: z.string().min(1), // YYYY-MM-DD or ISO string (source-dependent)
    defendant: z.string().min(1),
    status: z.string().min(1),
    source_url: z.string().url(),
    retrieved_at: z.string().min(1)
  })
  .strict();

export type LegalCaseCandidate = z.infer<typeof LegalCaseCandidateSchema>;

export const LegalCaseDiscoveryRequestSchema = z
  .object({
    sourceUrls: z.array(z.string().url()).min(1)
  })
  .strict();

export const FilingGuidanceRequestSchema = z
  .object({
    profileId: z.string().min(1),
    // Optional: user-provided context (kept minimal — do not require PII)
    incidentSummary: z.string().optional(),
    jurisdictionHint: z.string().optional()
  })
  .strict();

