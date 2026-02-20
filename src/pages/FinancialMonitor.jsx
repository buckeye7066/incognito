import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CreditCard, Plus, AlertTriangle, CheckCircle, Landmark, TrendingUp, DollarSign, Bell, Trash2, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ACCOUNT_ICONS = {
  checking: '🏦', savings: '💰', credit_card: '💳', investment: '📈',
  retirement: '🧓', mortgage: '🏠', auto_loan: '🚗', student_loan: '🎓',
  crypto: '₿', other: '📋'
};

const ACTIVITY_LABELS = {
  unauthorized_charge: 'Unauthorized Charge',
  new_account_opened: 'New Account Opened in My Name',
  address_change: 'Address Changed Without Authorization',
  password_reset: 'Unexpected Password Reset',
  large_withdrawal: 'Large Unexpected Withdrawal',
  foreign_transaction: 'Foreign Transaction',
  credit_inquiry: 'Unauthorized Credit Inquiry',
  sim_swap: 'SIM Swap / Phone Takeover',
  tax_fraud: 'Tax Fraud',
  medical_fraud: 'Medical Identity Fraud',
  benefits_fraud: 'Government Benefits Fraud',
  other: 'Other Suspicious Activity'
};

export default function FinancialMonitor() {
  const queryClient = useQueryClient();
  const activeProfileId = typeof window !== 'undefined' ? window.activeProfileId : null;

  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showLogActivity, setShowLogActivity] = useState(false);
  const [accountForm, setAccountForm] = useState({ account_type: 'checking', institution_name: '', last_four: '', nickname: '', alert_threshold: 500, monitoring_enabled: true });
  const [activityForm, setActivityForm] = useState({ activity_type: 'unauthorized_charge', description: '', amount: '', detected_date: new Date().toISOString().split('T')[0], institution: '', status: 'new' });

  const { data: allAccounts = [] } = useQuery({
    queryKey: ['financialAccounts'],
    queryFn: () => base44.entities.FinancialAccount.list()
  });

  const { data: allActivities = [] } = useQuery({
    queryKey: ['suspiciousActivities'],
    queryFn: () => base44.entities.SuspiciousActivity.list()
  });

  const accounts = allAccounts.filter(a => !activeProfileId || a.profile_id === activeProfileId);
  const activities = allActivities.filter(a => !activeProfileId || a.profile_id === activeProfileId);

  const createAccount = useMutation({
    mutationFn: (data) => base44.entities.FinancialAccount.create({ ...data, profile_id: activeProfileId }),
    onSuccess: () => { queryClient.invalidateQueries(['financialAccounts']); setShowAddAccount(false); setAccountForm({ account_type: 'checking', institution_name: '', last_four: '', nickname: '', alert_threshold: 500, monitoring_enabled: true }); }
  });

  const deleteAccount = useMutation({
    mutationFn: (id) => base44.entities.FinancialAccount.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['financialAccounts'])
  });

  const logActivity = useMutation({
    mutationFn: (data) => base44.entities.SuspiciousActivity.create({ ...data, profile_id: activeProfileId, amount: data.amount ? parseFloat(data.amount) : undefined }),
    onSuccess: () => { queryClient.invalidateQueries(['suspiciousActivities']); setShowLogActivity(false); }
  });

  const updateActivity = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SuspiciousActivity.update(id, data),
    onSuccess: () => queryClient.invalidateQueries(['suspiciousActivities'])
  });

  const openActivities = activities.filter(a => a.status === 'new' || a.status === 'investigating');
  const totalLoss = activities.filter(a => a.status !== 'false_positive').reduce((s, a) => s + (a.estimated_loss || 0), 0);

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Financial Monitor</h1>
          <p className="text-gray-400">Track accounts and flag suspicious activity — like Aura's fraud detection</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => setShowLogActivity(true)} variant="outline" className="border-red-500/50 text-red-300 hover:bg-red-500/10">
            <ShieldAlert className="w-4 h-4 mr-2" /> Log Suspicious Activity
          </Button>
          <Button onClick={() => setShowAddAccount(true)} className="bg-gradient-to-r from-red-600 to-purple-600">
            <Plus className="w-4 h-4 mr-2" /> Add Account
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Monitored Accounts', value: accounts.filter(a => a.monitoring_enabled).length, icon: Landmark, color: 'text-blue-400' },
          { label: 'Open Incidents', value: openActivities.length, icon: AlertTriangle, color: openActivities.length > 0 ? 'text-red-400' : 'text-green-400' },
          { label: 'Resolved', value: activities.filter(a => a.status === 'resolved').length, icon: CheckCircle, color: 'text-green-400' },
          { label: 'Est. Total Loss', value: `$${totalLoss.toLocaleString()}`, icon: DollarSign, color: totalLoss > 0 ? 'text-red-400' : 'text-green-400' },
        ].map(s => (
          <Card key={s.label} className="glass-card border-red-500/10">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`w-8 h-8 ${s.color}`} />
              <div>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-gray-400 text-xs">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Open Incidents Alert */}
      <AnimatePresence>
        {openActivities.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="glass-card border-red-500/40 bg-red-500/5">
              <CardContent className="p-4 flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" />
                <div>
                  <p className="text-red-300 font-semibold">{openActivities.length} open incident{openActivities.length > 1 ? 's' : ''} require attention</p>
                  <p className="text-gray-400 text-sm">Review suspicious activity below and report to relevant institutions.</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Accounts */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-400" /> Monitored Accounts ({accounts.length})
          </h2>

          {accounts.length === 0 ? (
            <Card className="glass-card border-slate-700">
              <CardContent className="p-8 text-center">
                <Landmark className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No accounts added yet</p>
                <Button onClick={() => setShowAddAccount(true)} className="mt-3 bg-gradient-to-r from-red-600 to-purple-600" size="sm">
                  <Plus className="w-4 h-4 mr-1" /> Add First Account
                </Button>
              </CardContent>
            </Card>
          ) : (
            accounts.map(account => {
              const compromised = activities.some(a => a.account_id === account.id && (a.status === 'new' || a.status === 'investigating'));
              return (
                <Card key={account.id} className={`glass-card ${compromised ? 'border-red-500/40' : 'border-slate-700'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{ACCOUNT_ICONS[account.account_type]}</span>
                        <div>
                          <p className="text-white font-medium">{account.nickname || account.institution_name}</p>
                          <p className="text-gray-400 text-xs">
                            {account.institution_name}{account.last_four ? ` ••••${account.last_four}` : ''} · {account.account_type.replace(/_/g, ' ')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {compromised && <Badge className="bg-red-500/20 text-red-300 border-0 text-xs">⚠ Alert</Badge>}
                        {account.monitoring_enabled
                          ? <Badge className="bg-green-500/10 text-green-400 border-0 text-xs">Monitoring</Badge>
                          : <Badge className="bg-gray-500/10 text-gray-400 border-0 text-xs">Paused</Badge>}
                        <Button variant="ghost" size="icon" onClick={() => deleteAccount.mutate(account.id)} className="h-7 w-7 text-red-400 hover:bg-red-500/10">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    {account.alert_threshold && (
                      <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                        <Bell className="w-3 h-3" /> Alert threshold: ${account.alert_threshold.toLocaleString()}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Suspicious Activity Log */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-400" /> Incident Log ({activities.length})
          </h2>

          {activities.length === 0 ? (
            <Card className="glass-card border-slate-700">
              <CardContent className="p-8 text-center">
                <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
                <p className="text-green-300 font-medium">No suspicious activity logged</p>
                <p className="text-gray-400 text-sm mt-1">Stay vigilant and log anything unusual immediately</p>
              </CardContent>
            </Card>
          ) : (
            activities.sort((a, b) => new Date(b.detected_date) - new Date(a.detected_date)).map(activity => {
              const statusColors = { new: 'text-red-400 bg-red-500/10', investigating: 'text-yellow-400 bg-yellow-500/10', reported: 'text-blue-400 bg-blue-500/10', resolved: 'text-green-400 bg-green-500/10', false_positive: 'text-gray-400 bg-gray-500/10' };
              return (
                <Card key={activity.id} className={`glass-card ${activity.status === 'new' ? 'border-red-500/40' : 'border-slate-700'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-white font-medium text-sm">{ACTIVITY_LABELS[activity.activity_type]}</p>
                        <p className="text-gray-400 text-xs">{activity.institution} · {activity.detected_date}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {activity.amount && <span className="text-red-300 text-sm font-mono">${activity.amount.toLocaleString()}</span>}
                        <Badge className={`text-xs border-0 ${statusColors[activity.status]}`}>{activity.status}</Badge>
                      </div>
                    </div>
                    {activity.description && <p className="text-gray-300 text-xs mb-3">{activity.description}</p>}
                    {activity.status === 'new' && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => updateActivity.mutate({ id: activity.id, data: { status: 'investigating' } })} className="text-xs border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/10 h-7">
                          Investigate
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => updateActivity.mutate({ id: activity.id, data: { status: 'resolved' } })} className="text-xs border-green-500/30 text-green-300 hover:bg-green-500/10 h-7">
                          Resolve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => updateActivity.mutate({ id: activity.id, data: { status: 'false_positive' } })} className="text-xs border-gray-500/30 text-gray-400 hover:bg-gray-500/10 h-7">
                          False Positive
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Add Account Dialog */}
      <Dialog open={showAddAccount} onOpenChange={setShowAddAccount}>
        <DialogContent className="bg-slate-900 border-red-500/30 text-white max-w-md">
          <DialogHeader><DialogTitle>Add Financial Account</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-gray-300 text-xs">Account Type</Label>
                <Select value={accountForm.account_type} onValueChange={v => setAccountForm({ ...accountForm, account_type: v })}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(ACCOUNT_ICONS).map(([v, e]) => <SelectItem key={v} value={v}>{e} {v.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-gray-300 text-xs">Institution Name</Label>
                <Input value={accountForm.institution_name} onChange={e => setAccountForm({ ...accountForm, institution_name: e.target.value })} placeholder="e.g. Chase" className="bg-slate-800 border-slate-600 text-white h-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-gray-300 text-xs">Nickname (optional)</Label>
                <Input value={accountForm.nickname} onChange={e => setAccountForm({ ...accountForm, nickname: e.target.value })} placeholder="My Checking" className="bg-slate-800 border-slate-600 text-white h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-gray-300 text-xs">Last 4 Digits (optional)</Label>
                <Input value={accountForm.last_four} onChange={e => setAccountForm({ ...accountForm, last_four: e.target.value.slice(0, 4) })} placeholder="1234" className="bg-slate-800 border-slate-600 text-white h-9" maxLength={4} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-gray-300 text-xs">Alert Threshold ($)</Label>
              <Input type="number" value={accountForm.alert_threshold} onChange={e => setAccountForm({ ...accountForm, alert_threshold: e.target.value })} placeholder="500" className="bg-slate-800 border-slate-600 text-white h-9" />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Switch checked={accountForm.monitoring_enabled} onCheckedChange={v => setAccountForm({ ...accountForm, monitoring_enabled: v })} />
              <Label className="text-gray-300 text-sm">Enable monitoring</Label>
            </div>
            <Button onClick={() => createAccount.mutate(accountForm)} disabled={!accountForm.institution_name || createAccount.isPending} className="w-full bg-gradient-to-r from-red-600 to-purple-600">
              {createAccount.isPending ? 'Adding...' : 'Add Account'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Log Activity Dialog */}
      <Dialog open={showLogActivity} onOpenChange={setShowLogActivity}>
        <DialogContent className="bg-slate-900 border-red-500/30 text-white max-w-md">
          <DialogHeader><DialogTitle className="text-red-300">Log Suspicious Activity</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label className="text-gray-300 text-xs">Activity Type</Label>
              <Select value={activityForm.activity_type} onValueChange={v => setActivityForm({ ...activityForm, activity_type: v })}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(ACTIVITY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-gray-300 text-xs">Institution</Label>
                <Input value={activityForm.institution} onChange={e => setActivityForm({ ...activityForm, institution: e.target.value })} placeholder="Bank name" className="bg-slate-800 border-slate-600 text-white h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-gray-300 text-xs">Amount ($)</Label>
                <Input type="number" value={activityForm.amount} onChange={e => setActivityForm({ ...activityForm, amount: e.target.value })} placeholder="0.00" className="bg-slate-800 border-slate-600 text-white h-9" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-gray-300 text-xs">Description</Label>
              <Input value={activityForm.description} onChange={e => setActivityForm({ ...activityForm, description: e.target.value })} placeholder="Describe what happened..." className="bg-slate-800 border-slate-600 text-white h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-gray-300 text-xs">Date Detected</Label>
              <Input type="date" value={activityForm.detected_date} onChange={e => setActivityForm({ ...activityForm, detected_date: e.target.value })} className="bg-slate-800 border-slate-600 text-white h-9" />
            </div>
            <Button onClick={() => logActivity.mutate(activityForm)} disabled={logActivity.isPending} className="w-full bg-gradient-to-r from-red-600 to-red-800">
              {logActivity.isPending ? 'Logging...' : 'Log Incident'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}