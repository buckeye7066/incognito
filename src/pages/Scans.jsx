import { useActiveProfile } from '@/hooks/useActiveProfile';
import { notify } from '@/lib/notify';
import { useState } from 'react';
import { incognito, resolvePersonalDataValue } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, CheckCircle2, AlertTriangle, Database, Globe, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DarkWebConsentModal from '../components/scans/DarkWebConsentModal';
import DarkWebScanCard from '../components/scans/DarkWebScanCard';
import DataSourcesCard from '../components/scans/DataSourcesCard';

export default function Scans() {
  const queryClient = useQueryClient();
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(null);
  const [scanSummary, setScanSummary] = useState(null);
  const [showDarkWebConsent, setShowDarkWebConsent] = useState(false);
  const [darkWebScanning, setDarkWebScanning] = useState(false);
  const [categoryScan, setCategoryScan] = useState(null);

  const { activeProfileId } = useActiveProfile();

  const { data: allPersonalData = [] } = useQuery({
    queryKey: ['personalData'],
    queryFn: () => incognito.entities.PersonalData.list()
  });

  const personalData = allPersonalData.filter(d => !activeProfileId || d.profile_id === activeProfileId);

  const { data: allScanResults = [] } = useQuery({
    queryKey: ['scanResults'],
    queryFn: () => incognito.entities.ScanResult.list()
  });

  const myScanResults = allScanResults.filter(r => !activeProfileId || r.profile_id === activeProfileId);

  const { data: userPreferences = [], refetch: refetchPreferences } = useQuery({
    queryKey: ['userPreferences'],
    queryFn: () => incognito.entities.UserPreferences.list()
  });

  const preference = userPreferences[0] || {};
  const darkWebEnabled = preference.dark_web_scan_enabled || false;

  const createResultMutation = useMutation({
    mutationFn: (data) => incognito.entities.ScanResult.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scanResults'] });
    }
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: (data) => {
      if (preference.id) {
        return incognito.entities.UserPreferences.update(preference.id, data);
      } else {
        return incognito.entities.UserPreferences.create(data);
      }
    },
    onSuccess: () => {
      refetchPreferences();
    }
  });

  const runScan = async () => {
    if (!activeProfileId) {
      notify.warn('Please select a profile first from the sidebar.');
      return;
    }
    setScanning(true);
    setScanSummary(null);
    const warnings = [];
    let totalBreaches = 0;
    let totalExposures = 0;

    const emails = personalData.filter(p => p.monitoring_enabled && p.data_type === 'email');
    const fnItem = personalData.find(p => p.data_type === 'full_name');
    const fullName = fnItem ? resolvePersonalDataValue(fnItem) : '';
    const phones = personalData.filter(p => p.data_type === 'phone').map(p => resolvePersonalDataValue(p));
    const addresses = personalData.filter(p => p.data_type === 'address').map(p => resolvePersonalDataValue(p));

    const totalSteps = emails.length + 1;
    setScanProgress({ current: 0, total: totalSteps, phase: 'Breach databases' });

    for (let i = 0; i < emails.length; i++) {
      const emailData = emails[i];
      setScanProgress({ current: i + 1, total: totalSteps, scanning: emailData.value, phase: 'Breach databases' });

      try {
        const response = await incognito.functions.invoke('checkHIBP', { email: emailData.value });

        if (response.data?.skipped) {
          if (!warnings.includes(response.data.reason)) warnings.push(response.data.reason);
          continue;
        }

        if (response.data.found && response.data.breaches?.length > 0) {
          for (const breach of response.data.breaches) {
            totalBreaches++;
            await createResultMutation.mutateAsync({
              profile_id: activeProfileId,
              personal_data_id: emailData.id,
              source_name: breach.title || breach.name || breach.Name,
              source_url: breach.domain ? `https://${breach.domain}` : 'https://haveibeenpwned.com',
              source_type: 'breach_database',
              risk_score: breach.isSensitive ? 90 : (breach.dataClasses?.length > 5 ? 80 : 60),
              data_exposed: breach.dataClasses || breach.DataClasses || ['email'],
              breach_date: breach.breachDate || breach.BreachDate,
              status: 'new',
              scan_date: new Date().toISOString().split('T')[0],
              metadata: {
                details: breach.description || breach.Description,
                pwnCount: breach.pwnCount || breach.PwnCount,
                isVerified: breach.isVerified ?? breach.IsVerified,
                email: emailData.value,
                scan_type: 'hibp_verified'
              }
            });
          }
        }
      } catch (error) {
        console.warn('HIBP scan error:', error?.message);
        if (!warnings.includes(error?.message)) warnings.push(error?.message || 'Breach scan failed');
      }

      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    setScanProgress({ current: emails.length + 1, total: totalSteps, scanning: 'Public exposure search', phase: 'People search & data brokers' });

    try {
      const exposureResult = await incognito.functions.invoke('detectSearchQueries', {
        profileId: activeProfileId,
        fullName,
        emails: emails.map(e => e.value),
        phones,
        addresses,
      });
      if (exposureResult.data?.skipped) {
        if (!warnings.includes(exposureResult.data.reason)) warnings.push(exposureResult.data.reason);
      } else {
        totalExposures = exposureResult.data?.total || 0;
      }
    } catch (error) {
      console.warn('Exposure scan error:', error?.message);
      if (!warnings.includes(error?.message)) warnings.push(error?.message || 'Exposure scan failed');
    }

    queryClient.invalidateQueries({ queryKey: ['scanResults'] });
    queryClient.invalidateQueries({ queryKey: ['searchQueryFindings'] });

    setScanSummary({
      breaches: totalBreaches,
      exposures: totalExposures,
      warnings,
      emailsScanned: emails.length,
    });

    setScanning(false);
    setScanProgress(null);
  };

  const runCategoryScan = async (category) => {
    setCategoryScan(category);
    const fnItem2 = personalData.find(p => p.data_type === 'full_name');
    const fullName = fnItem2 ? resolvePersonalDataValue(fnItem2) : '';
    const emails = personalData.filter(p => p.data_type === 'email').map(p => resolvePersonalDataValue(p));
    const phones = personalData.filter(p => p.data_type === 'phone').map(p => resolvePersonalDataValue(p));
    const addresses = personalData.filter(p => p.data_type === 'address').map(p => resolvePersonalDataValue(p));
    const usernames = personalData.filter(p => p.data_type === 'username').map(p => resolvePersonalDataValue(p));

    try {
      if (category === 'people_search') {
        const result = await incognito.functions.invoke('detectSearchQueries', {
          profileId: activeProfileId,
          fullName,
          emails,
          phones,
          addresses,
        });
        queryClient.invalidateQueries({ queryKey: ['searchQueryFindings'] });
        if (result.data?.skipped) {
          notify.warn(`Scan skipped: ${result.data.reason}. Add your OpenAI API key in Settings.`);
        } else {
          notify.success(`People search scan complete: ${result.data?.total || 0} exposures found. View results in Findings.`);
        }
      } else if (category === 'data_brokers') {
        window.location.href = '/DataBrokerDirectory';
        return;
      } else if (category === 'public_records') {
        const result = await incognito.functions.invoke('runIdentityScan', {
          profileId: activeProfileId,
          fullName,
          emails,
          phones,
          addresses,
        });
        queryClient.invalidateQueries({ queryKey: ['scanResults'] });
        if (result.data?.findings) {
          notify.success(`Public records scan complete: ${result.data.findings.length} findings. View results in Findings.`);
        } else {
          notify.success(`Public records scan complete. ${result.data?.scan_summary || 'Check Findings for results.'}`);
        }
      } else if (category === 'social_media') {
        const result = await incognito.functions.invoke('monitorSocialMedia', {
          profileId: activeProfileId,
          fullName,
          usernames,
        });
        queryClient.invalidateQueries({ queryKey: ['socialMediaFindings'] });
        if (result.data?.skipped) {
          notify.warn(`Scan skipped: ${result.data.reason}. Add your OpenAI API key in Settings.`);
        } else {
          notify.success(`Social media scan complete: ${result.data?.total || 0} findings. View results in Findings.`);
        }
      }
    } catch (error) {
      const msg = error?.message || 'Unknown error';
      if (msg.includes('API key') || msg.includes('Failed to fetch')) {
        notify.error(`This scan requires an API key. ${msg}. Go to Settings → API Keys.`);
      } else {
        notify.error('Scan failed: ' + msg);
      }
    } finally {
      setCategoryScan(null);
    }
  };

  const enableDarkWebScanning = async () => {
    await updatePreferencesMutation.mutateAsync({
      dark_web_scan_enabled: true,
      dark_web_consent_given: true,
      consent_timestamp: new Date().toISOString()
    });
  };

  const runDarkWebScan = async () => {
    setDarkWebScanning(true);
    const emails = personalData.filter(p => p.monitoring_enabled && p.data_type === 'email');

    setScanProgress({ current: 0, total: emails.length, type: 'dark_web' });

    for (let i = 0; i < emails.length; i++) {
      const emailData = emails[i];
      setScanProgress({ current: i + 1, total: emails.length, scanning: emailData.value, type: 'dark_web' });

      try {
        const response = await incognito.functions.invoke('checkHIBP', { email: emailData.value });

        if (response.data?.skipped) continue;

        if (response.data.found && response.data.breaches?.length > 0) {
          const seriousBreaches = response.data.breaches.filter(b =>
            b.isSensitive || b.IsSensitive ||
            (b.dataClasses || b.DataClasses || []).some(dc => ['Passwords', 'Credit cards', 'Bank account numbers', 'Social security numbers'].includes(dc))
          );

          for (const breach of seriousBreaches) {
            await createResultMutation.mutateAsync({
              profile_id: activeProfileId,
              personal_data_id: emailData.id,
              source_name: breach.title || breach.name || breach.Name,
              source_url: 'https://haveibeenpwned.com',
              source_type: 'breach_database',
              risk_score: 85,
              data_exposed: breach.dataClasses || breach.DataClasses || ['email'],
              breach_date: breach.breachDate || breach.BreachDate,
              status: 'new',
              scan_date: new Date().toISOString().split('T')[0],
              metadata: {
                details: breach.description || breach.Description,
                pwnCount: breach.pwnCount || breach.PwnCount,
                isVerified: breach.isVerified ?? breach.IsVerified,
                email: emailData.value,
                scan_type: 'dark_web',
                recommendations: [
                  'Change your password immediately',
                  'Enable two-factor authentication',
                  'Monitor your accounts for suspicious activity'
                ]
              }
            });
          }
        }
      } catch (error) {
        console.warn('Dark web scan error:', error?.message);
      }

      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    setDarkWebScanning(false);
    setScanProgress(null);
  };

  const SCAN_CATEGORIES = [
    {
      key: 'people_search',
      title: 'People Finder Sites',
      description: 'BeenVerified, Intelius, Spokeo, WhitePages, and similar services',
      icon: Search,
      color: 'purple',
      bgIcon: 'bg-purple-500/20',
      textIcon: 'text-purple-400',
    },
    {
      key: 'data_brokers',
      title: 'Data Brokers',
      description: 'Acxiom, Epsilon, Oracle Data Cloud, and commercial data aggregators',
      icon: Database,
      color: 'indigo',
      bgIcon: 'bg-indigo-500/20',
      textIcon: 'text-indigo-400',
    },
    {
      key: 'public_records',
      title: 'Public & Legal Records',
      description: 'PACER, court filings, government databases, property records',
      icon: CheckCircle2,
      color: 'pink',
      bgIcon: 'bg-pink-500/20',
      textIcon: 'text-pink-400',
    },
    {
      key: 'social_media',
      title: 'Social Media OSINT',
      description: 'Facebook, Instagram, LinkedIn, Twitter — impersonation & data exposure',
      icon: Globe,
      color: 'cyan',
      bgIcon: 'bg-cyan-500/20',
      textIcon: 'text-cyan-400',
    },
  ];

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">Web Scanning</h1>
        <p className="text-purple-300">Search for your data across breach databases and public records</p>
      </div>

      {/* Scan Control */}
      <Card className="glass-card border-purple-500/30 glow-border">
        <CardHeader className="border-b border-purple-500/20">
          <CardTitle className="text-white flex items-center gap-2">
            <Search className="w-5 h-5 text-purple-400" />
            Run New Scan
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/50">
              <div>
                <p className="text-white font-semibold mb-1">Identifiers to Scan</p>
                <p className="text-sm text-purple-300">
                  {personalData.filter(p => p.monitoring_enabled).length} identifiers with monitoring enabled
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white">
                  {personalData.filter(p => p.monitoring_enabled).length}
                </p>
              </div>
            </div>

            {personalData.filter(p => p.monitoring_enabled).length === 0 ? (
              <div className="text-center py-8">
                <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                <p className="text-white font-semibold mb-2">No identifiers to scan</p>
                <p className="text-sm text-purple-300">Add identifiers to your vault and enable monitoring first</p>
              </div>
            ) : (
              <>
                {!scanning && !scanProgress && (
                  <Button
                    onClick={runScan}
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 py-6 text-lg"
                  >
                    <Search className="w-5 h-5 mr-2" />
                    Start Comprehensive Scan
                  </Button>
                )}

                {scanning && scanProgress && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-semibold">
                        {scanProgress.phase || 'Scanning in progress...'}
                      </span>
                      <span className="text-purple-300">
                        {scanProgress.current} / {scanProgress.total}
                      </span>
                    </div>

                    <div className="relative h-3 bg-slate-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}
                        className="h-full bg-gradient-to-r from-purple-600 to-indigo-600"
                      />
                    </div>

                    <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-900/50">
                      <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                      <span className="text-sm text-purple-300">
                        Checking: {scanProgress.scanning}
                      </span>
                    </div>
                  </motion.div>
                )}
              </>
            )}

            {/* Scan Summary */}
            <AnimatePresence>
              {scanSummary && !scanning && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3"
                >
                  <div className={`p-4 rounded-xl border ${
                    scanSummary.breaches > 0 || scanSummary.exposures > 0
                      ? 'bg-red-500/10 border-red-500/30'
                      : scanSummary.warnings.length > 0
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-green-500/10 border-green-500/30'
                  }`}>
                    <div className="flex items-start gap-3">
                      {scanSummary.breaches > 0 || scanSummary.exposures > 0 ? (
                        <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
                      ) : scanSummary.warnings.length > 0 ? (
                        <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 shrink-0" />
                      )}
                      <div className="flex-1">
                        <p className="text-white font-semibold mb-1">Scan Complete</p>
                        <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                          <p className="text-gray-300">
                            Emails scanned: <span className="text-white font-medium">{scanSummary.emailsScanned}</span>
                          </p>
                          <p className="text-gray-300">
                            Breaches found: <span className={`font-medium ${scanSummary.breaches > 0 ? 'text-red-400' : 'text-green-400'}`}>{scanSummary.breaches}</span>
                          </p>
                          <p className="text-gray-300">
                            Public exposures: <span className={`font-medium ${scanSummary.exposures > 0 ? 'text-red-400' : 'text-green-400'}`}>{scanSummary.exposures}</span>
                          </p>
                        </div>
                        {scanSummary.warnings.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-white/10">
                            <p className="text-amber-300 text-xs font-medium mb-1">Warnings:</p>
                            {scanSummary.warnings.map((w, i) => (
                              <p key={i} className="text-xs text-amber-200/80">• {w}</p>
                            ))}
                            {scanSummary.warnings.some(w => w.includes('API key')) && (
                              <p className="text-xs text-amber-300 mt-1">Tip: Add missing API keys in Settings → API Keys</p>
                            )}
                          </div>
                        )}
                        {(scanSummary.breaches > 0 || scanSummary.exposures > 0) && (
                          <Button
                            size="sm"
                            className="mt-3 bg-red-600 hover:bg-red-700"
                            onClick={() => window.location.href = '/Findings'}
                          >
                            View Findings <ArrowRight className="w-4 h-4 ml-1" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Recent scan results count */}
            {myScanResults.length > 0 && !scanning && !scanSummary && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/30 border border-purple-500/10">
                <p className="text-sm text-gray-400">
                  You have <span className="text-white font-medium">{myScanResults.length}</span> existing scan results
                </p>
                <Button size="sm" variant="outline" className="border-purple-500/30 text-purple-300 text-xs h-7" onClick={() => window.location.href = '/Findings'}>
                  View Findings
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dark Web Scanning */}
      <DarkWebScanCard
        enabled={darkWebEnabled}
        onEnable={() => setShowDarkWebConsent(true)}
        onRunScan={runDarkWebScan}
        isScanning={darkWebScanning}
      />

      {/* Dark Web Consent Modal */}
      <DarkWebConsentModal
        open={showDarkWebConsent}
        onClose={() => setShowDarkWebConsent(false)}
        onConsent={enableDarkWebScanning}
      />

      {/* Data Sources Coverage */}
      <DataSourcesCard expanded={true} />

      {/* Scan Category Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SCAN_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isRunning = categoryScan === cat.key;
          return (
            <Card
              key={cat.key}
              onClick={() => !isRunning && !categoryScan && runCategoryScan(cat.key)}
              className={`glass-card border-purple-500/20 cursor-pointer transition-all duration-200 hover:border-purple-500/50 hover:scale-[1.02] active:scale-[0.99] ${
                isRunning ? 'border-purple-500/60 ring-1 ring-purple-500/30' : ''
              } ${categoryScan && !isRunning ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl ${cat.bgIcon} flex items-center justify-center shrink-0`}>
                    {isRunning ? (
                      <Loader2 className={`w-6 h-6 ${cat.textIcon} animate-spin`} />
                    ) : (
                      <Icon className={`w-6 h-6 ${cat.textIcon}`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-white font-semibold">{cat.title}</h3>
                      {cat.key === 'data_brokers' ? (
                        <Badge className="bg-purple-500/20 text-purple-300 border-0 text-xs">Directory</Badge>
                      ) : (
                        <ArrowRight className="w-4 h-4 text-purple-400" />
                      )}
                    </div>
                    <p className="text-sm text-purple-300">{cat.description}</p>
                    {isRunning && (
                      <p className="text-xs text-purple-400 mt-2 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Scanning...
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
