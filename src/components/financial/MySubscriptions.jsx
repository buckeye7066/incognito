import React, { useState } from 'react';
import { incognito } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Plus, Trash2, Loader2, Store, DollarSign, Calendar, CreditCard,
  Bot, Scissors, Settings, ChevronDown, ChevronUp, ExternalLink,
  AlertTriangle, CheckCircle, Search, Zap, Send, Square, CheckSquare,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ManageSubscriptionModal from './ManageSubscriptionModal';

const COMMON_SERVICES = [
  { name: 'Netflix', url: 'https://www.netflix.com/cancelplan', category: 'streaming', amount: 15.49 },
  { name: 'Spotify', url: 'https://www.spotify.com/account/subscription/', category: 'streaming', amount: 10.99 },
  { name: 'Hulu', url: 'https://secure.hulu.com/account', category: 'streaming', amount: 17.99 },
  { name: 'Disney+', url: 'https://www.disneyplus.com/account', category: 'streaming', amount: 13.99 },
  { name: 'Amazon Prime', url: 'https://www.amazon.com/mc/pipelines', category: 'streaming', amount: 14.99 },
  { name: 'Apple TV+', url: 'https://tv.apple.com/settings', category: 'streaming', amount: 9.99 },
  { name: 'YouTube Premium', url: 'https://www.youtube.com/paid_memberships', category: 'streaming', amount: 13.99 },
  { name: 'HBO Max', url: 'https://play.max.com/settings/subscription', category: 'streaming', amount: 15.99 },
  { name: 'Peacock', url: 'https://www.peacocktv.com/account/subscription', category: 'streaming', amount: 7.99 },
  { name: 'Paramount+', url: 'https://www.paramountplus.com/account/', category: 'streaming', amount: 11.99 },
  { name: 'Adobe Creative Cloud', url: 'https://account.adobe.com/plans', category: 'software', amount: 59.99 },
  { name: 'Microsoft 365', url: 'https://account.microsoft.com/services', category: 'software', amount: 9.99 },
  { name: 'ChatGPT Plus', url: 'https://chat.openai.com/#settings', category: 'software', amount: 20.00 },
  { name: 'iCloud+', url: 'https://support.apple.com/en-us/108053', category: 'software', amount: 2.99 },
  { name: 'Google One', url: 'https://one.google.com/settings', category: 'software', amount: 2.99 },
  { name: 'Dropbox', url: 'https://www.dropbox.com/plans', category: 'software', amount: 11.99 },
  { name: 'Planet Fitness', url: 'https://www.planetfitness.com/my-account', category: 'fitness', amount: 24.99 },
  { name: 'Peloton', url: 'https://members.onepeloton.com/settings', category: 'fitness', amount: 44.00 },
  { name: 'NordVPN', url: 'https://my.nordaccount.com/dashboard/', category: 'security', amount: 12.99 },
  { name: 'ExpressVPN', url: 'https://www.expressvpn.com/subscriptions', category: 'security', amount: 12.95 },
  { name: 'DoorDash DashPass', url: 'https://www.doordash.com/consumer/membership/', category: 'delivery', amount: 9.99 },
  { name: 'Uber One', url: 'https://account.uber.com/membership', category: 'delivery', amount: 9.99 },
  { name: 'Instacart+', url: 'https://www.instacart.com/store/account/manage_membership', category: 'delivery', amount: 9.99 },
  { name: 'Xbox Game Pass', url: 'https://account.microsoft.com/services', category: 'gaming', amount: 16.99 },
  { name: 'PlayStation Plus', url: 'https://store.playstation.com/subscriptions', category: 'gaming', amount: 17.99 },
  { name: 'Nintendo Switch Online', url: 'https://ec.nintendo.com/my/#/membership', category: 'gaming', amount: 3.99 },
];

const FREQ_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

const CATEGORY_COLORS = {
  streaming: 'bg-blue-500/20 text-blue-300',
  software: 'bg-purple-500/20 text-purple-300',
  fitness: 'bg-green-500/20 text-green-300',
  security: 'bg-amber-500/20 text-amber-300',
  delivery: 'bg-orange-500/20 text-orange-300',
  gaming: 'bg-pink-500/20 text-pink-300',
  other: 'bg-gray-500/20 text-gray-300',
};

export default function MySubscriptions({ profileId }) {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [showDetect, setShowDetect] = useState(false);
  const [manageSub, setManageSub] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [batchMode, setBatchMode] = useState(false);
  const [batchSelected, setBatchSelected] = useState(new Set());
  const [batchRunning, setBatchRunning] = useState(false);
  const [form, setForm] = useState({
    service_name: '', service_url: '', amount: '', frequency: 'monthly',
    card_last4: '', category: 'other', notes: '',
  });

  const { data: allSubs = [] } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => incognito.entities.Subscription.list(),
  });

  const { data: personalData = [] } = useQuery({
    queryKey: ['personalData'],
    queryFn: () => incognito.entities.PersonalData.list(),
  });

  const subs = allSubs
    .filter(s => !profileId || s.profile_id === profileId)
    .sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;
      return (b.amount || 0) - (a.amount || 0);
    });

  const creditCards = personalData.filter(d =>
    d.data_type === 'credit_card' && (!profileId || d.profile_id === profileId)
  );

  const filteredSubs = subs.filter(s => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (searchFilter && !s.service_name?.toLowerCase().includes(searchFilter.toLowerCase())) return false;
    return true;
  });

  const activeSubs = subs.filter(s => s.status === 'active');
  const monthlyTotal = activeSubs.reduce((sum, s) => {
    let amt = s.amount || 0;
    if (s.frequency === 'yearly') amt /= 12;
    if (s.frequency === 'quarterly') amt /= 3;
    if (s.frequency === 'weekly') amt *= 4.33;
    return sum + amt;
  }, 0);

  const createSub = useMutation({
    mutationFn: (data) => incognito.entities.Subscription.create({
      ...data,
      profile_id: profileId,
      status: 'active',
      amount: data.amount ? parseFloat(data.amount) : undefined,
      created_at: new Date().toISOString(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['subscriptions']);
      setShowAdd(false);
      setForm({ service_name: '', service_url: '', amount: '', frequency: 'monthly', card_last4: '', category: 'other', notes: '' });
    },
  });

  const deleteSub = useMutation({
    mutationFn: (id) => incognito.entities.Subscription.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['subscriptions']),
  });

  const updateSub = useMutation({
    mutationFn: ({ id, data }) => incognito.entities.Subscription.update(id, data),
    onSuccess: () => queryClient.invalidateQueries(['subscriptions']),
  });

  const addCommonService = (svc) => {
    const cardL4 = creditCards.length > 0
      ? (creditCards[0].value || '').slice(-4)
      : '';
    createSub.mutate({
      service_name: svc.name,
      service_url: svc.url,
      amount: svc.amount,
      frequency: 'monthly',
      card_last4: cardL4,
      category: svc.category,
    });
  };

  const toggleBatchSelect = (id) => {
    setBatchSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBatchCancel = async () => {
    const selected = activeSubs.filter(s => batchSelected.has(s.id));
    if (selected.length === 0) return;
    setBatchRunning(true);
    try {
      for (const sub of selected) {
        try {
          const result = await incognito.functions.invoke('generateCancellationEmail', {
            serviceName: sub.service_name,
            serviceUrl: sub.service_url,
            accountInfo: sub.card_last4 ? `Card ending ${sub.card_last4}` : '',
          });
          const data = result.data || result;
          if (data.mailto_url) {
            window.open(data.mailto_url, '_blank');
          }
          await new Promise(r => setTimeout(r, 600));
        } catch {
          // continue to next
        }
      }
      for (const sub of selected) {
        await incognito.entities.Subscription.update(sub.id, { status: 'cancelling' });
      }
      queryClient.invalidateQueries(['subscriptions']);
      setBatchMode(false);
      setBatchSelected(new Set());
    } finally {
      setBatchRunning(false);
    }
  };

  const existingNames = new Set(subs.map(s => s.service_name?.toLowerCase()));

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Subs', value: activeSubs.length, icon: Store, color: 'text-blue-400' },
          { label: 'Monthly Cost', value: `$${monthlyTotal.toFixed(2)}`, icon: DollarSign, color: monthlyTotal > 100 ? 'text-red-400' : 'text-green-400' },
          { label: 'Yearly Cost', value: `$${(monthlyTotal * 12).toFixed(0)}`, icon: Calendar, color: 'text-amber-400' },
          { label: 'Cancelled', value: subs.filter(s => s.status === 'cancelled').length, icon: Scissors, color: 'text-green-400' },
        ].map(s => (
          <Card key={s.label} className="glass-card border-red-500/10">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`w-7 h-7 ${s.color}`} />
              <div>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-gray-400 text-xs">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="Search subscriptions..."
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              className="bg-slate-800 border-slate-600 text-white h-9 pl-9"
            />
          </div>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="bg-slate-800 border-slate-600 text-white h-9 w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="cancelling">Cancelling</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        {activeSubs.length >= 2 && (
          batchMode ? (
            <div className="flex gap-2">
              <Button size="sm" onClick={handleBatchCancel} disabled={batchSelected.size === 0 || batchRunning} className="bg-gradient-to-r from-red-600 to-orange-600 h-9">
                {batchRunning ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Sending...</> : <><Send className="w-4 h-4 mr-1" /> Cancel {batchSelected.size} Selected</>}
              </Button>
              <Button size="sm" onClick={() => { setBatchMode(false); setBatchSelected(new Set()); }} variant="outline" className="border-slate-600 text-gray-300 h-9">Done</Button>
            </div>
          ) : (
            <Button size="sm" onClick={() => setBatchMode(true)} variant="outline" className="border-red-500/40 text-red-300 hover:bg-red-500/10 h-9">
              <Zap className="w-4 h-4 mr-1" /> Batch Cancel
            </Button>
          )
        )}
        <Button size="sm" onClick={() => setShowDetect(true)} variant="outline" className="border-purple-500/40 text-purple-300 hover:bg-purple-500/10 h-9">
          <Bot className="w-4 h-4 mr-1" /> Quick Add Common
        </Button>
        <Button size="sm" onClick={() => setShowAdd(true)} className="bg-gradient-to-r from-red-600 to-purple-600 h-9">
          <Plus className="w-4 h-4 mr-1" /> Add Subscription
        </Button>
      </div>

      {/* Batch mode banner */}
      {batchMode && (
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="p-3 flex items-center gap-3">
            <Zap className="w-5 h-5 text-red-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-white font-semibold">Batch Cancel Mode</p>
              <p className="text-xs text-gray-400">Select subscriptions, then hit Cancel. A pre-written cancellation email will be generated and opened for each one — you just hit Send in your email client.</p>
            </div>
            <Badge className="bg-red-500/20 text-red-300 border-0">{batchSelected.size} selected</Badge>
          </CardContent>
        </Card>
      )}

      {/* Subscriptions List */}
      {filteredSubs.length === 0 ? (
        <Card className="glass-card border-slate-700">
          <CardContent className="p-10 text-center">
            <Store className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-lg">No subscriptions tracked yet</p>
            <p className="text-gray-500 text-sm mt-1">Add your subscriptions to track spending and manage cancellations</p>
            <div className="flex gap-3 justify-center mt-4">
              <Button onClick={() => setShowDetect(true)} variant="outline" className="border-purple-500/40 text-purple-300">
                <Bot className="w-4 h-4 mr-1" /> Quick Add Common
              </Button>
              <Button onClick={() => setShowAdd(true)} className="bg-gradient-to-r from-red-600 to-purple-600">
                <Plus className="w-4 h-4 mr-1" /> Add Manually
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredSubs.map((sub) => {
            const isExpanded = expandedId === sub.id;
            const isCancelled = sub.status === 'cancelled';
            return (
              <Card
                key={sub.id}
                className={`glass-card overflow-hidden ${isCancelled ? 'border-slate-700 opacity-60' : 'border-slate-700 hover:border-purple-500/30'}`}
              >
                <button
                  onClick={() => batchMode && !isCancelled ? toggleBatchSelect(sub.id) : setExpandedId(isExpanded ? null : sub.id)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {batchMode && !isCancelled && (
                      <div className="shrink-0">
                        {batchSelected.has(sub.id) ? <CheckSquare className="w-5 h-5 text-red-400" /> : <Square className="w-5 h-5 text-gray-600" />}
                      </div>
                    )}
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${CATEGORY_COLORS[sub.category] || CATEGORY_COLORS.other}`}>
                      <Store className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-white font-medium text-sm truncate">{sub.service_name}</p>
                        {isCancelled && <Badge className="bg-green-500/20 text-green-300 border-0 text-[10px]">Cancelled</Badge>}
                        {sub.status === 'cancelling' && <Badge className="bg-amber-500/20 text-amber-300 border-0 text-[10px]">Cancelling</Badge>}
                      </div>
                      <p className="text-gray-400 text-xs">
                        {sub.card_last4 ? `•••• ${sub.card_last4}` : 'No card'}
                        {sub.category && ` · ${sub.category}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {sub.amount && (
                      <div className="text-right">
                        <p className={`font-mono text-sm ${isCancelled ? 'text-gray-500 line-through' : 'text-white'}`}>
                          ${sub.amount.toFixed(2)}
                        </p>
                        <p className="text-gray-500 text-[10px]">/{sub.frequency || 'mo'}</p>
                      </div>
                    )}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-2 border-t border-slate-700/50 space-y-3">
                        {sub.service_url && (
                          <a href={sub.service_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" /> {sub.service_url}
                          </a>
                        )}
                        {sub.notes && <p className="text-xs text-gray-400">{sub.notes}</p>}

                        <div className="flex flex-wrap gap-2">
                          {!isCancelled && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => { e.stopPropagation(); setManageSub(sub); }}
                              className="text-xs border-red-500/30 text-red-300 hover:bg-red-500/10 h-8"
                            >
                              <Scissors className="w-3 h-3 mr-1" /> Cancel / Replace Info
                            </Button>
                          )}
                          {isCancelled && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => { e.stopPropagation(); updateSub.mutate({ id: sub.id, data: { status: 'active' } }); }}
                              className="text-xs border-blue-500/30 text-blue-300 hover:bg-blue-500/10 h-8"
                            >
                              <CheckCircle className="w-3 h-3 mr-1" /> Re-activate
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Delete ${sub.service_name} from your tracked subscriptions?`)) {
                                deleteSub.mutate(sub.id);
                              }
                            }}
                            className="text-xs border-gray-500/30 text-gray-400 hover:bg-gray-500/10 h-8"
                          >
                            <Trash2 className="w-3 h-3 mr-1" /> Remove
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Subscription Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-slate-900 border-red-500/30 text-white max-w-md">
          <DialogHeader><DialogTitle>Add Subscription</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label className="text-gray-300 text-xs">Service Name</Label>
              <Input value={form.service_name} onChange={e => setForm({ ...form, service_name: e.target.value })} placeholder="e.g. Netflix" className="bg-slate-800 border-slate-600 text-white h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-gray-300 text-xs">Website / Cancel URL</Label>
              <Input value={form.service_url} onChange={e => setForm({ ...form, service_url: e.target.value })} placeholder="https://..." className="bg-slate-800 border-slate-600 text-white h-9" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-gray-300 text-xs">Amount ($)</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="9.99" className="bg-slate-800 border-slate-600 text-white h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-gray-300 text-xs">Frequency</Label>
                <Select value={form.frequency} onValueChange={v => setForm({ ...form, frequency: v })}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{FREQ_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-gray-300 text-xs">Card (last 4)</Label>
                <Select value={form.card_last4} onValueChange={v => setForm({ ...form, card_last4: v })}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white h-9"><SelectValue placeholder="Select card" /></SelectTrigger>
                  <SelectContent>
                    {creditCards.map(cc => {
                      const last4 = (cc.value || '').slice(-4);
                      return <SelectItem key={cc.id} value={last4}>•••• {last4} {cc.label ? `(${cc.label})` : ''}</SelectItem>;
                    })}
                    <SelectItem value="other">Other / Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-gray-300 text-xs">Category</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(CATEGORY_COLORS).map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-gray-300 text-xs">Notes (optional)</Label>
              <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Annual plan, shared with family..." className="bg-slate-800 border-slate-600 text-white h-9" />
            </div>
            <Button
              onClick={() => createSub.mutate(form)}
              disabled={!form.service_name || createSub.isPending}
              className="w-full bg-gradient-to-r from-red-600 to-purple-600"
            >
              {createSub.isPending ? 'Adding...' : 'Add Subscription'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Add Common Services Dialog */}
      <Dialog open={showDetect} onOpenChange={setShowDetect}>
        <DialogContent className="bg-slate-900 border-purple-500/30 text-white max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-purple-400" /> Quick Add Common Subscriptions
            </DialogTitle>
          </DialogHeader>
          <p className="text-gray-400 text-sm -mt-2">Tap any service you're subscribed to. It will be added and linked to your first credit card.</p>
          <div className="space-y-3 pt-2">
            {Object.entries(
              COMMON_SERVICES.reduce((acc, svc) => {
                (acc[svc.category] = acc[svc.category] || []).push(svc);
                return acc;
              }, {})
            ).map(([cat, services]) => (
              <div key={cat}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{cat}</p>
                <div className="grid grid-cols-2 gap-2">
                  {services.map(svc => {
                    const alreadyAdded = existingNames.has(svc.name.toLowerCase());
                    return (
                      <button
                        key={svc.name}
                        disabled={alreadyAdded || createSub.isPending}
                        onClick={() => addCommonService(svc)}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          alreadyAdded
                            ? 'border-green-500/30 bg-green-500/5 cursor-default'
                            : 'border-slate-700 bg-slate-800/50 hover:border-purple-500/40 hover:bg-purple-500/5'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-white text-sm font-medium">{svc.name}</span>
                          {alreadyAdded && <CheckCircle className="w-4 h-4 text-green-400" />}
                        </div>
                        <p className="text-gray-400 text-xs">${svc.amount}/mo</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Subscription Modal */}
      <ManageSubscriptionModal
        open={!!manageSub}
        onClose={() => setManageSub(null)}
        subscription={manageSub}
        onUpdate={(data) => {
          if (manageSub?.id) {
            updateSub.mutate({ id: manageSub.id, data });
          }
        }}
      />
    </div>
  );
}
