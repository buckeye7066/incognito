import { useState, useEffect } from 'react';
import { incognito } from '@/api/client';
import vault from '@/lib/vault';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, Plus, Copy, Search, Lock, PhoneForwarded } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCapabilities } from '@/hooks/useCapabilities';
import CapabilityBadge from '@/components/common/CapabilityBadge';
import { CAPABILITY, CAPABILITY_STATUS } from '@/providers/capabilities';
import { summarizePhoneRules } from '@/lib/phoneRules';
import { estimateMonthlyCost, formatUsd } from '@/lib/phoneCost';
import PhoneDetailDrawer from '@/components/phone/PhoneDetailDrawer';

export default function PhoneAliases() {
  const queryClient = useQueryClient();
  const { capabilities } = useCapabilities();
  const [locked, setLocked] = useState(!vault.isUnlocked());
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [fMember, setFMember] = useState('all');
  const [areaCode, setAreaCode] = useState('');
  const [available, setAvailable] = useState([]);
  const [form, setForm] = useState({ purpose: '', household_member_id: 'none' });

  useEffect(() => {
    const a = vault.on('lock', () => setLocked(true));
    const b = vault.on('unlock', () => setLocked(false));
    return () => { if (a) a(); if (b) b(); };
  }, []);

  const activeProfileId = typeof window !== 'undefined' ? window.activeProfileId : null;
  const phoneCap = capabilities[CAPABILITY.PHONE_ALIAS];
  const phoneReady = phoneCap?.status === CAPABILITY_STATUS.READY;

  const { data: aliases = [], isLoading } = useQuery({ queryKey: ['phoneAliases'], queryFn: () => incognito.entities.PhoneAlias.list('-created_date') });
  const { data: members = [] } = useQuery({ queryKey: ['householdMembers'], queryFn: () => incognito.entities.HouseholdMember.list() });
  const memberById = Object.fromEntries(members.map((m) => [m.id, m]));

  const searchMutation = useMutation({
    mutationFn: (ac) => incognito.functions.invoke('listAvailablePhoneNumbers', { areaCode: ac }),
    onSuccess: (r) => setAvailable(r.data || []),
  });
  const purchaseMutation = useMutation({
    mutationFn: (phoneNumber) => incognito.functions.invoke('purchasePhoneNumber', {
      phoneNumber, profileId: activeProfileId,
      householdMemberId: form.household_member_id === 'none' ? null : form.household_member_id,
      purpose: form.purpose,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phoneAliases'] });
      setShowCreate(false); setAvailable([]); setForm({ purpose: '', household_member_id: 'none' });
    },
  });

  const filtered = aliases.filter((p) => {
    if (fMember !== 'all') { if (fMember === 'unassigned' ? p.household_member_id : p.household_member_id !== fMember) return false; }
    if (search && !`${p.phone_number} ${p.purpose || ''}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const cost = estimateMonthlyCost({ numberCount: aliases.length });
  const selected = aliases.find((a) => a.id === selectedId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3"><Phone className="h-8 w-8 text-primary" /> Phone Aliases</h1>
          <p className="text-muted-foreground mt-1">Real Twilio numbers per service. Forward calls/texts to your real number; block/allow callers per number.</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild><Button className="gap-2" disabled={locked}><Plus className="h-4 w-4" /> New Number</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Get a New Phone Number</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="rounded-lg border p-3 text-xs flex items-center gap-2">
                <span className="flex-1 text-muted-foreground">
                  {phoneReady ? `Real Twilio numbers — about ${formatUsd(cost.perNumber)}/mo each plus usage.` : 'Configure Twilio in Settings → Providers to search and buy numbers. No fake numbers are created.'}
                </span>
                <CapabilityBadge status={phoneCap?.status} detail={phoneCap?.providers?.[0]?.detail} />
              </div>
              <div><Label>Purpose</Label><Input placeholder="e.g. Online shopping" value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} /></div>
              {members.length > 0 && (
                <div><Label>Household member</Label>
                  <Select value={form.household_member_id} onValueChange={(v) => setForm((f) => ({ ...f, household_member_id: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Unassigned —</SelectItem>
                      {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Search by area code (optional)</Label>
                <div className="flex gap-2">
                  <Input placeholder="e.g. 212, 415" value={areaCode} disabled={!phoneReady} onChange={(e) => setAreaCode(e.target.value)} />
                  <Button disabled={!phoneReady || searchMutation.isPending} onClick={() => searchMutation.mutate(areaCode)}>{searchMutation.isPending ? 'Searching…' : 'Search'}</Button>
                </div>
              </div>
              {available.length > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  <Label>Available numbers</Label>
                  {available.map((num, i) => (
                    <Card key={i} className="cursor-pointer hover:bg-muted/50" onClick={() => purchaseMutation.mutate(num.phone_number)}>
                      <CardContent className="py-2 px-3 flex items-center justify-between">
                        <span className="font-mono">{num.friendly_name || num.phone_number}<span className="text-xs text-muted-foreground ml-2">{num.locality || ''} {num.region || ''}</span></span>
                        <Button size="sm" disabled={purchaseMutation.isPending}>{purchaseMutation.isPending ? 'Getting…' : 'Get'}</Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              {searchMutation.isError && <p className="text-xs text-red-400">{searchMutation.error?.message}</p>}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {locked && <Card className="glass-card border-amber-500/30"><CardContent className="p-3 flex items-center gap-2 text-amber-300 text-sm"><Lock className="h-4 w-4" /> Unlock the vault to manage numbers (forwarding numbers are encrypted).</CardContent></Card>}

      {/* Capability chips */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="inline-flex items-center gap-1.5">Numbers / SMS <CapabilityBadge status={phoneCap?.status} detail={phoneCap?.providers?.[0]?.detail} /></span>
        <span className="inline-flex items-center gap-1.5">Inbox & call logs <CapabilityBadge status={capabilities[CAPABILITY.SMS_INBOX]?.status} detail={capabilities[CAPABILITY.SMS_INBOX]?.providers?.[0]?.detail} /></span>
        <span className="inline-flex items-center gap-1.5">Live screening <CapabilityBadge status={capabilities[CAPABILITY.CALL_SCREEN]?.status} detail={capabilities[CAPABILITY.CALL_SCREEN]?.providers?.[0]?.detail} /></span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Numbers', value: aliases.length },
          { label: 'Active', value: aliases.filter((p) => p.status === 'active').length },
          { label: 'With forwarding', value: aliases.filter((p) => p.forwarding_number).length },
          { label: 'Est. base /mo', value: formatUsd(cost.base) },
        ].map((s, i) => (
          <Card key={i} className="glass-card"><CardContent className="pt-4 pb-3 text-center"><div className="text-2xl font-bold">{s.value}</div><div className="text-xs text-muted-foreground">{s.label}</div></CardContent></Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search numbers…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={fMember} onValueChange={setFMember}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All members</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="space-y-2">
        <AnimatePresence>
          {filtered.map((alias) => {
            const member = alias.household_member_id ? memberById[alias.household_member_id] : null;
            return (
              <motion.div key={alias.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Card className={`cursor-pointer hover:bg-muted/30 transition-colors ${alias.status === 'disabled' ? 'opacity-60' : ''}`} onClick={() => setSelectedId(alias.id)}>
                  <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Phone className={`h-5 w-5 shrink-0 ${alias.status === 'active' ? 'text-green-500' : 'text-muted-foreground'}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm">{alias.phone_number}</span>
                          <Badge variant={alias.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">{alias.status}</Badge>
                          {alias.forwarding_number && <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><PhoneForwarded className="h-3 w-3" />{alias.forwarding_number}</span>}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{alias.purpose || '—'}{member ? ` · ${member.display_name}` : ''} · {summarizePhoneRules(alias.rules)}</div>
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(alias.phone_number); }} className="text-muted-foreground hover:text-primary shrink-0"><Copy className="h-4 w-4" /></button>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && !isLoading && (
        <Card className="p-12 text-center">
          <Phone className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold mb-2">{aliases.length === 0 ? 'No phone numbers yet' : 'No numbers match your filters'}</h3>
          <p className="text-muted-foreground mb-4">{aliases.length === 0 ? 'Real Twilio numbers per service. Requires Twilio credentials in Settings.' : 'Try clearing a filter.'}</p>
          {aliases.length === 0 && <Button onClick={() => setShowCreate(true)} disabled={locked} className="gap-2"><Plus className="h-4 w-4" /> Get First Number</Button>}
        </Card>
      )}

      <PhoneDetailDrawer open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}
        alias={selected} members={members} capabilities={capabilities} locked={locked}
        onChanged={() => queryClient.invalidateQueries({ queryKey: ['phoneAliases'] })} />
    </div>
  );
}
