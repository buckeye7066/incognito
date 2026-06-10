import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Copy, ChevronDown, ChevronRight, Circle, CheckCircle2 } from 'lucide-react';
import { getProgress, setStepDone, percentComplete } from '@/lib/setupProgress';

/**
 * Reusable step-by-step setup guide. Give it an `id` (for saved progress) and a
 * list of steps; it renders a numbered, collapsible checklist with copyable
 * commands and a progress bar. Used by any in-app feature that needs setup.
 *
 * step: {
 *   title: string,
 *   body?: ReactNode,             // explanation / inputs
 *   copy?: { label?: string, value: string },  // a command/URL to copy
 * }
 */
export default function SetupSteps({ id, steps = [], title = 'Setup guide' }) {
  const [progress, setProgress] = useState(() => getProgress(id));
  const [open, setOpen] = useState(() => {
    // Open the first not-yet-done step.
    const p = getProgress(id);
    const idx = steps.findIndex((_, i) => !p[i]);
    return idx === -1 ? -1 : idx;
  });
  const [copied, setCopied] = useState(null);

  const pct = percentComplete(progress, steps.length);
  const toggleDone = (i) => setProgress({ ...setStepDone(id, i, !progress[i]) });
  const copy = async (i, value) => {
    try { await navigator.clipboard.writeText(value); setCopied(i); setTimeout(() => setCopied(null), 1500); } catch { /* clipboard blocked */ }
  };

  return (
    <Card className="glass-card border-primary/20">
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold flex items-center gap-2">
            {pct === 100 ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <Circle className="h-4 w-4 text-primary" />}
            {title}
          </h3>
          <span className="text-xs text-muted-foreground">{pct}% complete</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-700 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-500' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
        </div>

        <div className="space-y-1.5">
          {steps.map((step, i) => {
            const done = Boolean(progress[i]);
            const isOpen = open === i;
            return (
              <div key={i} className={`rounded-lg border ${done ? 'border-green-500/20 bg-green-500/5' : 'border-border/60'}`}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left"
                >
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] shrink-0 ${done ? 'bg-green-500 text-white' : 'bg-slate-700 text-gray-300'}`}>
                    {done ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  <span className={`flex-1 text-sm font-medium ${done ? 'text-gray-400 line-through' : ''}`}>{step.title}</span>
                  {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 pl-10 space-y-2 text-sm text-muted-foreground">
                    {step.body}
                    {step.copy && (
                      <div className="flex items-center gap-2">
                        <code className="flex-1 min-w-0 truncate rounded bg-slate-900/70 px-2 py-1.5 text-xs text-gray-200">{step.copy.value}</code>
                        <Button variant="outline" size="sm" className="gap-1 shrink-0" onClick={() => copy(i, step.copy.value)}>
                          <Copy className="h-3 w-3" /> {copied === i ? 'Copied' : (step.copy.label || 'Copy')}
                        </Button>
                      </div>
                    )}
                    <label className="flex items-center gap-2 text-xs cursor-pointer pt-1">
                      <input type="checkbox" checked={done} onChange={() => toggleDone(i)} />
                      Mark this step done
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
