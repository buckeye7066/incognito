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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PhoneCall, Shield, ShieldAlert, ShieldBan, ShieldCheck, FileText, Search, Trash2, AlertTriangle, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [screeningEnabled, setScreeningEnabled] = useState(() => localStorage.getItem('call_guard_enabled') === 'true');
  const [voiceCloneDetection, setVoiceCloneDetection] = useState(() => localStorage.getItem('voice_clone_detection') === 'true');
  const [autoBlock, setAutoBlock] = useState(() => localStorage.getItem('auto_block_scam') === 'true');

  const activeProfileId = typeof window !== 'undefined' ? window.activeProfileId : null;

  const { data: callLogs = [], isLoading } = useQuery({
    queryKey: ['callGuardLogs'],
    queryFn: () => incognito.entities.CallGuardLog.list('-screened_at'),
  });

  const filtered = callLogs
    .filter(l => !activeProfileId || l.profile_id === activeProfileId)
    .filter(l => activeTab === 'all' || l.action_taken === activeTab)
    .filter(l => !searchQuery || l.caller_number?.includes(searchQuery));

  const screenMutation = useMutation({
    mutationFn: (number) => incognito.functions.invoke('screenCall', {
      callerNumber: number, profileId: activeProfileId,
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

  const toggleSetting = (key, setter) => (value) => {
    setter(value);
    localStorage.setItem(key, value.toString());
  };

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
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-powered call screening — detect scams, robocalls, and voice cloning attempts.
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
              <p className="text-sm text-muted-foreground">
                AI will analyze this number for scam/spam risk, caller type, and provide a recommendation.
              </p>
              <Button className="w-full" onClick={() => screenMutation.mutate(phoneNumber)}
                disabled={!phoneNumber || screenMutation.isPending}>
                {screenMutation.isPending ? 'Analyzing...' : 'Screen Call'}
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

      {/* Settings */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4 flex items-center justify-between">
            <div>
              <h3 className="font-medium text-sm">AI Screening</h3>
              <p className="text-xs text-muted-foreground">Screen unknown calls</p>
            </div>
            <Switch checked={screeningEnabled} onCheckedChange={toggleSetting('call_guard_enabled', setScreeningEnabled)} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center justify-between">
            <div>
              <h3 className="font-medium text-sm">Voice Clone Detection</h3>
              <p className="text-xs text-muted-foreground">Detect AI voice cloning</p>
            </div>
            <Switch checked={voiceCloneDetection} onCheckedChange={toggleSetting('voice_clone_detection', setVoiceCloneDetection)} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center justify-between">
            <div>
              <h3 className="font-medium text-sm">Auto-Block Scams</h3>
              <p className="text-xs text-muted-foreground">Block high-risk callers</p>
            </div>
            <Switch checked={autoBlock} onCheckedChange={toggleSetting('auto_block_scam', setAutoBlock)} />
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
                          <p className="text-sm text-muted-foreground mt-0.5">{log.reasoning}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <Clock className="h-3 w-3" />
                            <span>{new Date(log.screened_at).toLocaleString()}</span>
                            <span>Action: {log.action_taken}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {log.transcript && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="View transcript">
                            <FileText className="h-3 w-3" />
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
            Screen phone numbers to detect scams, robocalls, and suspicious callers using AI analysis.
          </p>
          <Button onClick={() => setShowScreen(true)} className="gap-2">
            <PhoneCall className="h-4 w-4" /> Screen a Number
          </Button>
        </Card>
      )}
    </div>
  );
}
