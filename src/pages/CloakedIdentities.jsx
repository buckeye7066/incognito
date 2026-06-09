import { useState, useEffect, useMemo } from 'react';
import { incognito } from '@/api/client';
import vault from '@/lib/vault';
import { hostnameOf } from '@/lib/passwordImport';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Fingerprint, Mail, Phone, KeyRound, CreditCard, Shield, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCapabilities } from '@/hooks/useCapabilities';
import CapabilityBadge from '@/components/common/CapabilityBadge';
import { CAPABILITY } from '@/providers/capabilities';
import { computeIdentityHealth, summarizeIdentityHealth } from '@/lib/identityHealth';
import { IDENTITY_CATEGORIES, categoryInfo, IDENTITY_STATUS_META } from '@/components/identities/identityConstants';
import CreateIdentityDialog from '@/components/identities/CreateIdentityDialog';
import IdentityDetailDrawer from '@/components/identities/IdentityDetailDrawer';
import IdentityHealthList from '@/components/identities/IdentityHealthList';

const STATUS_FILTERS = ['all', 'active', 'muted', 'disabled', 'archived', 'compromised'];
const HEALTH_FILTERS = [
  { value: 'all', label: 'All health' },
  { value: 'issues', label: 'Has any issue' },
  { value: 'critical', label: 'Has critical' },
  { value: 'warning', label: 'Has warning' },
  { value: 'healthy', label: 'Healthy' },
];

const CAP_CHIPS = [
  { cap: CAPABILITY.EMAIL_ALIAS, label: 'Email' },
  { cap: CAPABILITY.PHONE_ALIAS, label: 'Phone' },
  { cap: CAPABILITY.VIRTUAL_CARD, label: 'Cards' },
  { cap: CAPABILITY.AUTOFILL, label: 'Autofill' },
];

export default function CloakedIdentities() {
  const queryClient = useQueryClient();
  const { capabilities } = useCapabilities();
  const [locked, setLocked] = useState(!vault.isUnlocked());
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState(null);
  const [lastResult, setLastResult] = useState(null);

  const [search, setSearch] = useState('');
  const [fMember, setFMember] = useState('all');
  const [fCategory, setFCategory] = useState('all');
  const [fStatus, setFStatus] = useState('all');
  const [fHealth, setFHealth] = useState('all');

  useEffect(() => {
    const a = vault.on('lock', () => setLocked(true));
    const b = vault.on('unlock', () => setLocked(false));
    return () => { if (a) a(); if (b) b(); };
  }, []);

  const { data: identities = [], isLoading } = useQuery({ queryKey: ['cloakedIdentities'], queryFn: () => incognito.entities.CloakedIdentity.list('-created_date') });
  const { data: passwords = [] } = useQuery({ queryKey: ['passwordEntries'], queryFn: () => incognito.entities.PasswordEntry.list() });
  const { data: emailAliases = [] } = useQuery({ queryKey: ['emailAliases'], queryFn: () => incognito.entities.EmailAlias.list() });
  const { data: phoneAliases = [] } = useQuery({ queryKey: ['phoneAliases'], queryFn: () => incognito.entities.PhoneAlias.list() });
  const { data: virtualCards = [] } = useQuery({ queryKey: ['virtualCards'], queryFn: () => incognito.entities.VirtualCard.list() });
  const { data: totpSecrets = [] } = useQuery({ queryKey: ['totpSecrets'], queryFn: () => incognito.entities.TOTPSecret.list() });
  const { data: members = [] } = useQuery({ queryKey: ['householdMembers'], queryFn: () => incognito.entities.HouseholdMember.list() });
  const { data: findings = [] } = useQuery({ queryKey: ['searchQueryFindings'], queryFn: () => incognito.entities.SearchQueryFinding.list() });

  const byId = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));
  const pwById = useMemo(() => byId(passwords), [passwords]);
  const emById = useMemo(() => byId(emailAliases), [emailAliases]);
  const phById = useMemo(() => byId(phoneAliases), [phoneAliases]);
  const cardById = useMemo(() => byId(virtualCards), [virtualCards]);
  const totpById = useMemo(() => byId(totpSecrets), [totpSecrets]);
  const memberById = useMemo(() => byId(members), [members]);

  const unavailableForIdentity = (identity, hasEmail, hasPhone, hasCard) => {
    const out = [];
    const notReady = (cap) => capabilities[cap] && capabilities[cap].status !== 'ready';
    if (!hasEmail && notReady(CAPABILITY.EMAIL_ALIAS)) out.push('email');
    if (!hasPhone && notReady(CAPABILITY.PHONE_ALIAS)) out.push('phone');
    if (!hasCard && notReady(CAPABILITY.VIRTUAL_CARD)) out.push('card');
    return out;
  };

  // Decorate every identity with its linked resources + computed health.
  const decorated = useMemo(() => identities.map((identity) => {
    const password = identity.password_entry_id ? pwById[identity.password_entry_id] : null;
    const email = identity.email_alias_id ? emById[identity.email_alias_id] : null;
    const phone = identity.phone_alias_id ? phById[identity.phone_alias_id] : null;
    const card = identity.virtual_card_id ? cardById[identity.virtual_card_id] : null;
    const totp = identity.totp_secret_id ? totpById[identity.totp_secret_id] : null;
    const domain = hostnameOf(identity.service_url);
    const exposures = domain
      ? findings.filter((f) => `${f.url || ''} ${f.source_name || ''} ${f.title || ''}`.toLowerCase().includes(domain))
      : [];
    const issues = computeIdentityHealth(identity, {
      password, emailAlias: email, phoneAlias: phone, card, totp,
      allPasswords: passwords, exposures,
      unavailableProviders: unavailableForIdentity(identity, !!email, !!phone, !!card),
    });
    return { identity, resources: { password, email, phone, card, totp }, issues, summary: summarizeIdentityHealth(issues) };
  }), [identities, pwById, emById, phById, cardById, totpById, passwords, findings, capabilities]);

  const filtered = decorated.filter(({ identity, summary, issues }) => {
    if (fMember !== 'all') {
      if (fMember === 'unassigned' ? identity.household_member_id : identity.household_member_id !== fMember) return false;
    }
    if (fCategory !== 'all' && identity.category !== fCategory) return false;
    if (fStatus !== 'all' && identity.status !== fStatus) return false;
    if (fHealth === 'issues' && summary.clean) return false;
    if (fHealth === 'healthy' && !summary.clean) return false;
    if (fHealth === 'critical' && summary.worst !== 'critical') return false;
    if (fHealth === 'warning' && !issues.some((i) => i.severity === 'warning')) return false;
    if (search && !`${identity.service_name} ${identity.service_url} ${identity.username}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const refresh = () => {
    for (const k of ['cloakedIdentities', 'passwordEntries', 'emailAliases', 'phoneAliases', 'virtualCards', 'totpSecrets']) {
      queryClient.invalidateQueries({ queryKey: [k] });
    }
  };

  const selectedDecorated = selected && decorated.find((d) => d.identity.id === selected);
  const stats = {
    total: identities.length,
    active: identities.filter((i) => i.status === 'active').length,
    compromised: identities.filter((i) => i.status === 'compromised').length,
    issues: decorated.filter((d) => !d.summary.clean).length,
  };

  const activeProfileId = typeof window !== 'undefined' ? window.activeProfileId : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Fingerprint className="h-8 w-8 text-primary" /> Cloaked Identities
          </h1>
          <p className="text-muted-foreground mt-1">One bundle per service — username, password, alias, phone, card, and 2FA, per household member.</p>
        </div>
        <Button className="gap-2" disabled={locked} onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" /> New Identity
        </Button>
      </div>

      {locked && (
        <Card className="glass-card border-amber-500/30">
          <CardContent className="p-3 flex items-center gap-2 text-amber-300 text-sm">
            <Lock className="h-4 w-4" /> Unlock the vault to create identities and reveal linked secrets.
          </CardContent>
        </Card>
      )}

      {/* Capability chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Providers:</span>
        {CAP_CHIPS.map(({ cap, label }) => (
          <span key={cap} className="inline-flex items-center gap-1.5 text-xs">
            {label}<CapabilityBadge status={capabilities[cap]?.status} detail={capabilities[cap]?.providers?.[0]?.detail} />
          </span>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Identities', value: stats.total },
          { label: 'Active', value: stats.active },
          { label: 'Needs attention', value: stats.issues },
          { label: 'Compromised', value: stats.compromised },
        ].map((s, i) => (
          <Card key={i} className="glass-card"><CardContent className="pt-4 pb-3 text-center">
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </CardContent></Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search identities…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={fMember} onValueChange={setFMember}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Member" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All members</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fCategory} onValueChange={setFCategory}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {IDENTITY_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((s) => <SelectItem key={s} value={s}>{s === 'all' ? 'All status' : s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fHealth} onValueChange={setFHealth}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Health" /></SelectTrigger>
          <SelectContent>
            {HEALTH_FILTERS.map((h) => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Creation result banner */}
      {lastResult && (
        <Card className="glass-card border-primary/30">
          <CardContent className="p-3 text-sm flex items-center justify-between gap-3">
            <span>
              Created <strong>{lastResult.identity?.service_name}</strong>
              {lastResult.created?.length > 0 && <> with {lastResult.created.join(', ')}</>}.
              {lastResult.skipped?.length > 0 && (
                <span className="text-amber-300"> Skipped: {lastResult.skipped.map((s) => `${s.resource} (${s.reason})`).join('; ')}</span>
              )}
            </span>
            <Button size="sm" variant="ghost" onClick={() => setLastResult(null)}>Dismiss</Button>
          </CardContent>
        </Card>
      )}

      {/* Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence>
          {filtered.map(({ identity, resources, issues, summary }) => {
            const cat = categoryInfo(identity.category);
            const meta = IDENTITY_STATUS_META[identity.status] || { label: identity.status, variant: 'secondary' };
            const member = identity.household_member_id ? memberById[identity.household_member_id] : null;
            return (
              <motion.div key={identity.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}>
                <Card className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary/40 ${identity.status === 'muted' || identity.status === 'archived' ? 'opacity-60' : ''}`}
                  onClick={() => setSelected(identity.id)}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-3 h-3 rounded-full shrink-0 ${cat.color}`} />
                        <CardTitle className="text-base truncate">{identity.service_name}</CardTitle>
                      </div>
                      <Badge variant={meta.variant} className="shrink-0">{meta.label}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {member && <span className="truncate">{member.display_name}</span>}
                      {identity.service_url && <span className="truncate">· {identity.service_url}</span>}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex gap-2 text-muted-foreground">
                      <KeyRound className={`h-4 w-4 ${resources.password ? 'text-green-400' : 'opacity-30'}`} />
                      <Mail className={`h-4 w-4 ${resources.email ? 'text-green-400' : 'opacity-30'}`} />
                      <Phone className={`h-4 w-4 ${resources.phone ? 'text-green-400' : 'opacity-30'}`} />
                      <CreditCard className={`h-4 w-4 ${resources.card ? 'text-green-400' : 'opacity-30'}`} />
                      <Shield className={`h-4 w-4 ${resources.totp && resources.totp.secret ? 'text-green-400' : 'opacity-30'}`} />
                      <span className="ml-auto text-xs">{summary.clean ? '' : `${summary.count} issue${summary.count === 1 ? '' : 's'}`}</span>
                    </div>
                    <IdentityHealthList issues={issues} compact />
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && !isLoading && (
        <Card className="p-12 text-center">
          <Fingerprint className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold mb-2">{identities.length === 0 ? 'No Cloaked Identities yet' : 'No identities match your filters'}</h3>
          <p className="text-muted-foreground mb-4">
            {identities.length === 0 ? 'Create one bundle per service to keep your real details hidden.' : 'Try clearing a filter.'}
          </p>
          {identities.length === 0 && (
            <Button onClick={() => setShowCreate(true)} disabled={locked} className="gap-2"><Plus className="h-4 w-4" /> Create First Identity</Button>
          )}
        </Card>
      )}

      <CreateIdentityDialog
        open={showCreate} onOpenChange={setShowCreate}
        members={members} capabilities={capabilities} activeProfileId={activeProfileId}
        onCreated={(result) => { setLastResult(result); refresh(); }}
      />

      <IdentityDetailDrawer
        open={!!selected} onOpenChange={(o) => !o && setSelected(null)}
        identity={selectedDecorated?.identity} resources={selectedDecorated?.resources || {}}
        issues={selectedDecorated?.issues || []} capabilities={capabilities} locked={locked}
        onChanged={refresh}
      />
    </div>
  );
}
