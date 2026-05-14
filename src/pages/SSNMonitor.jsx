import { useState } from 'react';
import { incognito } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertTriangle, Shield, ShieldAlert, Search, Clock, CheckCircle, ExternalLink, Lock, Fingerprint, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CREDIT_BUREAUS = [
  { name: 'Equifax', freezeUrl: 'https://www.equifax.com/personal/credit-report-services/credit-freeze/', color: 'bg-red-500' },
  { name: 'Experian', freezeUrl: 'https://www.experian.com/freeze/center.html', color: 'bg-blue-500' },
  { name: 'TransUnion', freezeUrl: 'https://www.transunion.com/credit-freeze', color: 'bg-green-500' },
];

const RISK_STYLES = {
  critical: { bg: 'bg-red-500/10', text: 'text-red-500', badge: 'destructive' },
  high: { bg: 'bg-orange-500/10', text: 'text-orange-500', badge: 'destructive' },
  medium: { bg: 'bg-yellow-500/10', text: 'text-yellow-500', badge: 'secondary' },
  low: { bg: 'bg-green-500/10', text: 'text-green-500', badge: 'default' },
};

export default function SSNMonitor() {
  const queryClient = useQueryClient();
  const [showCheck, setShowCheck] = useState(false);
  const [ssnLast4, setSsnLast4] = useState('');
  const [selectedAlert, setSelectedAlert] = useState(null);

  const activeProfileId = typeof window !== 'undefined' ? window.activeProfileId : null;

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['ssnMonitorAlerts'],
    queryFn: () => incognito.entities.SSNMonitorAlert.list('-checked_at'),
  });

  const profileAlerts = alerts.filter(a => !activeProfileId || a.profile_id === activeProfileId);
  const latestAlert = profileAlerts[0];

  const checkMutation = useMutation({
    mutationFn: (last4) => incognito.functions.invoke('checkSSNExposure', {
      ssnLast4: last4, profileId: activeProfileId,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['ssnMonitorAlerts']);
      setShowCheck(false);
      setSsnLast4('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => incognito.entities.SSNMonitorAlert.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['ssnMonitorAlerts']),
  });

  const markReviewed = async (alertId) => {
    await incognito.entities.SSNMonitorAlert.update(alertId, { status: 'reviewed' });
    queryClient.invalidateQueries(['ssnMonitorAlerts']);
  };

  const riskStyle = (level) => RISK_STYLES[level] || RISK_STYLES.medium;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Fingerprint className="h-8 w-8 text-primary" />
            SSN & Identity Monitor
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor your Social Security Number on the dark web and get guided response plans.
          </p>
        </div>
        <Dialog open={showCheck} onOpenChange={setShowCheck}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Search className="h-4 w-4" /> Run SSN Check</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Check SSN Exposure</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="p-3 bg-yellow-500/10 rounded-lg text-sm">
                <AlertTriangle className="h-4 w-4 inline mr-1 text-yellow-500" />
                Only the last 4 digits of your SSN are used. Full SSN is never stored or transmitted.
              </div>
              <div>
                <Label>Last 4 Digits of SSN</Label>
                <Input type="password" maxLength={4} placeholder="****" value={ssnLast4}
                  onChange={(e) => setSsnLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="text-center text-2xl tracking-[1em] font-mono" />
              </div>
              <Button className="w-full" onClick={() => checkMutation.mutate(ssnLast4)}
                disabled={ssnLast4.length !== 4 || checkMutation.isPending}>
                {checkMutation.isPending ? 'Checking dark web databases...' : 'Check Exposure'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Current Status */}
      {latestAlert && (
        <Card className={`border-2 ${latestAlert.risk_level === 'critical' || latestAlert.risk_level === 'high' ? 'border-red-500/50' : 'border-green-500/50'}`}>
          <CardContent className="py-6">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center ${riskStyle(latestAlert.risk_level).bg}`}>
                {latestAlert.risk_level === 'critical' || latestAlert.risk_level === 'high' ?
                  <ShieldAlert className={`h-7 w-7 ${riskStyle(latestAlert.risk_level).text}`} /> :
                  <Shield className={`h-7 w-7 ${riskStyle(latestAlert.risk_level).text}`} />
                }
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold">SSN Risk Level: {latestAlert.risk_level?.toUpperCase()}</h2>
                  <Badge variant={riskStyle(latestAlert.risk_level).badge}>{latestAlert.risk_level}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Last checked: {new Date(latestAlert.checked_at).toLocaleString()} — SSN ending in ****{latestAlert.ssn_last4}
                </p>
                {latestAlert.credit_freeze_recommended && (
                  <p className="text-sm text-red-500 font-medium mt-1">
                    Credit freeze is STRONGLY recommended.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Credit Freeze Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Credit Freeze Status</h2>
        <div className="grid grid-cols-3 gap-4">
          {CREDIT_BUREAUS.map((bureau) => (
            <Card key={bureau.name}>
              <CardContent className="py-4 text-center">
                <div className={`w-10 h-10 rounded-full ${bureau.color} mx-auto mb-2 flex items-center justify-center`}>
                  <Lock className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-medium">{bureau.name}</h3>
                <Button variant="outline" size="sm" className="mt-2 gap-1" asChild>
                  <a href={bureau.freezeUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3" /> Freeze Credit
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* 24-Hour Response Plan */}
      {latestAlert && (latestAlert.risk_level === 'critical' || latestAlert.risk_level === 'high') && (
        <Card className="border-red-500/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-5 w-5" /> 24-Hour Response Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { step: 1, action: 'Freeze credit at all three bureaus', links: CREDIT_BUREAUS.map(b => ({ name: b.name, url: b.freezeUrl })) },
                { step: 2, action: 'Place fraud alerts with each bureau' },
                { step: 3, action: 'File an identity theft report at IdentityTheft.gov', url: 'https://www.identitytheft.gov/' },
                { step: 4, action: 'File a police report with local law enforcement' },
                { step: 5, action: 'Review bank and credit card statements for unauthorized transactions' },
                { step: 6, action: 'Change passwords on all financial accounts' },
                { step: 7, action: 'Enable 2FA on all accounts (use the Authenticator tab)' },
                { step: 8, action: 'Contact IRS to prevent tax fraud', url: 'https://www.irs.gov/identity-theft-fraud-scams' },
              ].map(item => (
                <div key={item.step} className="flex items-start gap-3 p-2 rounded hover:bg-muted/50">
                  <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-red-500">
                    {item.step}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm">{item.action}</p>
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5">
                        <ExternalLink className="h-3 w-3" /> Open
                      </a>
                    )}
                    {item.links && (
                      <div className="flex gap-2 mt-1">
                        {item.links.map(l => (
                          <a key={l.name} href={l.url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline">{l.name}</a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alerts History */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Check History</h2>
        <div className="space-y-2">
          <AnimatePresence>
            {profileAlerts.map((alert) => (
              <motion.div key={alert.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Card className={`${selectedAlert === alert.id ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setSelectedAlert(selectedAlert === alert.id ? null : alert.id)}>
                  <CardContent className="py-3 px-4 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${riskStyle(alert.risk_level).bg}`}>
                          <Shield className={`h-4 w-4 ${riskStyle(alert.risk_level).text}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">SSN ****{alert.ssn_last4}</span>
                            <Badge variant={riskStyle(alert.risk_level).badge}>{alert.risk_level}</Badge>
                            <Badge variant={alert.status === 'new' ? 'default' : 'secondary'}>{alert.status}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(alert.checked_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {alert.status === 'new' && (
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); markReviewed(alert.id); }}>
                            <CheckCircle className="h-3 w-3 mr-1" /> Mark Reviewed
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                          onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(alert.id); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {selectedAlert === alert.id && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                        className="mt-3 pt-3 border-t space-y-2">
                        {alert.known_breaches?.length > 0 && (
                          <div>
                            <Label className="text-xs">Known Breaches Involving SSNs</Label>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {alert.known_breaches.map((b, i) => (
                                <Badge key={i} variant="outline" className="text-[10px]">{b}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {alert.recommended_actions?.length > 0 && (
                          <div>
                            <Label className="text-xs">Recommended Actions</Label>
                            <ul className="mt-1 space-y-1">
                              {alert.recommended_actions.map((a, i) => (
                                <li key={i} className="text-xs flex items-start gap-1">
                                  <CheckCircle className="h-3 w-3 text-primary flex-shrink-0 mt-0.5" />
                                  {a}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {profileAlerts.length === 0 && !isLoading && (
        <Card className="p-12 text-center">
          <Fingerprint className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold mb-2">No SSN Checks Yet</h3>
          <p className="text-muted-foreground mb-4">
            Run a check to scan dark web databases for your SSN exposure. Only the last 4 digits are used.
          </p>
          <Button onClick={() => setShowCheck(true)} className="gap-2">
            <Search className="h-4 w-4" /> Run First Check
          </Button>
        </Card>
      )}
    </div>
  );
}
