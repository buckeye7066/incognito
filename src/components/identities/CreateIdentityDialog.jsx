import { useState } from 'react';
import { incognito, generateSecurePassword } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RefreshCw, Mail, CreditCard, Phone, KeyRound, Shield } from 'lucide-react';
import CapabilityBadge from '@/components/common/CapabilityBadge';
import { CAPABILITY, CAPABILITY_STATUS } from '@/providers/capabilities';
import { IDENTITY_CATEGORIES, generateUsername } from './identityConstants';

const EMPTY = {
  household_member_id: 'none', service_name: '', service_url: '', category: 'general',
  username: '', notes: '',
  createPassword: true, autoGenerate: true, password: '',
  createEmail: false, createCard: false, addTotp: false,
};

export default function CreateIdentityDialog({ open, onOpenChange, members = [], capabilities = {}, activeProfileId, onCreated }) {
  const [form, setForm] = useState(EMPTY);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const reset = () => { setForm(EMPTY); setError(''); };

  const emailCap = capabilities[CAPABILITY.EMAIL_ALIAS];
  const cardCap = capabilities[CAPABILITY.VIRTUAL_CARD];
  const phoneCap = capabilities[CAPABILITY.PHONE_ALIAS];
  const emailReady = emailCap?.status === CAPABILITY_STATUS.READY;
  const cardReady = cardCap?.status === CAPABILITY_STATUS.READY;

  const submit = async () => {
    setPending(true); setError('');
    try {
      const res = await incognito.functions.invoke('createIdentityBundle', {
        profileId: activeProfileId || null,
        householdMemberId: form.household_member_id === 'none' ? null : form.household_member_id,
        serviceName: form.service_name,
        serviceUrl: form.service_url,
        category: form.category,
        username: form.username,
        notes: form.notes,
        password: { create: form.createPassword, value: form.autoGenerate ? null : form.password },
        email: { create: form.createEmail },
        card: { create: form.createCard },
        totp: { placeholder: form.addTotp },
        readiness: { email: emailReady, card: cardReady },
      });
      onCreated?.(res.data);
      reset();
      onOpenChange(false);
    } catch (e) {
      setError(e.message || 'Failed to create identity');
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Create Cloaked Identity</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {members.length > 0 && (
            <div>
              <Label>Household member</Label>
              <Select value={form.household_member_id} onValueChange={(v) => set({ household_member_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Unassigned —</SelectItem>
                  {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Service name *</Label>
            <Input placeholder="e.g. Amazon, Netflix" value={form.service_name}
              onChange={(e) => set({ service_name: e.target.value })} />
          </div>
          <div>
            <Label>Service URL</Label>
            <Input placeholder="https://…" value={form.service_url}
              onChange={(e) => set({ service_url: e.target.value })} />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={form.category} onValueChange={(v) => set({ category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {IDENTITY_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Username</Label>
            <div className="flex gap-2">
              <Input value={form.username} placeholder="optional"
                onChange={(e) => set({ username: e.target.value })} />
              <Button type="button" variant="outline" size="icon" title="Generate username"
                onClick={() => set({ username: generateUsername(form.service_name) })}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Password — local, always available */}
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              <Label className="flex-1">Create password (local)</Label>
              <Switch checked={form.createPassword} onCheckedChange={(v) => set({ createPassword: v })} />
            </div>
            {form.createPassword && (
              <div className="flex items-center gap-2 pl-6">
                <Switch checked={form.autoGenerate} onCheckedChange={(v) => set({ autoGenerate: v })} />
                <Label className="text-sm">Auto-generate strong password</Label>
                {!form.autoGenerate && (
                  <Input className="h-8" value={form.password} placeholder="enter password"
                    onChange={(e) => set({ password: e.target.value })} />
                )}
                {form.autoGenerate && (
                  <Button type="button" size="sm" variant="ghost"
                    onClick={() => set({ autoGenerate: false, password: generateSecurePassword(20) })}>preview</Button>
                )}
              </div>
            )}
          </div>

          {/* Email alias — provider-gated */}
          <ResourceToggle
            icon={Mail} label="Email alias" cap={emailCap} ready={emailReady}
            checked={form.createEmail} onChange={(v) => set({ createEmail: v })}
          />
          {/* Virtual card — provider-gated */}
          <ResourceToggle
            icon={CreditCard} label="Virtual card" cap={cardCap} ready={cardReady}
            checked={form.createCard} onChange={(v) => set({ createCard: v })}
          />
          {/* Phone alias — show status only (provisioning happens on the Phone Aliases page) */}
          <div className="rounded-lg border p-3 flex items-center gap-2 opacity-90">
            <Phone className="h-4 w-4 text-primary" />
            <Label className="flex-1">Phone alias</Label>
            <CapabilityBadge status={phoneCap?.status} detail={phoneCap?.providers?.[0]?.detail} />
          </div>
          {phoneCap?.status !== CAPABILITY_STATUS.READY && (
            <p className="-mt-2 pl-1 text-[11px] text-muted-foreground">Add a phone alias from the Phone Aliases page once a provider/backend is configured.</p>
          )}

          {/* TOTP placeholder */}
          <div className="rounded-lg border p-3 flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <Label className="flex-1">Add 2FA / TOTP placeholder<span className="block text-[11px] text-muted-foreground">Set up the secret later from the identity detail.</span></Label>
            <Switch checked={form.addTotp} onCheckedChange={(v) => set({ addTotp: v })} />
          </div>

          <div>
            <Label>Notes (encrypted)</Label>
            <Input value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <Button className="w-full" disabled={!form.service_name || pending} onClick={submit}>
            {pending ? 'Creating…' : 'Create Identity'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResourceToggle({ icon: Icon, label, cap, ready, checked, onChange }) {
  return (
    <div className="rounded-lg border p-3 space-y-1">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <Label className="flex-1">{label}</Label>
        <CapabilityBadge status={cap?.status} detail={cap?.providers?.[0]?.detail} />
        <Switch checked={ready && checked} disabled={!ready} onCheckedChange={onChange} />
      </div>
      {!ready && (
        <p className="pl-6 text-[11px] text-muted-foreground">
          Not created — provider not ready. The rest of the identity is still created locally.
        </p>
      )}
    </div>
  );
}
