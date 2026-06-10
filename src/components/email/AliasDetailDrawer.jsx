import { useState } from 'react';
import { incognito } from '@/api/client';
import { useQuery } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Inbox, ShieldBan, ShieldCheck, Trash2, Lock, Mail } from 'lucide-react';
import CapabilityBadge from '@/components/common/CapabilityBadge';
import { CAPABILITY, CAPABILITY_STATUS } from '@/providers/capabilities';
import { normalizeRules } from '@/lib/aliasRules';

export default function AliasDetailDrawer({ open, onOpenChange, alias, members = [], capabilities = {}, locked, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [blockInput, setBlockInput] = useState('');
  const [allowInput, setAllowInput] = useState('');
  const [desc, setDesc] = useState('');

  const inboxCap = capabilities[CAPABILITY.EMAIL_INBOX];
  const inboxReady = inboxCap?.status === CAPABILITY_STATUS.READY;

  const { data: inbox } = useQuery({
    queryKey: ['aliasInbox', alias?.id],
    queryFn: () => incognito.functions.invoke('getAliasInbox', { aliasEmail: alias?.alias_email }),
    enabled: Boolean(open && alias && inboxReady),
  });

  if (!alias) return null;
  const rules = normalizeRules(alias.rules);
  const copy = (t) => t && navigator.clipboard.writeText(t);

  const act = async (fn) => { setBusy(true); try { await fn(); onChanged?.(); } finally { setBusy(false); } };
  const rule = (change) => act(() => incognito.functions.invoke('setAliasRule', { aliasId: alias.id, change }));
  const saveDesc = () => act(() => incognito.functions.invoke('updateEmailAlias', { aliasId: alias.id, description: desc }));
  const setMember = (v) => act(() => incognito.functions.invoke('updateEmailAlias', { aliasId: alias.id, householdMemberId: v === 'none' ? null : v }));
  const toggleStatus = () => act(() => incognito.functions.invoke('toggleEmailAlias', { aliasId: alias.id }));
  const del = () => act(async () => { await incognito.functions.invoke('deleteEmailAlias', { aliasId: alias.id }); onOpenChange(false); });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            <Mail className="h-4 w-4 text-primary" />
            <span className="font-mono text-sm break-all">{alias.alias_email}</span>
            {alias.placeholder && <Badge variant="outline" className="text-[10px]">Placeholder only</Badge>}
            <Badge variant={alias.status === 'active' ? 'default' : 'secondary'}>{alias.status}</Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-4">
          {alias.placeholder && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-300">
              This is a local placeholder (undeliverable <code>.invalid</code> address). Configure SimpleLogin/addy.io in Settings to mint a real forwarding alias.
            </div>
          )}

          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => copy(alias.alias_email)}><Copy className="h-3 w-3" /> Copy</Button>
            <Button size="sm" variant="outline" className="gap-1 text-xs" disabled={busy || locked} onClick={toggleStatus}>
              {alias.status === 'active' ? 'Disable' : 'Enable'}
            </Button>
            <Button size="sm" variant="destructive" className="gap-1 text-xs ml-auto" disabled={busy} onClick={del}><Trash2 className="h-3 w-3" /> Delete</Button>
          </div>

          {/* Member + description */}
          {members.length > 0 && (
            <div>
              <Label>Household member</Label>
              <Select value={alias.household_member_id || 'none'} onValueChange={setMember}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Unassigned —</SelectItem>
                  {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Description</Label>
            <div className="flex gap-2">
              <Input defaultValue={alias.description || ''} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Shopping" />
              <Button size="sm" variant="outline" disabled={busy || locked} onClick={saveDesc}>Save</Button>
            </div>
          </div>

          {/* Rules */}
          <section className="rounded-lg border p-3 space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Forwarding rules</h4>
            <p className="text-[11px] text-muted-foreground">Rules are enforced by your alias provider / optional backend on inbound mail. Locally they record intent.</p>
            <div className="flex items-center gap-2">
              <Switch checked={rules.forward} disabled={busy || locked} onCheckedChange={(v) => rule({ type: v ? 'forward_on' : 'forward_off' })} />
              <Label className="flex-1">Forward to my real inbox</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={rules.muted} disabled={busy || locked} onCheckedChange={(v) => rule({ type: v ? 'mute' : 'unmute' })} />
              <Label className="flex-1">Mute (stop forwarding without disabling)</Label>
            </div>

            <SenderList title="Blocked senders" icon={ShieldBan} items={rules.blocked_senders}
              input={blockInput} setInput={setBlockInput} disabled={busy || locked}
              onAdd={() => { rule({ type: 'block', sender: blockInput }); setBlockInput(''); }}
              onRemove={(s) => rule({ type: 'unblock', sender: s })} />
            <SenderList title="Allowed senders (overrides block)" icon={ShieldCheck} items={rules.allowed_senders}
              input={allowInput} setInput={setAllowInput} disabled={busy || locked}
              onAdd={() => { rule({ type: 'allow', sender: allowInput }); setAllowInput(''); }}
              onRemove={(s) => rule({ type: 'unallow', sender: s })} />
          </section>

          {/* Inbox */}
          <section className="rounded-lg border p-3">
            <div className="flex items-center gap-2 mb-2">
              <Inbox className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-medium flex-1">Inbox</h4>
              <CapabilityBadge status={inboxCap?.status} detail={inboxCap?.providers?.[0]?.detail} />
            </div>
            {!inboxReady ? (
              <p className="text-xs text-muted-foreground">
                Receive/forward only. A dedicated inbox needs the optional self-hosted backend (see docs/OPTIONAL_BACKEND.md). Sending “as alias” is not supported from the web app.
              </p>
            ) : !inbox?.data?.inboxAvailable ? (
              <p className="text-xs text-muted-foreground">{inbox?.data?.reason || 'Inbox unavailable.'}</p>
            ) : inbox.data.messages.length === 0 ? (
              <p className="text-xs text-muted-foreground">No messages yet.</p>
            ) : (
              <div className="space-y-1.5">
                {inbox.data.messages.map((m) => (
                  <div key={m.id} className="rounded bg-slate-900/40 px-2.5 py-1.5 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium truncate">{m.from || 'unknown'}</span>
                      <span className="text-muted-foreground shrink-0">{m.received_at ? new Date(m.received_at).toLocaleString() : ''}</span>
                    </div>
                    {m.subject && <div className="text-muted-foreground truncate">{m.subject}</div>}
                  </div>
                ))}
              </div>
            )}
          </section>

          {locked && (
            <div className="flex items-center gap-2 text-xs text-amber-300"><Lock className="h-3.5 w-3.5" /> Unlock the vault to edit this alias.</div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SenderList({ title, icon: Icon, items, input, setInput, onAdd, onRemove, disabled }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" /> {title}</Label>
      <div className="flex gap-2">
        <Input className="h-8 text-xs" placeholder="sender@example.com" value={input} disabled={disabled}
          onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && input.trim()) onAdd(); }} />
        <Button size="sm" className="h-8" disabled={disabled || !input.trim()} onClick={onAdd}>Add</Button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px]">
              {s}<button disabled={disabled} onClick={() => onRemove(s)} className="hover:text-red-400">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
