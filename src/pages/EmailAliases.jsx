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
import { Mail, Plus, Copy, Search, Inbox, Send, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCapabilities } from '@/hooks/useCapabilities';
import CapabilityBadge from '@/components/common/CapabilityBadge';
import { CAPABILITY, CAPABILITY_STATUS } from '@/providers/capabilities';
import { summarizeRules } from '@/lib/aliasRules';
import AliasDetailDrawer from '@/components/email/AliasDetailDrawer';

export default function EmailAliases() {
  const queryClient = useQueryClient();
  const { capabilities } = useCapabilities();
  const [locked, setLocked] = useState(!vault.isUnlocked());
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [fStatus, setFStatus] = useState('all');
  const [fMember, setFMember] = useState('all');
  const [form, setForm] = useState({ description: '', household_member_id: 'none' });

  useEffect(() => {
    const a = vault.on('lock', () => setLocked(true));
    const b = vault.on('unlock', () => setLocked(false));
    return () => { if (a) a(); if (b) b(); };
  }, []);

  const activeProfileId = typeof window !== 'undefined' ? window.activeProfileId : null;
  const emailCap = capabilities[CAPABILITY.EMAIL_ALIAS];
  const emailReady = emailCap?.status === CAPABILITY_STATUS.READY;

  const { data: aliases = [], isLoading } = useQuery({
    queryKey: ['emailAliases'],
    queryFn: () => incognito.entities.EmailAlias.list('-created_date'),
  });
  const { data: members = [] } = useQuery({
    queryKey: ['householdMembers'],
    queryFn: () => incognito.entities.HouseholdMember.list(),
  });
  const memberById = Object.fromEntries(members.map((m) => [m.id, m]));

  const createMutation = useMutation({
    mutationFn: (data) => incognito.functions.invoke('createEmailAliasReal', {
      profileId: activeProfileId,
      householdMemberId: data.household_member_id === 'none' ? null : data.household_member_id,
      description: data.description,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emailAliases'] });
      setShowCreate(false);
      setForm({ description: '', household_member_id: 'none' });
    },
  });

  const filtered = aliases.filter((a) => {
    if (fStatus !== 'all' && a.status !== fStatus) return false;
    if (fMember !== 'all') {
      if (fMember === 'unassigned' ? a.household_member_id : a.household_member_id !== fMember) return false;
    }
    if (search && !`${a.alias_email} ${a.description || ''}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: aliases.length,
    active: aliases.filter((a) => a.status === 'active').length,
    placeholder: aliases.filter((a) => a.placeholder).length,
    managed: aliases.filter((a) => !a.placeholder).length,
  };
  const selected = aliases.find((a) => a.id === selectedId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3"><Mail className="h-8 w-8 text-primary" /> Email Aliases</h1>
          <p className="text-muted-foreground mt-1">A unique forwarding address per service. Real alias when a provider is configured; clearly-labelled placeholder otherwise.</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="gap-2" disabled={locked}><Plus className="h-4 w-4" /> New Alias</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Email Alias</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Description / purpose</Label>
                <Input placeholder="e.g. Shopping, Newsletters" value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              {members.length > 0 && (
                <div>
                  <Label>Household member</Label>
                  <Select value={form.household_member_id} onValueChange={(v) => setForm((f) => ({ ...f, household_member_id: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Unassigned —</SelectItem>
                      {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="rounded-lg border p-3 text-xs flex items-center gap-2">
                <span className="flex-1 text-muted-foreground">
                  {emailReady ? 'A real forwarding alias will be created via your configured provider.' : 'No alias provider configured — a clearly-labelled local placeholder will be created.'}
                </span>
                <CapabilityBadge status={emailCap?.status} detail={emailCap?.providers?.[0]?.detail} />
              </div>
              <Button className="w-full" disabled={createMutation.isPending} onClick={() => createMutation.mutate(form)}>
                {createMutation.isPending ? 'Creating…' : (emailReady ? 'Generate Alias' : 'Create Placeholder')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {locked && (
        <Card className="glass-card border-amber-500/30"><CardContent className="p-3 flex items-center gap-2 text-amber-300 text-sm">
          <Lock className="h-4 w-4" /> Unlock the vault to create or edit aliases (forwarding addresses are encrypted).
        </CardContent></Card>
      )}

      {/* Capability chips */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="inline-flex items-center gap-1.5">Alias provider <CapabilityBadge status={emailCap?.status} detail={emailCap?.providers?.[0]?.detail} /></span>
        <span className="inline-flex items-center gap-1.5">Inbox <CapabilityBadge status={capabilities[CAPABILITY.EMAIL_INBOX]?.status} detail={capabilities[CAPABILITY.EMAIL_INBOX]?.providers?.[0]?.detail} /></span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, icon: Mail },
          { label: 'Active', value: stats.active, icon: Inbox },
          { label: 'Real (provider)', value: stats.managed, icon: Send },
          { label: 'Placeholders', value: stats.placeholder, icon: Mail },
        ].map((s, i) => (
          <Card key={i} className="glass-card"><CardContent className="pt-4 pb-3 text-center">
            <s.icon className="h-5 w-5 mx-auto mb-1 text-primary" />
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </CardContent></Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search aliases…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>
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
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Mail className={`h-5 w-5 shrink-0 ${alias.status === 'active' ? 'text-green-500' : 'text-muted-foreground'}`} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm truncate">{alias.alias_email}</span>
                            {alias.placeholder && <Badge variant="outline" className="text-[10px]">Placeholder</Badge>}
                            <Badge variant={alias.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">{alias.status}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {alias.description || '—'}{member ? ` · ${member.display_name}` : ''} · {summarizeRules(alias.rules)}
                          </div>
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(alias.alias_email); }}
                        className="text-muted-foreground hover:text-primary shrink-0"><Copy className="h-4 w-4" /></button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && !isLoading && (
        <Card className="p-12 text-center">
          <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold mb-2">{aliases.length === 0 ? 'No email aliases yet' : 'No aliases match your filters'}</h3>
          <p className="text-muted-foreground mb-4">{aliases.length === 0 ? 'Create one alias per service to keep your real email hidden.' : 'Try clearing a filter.'}</p>
          {aliases.length === 0 && <Button onClick={() => setShowCreate(true)} disabled={locked} className="gap-2"><Plus className="h-4 w-4" /> Create First Alias</Button>}
        </Card>
      )}

      <AliasDetailDrawer
        open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}
        alias={selected} members={members} capabilities={capabilities} locked={locked}
        onChanged={() => queryClient.invalidateQueries({ queryKey: ['emailAliases'] })}
      />
    </div>
  );
}
