import { CAPABILITY_STATUS, STATUS_META } from '@/providers/capabilities';

/**
 * Honest, at-a-glance status pill for a capability or provider.
 * Reads its label/tone from the shared STATUS_META so the vocabulary is
 * consistent everywhere (Dashboard, Settings, feature pages).
 */
const TONE_CLASSES = {
  success: 'bg-green-500/15 text-green-300 border-green-500/40',
  warning: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  info: 'bg-blue-500/15 text-blue-300 border-blue-500/40',
  muted: 'bg-slate-500/15 text-slate-300 border-slate-500/40',
  danger: 'bg-red-500/15 text-red-300 border-red-500/40',
};

export default function CapabilityBadge({ status, detail, className = '' }) {
  const meta = STATUS_META[status] || { label: status || 'unknown', tone: 'muted' };
  let label = meta.label;
  // Surface the most useful honesty detail inline.
  if (status === CAPABILITY_STATUS.NEEDS_PROVIDER && detail?.locked) {
    label = 'Unlock to check';
  }
  const tone = TONE_CLASSES[meta.tone] || TONE_CLASSES.muted;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone} ${className}`}
      title={detail?.reason || detail?.missingSecrets?.join(', ') || meta.label}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {label}
    </span>
  );
}
