import React, { useState } from 'react';
import { incognito } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, Plus, Copy, Trash2, Search, ToggleLeft, ToggleRight, ExternalLink, Inbox, Send, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function EmailAliases() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [formData, setFormData] = useState({ description: '', provider: 'local' });

  const activeProfileId = typeof window !== 'undefined' ? window.activeProfileId : null;

  const { data: aliases = [], isLoading } = useQuery({
    queryKey: ['emailAliases'],
    queryFn: () => incognito.entities.EmailAlias.list('-created_date'),
  });

  const { data: disposableAliases = [] } = useQuery({
    queryKey: ['disposableCredentials'],
    queryFn: async () => {
      const all = await incognito.entities.DisposableCredential.list('-created_date');
      return all.filter(d => d.type === 'email_alias');
    },
  });

  const allAliases = [
    ...aliases.map(a => ({ ...a, source: 'managed' })),
    ...disposableAliases.map(d => ({
      id: d.id, alias_email: d.value, description: d.purpose,
      status: 'active', source: 'disposable', created_date: d.created_date,
    })),
  ];

  const filtered = allAliases
    .filter(a => filterStatus === 'all' || a.status === filterStatus)
    .filter(a => !searchQuery || a.alias_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.description?.toLowerCase().includes(searchQuery.toLowerCase()));

  const createMutation = useMutation({
    mutationFn: (data) => incognito.functions.invoke('createEmailAliasReal', {
      profileId: activeProfileId, description: data.description,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['emailAliases']);
      setShowCreate(false);
      setFormData({ description: '', provider: 'local' });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (aliasId) => incognito.functions.invoke('toggleEmailAlias', { aliasId }),
    onSuccess: () => queryClient.invalidateQueries(['emailAliases']),
  });

  const deleteMutation = useMutation({
    mutationFn: async (alias) => {
      if (alias.source === 'disposable') {
        await incognito.entities.DisposableCredential.delete(alias.id);
      } else {
        await incognito.entities.EmailAlias.delete(alias.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['emailAliases']);
      queryClient.invalidateQueries(['disposableCredentials']);
    },
  });

  const copyToClipboard = (text) => navigator.clipboard.writeText(text);

  const stats = {
    total: allAliases.length,
    active: allAliases.filter(a => a.status === 'active').length,
    disabled: allAliases.filter(a => a.status === 'disabled').length,
    managed: aliases.length,
    disposable: disposableAliases.length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Mail className="h-8 w-8 text-primary" />
            Email Aliases
          </h1>
          <p className="text-muted-foreground mt-1">
            Generate unique email addresses for every service. Your real email stays hidden.
          </p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> New Alias</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Email Alias</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Description / Purpose</Label>
                <Input placeholder="e.g., Shopping sites, Newsletter signup" value={formData.description}
                  onChange={(e) => setFormData(d => ({ ...d, description: e.target.value }))} />
              </div>
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p className="font-medium mb-1">How it works:</p>
                <ul className="space-y-1 text-muted-foreground text-xs">
                  <li>- If SimpleLogin/addy.io API key is configured, a real forwarding alias is created</li>
                  <li>- Otherwise, a local alias is generated (use with a compatible email service)</li>
                  <li>- All emails to the alias are forwarded to your real email</li>
                  <li>- You can disable any alias to stop receiving emails</li>
                </ul>
              </div>
              <Button className="w-full" onClick={() => createMutation.mutate(formData)}
                disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Generate Alias'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Aliases', value: stats.total, icon: Mail },
          { label: 'Active', value: stats.active, icon: ToggleRight },
          { label: 'Disabled', value: stats.disabled, icon: ToggleLeft },
          { label: 'Managed', value: stats.managed, icon: Inbox },
          { label: 'Quick/Disposable', value: stats.disposable, icon: Send },
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
          <Input className="pl-9" placeholder="Search aliases..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alias List */}
      <div className="space-y-2">
        <AnimatePresence>
          {filtered.map((alias) => (
            <motion.div key={alias.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Card className={`hover:bg-muted/30 transition-colors ${alias.status === 'disabled' ? 'opacity-60' : ''}`}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Mail className={`h-5 w-5 ${alias.status === 'active' ? 'text-green-500' : 'text-muted-foreground'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm truncate">{alias.alias_email}</span>
                          <Badge variant={alias.source === 'managed' ? 'default' : 'outline'} className="text-[10px]">
                            {alias.source === 'managed' ? 'Managed' : 'Quick'}
                          </Badge>
                          <Badge variant={alias.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
                            {alias.status}
                          </Badge>
                        </div>
                        {alias.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{alias.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => copyToClipboard(alias.alias_email)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                      {alias.source === 'managed' && (
                        <Button variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => toggleMutation.mutate(alias.id)}>
                          {alias.status === 'active' ? <ToggleRight className="h-4 w-4 text-green-500" /> : <ToggleLeft className="h-4 w-4" />}
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                        onClick={() => deleteMutation.mutate(alias)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {allAliases.length === 0 && !isLoading && (
        <Card className="p-12 text-center">
          <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold mb-2">No Email Aliases</h3>
          <p className="text-muted-foreground mb-4">
            Create email aliases to protect your real email address when signing up for services.
          </p>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Create First Alias
          </Button>
        </Card>
      )}
    </div>
  );
}
