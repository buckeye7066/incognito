import { useState, useEffect } from 'react';
import { incognito } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PhoneCall, Shield, ShieldAlert, ShieldBan, ShieldCheck, FileText, Search, Trash2, AlertTriangle, Clock, Sparkles, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCapabilities } from '@/hooks/useCapabilities';
import { CAPABILITY } from '@/providers';
import CapabilityBadge from '@/components/common/CapabilityBadge';
import { normalizePhone } from '@/lib/phoneRules';
import nativeBridge from '@/lib/nativeBridge';
import { planEnforcement, mergeCallEvents, summarizeEnforcement } from '@/lib/callEnforcement';
import { notify } from '@/lib/notify';

const RISK_COLORS = {
  high: 'text-red-500 bg-red-500/10', medium: 'text-yellow-500 bg-yellow-500/10', low: 'text-green-500 bg-green-500/10',
};

const ACTION_ICONS = {
  block: ShieldBan, screen: Shield, allow: ShieldCheck,
};

const CALLER_TYPES = {
  scam: { label: 'Scam', color: 'bg-red-500' },
  spam: { label: 'Spam', color: 'bg-orange-500' },
  robocall: { label: 'Robocall', color: 'bg-yellow-500' },
  telemarketer: { label: 'Telemarketer', color: 'bg-amber-500' },
  legitimate: { label: 'Legitimate', color: 'bg-green-500' },
  unknown: { label: 'Unknown', color: 'bg-gray-500' },
};

export default function CallGuard() {
  const queryClient = useQueryClient();
  const [showScreen, setShowScreen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [myNumber, setMyNumber] = useState(() => localStorage.getItem('call_guard_my_number') || '');
  const [autoBlock, setAutoBlock] = useState(() => localStorage.getItem('auto_block_scam') === 'true');
  const [useAI, setUseAI] = useState(() => localStorage.getItem('call_guard_use_ai') === 'true');

  const { capabilities } = useCapabilities();
  const callCap = capabilities[CAPABILITY.CALL_SCREEN];
  const blockCap = capabilities[CAPABILITY.CALL_BLOCK];

  // Native dialer bridge: present only inside the companion native shell. When
  // absent, Call Guard is honestly advisory — it recommends but cannot enforce.
  const [native, setNative] = useState({ present: false, canScreen: false, events: [] });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!nativeBridge.isPresent()) return;
      try {
        const canScreen = await nativeBridge.calls.canScreen();
        const events = await nativeBridge.calls.recentEvents().catch(() => []);
        if (!cancelled) setNative({ present: true, canScreen: Boolean(canScreen), events: Array.isArray(events) ? events : [] });
      } catch {
        if (!cancelled) setNative({ present: true, canScreen: false, events: [] });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const activeProfileId = typeof window !== 'undefined' ? window.activeProfileId : null;

  const { data: callLogs = [], isLoading } = useQuery({
    queryKey: ['callGuardLogs'],
    queryFn: () => incognito.entities.CallGuardLog.list('-screened_at'),
  });

  const filtered = callLogs
    .filter(l => !activeProfileId || l.profile_id === activeProfileId)
    .filter(l => activeTab === 'all' || l.action_taken === activeTab)
    .filter(l => !searchQuery || l.caller_number?.includes(searchQuery));

  // The screener learns from history: numbers you previously allowed become a
  // local allowlist, ones you blocked stay blocked, and all prior callers feed
  // repeat-caller detection. Everything stays on-device.
  const learned = callLogs.reduce((acc, l) => {
    const n = normalizePhone(l.caller_number);
    if (!n) return acc;
    acc.history.push(n);
    if (l.action_taken === 'allow') acc.contacts.add(n);
    if (l.action_taken === 'block') acc.blocked.add(n);
    return acc;
  }, { history: [], contacts: new Set(), blocked: new Set() });

  const screenMutation = useMutation({
    mutationFn: (number) => incognito.functions.invoke('screenCall', {
      callerNumber: number,
      profileId: activeProfileId,
      myNumber,
      contacts: [...learned.contacts],
      blocked: [...learned.blocked],
      history: learned.history,
      autoBlock,
      useAI,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['callGuardLogs']);
      setShowScreen(false);
      setPhoneNumber('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => incognito.entities.CallGuardLog.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['callGuardLogs']),
  });

  // Block/allow a number. Records the decision locally (so the screener learns)
  // and, when the native bridge is present, actually enforces it on the device.
  // Without the bridge it stays honestly advisory.
  const enforceMutation = useMutation({
    mutationFn: async ({ number, action }) => {
      const plan = planEnforcement(action, { hasBridge: native.present, canScreen: native.canScreen });
      if (plan.command && nativeBridge.isPresent()) {
        await nativeBridge.calls[plan.command](number);
      }
      await incognito.entities.CallGuardLog.create({
        profile_id: activeProfileId,
        caller_number: number,
        risk_level: action === 'block' ? 'high' : 'low',
        likely_type: action === 'block' ? 'scam' : 'legitimate',
        action_taken: action,
        reasoning: action === 'block' ? 'Manually blocked' : 'Manually allowed',
        signals: [{ code: 'manual', label: `You ${action === 'block' ? 'blocked' : 'allowed'} this number`, severity: action === 'block' ? 'danger' : 'good' }],
        source: plan.mode === 'enforced' ? 'native' : 'on_device',
        screened_at: new Date().toISOString(),
      });
      return plan;
    },
    onSuccess: (plan) => {
      queryClient.invalidateQueries(['callGuardLogs']);
      notify.success(plan.note);
    },
    onError: (err) => notify.error(err?.message || 'Could not apply that.'),
  });

  const toggleSetting = (key, setter) => (value) => {
    setter(value);
    localStorage.setItem(key, value.toString());
  };

  // Fold the OS's own call events into the history for an honest device tally.
  const enforcement = summarizeEnforcement(mergeCallEvents(callLogs, native.events));

  const stats = {
    total: callLogs.length,
    blocked: callLogs.filter(l => l.action_taken === 'block').length,
    screened: callLogs.filter(l => l.action_taken === 'screen').length,
    allowed: callLogs.filter(l => l.action_taken === 'allow').length,
    scams: callLogs.filter(l => l.likely_type === 'scam').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ShieldAlert className="h-8 w-8 text-primary" />
            Call Guard
            <CapabilityBadge status={callCap?.status} detail={callCap?.providers?.[0]?.detail} />
            <span className="inline-flex items-center gap-1 text-sm font-normal">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <CapabilityBadge status={blockCap?.status} detail={blockCap?.providers?.[0]?.detail} />
            </span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Check a number against signals we can actually verify on-device — invalid caller IDs,
            local-prefix spoofing, and your own allow/block history.
            {native.present && native.canScreen
              ? ' Blocks are enforced on this device.'
              : ' Blocking is advisory until you install the companion app.'}
          </p>
        </div>
        <Dialog open={showScreen} onOpenChange={setShowScreen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><PhoneCall className="h-4 w-4" /> Screen Number</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Screen a Phone Number</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Phone Number</Label>
                <Input placeholder="+1 (555) 123-4567" value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)} />
              </div>
              <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <Sparkles className="h-3.5 w-3.5 text-primary" /> Add AI estimate
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Optional, needs an API key. Clearly labeled as an unverified guess.
                  </p>
                </div>
                <Switch checked={useAI} onCheckedChange={toggleSetting('call_guard_use_ai', setUseAI)} />
              </div>
              <p className="text-sm text-muted-foreground">
                Runs entirely on-device using verifiable signals. {useAI ? 'An AI estimate is added as a labeled, unverified hint.' : ''}
                {' '}Screening flags and recommends — it can&apos;t intercept a live call (that needs your carrier or a native dialer app).
              </p>
              <Button className="w-full" onClick={() => screenMutation.mutate(phoneNumber)}
                disabled={!phoneNumber || screenMutation.isPending}>
                {screenMutation.isPending ? 'Checking…' : 'Screen Number'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Screened', value: stats.total, icon: PhoneCall, color: 'text-primary' },
          { label: 'Blocked', value: stats.blocked, icon: ShieldBan, color: 'text-red-500' },
          { label: 'Screened', value: stats.screened, icon: Shield, color: 'text-yellow-500' },
          { label: 'Allowed', value: stats.allowed, icon: ShieldCheck, color: 'text-green-500' },
          { label: 'Scams Detected', value: stats.scams, icon: AlertTriangle, color: 'text-red-500' },
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

      {/* Native enforcement banner — only meaningful inside the companion app */}
      {native.present && (
        <Card className="glass-card border-green-500/20 bg-green-500/5">
          <CardContent className="py-3 px-4 flex items-center gap-3 text-sm">
            <Smartphone className="h-4 w-4 text-green-400" />
            <span className="text-green-300">
              {native.canScreen
                ? `Enforcement active on this device · ${enforcement.enforcedOnDevice} call event${enforcement.enforcedOnDevice === 1 ? '' : 's'} from the OS.`
                : 'Companion app detected, but it has no call-screening permission yet.'}
            </span>
          </CardContent>
        </Card>
      )}

      {/* Settings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-1">
          <CardContent className="py-4">
            <h3 className="font-medium text-sm">Your number</h3>
            <p className="text-xs text-muted-foreground mb-2">
              Enables local-prefix &ldquo;neighbor spoof&rdquo; detection. Stays on this device.
            </p>
            <Input
              placeholder="+1 (555) 123-4567"
              value={myNumber}
              onChange={(e) => { setMyNumber(e.target.value); localStorage.setItem('call_guard_my_number', e.target.value); }}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center justify-between h-full">
            <div>
              <h3 className="font-medium text-sm">Auto-block high-risk</h3>
              <p className="text-xs text-muted-foreground">
                Off = high-risk calls are screened for review, never silently dropped.
              </p>
            </div>
            <Switch checked={autoBlock} onCheckedChange={toggleSetting('auto_block_scam', setAutoBlock)} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center justify-between h-full">
            <div>
              <h3 className="font-medium text-sm flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> AI estimate
              </h3>
              <p className="text-xs text-muted-foreground">
                Adds a labeled, unverified AI hint (needs an API key).
              </p>
            </div>
            <Switch checked={useAI} onCheckedChange={toggleSetting('call_guard_use_ai', setUseAI)} />
          </CardContent>
        </Card>
      </div>

      {/* Tabs & Search */}
      <div className="flex gap-3">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="block">Blocked</TabsTrigger>
            <TabsTrigger value="screen">Screened</TabsTrigger>
            <TabsTrigger value="allow">Allowed</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by phone number..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      {/* Call Logs */}
      <div className="space-y-2">
        <AnimatePresence>
          {filtered.map((log) => {
            const ActionIcon = ACTION_ICONS[log.action_taken] || Shield;
            const callerType = CALLER_TYPES[log.likely_type] || CALLER_TYPES.unknown;

            return (
              <motion.div key={log.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Card>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${RISK_COLORS[log.risk_level] || 'bg-muted'}`}>
                          <ActionIcon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-medium">{log.caller_number}</span>
                            <Badge className={`${callerType.color} text-white text-[10px]`}>
                              {callerType.label}
                            </Badge>
                            <Badge variant={log.risk_level === 'high' ? 'destructive' : log.risk_level === 'medium' ? 'secondary' : 'default'}>
                              {log.risk_level} risk
                            </Badge>
                          </div>
                          {Array.isArray(log.signals) && log.signals.length > 0 ? (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {log.signals.map((sig, idx) => (
                                <Badge
                                  key={idx}
                                  variant="outline"
                                  className={`text-[10px] ${
                                    sig.severity === 'danger' ? 'border-red-500/50 text-red-300'
                                      : sig.severity === 'warn' ? 'border-amber-500/50 text-amber-300'
                                      : sig.severity === 'good' ? 'border-green-500/50 text-green-300'
                                      : 'border-border/60 text-muted-foreground'
                                  }`}
                                >
                                  {sig.label}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground mt-0.5">{log.reasoning}</p>
                          )}
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <Clock className="h-3 w-3" />
                            <span>{new Date(log.screened_at).toLocaleString()}</span>
                            <span>Action: {log.action_taken}</span>
                            {log.source && (
                              <span className="inline-flex items-center gap-1">
                                ·{log.source.includes('ai') ? <><Sparkles className="h-3 w-3" /> on-device + AI estimate</> : 'on-device'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {log.transcript && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="View transcript">
                            <FileText className="h-3 w-3" />
                          </Button>
                        )}
                        {log.action_taken !== 'block' && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400"
                            title={native.canScreen ? 'Block on this device' : 'Block (advisory)'}
                            disabled={enforceMutation.isPending}
                            onClick={() => enforceMutation.mutate({ number: log.caller_number, action: 'block' })}>
                            <ShieldBan className="h-3 w-3" />
                          </Button>
                        )}
                        {log.action_taken !== 'allow' && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-green-400"
                            title={native.canScreen ? 'Allow on this device' : 'Allow (advisory)'}
                            disabled={enforceMutation.isPending}
                            onClick={() => enforceMutation.mutate({ number: log.caller_number, action: 'allow' })}>
                            <ShieldCheck className="h-3 w-3" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                          onClick={() => deleteMutation.mutate(log.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {callLogs.length === 0 && !isLoading && (
        <Card className="p-12 text-center">
          <ShieldAlert className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold mb-2">No Call Screening History</h3>
          <p className="text-muted-foreground mb-4">
            Screen phone numbers against on-device signals — invalid caller IDs, local-prefix spoofing, and your own allow/block history.
          </p>
          <Button onClick={() => setShowScreen(true)} className="gap-2">
            <PhoneCall className="h-4 w-4" /> Screen a Number
          </Button>
        </Card>
      )}
    </div>
  );
}
