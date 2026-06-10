import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, ArrowRight, Settings2, CheckCircle2 } from 'lucide-react';
import { useCapabilities } from '@/hooks/useCapabilities';
import { summarizeCoverage } from '@/lib/coverageSummary';
import CapabilityBadge from '@/components/common/CapabilityBadge';
import { createPageUrl } from '@/utils';

const COVERAGE_TONE = (pct) =>
  pct >= 80 ? 'text-green-400' : pct >= 50 ? 'text-amber-400' : 'text-red-400';
const BAR_TONE = (pct) =>
  pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';

/**
 * Protection Coverage (Pass 16): an honest at-a-glance answer to "what actually
 * works right now, and what do I still need to set up?", driven entirely by the
 * live capability/provider registry — never a fabricated readiness number.
 */
export default function CoverageOverview({ maxActions = 4 }) {
  const { capabilities } = useCapabilities();
  const summary = useMemo(() => summarizeCoverage(capabilities), [capabilities]);

  if (summary.total === 0) return null;

  const tone = COVERAGE_TONE(summary.coveragePct);
  const actions = summary.topActions.slice(0, maxActions);

  return (
    <Card className="glass-card border-purple-500/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-white flex items-center gap-2 text-lg">
          <ShieldCheck className="w-5 h-5 text-purple-400" />
          Protection Coverage
        </CardTitle>
        <p className="text-xs text-purple-300/80">
          {summary.usable} of {summary.total} privacy tools are usable right now.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className={`text-3xl font-bold ${tone} min-w-[64px]`}>{summary.coveragePct}%</div>
          <div className="flex-1">
            <div className="h-2.5 w-full rounded-full bg-slate-700 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${BAR_TONE(summary.coveragePct)}`} style={{ width: `${summary.coveragePct}%` }} />
            </div>
            <div className="flex gap-4 mt-1.5 text-xs text-gray-400">
              <span><span className="text-green-400 font-semibold">{summary.ready}</span> ready</span>
              <span><span className="text-amber-400 font-semibold">{summary.needsSetup}</span> need setup</span>
            </div>
          </div>
        </div>

        {actions.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
              <Settings2 className="w-3.5 h-3.5" /> Set up next
            </p>
            {actions.map((a) => {
              const row = (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-800/30 px-3 py-2 hover:border-purple-500/40 transition-colors">
                  <span className="text-sm text-white truncate">{a.label}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    <CapabilityBadge status={a.status} />
                    {a.page && <ArrowRight className="w-3.5 h-3.5 text-purple-400" />}
                  </span>
                </div>
              );
              return a.page
                ? <Link key={a.capability} to={createPageUrl(a.page)} className="block">{row}</Link>
                : <div key={a.capability}>{row}</div>;
            })}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/5 px-3 py-2.5">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            <span className="text-sm text-green-300">Everything available is set up. Nice work.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
