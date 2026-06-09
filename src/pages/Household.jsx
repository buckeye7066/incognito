import { useState } from 'react';
import { incognito } from '@/api/client';
import vault from '@/lib/vault';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Plus, Trash2, Edit, Lock, ShieldCheck, LifeBuoy } from 'lucide-react';
import {
  ROLES, ROLE_LABELS, computeMemberPrivacyScore, scoreBand, householdScore,
  nextEmergencyState,
} from '@/lib/household';
import { useCapabilities } from '@/hooks/useCapabilities';
import CapabilityBadge from '@/components/common/CapabilityBadge';
import { CAPABILITY } from '@/providers/capabilities';

const CAP_LABELS = {
  [CAPABILITY.EMAIL_ALIAS]: 'Email aliases',
  [CAPABILITY.PHONE_ALIAS]: 'Phone aliases',
  [CAPABILITY.VIRTUAL_CARD]: 'Virtual cards',
  [CAPABILITY.BREACH_CHECK]: 'Breach check',
  [CAPABILITY.DARKWEB_MONITOR]: 'Dark-web monitor',
  [CAPABILITY.CALL_SCREEN]: 'Call screening',
  [CAPABILITY.LLM_ASSIST]: 'AI assistant',
  [CAPABILITY.VPN_CONNECT]: 'VPN connect',
  [CAPABILITY.AUTOFILL]: 'Autofill',
};

const BAND_COLOR = {
  strong: 'text-green-400', fair: 'text-amber-400',
  weak: 'text-orange-400', critical: 'text-red-400',
};

const EMPTY = { display_name: '', role: 'adult', email: '', phone: '', date_of_birth: '', ssn: '', notes: '' };

export default function Household() {
  const queryClient = useQueryClient();
  const locked = !vault.isUnlocked();
  const { capabilities } = useCapabilities();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const { data: members = [] } = useQuery({
    queryKey: ['householdMembers'],
    queryFn: () => incognito.entities.HouseholdMember.list('-created_date'),
  });
  const { data: grants = [] } = useQuery({
    queryKey: ['emergencyGrants'],
    queryFn: () => incognito.entities.EmergencyAccessGrant.list('-created_date'),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['householdMembers'] });
    queryClient.invalidateQueries({ queryKey: ['emergencyGrants'] });
  };

  const saveMember = useMutation({
    mutationFn: (data) => editing
      ? incognito.entities.HouseholdMember.update(editing.id, data)
      : incognito.entities.HouseholdMember.create(data),
    onSuccess: () => { invalidate(); setShowModal(false); setEditing(null); setForm(EMPTY); },
  });
  const deleteMember = useMutation({
    mutationFn: (id) => incognito.entities.HouseholdMember.delete(id),
    onSuccess: invalidate,
  });
  const transitionGrant = useMutation({
    mutationFn: ({ grant, action }) =>
      incognito.entities.EmergencyAccessGrant.update(grant.id, {
        status: nextEmergencyState(grant.status, action),
      }),
    onSuccess: invalidate,
  });
  const requestGrant = useMutation({
    mutationFn: (memberId) => incognito.entities.EmergencyAccessGrant.create({
      member_id: memberId, status: 'requested', requested_at: new Date().toISOString(),
    }),
    onSuccess: invalidate,
  });

  const memberScores = members.map((m) => computeMemberPrivacyScore(m.signals || {}));
  const hhScore = householdScore(memberScores);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = (m) => {
    setEditing(m);
    setForm({ ...EMPTY, ...m, ssn: m.__locked ? '' : (m.ssn || '') });
    setShowModal(true);
  };

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <Users className="w-8 h-8 text-red-400" /> Household
          </h1>
          <p className="text-gray-400">
            Your family privacy command center.
            {hhScore != null && (
              <> Household score: <span className={BAND_COLOR[scoreBand(hhScore)]}>{hhScore}/100</span></>
            )}
          </p>
        </div>
        <Button onClick={openCreate} disabled={locked}
          className="bg-gradient-to-r from-red-600 to-gray-700">
          <Plus className="w-5 h-5 mr-2" /> Add member
        </Button>
      </div>

      {locked && (
        <Card className="glass-card border-amber-500/30">
          <CardContent className="p-4 flex items-center gap-3 text-amber-300 text-sm">
            <Lock className="w-4 h-4" />
            Unlock the vault to add or view family members — their date of birth, SSN, and notes are encrypted at rest.
          </CardContent>
        </Card>
      )}

      {/* Capability panel — honest status of every family capability */}
      <Card className="glass-card border-red-500/20">
        <CardContent className="p-5">
          <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-red-400" /> What this household can do right now
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {Object.entries(CAP_LABELS).map(([cap, label]) => {
              const c = capabilities[cap];
              return (
                <div key={cap} className="flex items-center justify-between rounded-lg bg-slate-900/40 px-3 py-2">
                  <span className="text-sm text-gray-300">{label}</span>
                  <CapabilityBadge status={c?.status} detail={c?.providers?.[0]?.detail} />
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Statuses come from the provider registry — configure providers in Settings to turn “needs provider” into “ready”.
          </p>
        </CardContent>
      </Card>

      {/* Members */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {members.map((m, i) => {
          const score = memberScores[i];
          const hasSignals = m.signals && Object.keys(m.signals).length > 0;
          return (
            <Card key={m.id} className="glass-card border-red-500/20">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-lg font-semibold text-white">{m.display_name}</h4>
                    <Badge variant="outline" className="text-[10px] mt-1">{ROLE_LABELS[m.role] || m.role}</Badge>
                  </div>
                  <div className="text-right">
                    {hasSignals ? (
                      <div className={`text-2xl font-bold ${BAND_COLOR[scoreBand(score)]}`}>{score}</div>
                    ) : (
                      <div className="text-xs text-gray-500">no signals<br />tracked yet</div>
                    )}
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-400 space-y-0.5">
                  {m.email && <div>{m.email}</div>}
                  {m.phone && <div>{m.phone}</div>}
                  {(m.ssn || m.__locked) && <div>SSN: •••• (encrypted)</div>}
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={() => openEdit(m)} disabled={locked}
                    className="border-red-500/40 text-red-300"><Edit className="w-4 h-4" /></Button>
                  <Button variant="outline" size="sm" onClick={() => deleteMember.mutate(m.id)}
                    className="border-red-500/40 text-red-300"><Trash2 className="w-4 h-4" /></Button>
                  {m.role === 'emergency_contact' && (
                    <Button variant="outline" size="sm" onClick={() => requestGrant.mutate(m.id)}
                      className="border-blue-500/40 text-blue-300 ml-auto">
                      <LifeBuoy className="w-4 h-4 mr-1" /> Request access
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {members.length === 0 && !locked && (
          <Card className="glass-card border-red-500/20 md:col-span-2 lg:col-span-3">
            <CardContent className="p-12 text-center">
              <Users className="w-12 h-12 text-red-500/50 mx-auto mb-3" />
              <p className="text-gray-300 mb-4">No family members yet. Add yourself, your spouse, and dependents.</p>
              <Button onClick={openCreate} className="bg-gradient-to-r from-red-600 to-gray-700">
                <Plus className="w-4 h-4 mr-2" /> Add first member
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Emergency access */}
      {grants.length > 0 && (
        <Card className="glass-card border-blue-500/20">
          <CardContent className="p-5">
            <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
              <LifeBuoy className="w-4 h-4 text-blue-400" /> Emergency access requests
            </h3>
            <div className="space-y-2">
              {grants.map((g) => {
                const member = members.find((m) => m.id === g.member_id);
                return (
                  <div key={g.id} className="flex items-center justify-between rounded-lg bg-slate-900/40 px-3 py-2">
                    <span className="text-sm text-gray-300">
                      {member?.display_name || 'Unknown'} — <Badge variant="outline" className="text-[10px]">{g.status}</Badge>
                    </span>
                    <div className="flex gap-2">
                      {g.status === 'requested' && (
                        <>
                          <Button size="sm" variant="outline" className="border-green-500/40 text-green-300"
                            onClick={() => transitionGrant.mutate({ grant: g, action: 'approved' })}>Approve</Button>
                          <Button size="sm" variant="outline" className="border-red-500/40 text-red-300"
                            onClick={() => transitionGrant.mutate({ grant: g, action: 'denied' })}>Deny</Button>
                        </>
                      )}
                      {g.status === 'approved' && (
                        <Button size="sm" variant="outline" className="border-red-500/40 text-red-300"
                          onClick={() => transitionGrant.mutate({ grant: g, action: 'revoked' })}>Revoke</Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Member modal */}
      <Dialog open={showModal} onOpenChange={(o) => { if (!o) { setShowModal(false); setEditing(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit member' : 'Add family member'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label>
              <Input value={form.display_name} onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))} /></div>
            <div><Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                </SelectContent>
              </Select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label>
                <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
              <div><Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date of birth</Label>
                <Input type="date" value={form.date_of_birth} onChange={(e) => setForm((f) => ({ ...f, date_of_birth: e.target.value }))} /></div>
              <div><Label>SSN (encrypted)</Label>
                <Input value={form.ssn} placeholder="optional" onChange={(e) => setForm((f) => ({ ...f, ssn: e.target.value }))} /></div>
            </div>
            <div><Label>Notes (encrypted)</Label>
              <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
            <p className="text-xs text-gray-500">
              Date of birth, SSN, and notes are encrypted at rest and redacted when the vault is locked.
              For children, prefer storing only what you need.
            </p>
            <Button className="w-full bg-gradient-to-r from-red-600 to-gray-700"
              disabled={!form.display_name || saveMember.isPending}
              onClick={() => saveMember.mutate(form)}>
              {saveMember.isPending ? 'Saving…' : (editing ? 'Save changes' : 'Add member')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
