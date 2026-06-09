import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { SEVERITY_TONE } from './identityConstants';

/**
 * Renders an identity's health issues (from lib/identityHealth.computeIdentityHealth).
 * `compact` shows just the worst few as pills (for the card); full shows all.
 */
export default function IdentityHealthList({ issues = [], compact = false }) {
  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-green-400">
        <ShieldCheck className="h-3.5 w-3.5" /> Healthy
      </div>
    );
  }
  const shown = compact ? issues.slice(0, 3) : issues;
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((i) => (
        <span
          key={i.code}
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${SEVERITY_TONE[i.severity] || SEVERITY_TONE.info}`}
          title={i.detail ? `${i.label} (${i.detail})` : i.label}
        >
          <AlertTriangle className="h-3 w-3" />
          {i.label}
        </span>
      ))}
      {compact && issues.length > 3 && (
        <span className="text-[11px] text-muted-foreground">+{issues.length - 3} more</span>
      )}
    </div>
  );
}
