import { sha256Hex } from './sha256.ts';

export type EvidenceItem = {
  source_url: string;
  captured_at: string; // ISO-8601
  sha256: string;
  retrieval: {
    retrieved_at: string; // ISO-8601
    method: string;
    notes?: string;
    entity?: string;
    entity_id?: string;
  };
  content_verbatim?: string;
};

export async function buildEvidenceItem(args: {
  source_url: string;
  captured_at: string;
  retrieved_at: string;
  method: string;
  entity?: string;
  entity_id?: string;
  notes?: string;
  content_verbatim?: string;
}) {
  const payload = {
    source_url: args.source_url,
    captured_at: args.captured_at,
    retrieved_at: args.retrieved_at,
    method: args.method,
    content_verbatim: args.content_verbatim || '',
    entity: args.entity || '',
    entity_id: args.entity_id || '',
    notes: args.notes || ''
  };

  const sha256 = await sha256Hex(JSON.stringify(payload));

  const item: EvidenceItem = {
    source_url: args.source_url,
    captured_at: args.captured_at,
    sha256,
    retrieval: {
      retrieved_at: args.retrieved_at,
      method: args.method,
      notes: args.notes,
      entity: args.entity,
      entity_id: args.entity_id
    },
    content_verbatim: args.content_verbatim
  };

  return item;
}

