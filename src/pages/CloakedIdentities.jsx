import { useState } from 'react';
import { incognito } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Shield, Mail, Phone, Lock, CreditCard, Copy, Search, Filter, Trash2, Eye, EyeOff, Fingerprint } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CATEGORIES = [
  { value: 'shopping', label: 'Shopping', color: 'bg-blue-500' },
  { value: 'social', label: 'Social Media', color: 'bg-purple-500' },
  { value: 'finance', label: 'Finance & Banking', color: 'bg-green-500' },
  { value: 'email', label: 'Email & Communication', color: 'bg-yellow-500' },
  { value: 'streaming', label: 'Streaming & Entertainment', color: 'bg-red-500' },
  { value: 'work', label: 'Work & Professional', color: 'bg-indigo-500' },
  { value: 'health', label: 'Health & Medical', color: 'bg-pink-500' },
  { value: 'travel', label: 'Travel', color: 'bg-teal-500' },
  { value: 'gaming', label: 'Gaming', color: 'bg-orange-500' },
  { value: 'general', label: 'General', color: 'bg-gray-500' },
];

export default function CloakedIdentities() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [selectedIdentity, setSelectedIdentity] = useState(null);
  const [showPassword, setShowPassword] = useState({});
  const [editingCustomField, setEditingCustomField] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  const [formData, setFormData] = useState({
    service_name: '', service_url: '', category: 'general',
    username: '', notes: '', auto_generate: true,
  });

  const activeProfileId = typeof window !== 'undefined' ? window.activeProfileId : null;

  const { data: identities = [], isLoading } = useQuery({
    queryKey: ['cloakedIdentities'],
    queryFn: () => incognito.entities.CloakedIdentity.list('-created_date'),
  });

  const { data: passwords = [] } = useQuery({
    queryKey: ['passwordEntries'],
    queryFn: () => incognito.entities.PasswordEntry.list(),
  });

  const { data: emailAliases = [] } = useQuery({
    queryKey: ['emailAliases'],
    queryFn: () => incognito.entities.EmailAlias.list(),
  });

  const { data: phoneAliases = [] } = useQuery({
    queryKey: ['phoneAliases'],
    queryFn: () => incognito.entities.PhoneAlias.list(),
  });

  const { data: virtualCards = [] } = useQuery({
    queryKey: ['virtualCards'],
    queryFn: () => incognito.entities.VirtualCard.list(),
  });

  const filtered = identities
    .filter(i => !activeProfileId || i.profile_id === activeProfileId)
    .filter(i => filterCategory === 'all' || i.category === filterCategory)
    .filter(i => !searchQuery || i.service_name?.toLowerCase().includes(searchQuery.toLowerCase()));

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const result = await incognito.functions.invoke('createCloakedIdentity', {
        profileId: activeProfileId,
        serviceName: data.service_name,
        serviceUrl: data.service_url,
        category: data.category,
        autoGenerate: data.auto_generate,
      });
      if (data.username && result.data?.password_entry_id) {
        await incognito.entities.PasswordEntry.update(result.data.password_entry_id, { username: data.username });
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['cloakedIdentities']);
      queryClient.invalidateQueries(['passwordEntries']);
      setShowCreate(false);
      setFormData({ service_name: '', service_url: '', category: 'general', username: '', notes: '', auto_generate: true });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (id) => incognito.functions.invoke('toggleIdentityStatus', { identityId: id }),
    onSuccess: () => queryClient.invalidateQueries(['cloakedIdentities']),
  });

  const deleteMutation = useMutation({
    mutationFn: async (identity) => {
      if (identity.password_entry_id) await incognito.entities.PasswordEntry.delete(identity.password_entry_id);
      if (identity.email_alias_id) await incognito.entities.EmailAlias.delete(identity.email_alias_id);
      await incognito.entities.CloakedIdentity.delete(identity.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['cloakedIdentities']);
      queryClient.invalidateQueries(['passwordEntries']);
      queryClient.invalidateQueries(['emailAliases']);
      setSelectedIdentity(null);
    },
  });

  const addEmailMutation = useMutation({
    mutationFn: async (identityId) => {
      const result = await incognito.functions.invoke('createEmailAliasReal', {
        profileId: activeProfileId, identityId, description: `For ${identities.find(i => i.id === identityId)?.service_name}`,
      });
      await incognito.entities.CloakedIdentity.update(identityId, { email_alias_id: result.data.id });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['cloakedIdentities']);
      queryClient.invalidateQueries(['emailAliases']);
    },
  });

  const addCustomField = async (identityId) => {
    if (!newFieldName.trim()) return;
    const identity = identities.find(i => i.id === identityId);
    const fields = { ...(identity?.custom_fields || {}), [newFieldName]: newFieldValue };
    await incognito.entities.CloakedIdentity.update(identityId, { custom_fields: fields });
    queryClient.invalidateQueries(['cloakedIdentities']);
    setNewFieldName('');
    setNewFieldValue('');
    setEditingCustomField(false);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const getPasswordForIdentity = (identity) => passwords.find(p => p.id === identity.password_entry_id);
  const getEmailForIdentity = (identity) => emailAliases.find(e => e.id === identity.email_alias_id);
  const getPhoneForIdentity = (identity) => phoneAliases.find(p => p.id === identity.phone_alias_id);
  const getCardForIdentity = (identity) => virtualCards.find(c => c.id === identity.virtual_card_id);
  const getCategoryInfo = (cat) => CATEGORIES.find(c => c.value === cat) || CATEGORIES[CATEGORIES.length - 1];

  const stats = {
    total: identities.length,
    active: identities.filter(i => i.status === 'active').length,
    muted: identities.filter(i => i.status === 'muted').length,
    withEmail: identities.filter(i => i.email_alias_id).length,
    withPhone: identities.filter(i => i.phone_alias_id).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Fingerprint className="h-8 w-8 text-primary" />
            Cloaked Identities
          </h1>
          <p className="text-muted-foreground mt-1">
            Create unique identities for every service — email, phone, password, and payment card bundled together.
          </p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> New Identity</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Cloaked Identity</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Service Name *</Label>
                <Input placeholder="e.g., Amazon, Netflix, Gmail" value={formData.service_name}
                  onChange={(e) => setFormData(d => ({ ...d, service_name: e.target.value }))} />
              </div>
              <div>
                <Label>Service URL</Label>
                <Input placeholder="https://..." value={formData.service_url}
                  onChange={(e) => setFormData(d => ({ ...d, service_url: e.target.value }))} />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData(d => ({ ...d, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Username (optional)</Label>
                <Input placeholder="Username for this service" value={formData.username}
                  onChange={(e) => setFormData(d => ({ ...d, username: e.target.value }))} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={formData.auto_generate}
                  onCheckedChange={(v) => setFormData(d => ({ ...d, auto_generate: v }))} />
                <Label>Auto-generate secure password</Label>
              </div>
              <Button className="w-full" onClick={() => createMutation.mutate(formData)}
                disabled={!formData.service_name || createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Identity'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Identities', value: stats.total, icon: Shield },
          { label: 'Active', value: stats.active, icon: Shield },
          { label: 'Muted', value: stats.muted, icon: EyeOff },
          { label: 'With Email', value: stats.withEmail, icon: Mail },
          { label: 'With Phone', value: stats.withPhone, icon: Phone },
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

      {/* Search & Filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search identities..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48"><Filter className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Identities Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence>
          {filtered.map((identity) => {
            const pw = getPasswordForIdentity(identity);
            const email = getEmailForIdentity(identity);
            const phone = getPhoneForIdentity(identity);
            const card = getCardForIdentity(identity);
            const cat = getCategoryInfo(identity.category);
            const isSelected = selectedIdentity?.id === identity.id;

            return (
              <motion.div key={identity.id} layout initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}>
                <Card className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 ${isSelected ? 'ring-2 ring-primary' : ''} ${identity.status === 'muted' ? 'opacity-60' : ''}`}
                  onClick={() => setSelectedIdentity(isSelected ? null : identity)}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${cat.color}`} />
                        <CardTitle className="text-lg">{identity.service_name}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={identity.status === 'active' ? 'default' : 'secondary'}>
                          {identity.status}
                        </Badge>
                      </div>
                    </div>
                    {identity.service_url && (
                      <p className="text-xs text-muted-foreground truncate">{identity.service_url}</p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {/* Credential summary icons */}
                    <div className="flex gap-2 flex-wrap">
                      {email && (
                        <div className="flex items-center gap-1 text-xs bg-muted rounded px-2 py-1">
                          <Mail className="h-3 w-3" />
                          <span className="truncate max-w-[140px]">{email.alias_email}</span>
                          <button onClick={(e) => { e.stopPropagation(); copyToClipboard(email.alias_email); }}
                            className="ml-1 hover:text-primary"><Copy className="h-3 w-3" /></button>
                        </div>
                      )}
                      {phone && (
                        <div className="flex items-center gap-1 text-xs bg-muted rounded px-2 py-1">
                          <Phone className="h-3 w-3" />
                          <span>{phone.phone_number}</span>
                          <button onClick={(e) => { e.stopPropagation(); copyToClipboard(phone.phone_number); }}
                            className="ml-1 hover:text-primary"><Copy className="h-3 w-3" /></button>
                        </div>
                      )}
                      {pw && (
                        <div className="flex items-center gap-1 text-xs bg-muted rounded px-2 py-1">
                          <Lock className="h-3 w-3" />
                          <span>{pw.username || 'password set'}</span>
                          <button onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(pw.password);
                          }} className="ml-1 hover:text-primary"><Copy className="h-3 w-3" /></button>
                        </div>
                      )}
                      {card && (
                        <div className="flex items-center gap-1 text-xs bg-muted rounded px-2 py-1">
                          <CreditCard className="h-3 w-3" />
                          <span>****{card.last_four}</span>
                        </div>
                      )}
                    </div>

                    {/* Quick actions when selected */}
                    {isSelected && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                        className="pt-3 border-t space-y-3">
                        {/* Full credentials */}
                        {pw && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Username:</span>
                              <div className="flex items-center gap-1">
                                <span>{pw.username || '—'}</span>
                                {pw.username && <button onClick={() => copyToClipboard(pw.username)}><Copy className="h-3 w-3" /></button>}
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Password:</span>
                              <div className="flex items-center gap-1">
                                <span className="font-mono text-xs">
                                  {showPassword[identity.id] ? pw.password : '••••••••••••'}
                                </span>
                                <button onClick={() => setShowPassword(s => ({ ...s, [identity.id]: !s[identity.id] }))}>
                                  {showPassword[identity.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                </button>
                                <button onClick={() => copyToClipboard(pw.password)}><Copy className="h-3 w-3" /></button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Custom fields */}
                        {identity.custom_fields && Object.keys(identity.custom_fields).length > 0 && (
                          <div className="space-y-1">
                            {Object.entries(identity.custom_fields).map(([key, val]) => (
                              <div key={key} className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">{key}:</span>
                                <div className="flex items-center gap-1">
                                  <span className="text-xs">{val}</span>
                                  <button onClick={() => copyToClipboard(val)}><Copy className="h-3 w-3" /></button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex flex-wrap gap-2">
                          {!email && (
                            <Button size="sm" variant="outline" className="gap-1 text-xs"
                              onClick={(e) => { e.stopPropagation(); addEmailMutation.mutate(identity.id); }}
                              disabled={addEmailMutation.isPending}>
                              <Mail className="h-3 w-3" /> Add Email
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="gap-1 text-xs"
                            onClick={(e) => { e.stopPropagation(); toggleMutation.mutate(identity.id); }}>
                            {identity.status === 'active' ? <><EyeOff className="h-3 w-3" /> Mute</> : <><Eye className="h-3 w-3" /> Activate</>}
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1 text-xs"
                            onClick={(e) => { e.stopPropagation(); setEditingCustomField(identity.id); }}>
                            <Plus className="h-3 w-3" /> Custom Field
                          </Button>
                          <Button size="sm" variant="destructive" className="gap-1 text-xs"
                            onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(identity); }}>
                            <Trash2 className="h-3 w-3" /> Delete
                          </Button>
                        </div>

                        {/* Add custom field form */}
                        {editingCustomField === identity.id && (
                          <div className="flex gap-2 pt-2">
                            <Input placeholder="Field name" value={newFieldName} className="h-8 text-xs"
                              onChange={(e) => setNewFieldName(e.target.value)} />
                            <Input placeholder="Value" value={newFieldValue} className="h-8 text-xs"
                              onChange={(e) => setNewFieldValue(e.target.value)} />
                            <Button size="sm" className="h-8" onClick={() => addCustomField(identity.id)}>Add</Button>
                          </div>
                        )}
                      </motion.div>
                    )}
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
          <h3 className="text-lg font-semibold mb-2">No Cloaked Identities Yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first identity to start protecting your real information online.
          </p>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Create First Identity
          </Button>
        </Card>
      )}
    </div>
  );
}
