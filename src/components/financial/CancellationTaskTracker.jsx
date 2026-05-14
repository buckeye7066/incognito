import { useState } from 'react';
import { incognito } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Scissors, CheckCircle, Clock, AlertTriangle, XCircle, RotateCw,
  ChevronDown, ChevronUp, Phone, Mail, Shield,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const STATUS_META = {
  active: { label: 'Active', color: 'bg-blue-500/20 text-blue-300' },
  cancelling: { label: 'Cancelling', color: 'bg-amber-500/20 text-amber-300' },
  cancelled: { label: 'Cancelled', color: 'bg-green-500/20 text-green-300' },
  disputed: { label: 'Disputed', color: 'bg-red-500/20 text-red-300' },
  failed: { label: 'Failed', color: 'bg-red-500/20 text-red-300' },
};

const DARK_PATTERNS = [
  { pattern: 'Must Call', icon: Phone, severity: 'high', tip: 'Prepare a script. Say "I want to cancel" firmly. Decline all retention offers.' },
  { pattern: 'Chat Only', icon: Mail, severity: 'medium', tip: 'Open chat, state "I want to cancel my subscription immediately." Screenshot everything.' },
  { pattern: 'Buried Settings', icon: AlertTriangle, severity: 'medium', tip: 'Look under Account > Billing > Manage Plan > Cancel. Try direct URL search.' },
  { pattern: 'Retention Offers', icon: RotateCw, severity: 'low', tip: 'Decline all offers. They\'ll try 2-3 times. Stay firm.' },
];

export default function CancellationTaskTracker({ profileId }) {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState(null);

  const { data: subs = [] } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => incognito.entities.Subscription.list(),
  });

  const mySubs = subs.filter(s => !profileId || s.profile_id === profileId);
  const cancellingOrFailed = mySubs.filter(s => s.status === 'cancelling' || s.status === 'disputed' || s.status === 'failed');
  const recentlyCancelled = mySubs.filter(s => s.status === 'cancelled');
  const activeSubs = mySubs.filter(s => s.status === 'active');

  const updateSub = useMutation({
    mutationFn: ({ id, data }) => incognito.entities.Subscription.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subscriptions'] }),
  });

  const monthlyTotal = activeSubs.reduce((sum, s) => {
    let amt = s.amount || 0;
    if (s.frequency === 'yearly') amt /= 12;
    if (s.frequency === 'quarterly') amt /= 3;
    return sum + amt;
  }, 0);

  const cancelledSavings = recentlyCancelled.reduce((sum, s) => {
    let amt = s.amount || 0;
    if (s.frequency === 'yearly') amt /= 12;
    if (s.frequency === 'quarterly') amt /= 3;
    return sum + amt;
  }, 0);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Subs', value: activeSubs.length, icon: Clock, color: 'text-blue-400' },
          { label: 'Monthly Spend', value: `$${monthlyTotal.toFixed(0)}`, icon: Scissors, color: 'text-amber-400' },
          { label: 'Cancelled', value: recentlyCancelled.length, icon: CheckCircle, color: 'text-green-400' },
          { label: 'Saved/mo', value: `$${cancelledSavings.toFixed(0)}`, icon: Shield, color: 'text-green-400' },
        ].map(s => (
          <Card key={s.label} className="glass-card border-slate-700">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`w-7 h-7 ${s.color}`} />
              <div>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-gray-400 text-xs">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dark Pattern Warnings */}
      <Card className="glass-card border-amber-500/20">
        <CardContent className="p-4">
          <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" /> Common Dark Patterns to Watch For
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {DARK_PATTERNS.map(dp => {
              const Icon = dp.icon;
              return (
                <div key={dp.pattern} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4 text-amber-400" />
                    <span className="text-white text-sm font-medium">{dp.pattern}</span>
                    <Badge className={`text-[10px] border-0 ${dp.severity === 'high' ? 'bg-red-500/20 text-red-300' : dp.severity === 'medium' ? 'bg-amber-500/20 text-amber-300' : 'bg-gray-500/20 text-gray-300'}`}>{dp.severity}</Badge>
                  </div>
                  <p className="text-xs text-gray-400">{dp.tip}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* In-Progress Cancellations */}
      {cancellingOrFailed.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Scissors className="w-5 h-5 text-amber-400" /> Cancellation Tasks ({cancellingOrFailed.length})
          </h3>
          {cancellingOrFailed.map(sub => {
            const meta = STATUS_META[sub.status] || STATUS_META.active;
            const isExpanded = expandedId === sub.id;
            return (
              <Card key={sub.id} className="glass-card overflow-hidden border-slate-700">
                <button onClick={() => setExpandedId(isExpanded ? null : sub.id)} className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/40">
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge className={`text-xs border-0 ${meta.color}`}>{meta.label}</Badge>
                    <p className="text-white font-medium text-sm">{sub.service_name}</p>
                    {sub.amount > 0 && <p className="text-gray-400 text-xs">${sub.amount}/{sub.frequency || 'mo'}</p>}
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="px-4 pb-4 border-t border-slate-700/50 pt-3 space-y-2">
                        <div className="text-xs text-gray-300 space-y-1">
                          <p>1. Replace payment info with fake data first</p>
                          <p>2. Navigate to account/billing settings</p>
                          <p>3. Complete cancellation flow</p>
                          <p>4. Screenshot confirmation</p>
                          <p>5. Mark as cancelled below</p>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button size="sm" onClick={() => updateSub.mutate({ id: sub.id, data: { status: 'cancelled' } })} className="text-xs bg-green-600 hover:bg-green-700 h-8">
                            <CheckCircle className="w-3 h-3 mr-1" /> Confirmed Cancelled
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => updateSub.mutate({ id: sub.id, data: { status: 'disputed' } })} className="text-xs border-red-500/40 text-red-300 h-8">
                            <XCircle className="w-3 h-3 mr-1" /> Dispute
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            );
          })}
        </div>
      )}

      {/* Active Subscriptions Review */}
      {activeSubs.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-white font-semibold">Active Subscriptions to Review ({activeSubs.length})</h3>
          {activeSubs.sort((a, b) => (b.amount || 0) - (a.amount || 0)).map(sub => (
            <div key={sub.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-700">
              <div className="flex items-center gap-3 min-w-0">
                <p className="text-white font-medium text-sm">{sub.service_name}</p>
                {sub.category && <Badge className="text-[10px] border-0 bg-slate-700 text-gray-300">{sub.category}</Badge>}
              </div>
              <div className="flex items-center gap-3">
                {sub.amount > 0 && <p className="text-gray-300 text-sm font-mono">${sub.amount}</p>}
                <Button size="sm" variant="outline" onClick={() => updateSub.mutate({ id: sub.id, data: { status: 'cancelling' } })} className="text-xs border-amber-500/40 text-amber-300 h-7">
                  <Scissors className="w-3 h-3 mr-1" /> Start Cancel
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {mySubs.length === 0 && (
        <Card className="glass-card border-slate-700">
          <CardContent className="p-10 text-center">
            <Scissors className="w-14 h-14 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No subscriptions tracked yet. Add them in "My Subscriptions" tab.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
