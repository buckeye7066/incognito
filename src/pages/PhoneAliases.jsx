import { useState } from 'react';
import { incognito } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Phone, Plus, Copy, Trash2, Search, PhoneCall, MessageSquare, PhoneOff, PhoneForwarded } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function PhoneAliases() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showSMS, setShowSMS] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchAreaCode, setSearchAreaCode] = useState('');
  const [availableNumbers, setAvailableNumbers] = useState([]);
  const [searchingNumbers, setSearchingNumbers] = useState(false);
  const [smsForm, setSmsForm] = useState({ to: '', body: '' });
  const [forwardingForm, setForwardingForm] = useState({});
  const [formData, setFormData] = useState({ purpose: '' });

  const activeProfileId = typeof window !== 'undefined' ? window.activeProfileId : null;

  const { data: phoneAliases = [], isLoading } = useQuery({
    queryKey: ['phoneAliases'],
    queryFn: () => incognito.entities.PhoneAlias.list('-created_date'),
  });

  const filtered = phoneAliases
    .filter(p => !activeProfileId || p.profile_id === activeProfileId)
    .filter(p => !searchQuery || p.phone_number?.includes(searchQuery) || p.purpose?.toLowerCase().includes(searchQuery.toLowerCase()));

  const searchNumbersMutation = useMutation({
    mutationFn: async (areaCode) => {
      const result = await incognito.functions.invoke('listAvailablePhoneNumbers', { areaCode });
      return result.data || [];
    },
    onSuccess: (data) => setAvailableNumbers(data),
  });

  const purchaseMutation = useMutation({
    mutationFn: ({ phoneNumber }) => incognito.functions.invoke('purchasePhoneNumber', {
      phoneNumber, profileId: activeProfileId, purpose: formData.purpose,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['phoneAliases']);
      setShowCreate(false);
      setAvailableNumbers([]);
      setFormData({ purpose: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => incognito.entities.PhoneAlias.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['phoneAliases']),
  });

  const sendSMSMutation = useMutation({
    mutationFn: ({ fromAliasSid, to, body }) => incognito.functions.invoke('sendSMS', { fromAliasSid, to, body }),
    onSuccess: () => {
      setShowSMS(null);
      setSmsForm({ to: '', body: '' });
    },
  });

  const forwardingMutation = useMutation({
    mutationFn: ({ phoneAliasSid, forwardingNumber }) =>
      incognito.functions.invoke('configurePhoneForwarding', { phoneAliasSid, forwardingNumber }),
    onSuccess: () => queryClient.invalidateQueries(['phoneAliases']),
  });

  const toggleAlias = async (alias) => {
    const newStatus = alias.status === 'active' ? 'disabled' : 'active';
    await incognito.entities.PhoneAlias.update(alias.id, { status: newStatus });
    queryClient.invalidateQueries(['phoneAliases']);
  };

  const copyToClipboard = (text) => navigator.clipboard.writeText(text);

  const stats = {
    total: phoneAliases.length,
    active: phoneAliases.filter(p => p.status === 'active').length,
    withForwarding: phoneAliases.filter(p => p.forwarding_number).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Phone className="h-8 w-8 text-primary" />
            Phone Aliases
          </h1>
          <p className="text-muted-foreground mt-1">
            Generate unique phone numbers for every service via Twilio. Forward calls and texts to your real number.
          </p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> New Number</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Get a New Phone Number</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Purpose</Label>
                <Input placeholder="e.g., Online shopping, Dating apps" value={formData.purpose}
                  onChange={(e) => setFormData(d => ({ ...d, purpose: e.target.value }))} />
              </div>
              <div>
                <Label>Search by Area Code (optional)</Label>
                <div className="flex gap-2">
                  <Input placeholder="e.g., 212, 415, 310" value={searchAreaCode}
                    onChange={(e) => setSearchAreaCode(e.target.value)} />
                  <Button onClick={() => searchNumbersMutation.mutate(searchAreaCode)}
                    disabled={searchNumbersMutation.isPending}>
                    {searchNumbersMutation.isPending ? 'Searching...' : 'Search'}
                  </Button>
                </div>
              </div>

              {availableNumbers.length > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  <Label>Available Numbers</Label>
                  {availableNumbers.map((num, i) => (
                    <Card key={i} className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => purchaseMutation.mutate({ phoneNumber: num.phone_number })}>
                      <CardContent className="py-2 px-3 flex items-center justify-between">
                        <div>
                          <span className="font-mono">{num.friendly_name || num.phone_number}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {num.locality || ''} {num.region || ''}
                          </span>
                        </div>
                        <Button size="sm" disabled={purchaseMutation.isPending}>
                          {purchaseMutation.isPending ? 'Getting...' : 'Get Number'}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {availableNumbers.length === 0 && searchNumbersMutation.isSuccess && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No numbers available for that area code. Try a different one.
                </p>
              )}

              <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Requires Twilio Account</p>
                <p>Phone numbers are provisioned through Twilio. You'll need a Twilio account with funds to purchase numbers (~$1.15/mo per number). Configure your Twilio credentials in Settings.</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Numbers', value: stats.total, icon: Phone },
          { label: 'Active', value: stats.active, icon: PhoneCall },
          { label: 'With Forwarding', value: stats.withForwarding, icon: PhoneForwarded },
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

      {/* Search */}
      {phoneAliases.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search phone numbers..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      )}

      {/* Phone Alias List */}
      <div className="space-y-3">
        <AnimatePresence>
          {filtered.map((alias) => (
            <motion.div key={alias.id} layout initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Card className={`${alias.status === 'disabled' ? 'opacity-60' : ''}`}>
                <CardContent className="py-4 px-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Phone className={`h-5 w-5 ${alias.status === 'active' ? 'text-green-500' : 'text-muted-foreground'}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-lg font-medium">{alias.phone_number}</span>
                          <Badge variant={alias.status === 'active' ? 'default' : 'secondary'}>{alias.status}</Badge>
                        </div>
                        {alias.purpose && <p className="text-sm text-muted-foreground">{alias.purpose}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => copyToClipboard(alias.phone_number)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => toggleAlias(alias)}>
                        {alias.status === 'active' ? <PhoneOff className="h-3 w-3" /> : <PhoneCall className="h-3 w-3" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                        onClick={() => deleteMutation.mutate(alias.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Features row */}
                  <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-1 text-xs">
                      <Switch checked={alias.sms_enabled !== false} onCheckedChange={async (v) => {
                        await incognito.entities.PhoneAlias.update(alias.id, { sms_enabled: v });
                        queryClient.invalidateQueries(['phoneAliases']);
                      }} />
                      <span>SMS</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <Switch checked={alias.voice_enabled !== false} onCheckedChange={async (v) => {
                        await incognito.entities.PhoneAlias.update(alias.id, { voice_enabled: v });
                        queryClient.invalidateQueries(['phoneAliases']);
                      }} />
                      <span>Voice</span>
                    </div>
                    <Button variant="outline" size="sm" className="gap-1 text-xs h-7"
                      onClick={() => setShowSMS(alias)}>
                      <MessageSquare className="h-3 w-3" /> Send SMS
                    </Button>
                    <div className="flex items-center gap-1 ml-auto">
                      <PhoneForwarded className="h-3 w-3 text-muted-foreground" />
                      <Input placeholder="Forward to..." className="h-7 w-36 text-xs"
                        value={forwardingForm[alias.id] || alias.forwarding_number || ''}
                        onChange={(e) => setForwardingForm(f => ({ ...f, [alias.id]: e.target.value }))} />
                      <Button size="sm" className="h-7 text-xs" variant="outline"
                        onClick={() => forwardingMutation.mutate({
                          phoneAliasSid: alias.twilio_sid,
                          forwardingNumber: forwardingForm[alias.id] || alias.forwarding_number,
                        })}>Save</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {phoneAliases.length === 0 && !isLoading && (
        <Card className="p-12 text-center">
          <Phone className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold mb-2">No Phone Numbers</h3>
          <p className="text-muted-foreground mb-4">
            Get dedicated phone numbers for different services. Requires Twilio credentials in Settings.
          </p>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Get First Number
          </Button>
        </Card>
      )}

      {/* Send SMS Dialog */}
      <Dialog open={!!showSMS} onOpenChange={() => setShowSMS(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send SMS from {showSMS?.phone_number}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>To Number</Label>
              <Input placeholder="+1..." value={smsForm.to}
                onChange={(e) => setSmsForm(f => ({ ...f, to: e.target.value }))} />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea value={smsForm.body} onChange={(e) => setSmsForm(f => ({ ...f, body: e.target.value }))}
                placeholder="Type your message..." />
            </div>
            <Button className="w-full" onClick={() => sendSMSMutation.mutate({
              fromAliasSid: showSMS?.twilio_sid, to: smsForm.to, body: smsForm.body,
            })} disabled={!smsForm.to || !smsForm.body || sendSMSMutation.isPending}>
              {sendSMSMutation.isPending ? 'Sending...' : 'Send SMS'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
