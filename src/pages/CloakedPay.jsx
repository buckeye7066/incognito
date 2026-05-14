import { useState } from 'react';
import { incognito } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, Plus, Trash2, Search, DollarSign, Pause, Play, Lock, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CARD_TYPES = [
  { value: 'MERCHANT_LOCKED', label: 'Merchant-Locked', description: 'Locks to first merchant used' },
  { value: 'SINGLE_USE', label: 'Single Use', description: 'Auto-closes after one transaction' },
  { value: 'UNLOCKED', label: 'Unlocked', description: 'Works at any merchant' },
];

const DURATION_OPTIONS = [
  { value: 'TRANSACTION', label: 'Per Transaction' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'ANNUALLY', label: 'Annually' },
  { value: 'FOREVER', label: 'Total Lifetime' },
];

const STATUS_COLORS = {
  OPEN: 'bg-green-500', PAUSED: 'bg-yellow-500', CLOSED: 'bg-red-500',
};

export default function CloakedPay() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showSelfDestruct, setShowSelfDestruct] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [formData, setFormData] = useState({
    merchant_name: '', spend_limit: 5000, spend_limit_duration: 'MONTHLY', card_type: 'MERCHANT_LOCKED',
  });
  const [destructForm, setDestructForm] = useState({ after_date: '', after_transactions: '' });

  const activeProfileId = typeof window !== 'undefined' ? window.activeProfileId : null;

  // Local virtual cards from entity store
  const { data: localCards = [], isLoading: localLoading } = useQuery({
    queryKey: ['virtualCards'],
    queryFn: () => incognito.entities.VirtualCard.list('-created_date'),
  });

  // Privacy.com cards from API
  const { data: privacyCards = [], isLoading: privacyLoading } = useQuery({
    queryKey: ['privacyComCards'],
    queryFn: async () => {
      try {
        const result = await incognito.functions.invoke('listCards');
        return (result.data || []).map(c => ({
          id: c.token,
          card_token: c.token,
          merchant_name: c.memo || 'Privacy.com Card',
          last_four: c.last_four,
          spend_limit: c.spend_limit,
          spend_limit_duration: c.spend_limit_duration,
          card_type: c.type,
          status: c.state,
          source: 'privacy.com',
        }));
      } catch { return []; }
    },
  });

  const allCards = [
    ...localCards.map(c => ({ ...c, source: 'incognito' })),
    ...privacyCards.filter(pc => !localCards.some(lc => lc.card_token === pc.card_token)),
  ];

  const filtered = allCards
    .filter(c => activeTab === 'all' || c.status === activeTab)
    .filter(c => !searchQuery || c.merchant_name?.toLowerCase().includes(searchQuery.toLowerCase()));

  const createMutation = useMutation({
    mutationFn: (data) => incognito.functions.invoke('createVirtualCard', {
      profileId: activeProfileId,
      merchantName: data.merchant_name,
      spendLimit: parseInt(data.spend_limit) || 5000,
      spendLimitDuration: data.spend_limit_duration,
      cardType: data.card_type,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['virtualCards']);
      queryClient.invalidateQueries(['privacyComCards']);
      setShowCreate(false);
      setFormData({ merchant_name: '', spend_limit: 5000, spend_limit_duration: 'MONTHLY', card_type: 'MERCHANT_LOCKED' });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: (cardToken) => incognito.functions.invoke('pauseCard', { cardToken }),
    onSuccess: () => {
      queryClient.invalidateQueries(['virtualCards']);
      queryClient.invalidateQueries(['privacyComCards']);
    },
  });

  const closeMutation = useMutation({
    mutationFn: (cardToken) => incognito.functions.invoke('closeCard', { cardToken }),
    onSuccess: () => {
      queryClient.invalidateQueries(['virtualCards']);
      queryClient.invalidateQueries(['privacyComCards']);
    },
  });

  const selfDestructMutation = useMutation({
    mutationFn: ({ cardId, ...rest }) => incognito.functions.invoke('setCardSelfDestruct', { cardId, ...rest }),
    onSuccess: () => {
      queryClient.invalidateQueries(['virtualCards']);
      setShowSelfDestruct(null);
    },
  });

  const formatCents = (cents) => `$${(cents / 100).toFixed(2)}`;

  const stats = {
    total: allCards.length,
    open: allCards.filter(c => c.status === 'OPEN').length,
    paused: allCards.filter(c => c.status === 'PAUSED').length,
    closed: allCards.filter(c => c.status === 'CLOSED').length,
    totalLimit: allCards.filter(c => c.status === 'OPEN').reduce((sum, c) => sum + (c.spend_limit || 0), 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <CreditCard className="h-8 w-8 text-primary" />
            Cloaked Pay
          </h1>
          <p className="text-muted-foreground mt-1">
            Virtual payment cards — merchant-locked, with spending limits and self-destruct. Powered by Privacy.com.
          </p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> New Card</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Virtual Card</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Merchant / Purpose *</Label>
                <Input placeholder="e.g., Amazon, Netflix, Spotify" value={formData.merchant_name}
                  onChange={(e) => setFormData(d => ({ ...d, merchant_name: e.target.value }))} />
              </div>
              <div>
                <Label>Card Type</Label>
                <Select value={formData.card_type} onValueChange={(v) => setFormData(d => ({ ...d, card_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CARD_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>
                        <div>
                          <span className="font-medium">{t.label}</span>
                          <span className="text-xs text-muted-foreground ml-2">{t.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Spend Limit (cents)</Label>
                  <Input type="number" value={formData.spend_limit}
                    onChange={(e) => setFormData(d => ({ ...d, spend_limit: e.target.value }))} />
                  <p className="text-xs text-muted-foreground mt-1">{formatCents(formData.spend_limit || 0)}</p>
                </div>
                <div>
                  <Label>Limit Duration</Label>
                  <Select value={formData.spend_limit_duration}
                    onValueChange={(v) => setFormData(d => ({ ...d, spend_limit_duration: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DURATION_OPTIONS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button className="w-full" onClick={() => createMutation.mutate(formData)}
                disabled={!formData.merchant_name || createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Card'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Cards', value: stats.total, icon: CreditCard },
          { label: 'Open', value: stats.open, icon: Play },
          { label: 'Paused', value: stats.paused, icon: Pause },
          { label: 'Closed', value: stats.closed, icon: Lock },
          { label: 'Total Limit', value: formatCents(stats.totalLimit), icon: DollarSign },
        ].map((s, i) => (
          <Card key={i} className="glass-card">
            <CardContent className="pt-4 pb-3 text-center">
              <s.icon className="h-5 w-5 mx-auto mb-1 text-primary" />
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs & Search */}
      <div className="flex gap-3">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="OPEN">Open</TabsTrigger>
            <TabsTrigger value="PAUSED">Paused</TabsTrigger>
            <TabsTrigger value="CLOSED">Closed</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search cards..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      {/* Card Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence>
          {filtered.map((card) => (
            <motion.div key={card.id} layout initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <Card className={`relative overflow-hidden ${card.status === 'CLOSED' ? 'opacity-60' : ''}`}>
                {/* Status stripe */}
                <div className={`absolute top-0 left-0 right-0 h-1 ${STATUS_COLORS[card.status] || 'bg-gray-400'}`} />
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-medium">{card.merchant_name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-lg">**** {card.last_four || '????'}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {CARD_TYPES.find(t => t.value === card.card_type)?.label || card.card_type}
                        </Badge>
                      </div>
                    </div>
                    <Badge variant={card.status === 'OPEN' ? 'default' : card.status === 'PAUSED' ? 'secondary' : 'destructive'}>
                      {card.status}
                    </Badge>
                  </div>

                  <div className="space-y-1 text-sm mb-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Limit:</span>
                      <span className="font-medium">{formatCents(card.spend_limit || 0)} / {card.spend_limit_duration?.toLowerCase()}</span>
                    </div>
                    {card.self_destruct && (
                      <div className="flex items-center gap-1 text-orange-500 text-xs">
                        <Flame className="h-3 w-3" />
                        {card.self_destruct.after_date && <span>Destroys: {card.self_destruct.after_date}</span>}
                        {card.self_destruct.after_transactions && <span>Destroys after {card.self_destruct.after_transactions} txns</span>}
                      </div>
                    )}
                    {card.source && (
                      <div className="text-xs text-muted-foreground">Source: {card.source}</div>
                    )}
                  </div>

                  {/* Actions */}
                  {card.status !== 'CLOSED' && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1 gap-1 text-xs"
                        onClick={() => pauseMutation.mutate(card.card_token)}
                        disabled={pauseMutation.isPending}>
                        {card.status === 'PAUSED' ? <><Play className="h-3 w-3" /> Resume</> : <><Pause className="h-3 w-3" /> Pause</>}
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1 text-xs"
                        onClick={() => setShowSelfDestruct(card)}>
                        <Flame className="h-3 w-3" /> Self-Destruct
                      </Button>
                      <Button size="sm" variant="destructive" className="gap-1 text-xs"
                        onClick={() => closeMutation.mutate(card.card_token)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {allCards.length === 0 && !localLoading && !privacyLoading && (
        <Card className="p-12 text-center">
          <CreditCard className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold mb-2">No Virtual Cards</h3>
          <p className="text-muted-foreground mb-4">
            Create merchant-locked virtual cards to protect your real card number. Requires Privacy.com API key in Settings.
          </p>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Create First Card
          </Button>
        </Card>
      )}

      {/* Self-Destruct Dialog */}
      <Dialog open={!!showSelfDestruct} onOpenChange={() => setShowSelfDestruct(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Set Self-Destruct Rules</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The card will automatically close when any of these conditions are met.
            </p>
            <div>
              <Label>Close After Date</Label>
              <Input type="date" value={destructForm.after_date}
                onChange={(e) => setDestructForm(f => ({ ...f, after_date: e.target.value }))} />
            </div>
            <div>
              <Label>Close After N Transactions</Label>
              <Input type="number" placeholder="e.g., 1 for single-use" value={destructForm.after_transactions}
                onChange={(e) => setDestructForm(f => ({ ...f, after_transactions: e.target.value }))} />
            </div>
            <Button className="w-full" onClick={() => selfDestructMutation.mutate({
              cardId: showSelfDestruct?.id,
              destroyAfterDate: destructForm.after_date || null,
              destroyAfterTransactions: parseInt(destructForm.after_transactions) || null,
            })}>
              Set Self-Destruct
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
