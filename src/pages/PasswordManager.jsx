import { useState, useRef } from 'react';
import { incognito, generateSecurePassword } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Lock, Plus, Copy, Eye, EyeOff, Search, RefreshCw, Upload, Shield, AlertTriangle, Trash2, ExternalLink, Key } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AutofillPreview from '@/components/passwords/AutofillPreview';

const STRENGTH_COLORS = {
  very_weak: 'bg-red-500', weak: 'bg-orange-500', fair: 'bg-yellow-500',
  good: 'bg-blue-500', strong: 'bg-green-500', very_strong: 'bg-emerald-500', unknown: 'bg-gray-400',
};

const STRENGTH_LABELS = {
  very_weak: 'Very Weak', weak: 'Weak', fair: 'Fair',
  good: 'Good', strong: 'Strong', very_strong: 'Very Strong', unknown: 'Unknown',
};

export default function PasswordManager() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPasswords, setShowPasswords] = useState({});
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [genLength, setGenLength] = useState(20);
  const [genOptions, setGenOptions] = useState({ uppercase: true, lowercase: true, numbers: true, symbols: true });
  const [importSource, setImportSource] = useState('chrome');
  const [filterTag, setFilterTag] = useState('all');
  const [formData, setFormData] = useState({
    service_name: '', service_url: '', username: '', password: '', notes: '', tags: '',
  });

  const { data: passwords = [], isLoading } = useQuery({
    queryKey: ['passwordEntries'],
    queryFn: () => incognito.entities.PasswordEntry.list('-updated_date'),
  });

  const allTags = [...new Set(passwords.flatMap((p) => p.tags || []))].sort();

  const filtered = passwords.filter(p =>
    (filterTag === 'all' || (p.tags || []).includes(filterTag)) &&
    (!searchQuery ||
      p.service_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.tags || []).some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const strength = await incognito.functions.invoke('checkPasswordStrength', { password: data.password });
      const { tags, ...rest } = data;
      return incognito.entities.PasswordEntry.create({
        ...rest,
        tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        strength: strength.data?.strength || 'unknown',
        last_changed: new Date().toISOString(),
        breach_checked: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['passwordEntries']);
      setShowCreate(false);
      setFormData({ service_name: '', service_url: '', username: '', password: '', notes: '', tags: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => incognito.entities.PasswordEntry.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['passwordEntries']),
  });

  const breachCheckMutation = useMutation({
    mutationFn: async (entry) => {
      const result = await incognito.functions.invoke('checkPasswordBreach', { password: entry.password });
      await incognito.entities.PasswordEntry.update(entry.id, {
        breach_checked: true,
        breach_count: result.data?.count || 0,
        last_breach_check: new Date().toISOString(),
      });
      return result.data;
    },
    onSuccess: () => queryClient.invalidateQueries(['passwordEntries']),
  });

  const importMutation = useMutation({
    mutationFn: async ({ csvData, source }) => {
      return incognito.functions.invoke('importPasswords', { csvData, source });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries(['passwordEntries']);
      setShowImport(false);
    },
  });

  const handleFileImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      importMutation.mutate({ csvData: ev.target.result, source: importSource });
    };
    reader.readAsText(file);
  };

  const handleGenerate = () => {
    const pw = generateSecurePassword(genLength, genOptions);
    setGeneratedPassword(pw);
  };

  const copyToClipboard = (text) => navigator.clipboard.writeText(text);

  // Stats
  const breached = passwords.filter(p => p.breach_count > 0).length;
  const weak = passwords.filter(p => ['very_weak', 'weak'].includes(p.strength)).length;
  const reused = passwords.filter((p, _, arr) => arr.filter(a => a.password === p.password && a.id !== p.id).length > 0).length;
  const old = passwords.filter(p => {
    if (!p.last_changed) return false;
    const days = (Date.now() - new Date(p.last_changed).getTime()) / 86400000;
    return days > 90;
  }).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Key className="h-8 w-8 text-primary" />
            Password Manager
          </h1>
          <p className="text-muted-foreground mt-1">
            Store, generate, and manage passwords with breach monitoring.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowGenerator(true)} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Generator
          </Button>
          <Button variant="outline" onClick={() => setShowImport(true)} className="gap-2">
            <Upload className="h-4 w-4" /> Import
          </Button>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Add Password</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Password Entry</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Service Name *</Label>
                  <Input value={formData.service_name} onChange={(e) => setFormData(d => ({ ...d, service_name: e.target.value }))} /></div>
                <div><Label>URL</Label>
                  <Input value={formData.service_url} onChange={(e) => setFormData(d => ({ ...d, service_url: e.target.value }))} /></div>
                <div><Label>Username / Email</Label>
                  <Input value={formData.username} onChange={(e) => setFormData(d => ({ ...d, username: e.target.value }))} /></div>
                <div>
                  <Label>Password</Label>
                  <div className="flex gap-2">
                    <Input type="password" value={formData.password}
                      onChange={(e) => setFormData(d => ({ ...d, password: e.target.value }))} />
                    <Button variant="outline" size="icon" onClick={() => {
                      const pw = generateSecurePassword(20);
                      setFormData(d => ({ ...d, password: pw }));
                    }}><RefreshCw className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div>
                  <Label>Tags / folder (comma-separated)</Label>
                  <Input placeholder="e.g. work, banking" value={formData.tags}
                    onChange={(e) => setFormData(d => ({ ...d, tags: e.target.value }))} />
                </div>
                <Button className="w-full" onClick={() => createMutation.mutate(formData)}
                  disabled={!formData.service_name || !formData.password}>
                  {createMutation.isPending ? 'Saving...' : 'Save Password'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Health Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Passwords', value: passwords.length, icon: Lock, color: 'text-primary' },
          { label: 'Breached', value: breached, icon: AlertTriangle, color: breached > 0 ? 'text-red-500' : 'text-green-500' },
          { label: 'Weak', value: weak, icon: Shield, color: weak > 0 ? 'text-orange-500' : 'text-green-500' },
          { label: 'Reused', value: reused, icon: Copy, color: reused > 0 ? 'text-yellow-500' : 'text-green-500' },
          { label: 'Old (90+ days)', value: old, icon: RefreshCw, color: old > 0 ? 'text-yellow-500' : 'text-green-500' },
        ].map((s, i) => (
          <Card key={i} className="glass-card">
            <CardContent className="pt-4 pb-3 text-center">
              <s.icon className={`h-5 w-5 mx-auto mb-1 ${s.color}`} />
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Autofill preview (capability-gated; fill needs the companion extension) */}
      <AutofillPreview passwords={passwords} />

      {/* Search + tag filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search passwords or tags..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        {allTags.length > 0 && (
          <Select value={filterTag} onValueChange={setFilterTag}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Tag" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tags</SelectItem>
              {allTags.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Password List */}
      <div className="space-y-2">
        <AnimatePresence>
          {filtered.map((entry) => (
            <motion.div key={entry.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Card className="hover:bg-muted/30 transition-colors">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-2 h-8 rounded-full ${STRENGTH_COLORS[entry.strength] || 'bg-gray-400'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{entry.service_name}</span>
                          {entry.imported_from && <Badge variant="outline" className="text-[10px]">Imported</Badge>}
                          {entry.breach_count > 0 && <Badge variant="destructive" className="text-[10px]">Breached ({entry.breach_count}x)</Badge>}
                          {entry.password_history?.length > 0 && <Badge variant="secondary" className="text-[10px]">rotated {entry.password_history.length}×</Badge>}
                          {(entry.tags || []).map((t) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span>{entry.username || '—'}</span>
                          <span className="font-mono">
                            {showPasswords[entry.id] ? entry.password : '••••••••••'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-[10px]">
                        {STRENGTH_LABELS[entry.strength] || 'Unknown'}
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => setShowPasswords(s => ({ ...s, [entry.id]: !s[entry.id] }))}>
                        {showPasswords[entry.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => copyToClipboard(entry.password)}><Copy className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => breachCheckMutation.mutate(entry)}
                        disabled={breachCheckMutation.isPending}>
                        <Shield className="h-3 w-3" />
                      </Button>
                      {entry.service_url && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                          <a href={entry.service_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                        onClick={() => deleteMutation.mutate(entry.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {passwords.length === 0 && !isLoading && (
        <Card className="p-12 text-center">
          <Key className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold mb-2">No Passwords Stored</h3>
          <p className="text-muted-foreground mb-4">Add passwords manually or import from another password manager.</p>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => setShowCreate(true)} className="gap-2"><Plus className="h-4 w-4" /> Add Password</Button>
            <Button variant="outline" onClick={() => setShowImport(true)} className="gap-2"><Upload className="h-4 w-4" /> Import</Button>
          </div>
        </Card>
      )}

      {/* Password Generator Dialog */}
      <Dialog open={showGenerator} onOpenChange={setShowGenerator}>
        <DialogContent>
          <DialogHeader><DialogTitle>Password Generator</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg font-mono text-center text-lg break-all min-h-[60px] flex items-center justify-center">
              {generatedPassword || 'Click generate to create a password'}
            </div>
            <div className="flex gap-2 justify-center">
              <Button onClick={handleGenerate} className="gap-2"><RefreshCw className="h-4 w-4" /> Generate</Button>
              {generatedPassword && (
                <Button variant="outline" onClick={() => copyToClipboard(generatedPassword)} className="gap-2">
                  <Copy className="h-4 w-4" /> Copy
                </Button>
              )}
            </div>
            <div>
              <Label>Length: {genLength}</Label>
              <Slider value={[genLength]} onValueChange={([v]) => setGenLength(v)} min={8} max={64} step={1} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries({ uppercase: 'Uppercase (A-Z)', lowercase: 'Lowercase (a-z)', numbers: 'Numbers (0-9)', symbols: 'Symbols (!@#)' }).map(([key, label]) => (
                <div key={key} className="flex items-center gap-2">
                  <Switch checked={genOptions[key]}
                    onCheckedChange={(v) => setGenOptions(o => ({ ...o, [key]: v }))} />
                  <Label className="text-sm">{label}</Label>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent>
          <DialogHeader><DialogTitle>Import Passwords</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Export your passwords as CSV from your current password manager, then import them here.
            </p>
            <div>
              <Label>Import Source</Label>
              <Select value={importSource} onValueChange={setImportSource}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="chrome">Google Chrome</SelectItem>
                  <SelectItem value="1password">1Password</SelectItem>
                  <SelectItem value="lastpass">LastPass</SelectItem>
                  <SelectItem value="bitwarden">Bitwarden</SelectItem>
                  <SelectItem value="dashlane">Dashlane</SelectItem>
                  <SelectItem value="keeper">Keeper</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileImport} className="hidden" />
            <Button className="w-full gap-2" onClick={() => fileInputRef.current?.click()}
              disabled={importMutation.isPending}>
              <Upload className="h-4 w-4" />
              {importMutation.isPending ? 'Importing...' : 'Select CSV File'}
            </Button>
            {importMutation.isSuccess && (
              <p className="text-sm text-green-500">
                Imported {importMutation.data?.data?.imported || 0} passwords successfully.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
