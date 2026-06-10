import { useState } from 'react';
import { incognito } from '@/api/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Mail, Phone, CreditCard, KeyRound, Shield, Copy, Eye, EyeOff, Lock,
  EyeOff as MuteIcon, Ban, Archive, AlertOctagon, RotateCcw, Trash2, Link2Off, RefreshCw,
} from 'lucide-react';
import CapabilityBadge from '@/components/common/CapabilityBadge';
import IdentityHealthList from './IdentityHealthList';
import DeleteIdentityDialog from './DeleteIdentityDialog';
import { categoryInfo, IDENTITY_STATUS_META } from './identityConstants';
import { CAPABILITY } from '@/providers/capabilities';

function Row({ label, value, mono, onCopy, canReveal, revealed, onToggleReveal, locked }) {
  const hidden = canReveal && !revealed;
  return (
    <div className="flex items-center justify-between gap-2 text-sm py-1">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`truncate ${mono ? 'font-mono text-xs' : ''}`}>
          {value == null || value === '' ? '—' : (hidden ? '••••••••••' : value)}
        </span>
        {canReveal && (
          <button title={locked ? 'Unlock vault to reveal' : 'Reveal'} disabled={locked}
            onClick={onToggleReveal} className="disabled:opacity-40">
            {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        )}
        {onCopy && value && !hidden && (
          <button title="Copy" onClick={onCopy}><Copy className="h-3.5 w-3.5" /></button>
        )}
      </div>
    </div>
  );
}

export default function IdentityDetailDrawer({
  open, onOpenChange, identity, resources = {}, issues = [], capabilities = {}, locked, onChanged,
}) {
  const [reveal, setReveal] = useState({});
  const [showDelete, setShowDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!identity) return null;

  const { password, email, phone, card, totp } = resources;
  const cat = categoryInfo(identity.category);
  const statusMeta = IDENTITY_STATUS_META[identity.status] || { label: identity.status, variant: 'secondary' };
  const linkedCount = ['password_entry_id', 'email_alias_id', 'phone_alias_id', 'virtual_card_id', 'totp_secret_id']
    .filter((k) => identity[k]).length;

  const copy = (t) => t && navigator.clipboard.writeText(t);

  const act = async (fn) => {
    setBusy(true);
    try { await fn(); onChanged?.(); } finally { setBusy(false); }
  };

  const setStatus = (status) => act(() => incognito.functions.invoke('updateIdentityStatus', { identityId: identity.id, status }));
  const rotate = () => act(() => incognito.functions.invoke('rotateIdentityPassword', { identityId: identity.id }));
  const unlink = (resourceType, deleteRecord) => act(() => incognito.functions.invoke('unlinkIdentityResource', { identityId: identity.id, resourceType, deleteRecord }));
  const doDelete = async (mode) => { await incognito.functions.invoke('deleteIdentity', { identityId: identity.id, mode }); onChanged?.(); onOpenChange(false); };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${cat.color}`} />
            {identity.service_name}
            <Badge variant={statusMeta.variant} className="ml-1">{statusMeta.label}</Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-4">
          {locked && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-300">
              <Lock className="h-3.5 w-3.5" /> Vault locked — sensitive values are hidden.
            </div>
          )}

          {/* Overview */}
          <section className="space-y-1">
            <Row label="Service URL" value={identity.service_url} onCopy={() => copy(identity.service_url)} />
            <Row label="Category" value={cat.label} />
            <Row label="Username" value={identity.username} onCopy={() => copy(identity.username)} />
          </section>

          {/* Health */}
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Health</h4>
            <IdentityHealthList issues={issues} />
          </section>

          {/* Password */}
          <Resource title="Password" icon={KeyRound} present={!!password}
            onUnlink={password ? (del) => unlink('password', del) : null}
            extra={password && <Button size="sm" variant="outline" className="gap-1 text-xs" disabled={busy || locked} onClick={rotate}><RefreshCw className="h-3 w-3" /> Rotate</Button>}>
            {password ? (
              <>
                <Row label="Username" value={password.username} onCopy={() => copy(password.username)} />
                <Row label="Password" value={password.password} mono locked={locked}
                  canReveal revealed={reveal.pw} onToggleReveal={() => setReveal((r) => ({ ...r, pw: !r.pw }))}
                  onCopy={() => copy(password.password)} />
                <Row label="Strength" value={password.strength} />
              </>
            ) : <Empty text="No password linked." />}
          </Resource>

          {/* Email alias */}
          <Resource title="Email alias" icon={Mail} present={!!email}
            badge={<CapabilityBadge status={capabilities[CAPABILITY.EMAIL_ALIAS]?.status} detail={capabilities[CAPABILITY.EMAIL_ALIAS]?.providers?.[0]?.detail} />}
            limitation={capabilities[CAPABILITY.EMAIL_ALIAS]?.providers?.[0]?.limitations}
            onUnlink={email ? (del) => unlink('email', del) : null}>
            {email ? (
              <>
                <Row label="Alias" value={email.alias_email} onCopy={() => copy(email.alias_email)} />
                <Row label="Status" value={email.status} />
                <Row label="Forwards to" value={email.actual_email} mono locked={locked}
                  canReveal revealed={reveal.em} onToggleReveal={() => setReveal((r) => ({ ...r, em: !r.em }))} />
              </>
            ) : <Empty text="No email alias linked." />}
          </Resource>

          {/* Phone alias */}
          <Resource title="Phone alias" icon={Phone} present={!!phone}
            badge={<CapabilityBadge status={capabilities[CAPABILITY.PHONE_ALIAS]?.status} detail={capabilities[CAPABILITY.PHONE_ALIAS]?.providers?.[0]?.detail} />}
            limitation={capabilities[CAPABILITY.PHONE_ALIAS]?.providers?.[0]?.limitations}
            onUnlink={phone ? (del) => unlink('phone', del) : null}>
            {phone ? (
              <>
                <Row label="Number" value={phone.phone_number} onCopy={() => copy(phone.phone_number)} />
                <Row label="Status" value={phone.status} />
              </>
            ) : <Empty text="No phone alias linked." />}
          </Resource>

          {/* Virtual card */}
          <Resource title="Virtual card" icon={CreditCard} present={!!card}
            badge={<CapabilityBadge status={capabilities[CAPABILITY.VIRTUAL_CARD]?.status} detail={capabilities[CAPABILITY.VIRTUAL_CARD]?.providers?.[0]?.detail} />}
            limitation={capabilities[CAPABILITY.VIRTUAL_CARD]?.providers?.[0]?.limitations}
            onUnlink={card ? (del) => unlink('card', del) : null}>
            {card ? (
              <>
                <Row label="Card" value={card.last_four ? `•••• ${card.last_four}` : '—'} />
                <Row label="Merchant" value={card.merchant_name} />
                <Row label="Status" value={card.status} />
              </>
            ) : <Empty text="No virtual card linked." />}
          </Resource>

          {/* TOTP */}
          <Resource title="2FA / TOTP" icon={Shield} present={!!totp}
            onUnlink={totp ? (del) => unlink('totp', del) : null}>
            {totp ? (
              totp.pending || !totp.secret
                ? <Empty text="Placeholder — add the secret from the Authenticator page." />
                : <Row label="Secret set" value="yes" />
            ) : <Empty text="No 2FA set up." />}
          </Resource>

          {/* Custom fields + notes */}
          {identity.custom_fields && Object.keys(identity.custom_fields).length > 0 && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Custom fields</h4>
              {Object.entries(identity.custom_fields).map(([k, v]) => (
                <Row key={k} label={k} value={v} onCopy={() => copy(v)} />
              ))}
            </section>
          )}
          {identity.notes && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Notes</h4>
              <p className="text-sm whitespace-pre-wrap">{locked ? '••••••••' : identity.notes}</p>
            </section>
          )}

          {/* Status actions */}
          <section className="border-t pt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Actions</h4>
            <div className="flex flex-wrap gap-2">
              {identity.status === 'active'
                ? <Button size="sm" variant="outline" className="gap-1 text-xs" disabled={busy} onClick={() => setStatus('muted')}><MuteIcon className="h-3 w-3" /> Mute</Button>
                : identity.status === 'muted' && <Button size="sm" variant="outline" className="gap-1 text-xs" disabled={busy} onClick={() => setStatus('active')}><Eye className="h-3 w-3" /> Unmute</Button>}
              {identity.status !== 'disabled'
                ? <Button size="sm" variant="outline" className="gap-1 text-xs" disabled={busy} onClick={() => setStatus('disabled')}><Ban className="h-3 w-3" /> Disable</Button>
                : <Button size="sm" variant="outline" className="gap-1 text-xs" disabled={busy} onClick={() => setStatus('active')}><Eye className="h-3 w-3" /> Enable</Button>}
              {identity.status !== 'archived'
                ? <Button size="sm" variant="outline" className="gap-1 text-xs" disabled={busy} onClick={() => setStatus('archived')}><Archive className="h-3 w-3" /> Archive</Button>
                : <Button size="sm" variant="outline" className="gap-1 text-xs" disabled={busy} onClick={() => setStatus('active')}><RotateCcw className="h-3 w-3" /> Restore</Button>}
              {identity.status !== 'compromised' && (
                <Button size="sm" variant="outline" className="gap-1 text-xs text-red-400 border-red-500/40" disabled={busy} onClick={() => setStatus('compromised')}>
                  <AlertOctagon className="h-3 w-3" /> Mark compromised
                </Button>
              )}
              <Button size="sm" variant="destructive" className="gap-1 text-xs ml-auto" onClick={() => setShowDelete(true)}>
                <Trash2 className="h-3 w-3" /> Delete
              </Button>
            </div>
          </section>
        </div>

        <DeleteIdentityDialog open={showDelete} onOpenChange={setShowDelete}
          identity={identity} linkedCount={linkedCount} onConfirm={doDelete} />
      </SheetContent>
    </Sheet>
  );
}

function Resource({ title, icon: Icon, present, badge, limitation, extra, onUnlink, children }) {
  const [showUnlink, setShowUnlink] = useState(false);
  return (
    <section className="rounded-lg border p-3">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-medium flex-1">{title}</h4>
        {badge}
        {extra}
        {onUnlink && (
          <button title="Unlink" onClick={() => setShowUnlink((s) => !s)} className="text-muted-foreground hover:text-foreground">
            <Link2Off className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {children}
      {showUnlink && onUnlink && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Unlink:</span>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { onUnlink(false); setShowUnlink(false); }}>Keep record</Button>
          <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => { onUnlink(true); setShowUnlink(false); }}>Delete record</Button>
        </div>
      )}
      {present && limitation && <p className="mt-2 text-[11px] text-muted-foreground">{limitation}</p>}
    </section>
  );
}

function Empty({ text }) {
  return <p className="text-xs text-muted-foreground">{text}</p>;
}
