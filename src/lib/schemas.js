import { z } from 'zod';

// Frontend-side validation only. Backend still enforces auth and will store data via Base44.

export const PersonalDataInputSchema = z
  .object({
    profile_id: z.string().min(1),
    data_type: z.string().min(1),
    value: z.string().min(1),
    label: z.string().optional(),
    monitoring_enabled: z.boolean().optional(),
    notes: z.string().optional()
  })
  .strict();

export const ScanResultSchema = z
  .object({
    id: z.string().optional(),
    profile_id: z.string().min(1),
    source_name: z.string().min(1),
    source_type: z.string().min(1),
    risk_score: z.number().optional(),
    source_url: z.string().url().optional(),
    scan_date: z.string().optional(),
    status: z.string().optional(),
    data_exposed: z.array(z.string()).optional(),
    metadata: z.any().optional()
  })
  .passthrough();

