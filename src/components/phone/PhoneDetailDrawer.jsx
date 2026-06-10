import { useState } from 'react';
import { incognito } from '@/api/client';
import { useQuery } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, Copy, MessageSquare, PhoneForwarded, ShieldBan, ShieldCheck, Trash2, Lock, PhoneCall } from 'lucide-react';
import CapabilityBadge from '@/components/common/CapabilityBadge';
import { CAPABILITY, CAPABILITY_STATUS } from '@/providers/capabilities';
import { normalizeRules, summarizePhoneRules } from '@/lib/phoneRules';
import { estimateMonthlyCost, formatUsd } from '@/lib/phoneCost';

export default function PhoneDetailDrawer({ open, onOpenChange, alias, members = [], capabilities = {}, locked, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [blockInput, setBlockInput] = useState('');
  const [allowInput, setAllowInput] = useState('');
  const [fwd, setFwd] = useState(null);
  const [sms, setSms] = useState({ to: '', body: '' });

  const phoneCap = capabilities[CAPABILITY.PHONE_ALIAS];
  const inboxCap = capabilities[CAPABILITY.SMS_INBOX];
  const phoneReady = phoneCap?.status === CAPABILITY_STATUS.READY;
  const activityReady = inboxCap?.status === CAPABILITY_STATUS.READY;

  const { data: activity } = useQuery({
    queryKey: ['phoneActivity', alias?.id],
    queryFn: () => incognito.functions.invoke('getPhoneActivity', { phoneNumber: alias?.phone_number }),
    enabled: Boolean(open && alias && activityReady),
  });

  if (!alias) return null;
  const rules = normalizeRules(alias.rules);
  const cost = estimateMonthlyCost({ numberCount: 1 });
  const copy = (t) => t && navigator.clipboard.writeText(t);
  const act = async (fn) => { setBusy(true); try { await fn(); onChanged?.(); } finally { setBusy(false); } };
  const rule = (change) => act(() => incognito.functions.invoke('setPhoneRule', { aliasId: alias.id, change }));
  const update = (patch) => act(() => incognito.functions.invoke('updatePhoneAlias', { aliasId: alias.id, ...patch }));
  const toggleStatus = () => act(() => incognito.entities.PhoneAlias.update(alias.id, { status: alias.status === 'active' ? 'disabled' : 'active' }));
  const release = () => act(async () => { await incognito.functions.invoke('releasePhoneNumber', { aliasId: alias.id }); onOpenChange(false); });
  const sendSms = () => act(async () => { await incognito.functions.invoke('sendSMS', { fromAliasSid: alias.twilio_sid, to: sms.to, body: sms.body }); setSms({ to: '', body: '' }); });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            <Phone className="h-4 w-4 text-primary" />
            <span className="font-mono">{alias.phone_number}</span>
            <Badge variant={alias.status === 'active' ? 'default' : 'secondary'}>{alias.status}</Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-4">
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => copy(alias.phone_number)}><Copy className="h-3 w-3" /> Copy</Button>
            <Button size="sm" variant="outline" className="gap-1 text-xs" disabled={busy || locked} onClick={toggleStatus}>{alias.status === 'active' ? 'Disable' : 'Enable'}</Button>
            <Button size="sm" variant="destructive" className="gap-1 text-xs ml-auto" disabled={busy} onClick={release}><Trash2 className="h-3 w-3" /> Release number</Button>
          </div>
          <p className="text-[11px] text-muted-foreground">Estimated cost ≈ {formatUsd(cost.perNumber)}/mo for this number, plus Twilio usage. Estimate only — actual charges come from Twilio.</p>

          {/* Member + purpose + forwarding */}
          {members.length > 0 && (
            <div>
              <Label>Household member</Label>
              <Select value={alias.household_member_id || 'none'} onValueChange={(v) => update({ householdMemberId: v === 'none' ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Unassigned —</SelectItem>
                  {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="flex items-center gap-1.5"><PhoneForwarded className="h-3.5 w-3.5" /> Forward to (your real number)</Label>
            <div className="flex gap-2">
              <Input className="font-mono" defaultValue={alias.forwarding_number || ''} placeholder="+1…" onChange={(e) => setFwd(e.target.value)} />
              <Button size="sm" variant="outline" disabled={busy || locked} onClick={() => fwd != null && update({ forwardingNumber: fwd })}>Save</Button>
            </div>
          </div>

          {/* Rules */}
          <section className="rounded-lg border p-3 space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Call & text rules</h4>
            <p className="text-[11px] text-muted-foreground">Enforced by Twilio + the optional backend on inbound calls/texts. Locally they record intent.</p>
            <div className="flex items-center gap-2"><Switch checked={rules.forward_calls} disabled={busy || locked} onCheckedChange={(v) => rule({ type: v ? 'calls_on' : 'calls_off' })} /><Label className="flex-1">Forward calls</Label></div>
            <div className="flex items-center gap-2"><Switch checked={rules.forward_texts} disabled={busy || locked} onCheckedChange={(v) => rule({ type: v ? 'texts_on' : 'texts_off' })} /><Label className="flex-1">Forward texts</Label></div>
            <NumberList title="Blocked numbers" icon={ShieldBan} items={rules.blocked_numbers} input={blockInput} setInput={setBlockInput} disabled={busy || locked}
              onAdd={() => { rule({ type: 'block', number: blockInput }); setBlockInput(''); }} onRemove={(n) => rule({ type: 'unblock', number: n })} />
            <NumberList title="Allowed numbers (overrides block)" icon={ShieldCheck} items={rules.allowed_numbers} input={allowInput} setInput={setAllowInput} disabled={busy || locked}
              onAdd={() => { rule({ type: 'allow', number: allowInput }); setAllowInput(''); }} onRemove={(n) => rule({ type: 'unallow', number: n })} />
            <p className="text-[11px] text-muted-foreground">{summarizePhoneRules(rules)}</p>
          </section>

          {/* Send SMS — needs Twilio */}
          <section className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-primary" /><h4 className="text-sm font-medium flex-1">Send SMS</h4><CapabilityBadge status={phoneCap?.status} detail={phoneCap?.providers?.[0]?.detail} /></div>
            {phoneReady ? (
              <>
                <Input className="h-8 font-mono" placeholder="+1… recipient" value={sms.to} onChange={(e) => setSms((s) => ({ ...s, to: e.target.value }))} />
                <Textarea rows={2} placeholder="Message" value={sms.body} onChange={(e) => setSms((s) => ({ ...s, body: e.target.value }))} />
                <Button size="sm" disabled={busy || !sms.to || !sms.body} onClick={sendSms}>Send</Button>
              </>
            ) : <p className="text-xs text-muted-foreground">Sending requires Twilio credentials (Settings → Providers).</p>}
          </section>

          {/* Activity — needs backend */}
          <section className="rounded-lg border p-3">
            <div className="flex items-center gap-2 mb-2"><PhoneCall className="h-4 w-4 text-primary" /><h4 className="text-sm font-medium flex-1">SMS inbox & call log</h4><CapabilityBadge status={inboxCap?.status} detail={inboxCap?.providers?.[0]?.detail} /></div>
            {!activityReady ? (
              <p className="text-xs text-muted-foreground">Inbound SMS and call logs need the optional self-hosted backend (Twilio webhooks). See docs/OPTIONAL_BACKEND.md.</p>
            ) : !activity?.data?.activityAvailable ? (
              <p className="text-xs text-muted-foreground">{activity?.data?.reason || 'Activity unavailable.'}</p>
            ) : (activity.data.messages.length + activity.data.calls.length) === 0 ? (
              <p className="text-xs text-muted-foreground">No activity yet.</p>
            ) : (
              <div className="space-y-1.5">
                {activity.data.calls.map((c) => (
                  <div key={`c${c.id}`} className="rounded bg-slate-900/40 px-2.5 py-1.5 text-xs flex justify-between gap-2">
                    <span className="flex items-center gap-1.5"><PhoneCall className="h-3 w-3" /> Call from {c.from || 'unknown'}</span>
                    <span className="text-muted-foreground shrink-0">{c.received_at ? new Date(c.received_at).toLocaleString() : ''}</span>
                  </div>
                ))}
                {activity.data.messages.map((m) => (
                  <div key={`m${m.id}`} className="rounded bg-slate-900/40 px-2.5 py-1.5 text-xs flex justify-between gap-2">
                    <span className="flex items-center gap-1.5"><MessageSquare className="h-3 w-3" /> SMS from {m.from || 'unknown'}</span>
                    <span className="text-muted-foreground shrink-0">{m.received_at ? new Date(m.received_at).toLocaleString() : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {locked && <div className="flex items-center gap-2 text-xs text-amber-300"><Lock className="h-3.5 w-3.5" /> Unlock the vault to edit this number.</div>}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function NumberList({ title, icon: Icon, items, input, setInput, onAdd, onRemove, disabled }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" /> {title}</Label>
      <div className="flex gap-2">
        <Input className="h-8 font-mono text-xs" placeholder="+1 555 123 4567" value={input} disabled={disabled}
          onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && input.trim()) onAdd(); }} />
        <Button size="sm" className="h-8" disabled={disabled || !input.trim()} onClick={onAdd}>Add</Button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map((n) => (
            <span key={n} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-mono">
              {n}<button disabled={disabled} onClick={() => onRemove(n)} className="hover:text-red-400">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
