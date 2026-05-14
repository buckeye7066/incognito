import { useState, useEffect } from 'react';
import { incognito, generateTOTP } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Plus, Copy, Trash2, Shield, Clock, Key, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function TOTPCodeDisplay({ secret, period = 30, digits = 6 }) {
  const [code, setCode] = useState('------');
  const [timeLeft, setTimeLeft] = useState(period);

  useEffect(() => {
    let mounted = true;
    const update = async () => {
      try {
        const generated = await generateTOTP(secret, period, digits);
        if (mounted) setCode(generated);
      } catch {
        if (mounted) setCode('ERROR');
      }
    };

    update();
    const interval = setInterval(() => {
      const left = period - (Math.floor(Date.now() / 1000) % period);
      if (mounted) setTimeLeft(left);
      if (left === period) update();
    }, 1000);

    return () => { mounted = false; clearInterval(interval); };
  }, [secret, period, digits]);

  const urgency = timeLeft <= 5 ? 'text-red-500' : timeLeft <= 10 ? 'text-yellow-500' : 'text-primary';

  return (
    <div className="flex items-center gap-3">
      <div className="text-3xl font-mono font-bold tracking-[0.3em]">
        {code.slice(0, 3)} {code.slice(3)}
      </div>
      <div className="flex flex-col items-center gap-1">
        <div className={`text-sm font-bold ${urgency}`}>{timeLeft}s</div>
        <Progress value={(timeLeft / period) * 100} className="w-12 h-1.5" />
      </div>
      <Button variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(code)} className="h-8 w-8">
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function TOTPAuthenticator() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    service_name: '', secret: '', digits: 6, period: 30,
  });

  const { data: secrets = [], isLoading } = useQuery({
    queryKey: ['totpSecrets'],
    queryFn: () => incognito.entities.TOTPSecret.list('-created_date'),
  });

  const filtered = secrets.filter(s =>
    !searchQuery || s.service_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const addMutation = useMutation({
    mutationFn: (data) => incognito.functions.invoke('addTOTPSecret', {
      serviceName: data.service_name,
      secret: data.secret,
      digits: parseInt(data.digits) || 6,
      period: parseInt(data.period) || 30,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['totpSecrets']);
      setShowAdd(false);
      setFormData({ service_name: '', secret: '', digits: 6, period: 30 });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => incognito.entities.TOTPSecret.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['totpSecrets']),
  });

  const parseOtpauthUri = (uri) => {
    try {
      const url = new URL(uri);
      if (url.protocol !== 'otpauth:') return null;
      const label = decodeURIComponent(url.pathname.slice(2));
      const secret = url.searchParams.get('secret') || '';
      const issuer = url.searchParams.get('issuer') || label.split(':')[0] || label;
      const digits = parseInt(url.searchParams.get('digits')) || 6;
      const period = parseInt(url.searchParams.get('period')) || 30;
      return { service_name: issuer, secret, digits, period };
    } catch { return null; }
  };

  const handleSecretChange = (value) => {
    // Check if it's an otpauth:// URI
    const parsed = parseOtpauthUri(value);
    if (parsed) {
      setFormData(parsed);
    } else {
      setFormData(d => ({ ...d, secret: value }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            Authenticator
          </h1>
          <p className="text-muted-foreground mt-1">
            Two-factor authentication codes — replaces Google Authenticator, Authy, etc.
          </p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Add Account</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add TOTP Account</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Service Name *</Label>
                <Input placeholder="e.g., GitHub, Google, AWS" value={formData.service_name}
                  onChange={(e) => setFormData(d => ({ ...d, service_name: e.target.value }))} />
              </div>
              <div>
                <Label>Secret Key or otpauth:// URI *</Label>
                <Input placeholder="Paste secret key or otpauth:// URI" value={formData.secret}
                  onChange={(e) => handleSecretChange(e.target.value)}
                  className="font-mono text-sm" />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter the base32 secret key from your service, or paste the full otpauth:// URI.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Digits</Label>
                  <Input type="number" value={formData.digits}
                    onChange={(e) => setFormData(d => ({ ...d, digits: e.target.value }))} />
                </div>
                <div>
                  <Label>Period (seconds)</Label>
                  <Input type="number" value={formData.period}
                    onChange={(e) => setFormData(d => ({ ...d, period: e.target.value }))} />
                </div>
              </div>
              <Button className="w-full" onClick={() => addMutation.mutate(formData)}
                disabled={!formData.service_name || !formData.secret || addMutation.isPending}>
                {addMutation.isPending ? 'Adding...' : 'Add Account'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="glass-card">
          <CardContent className="pt-4 pb-3 text-center">
            <Key className="h-5 w-5 mx-auto mb-1 text-primary" />
            <div className="text-2xl font-bold">{secrets.length}</div>
            <div className="text-xs text-muted-foreground">Total Accounts</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="pt-4 pb-3 text-center">
            <Shield className="h-5 w-5 mx-auto mb-1 text-green-500" />
            <div className="text-2xl font-bold">{secrets.filter(s => s.digits === 6).length}</div>
            <div className="text-xs text-muted-foreground">Standard (6-digit)</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="pt-4 pb-3 text-center">
            <Clock className="h-5 w-5 mx-auto mb-1 text-blue-500" />
            <div className="text-2xl font-bold">{secrets.filter(s => s.period === 30).length}</div>
            <div className="text-xs text-muted-foreground">30s Period</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      {secrets.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search accounts..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      )}

      {/* TOTP Codes */}
      <div className="space-y-3">
        <AnimatePresence>
          {filtered.map((entry) => (
            <motion.div key={entry.id} layout initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Card className="hover:bg-muted/30 transition-colors">
                <CardContent className="py-4 px-5">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-lg mb-1">{entry.service_name}</div>
                      <TOTPCodeDisplay
                        secret={entry.secret}
                        period={entry.period || 30}
                        digits={entry.digits || 6}
                      />
                    </div>
                    <Button variant="ghost" size="icon" className="text-destructive"
                      onClick={() => deleteMutation.mutate(entry.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {secrets.length === 0 && !isLoading && (
        <Card className="p-12 text-center">
          <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold mb-2">No Authenticator Accounts</h3>
          <p className="text-muted-foreground mb-4">
            Add your two-factor authentication accounts to generate TOTP codes right here.
          </p>
          <Button onClick={() => setShowAdd(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Add First Account
          </Button>
        </Card>
      )}
    </div>
  );
}
