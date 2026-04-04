import React, { useState, useEffect } from 'react';
import { incognito, getApiKeys } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Activity, CheckCircle, XCircle, AlertTriangle, Loader2,
  Database, HardDrive, Shield, Key, Wifi, RefreshCw,
  Download, Clock, Users, FileText, Trash2, Lock
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

const ENTITY_NAMES = [
  'Profile', 'PersonalData', 'ScanResult', 'SocialMediaFinding',
  'SocialMediaProfile', 'SocialMediaMention', 'ExposureFixLog',
  'FinancialAccount', 'SuspiciousActivity', 'UserPreferences',
  'SpamIncident', 'NotificationAlert', 'MonitoredAccount',
  'DisposableCredential', 'DeletionRequest', 'DeletionEmailResponse',
  'AIInsight', 'DigitalFootprintReport', 'SearchQueryFinding',
  'Subscription',
  'SettlementCase', 'SettlementMatch', 'SettlementClaim',
  'DebtIssue', 'CreditDispute',
  'BrokerRemovalCampaign', 'BrokerRemovalTask',
  'ActionRecommendation', 'RiskFactor', 'MerchantProfile',
  'CreditReport', 'CreditTradeline', 'CreditInquiry', 'CreditCollection',
  'CreditDisputeItem', 'CreditDisputeCase', 'CreditDisputeEvidence',
  'BureauAccount', 'CreditDisputeTimeline',
];

const STATUS_ICON = {
  pass: <CheckCircle className="w-4 h-4 text-green-400" />,
  fail: <XCircle className="w-4 h-4 text-red-400" />,
  warn: <AlertTriangle className="w-4 h-4 text-yellow-400" />,
  running: <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />,
};

const STATUS_BADGE = {
  pass: 'bg-green-500/20 text-green-300 border-0',
  fail: 'bg-red-500/20 text-red-300 border-0',
  warn: 'bg-yellow-500/20 text-yellow-300 border-0',
};

export default function SystemSelfCheck() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [progress, setProgress] = useState(0);
  const { user } = useAuth();

  const runSelfCheck = async () => {
    setRunning(true);
    setResults(null);
    setProgress(0);

    const checks = [];
    const totalSteps = 6;
    let step = 0;

    const advance = () => { step++; setProgress(Math.round((step / totalSteps) * 100)); };

    // 1. Entity data integrity check
    const entityResults = [];
    let totalRecords = 0;
    let corruptEntities = 0;

    for (const name of ENTITY_NAMES) {
      try {
        const items = await incognito.entities[name].list();
        const count = items.length;
        totalRecords += count;

        // Check for records with missing IDs
        const missingIds = items.filter(i => !i.id).length;
        // Check for records with invalid dates
        const badDates = items.filter(i => i.created_date && isNaN(new Date(i.created_date).getTime())).length;

        if (missingIds > 0 || badDates > 0) {
          corruptEntities++;
          entityResults.push({ name, count, status: 'warn', issues: `${missingIds} missing IDs, ${badDates} invalid dates` });
        } else {
          entityResults.push({ name, count, status: 'pass' });
        }
      } catch (e) {
        corruptEntities++;
        entityResults.push({ name, count: 0, status: 'fail', issues: e.message });
      }
    }

    checks.push({
      category: 'Data Integrity',
      icon: Database,
      status: corruptEntities === 0 ? 'pass' : corruptEntities <= 2 ? 'warn' : 'fail',
      summary: `${ENTITY_NAMES.length} entities checked, ${totalRecords} total records`,
      detail: corruptEntities > 0 ? `${corruptEntities} entities with issues` : 'All entities healthy',
      entities: entityResults,
    });
    advance();

    // 2. localStorage usage check
    let lsUsed = 0;
    let lsKeys = 0;
    let incognitoKeys = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const val = localStorage.getItem(key);
        lsUsed += (key.length + (val?.length || 0)) * 2; // UTF-16
        lsKeys++;
        if (key.startsWith('incognito_')) incognitoKeys++;
      }
    } catch { /* ignore */ }

    const lsMB = (lsUsed / (1024 * 1024)).toFixed(2);
    const lsCapacity = 5; // ~5MB typical limit
    const lsPercent = Math.round((lsUsed / (lsCapacity * 1024 * 1024)) * 100);

    checks.push({
      category: 'LocalStorage',
      icon: HardDrive,
      status: lsPercent > 80 ? 'warn' : 'pass',
      summary: `${lsMB} MB used (~${lsPercent}% of ~${lsCapacity}MB)`,
      detail: `${lsKeys} total keys, ${incognitoKeys} Incognito keys`,
    });
    advance();

    // 3. IndexedDB check
    let idbStatus = 'pass';
    let idbDetail = '';
    try {
      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open('incognito_db', 1);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const storeNames = Array.from(db.objectStoreNames);
      idbDetail = `Database open, ${storeNames.length} object store(s): ${storeNames.join(', ')}`;
      db.close();
    } catch (e) {
      idbStatus = 'fail';
      idbDetail = `IndexedDB error: ${e.message}`;
    }

    checks.push({
      category: 'IndexedDB',
      icon: Database,
      status: idbStatus,
      summary: idbStatus === 'pass' ? 'IndexedDB accessible' : 'IndexedDB error',
      detail: idbDetail,
    });
    advance();

    // 4. API keys & connectivity check
    const keys = getApiKeys();
    const apiChecks = [];

    apiChecks.push({
      name: 'OpenAI API Key',
      configured: !!keys.openai_api_key,
      required: false,
      description: 'Powers AI Insights, Threat Intelligence, and other AI features',
    });
    apiChecks.push({
      name: 'HIBP API Key',
      configured: !!keys.hibp_api_key,
      required: false,
      description: 'Enhanced breach lookups (free tier works without key)',
    });
    apiChecks.push({
      name: 'Google Search API',
      configured: !!(keys.google_search_api_key && keys.google_search_cx),
      required: false,
      description: 'Powers identity scan web searches',
    });
    apiChecks.push({
      name: 'Privacy.com API',
      configured: !!keys.privacy_com_api_key,
      required: false,
      description: 'Virtual card generation for disposable credentials',
    });

    const configuredCount = apiChecks.filter(a => a.configured).length;

    checks.push({
      category: 'API Keys',
      icon: Key,
      status: configuredCount === 0 ? 'warn' : 'pass',
      summary: `${configuredCount}/${apiChecks.length} API keys configured`,
      detail: configuredCount === 0 ? 'No API keys set — AI features will be limited' : `${apiChecks.filter(a => a.configured).map(a => a.name).join(', ')}`,
      apiChecks,
    });
    advance();

    // 5. HIBP free breach list connectivity
    let hibpStatus = 'pass';
    let hibpDetail = '';
    const hibpCache = localStorage.getItem('incognito_hibp_breaches_cache');
    if (hibpCache) {
      try {
        const { ts, data } = JSON.parse(hibpCache);
        const age = Date.now() - ts;
        const hours = Math.round(age / (1000 * 60 * 60));
        hibpDetail = `${data.length} breaches cached, ${hours}h old`;
        if (age > 48 * 60 * 60 * 1000) {
          hibpStatus = 'warn';
          hibpDetail += ' (stale — over 48h old)';
        }
      } catch {
        hibpStatus = 'warn';
        hibpDetail = 'Cache exists but is corrupt';
      }
    } else {
      hibpStatus = 'warn';
      hibpDetail = 'No cached breach list — will fetch on next scan';
    }

    checks.push({
      category: 'Breach Database',
      icon: Shield,
      status: hibpStatus,
      summary: hibpStatus === 'pass' ? 'HIBP breach list cached' : 'Breach list needs refresh',
      detail: hibpDetail,
    });
    advance();

    // 6. Profile check
    let profileStatus = 'pass';
    let profileDetail = '';
    try {
      const profiles = await incognito.entities.Profile.list();
      if (profiles.length === 0) {
        profileStatus = 'warn';
        profileDetail = 'No profiles created — create one to start scanning';
      } else {
        const defaultProfile = profiles.find(p => p.is_default);
        profileDetail = `${profiles.length} profile(s)${defaultProfile ? `, default: "${defaultProfile.full_name || defaultProfile.name || 'Unnamed'}"` : ' (no default set)'}`;
      }
    } catch (e) {
      profileStatus = 'fail';
      profileDetail = `Error loading profiles: ${e.message}`;
    }

    checks.push({
      category: 'Profiles',
      icon: Users,
      status: profileStatus,
      summary: profileStatus === 'pass' ? 'Profiles healthy' : 'Profile issue detected',
      detail: profileDetail,
    });
    advance();

    setResults({
      checks,
      totalRecords,
      timestamp: new Date().toISOString(),
      overallStatus: checks.every(c => c.status === 'pass') ? 'pass' : checks.some(c => c.status === 'fail') ? 'fail' : 'warn',
    });
    setRunning(false);
  };

  const downloadReport = () => {
    if (!results) return;
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `incognito-selfcheck-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Auto-run on mount
  useEffect(() => { runSelfCheck(); }, []);

  if (user && user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="glass-card border-red-500/30 max-w-md">
          <CardContent className="p-8 text-center">
            <Lock className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Admin Access Required</h2>
            <p className="text-gray-400">This page is restricted to administrators only.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-600 to-emerald-500 flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            System Self-Check
          </h1>
          <p className="text-gray-400 mt-1">Diagnostics, data integrity, and system health</p>
        </div>
        <div className="flex gap-3">
          {results && (
            <Button variant="outline" onClick={downloadReport} className="border-gray-500/50 text-gray-300">
              <Download className="w-4 h-4 mr-2" /> Export Report
            </Button>
          )}
          <Button
            onClick={runSelfCheck}
            disabled={running}
            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
          >
            {running ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Running...</>
            ) : (
              <><RefreshCw className="w-4 h-4 mr-2" /> Run Self-Check</>
            )}
          </Button>
        </div>
      </div>

      {/* Progress bar while running */}
      {running && (
        <Card className="glass-card border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              <span className="text-white font-medium">Running diagnostics...</span>
              <span className="text-gray-400 text-sm ml-auto">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Overall Status */}
      {results && (
        <Card className={`glass-card ${
          results.overallStatus === 'pass' ? 'border-green-500/30' :
          results.overallStatus === 'fail' ? 'border-red-500/30' : 'border-yellow-500/30'
        }`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                  results.overallStatus === 'pass' ? 'bg-green-500/20' :
                  results.overallStatus === 'fail' ? 'bg-red-500/20' : 'bg-yellow-500/20'
                }`}>
                  {results.overallStatus === 'pass' ? (
                    <CheckCircle className="w-8 h-8 text-green-400" />
                  ) : results.overallStatus === 'fail' ? (
                    <XCircle className="w-8 h-8 text-red-400" />
                  ) : (
                    <AlertTriangle className="w-8 h-8 text-yellow-400" />
                  )}
                </div>
                <div>
                  <h2 className={`text-2xl font-bold ${
                    results.overallStatus === 'pass' ? 'text-green-400' :
                    results.overallStatus === 'fail' ? 'text-red-400' : 'text-yellow-400'
                  }`}>
                    {results.overallStatus === 'pass' ? 'All Systems Healthy' :
                     results.overallStatus === 'fail' ? 'Issues Detected' : 'Warnings Found'}
                  </h2>
                  <p className="text-gray-400">
                    {results.checks.length} checks completed &middot; {results.totalRecords} total records &middot; {new Date(results.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-400">{results.checks.filter(c => c.status === 'pass').length}</p>
                  <p className="text-xs text-gray-400">Passed</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-400">{results.checks.filter(c => c.status === 'warn').length}</p>
                  <p className="text-xs text-gray-400">Warnings</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-400">{results.checks.filter(c => c.status === 'fail').length}</p>
                  <p className="text-xs text-gray-400">Failed</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Check Results */}
      {results && (
        <div className="grid gap-4">
          <AnimatePresence>
            {results.checks.map((check, idx) => {
              const Icon = check.icon;
              return (
                <motion.div
                  key={check.category}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Card className={`glass-card ${
                    check.status === 'pass' ? 'border-green-500/20' :
                    check.status === 'fail' ? 'border-red-500/20' : 'border-yellow-500/20'
                  }`}>
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-lg shrink-0 flex items-center justify-center ${
                          check.status === 'pass' ? 'bg-green-500/10' :
                          check.status === 'fail' ? 'bg-red-500/10' : 'bg-yellow-500/10'
                        }`}>
                          <Icon className={`w-5 h-5 ${
                            check.status === 'pass' ? 'text-green-400' :
                            check.status === 'fail' ? 'text-red-400' : 'text-yellow-400'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-white font-semibold">{check.category}</span>
                            <Badge className={STATUS_BADGE[check.status]}>
                              {check.status === 'pass' ? 'Healthy' : check.status === 'fail' ? 'Error' : 'Warning'}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-300">{check.summary}</p>
                          <p className="text-xs text-gray-500 mt-1">{check.detail}</p>

                          {/* Entity breakdown */}
                          {check.entities && (
                            <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                              {check.entities
                                .filter(e => e.count > 0 || e.status !== 'pass')
                                .sort((a, b) => b.count - a.count)
                                .map(entity => (
                                  <div
                                    key={entity.name}
                                    className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-md ${
                                      entity.status === 'pass' ? 'bg-slate-800/50 text-gray-400' :
                                      entity.status === 'warn' ? 'bg-yellow-500/10 text-yellow-300' :
                                      'bg-red-500/10 text-red-300'
                                    }`}
                                  >
                                    {STATUS_ICON[entity.status]}
                                    <span className="truncate">{entity.name}</span>
                                    <span className="ml-auto font-mono">{entity.count}</span>
                                  </div>
                                ))}
                            </div>
                          )}

                          {/* API key details */}
                          {check.apiChecks && (
                            <div className="mt-3 space-y-2">
                              {check.apiChecks.map(api => (
                                <div key={api.name} className="flex items-center gap-2 text-xs">
                                  {api.configured ? (
                                    <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />
                                  ) : (
                                    <XCircle className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                                  )}
                                  <span className={api.configured ? 'text-green-300' : 'text-gray-500'}>{api.name}</span>
                                  <span className="text-gray-600 ml-auto">{api.description}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
