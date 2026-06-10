import { useState } from 'react';
import { incognito } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users, Plus, Phone, PhoneForwarded, ShieldBan, Trash2, RefreshCw, ListChecks, Info, CheckCircle2, Voicemail, Mic } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCapabilities } from '@/hooks/useCapabilities';
import { CAPABILITY } from '@/providers';
import { getBackendUrl } from '@/providers/index.js';
import CapabilityBadge from '@/components/common/CapabilityBadge';
import { toBackendCoverage, coverageEntryValid, maskPhone, splitNumbers, BACKEND_SECRET_KEY } from '@/lib/familyCoverage';
import TwilioSetupWizard from '@/components/calls/TwilioSetupWizard';
import { notify } from '@/lib/notify';

const EMPTY = {
  id: null, label: '', twilio_number: '', forward_to: '', contacts: '', blocked: '',
  auto_block_high_risk: true, voicemail_on_screen: false, record: false,
};
const ACTION_BADGE = {
  forward: { label: 'Rang through', cls: 'bg-green-500/15 text-green-300' },
  record_forward: { label: 'Rang + recorded', cls: 'bg-green-500/15 text-green-300' },
  reject: { label: 'Blocked', cls: 'bg-red-500/15 text-red-300' },
  voicemail: { label: 'Voicemail', cls: 'bg-amber-500/15 text-amber-300' },
  screen: { label: 'Screened', cls: 'bg-amber-500/15 text-amber-300' },
};

export default function FamilyCallCoverage() {
  const queryClient = useQueryClient();
  const { capabilities } = useCapabilities();
  const cap = capabilities[CAPABILITY.CALL_ROUTING];

  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [log, setLog] = useState(null);

  const { data: coverage = [] } = useQuery({
    queryKey: ['callCoverage'],
    queryFn: () => incognito.entities.CallCoverage.list('-updated_date'),
  });

  const upsert = useMutation({
    mutationFn: (data) => {
      const { id, ...rest } = data;
      const payload = { ...rest, contacts: splitNumbers(rest.contacts), blocked: splitNumbers(rest.blocked) };
      return id ? incognito.entities.CallCoverage.update(id, payload) : incognito.entities.CallCoverage.create(payload);
    },
    onSuccess: () => { queryClient.invalidateQueries(['callCoverage']); setShowForm(false); setForm(EMPTY); },
    onError: (e) => notify.error(e?.message || 'Could not save.'),
  });

  const remove = useMutation({
    mutationFn: (id) => incognito.entities.CallCoverage.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['callCoverage']),
  });

  const sync = useMutation({
    mutationFn: async () => {
      const base = (getBackendUrl() || '').replace(/\/$/, '');
      if (!base) throw new Error('Set your backend URL in the setup guide first.');
      const res = await fetch(`${base}/coverage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-incognito-secret': localStorage.getItem(BACKEND_SECRET_KEY) || '' },
        body: JSON.stringify(toBackendCoverage(coverage)),
      });
      if (!res.ok) throw new Error(`Backend rejected the sync (${res.status}).`);
      return res.json();
    },
    onSuccess: (r) => notify.success(`Synced ${r.count} covered number${r.count === 1 ? '' : 's'} to your backend.`),
    onError: (e) => notify.error(e?.message || 'Sync failed — is the backend running and reachable?'),
  });

  const loadLog = async () => {
    try {
      const base = (getBackendUrl() || '').replace(/\/$/, '');
      if (!base) { notify.warn('Set your backend URL in the setup guide first.'); return; }
      const res = await fetch(`${base}/events`, { headers: { 'x-incognito-secret': localStorage.getItem(BACKEND_SECRET_KEY) || '' } });
      if (!res.ok) throw new Error(String(res.status));
      const events = await res.json();
      setLog((Array.isArray(events) ? events : []).filter((e) => e.type === 'call_routed').reverse());
    } catch {
      notify.error('Could not load the call log from the backend.');
    }
  };

  const openEdit = (c) => { setForm({ ...EMPTY, ...c, contacts: (c.contacts || []).join(', '), blocked: (c.blocked || []).join(', ') }); setShowForm(true); };
  const openNew = () => { setForm(EMPTY); setShowForm(true); };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            Family Call Coverage
            <CapabilityBadge status={cap?.status} detail={cap?.providers?.[0]?.detail} />
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Screen calls for your whole family from one place. Each person hands out a screening
            number; scam and spam callers are stopped, and trusted callers ring straight through to
            their real phone.
          </p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Add a person</Button>
      </div>

      {/* How it works */}
      <Card className="glass-card border-blue-500/20 bg-blue-500/5">
        <CardContent className="py-3 px-4 flex items-start gap-3 text-sm">
          <Info className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
          <p className="text-blue-100/90">
            For each person you give two numbers: the <b>screening number</b> they share publicly
            (a Twilio number), and their <b>real phone</b> that good calls forward to. Their real
            phone never forwards anywhere, so there's no loop. The same scam-detection used across
            the app decides who gets through.
          </p>
        </CardContent>
      </Card>

      {/* Step-by-step setup guide (Twilio + backend + tunnel) */}
      <TwilioSetupWizard />

      {/* Covered people */}
      <div className="space-y-2">
        <AnimatePresence>
          {coverage.map((c) => (
            <motion.div key={c.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Card className={coverageEntryValid(c) ? '' : 'border-amber-500/40'}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{c.label || 'Unnamed'}</span>
                        {c.auto_block_high_risk && <Badge variant="outline" className="text-[10px]">auto-block</Badge>}
                        {c.voicemail_on_screen && <Badge variant="outline" className="text-[10px] gap-1"><Voicemail className="h-3 w-3" />voicemail</Badge>}
                        {c.record && <Badge variant="outline" className="text-[10px] gap-1"><Mic className="h-3 w-3" />record</Badge>}
                        {!coverageEntryValid(c) && <Badge variant="destructive" className="text-[10px]">needs both numbers</Badge>}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> give out {c.twilio_number || '—'}</span>
                        <span className="flex items-center gap-1"><PhoneForwarded className="h-3 w-3" /> rings {maskPhone(c.forward_to)}</span>
                        {(c.contacts?.length > 0) && <span className="text-green-400">{c.contacts.length} always-allow</span>}
                        {(c.blocked?.length > 0) && <span className="text-red-400 flex items-center gap-1"><ShieldBan className="h-3 w-3" />{c.blocked.length} blocked</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>Edit</Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove.mutate(c.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>

        {coverage.length === 0 && (
          <Card className="p-10 text-center">
            <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
            <h3 className="font-semibold mb-1">No one covered yet</h3>
            <p className="text-muted-foreground text-sm mb-4">Add yourself and each family member to start screening their calls.</p>
            <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Add the first person</Button>
          </Card>
        )}
      </div>

      {/* Sync + verify actions (connection is configured in the setup guide above) */}
      <Card className="glass-card">
        <CardContent className="py-3 px-4 flex flex-wrap items-center gap-2">
          <Button onClick={() => sync.mutate()} disabled={sync.isPending || coverage.length === 0} className="gap-2">
            <RefreshCw className="h-4 w-4" /> {sync.isPending ? 'Syncing…' : 'Sync coverage to backend'}
          </Button>
          <Button variant="outline" onClick={loadLog} className="gap-2"><ListChecks className="h-4 w-4" /> Load recent calls</Button>
          <p className="text-xs text-muted-foreground ml-auto">
            Real numbers are encrypted in the vault; only numbers + the verdict reach your backend — never recordings.
          </p>
        </CardContent>
      </Card>

      {/* Recent screened calls (the verification view) */}
      {log && (
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-base">Recent screened calls</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {log.length === 0 ? (
              <p className="text-sm text-muted-foreground">No calls routed yet. Place a test call to a covered number to verify.</p>
            ) : log.slice(0, 25).map((e, i) => {
              const b = ACTION_BADGE[e.action] || { label: e.action, cls: 'bg-slate-500/15 text-slate-300' };
              return (
                <div key={i} className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <span className="font-mono">{e.from || 'unknown'}</span>
                    {e.label && <span className="text-muted-foreground"> → {e.label}</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{e.risk_level} risk</span>
                    <Badge className={`text-[10px] ${b.cls}`}>{b.label}</Badge>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Add / edit dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{form.id ? 'Edit coverage' : 'Add a person'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input placeholder="e.g. Mom" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} /></div>
            <div>
              <Label>Screening number (they hand this out)</Label>
              <Input placeholder="+1 614 555 0100" value={form.twilio_number} onChange={(e) => setForm((f) => ({ ...f, twilio_number: e.target.value }))} />
            </div>
            <div>
              <Label>Their real phone (good calls ring here)</Label>
              <Input placeholder="+1 614 555 0199" value={form.forward_to} onChange={(e) => setForm((f) => ({ ...f, forward_to: e.target.value }))} />
            </div>
            <div><Label>Always allow (comma-separated)</Label><Textarea rows={2} placeholder="+1 202 555 1111, +1 202 555 2222" value={form.contacts} onChange={(e) => setForm((f) => ({ ...f, contacts: e.target.value }))} /></div>
            <div><Label>Always block (comma-separated)</Label><Textarea rows={2} placeholder="+1 303 555 8888" value={form.blocked} onChange={(e) => setForm((f) => ({ ...f, blocked: e.target.value }))} /></div>
            <div className="space-y-2 pt-1">
              <label className="flex items-center justify-between text-sm"><span>Auto-block high-risk callers</span>
                <Switch checked={form.auto_block_high_risk} onCheckedChange={(v) => setForm((f) => ({ ...f, auto_block_high_risk: v }))} /></label>
              <label className="flex items-center justify-between text-sm"><span>Send screened callers to voicemail</span>
                <Switch checked={form.voicemail_on_screen} onCheckedChange={(v) => setForm((f) => ({ ...f, voicemail_on_screen: v }))} /></label>
              <label className="flex items-center justify-between text-sm"><span>Record allowed calls</span>
                <Switch checked={form.record} onCheckedChange={(v) => setForm((f) => ({ ...f, record: v }))} /></label>
            </div>
            <Button className="w-full gap-2" onClick={() => upsert.mutate(form)} disabled={!form.twilio_number || !form.forward_to || upsert.isPending}>
              <CheckCircle2 className="h-4 w-4" /> {upsert.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
