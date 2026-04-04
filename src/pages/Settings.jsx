import React, { useState } from 'react';
import { incognito, getApiKeys, setApiKeys } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings as SettingsIcon, Bell, Shield, Trash2, AlertTriangle, Eye, Loader2, Key, CheckCircle, CreditCard, Brain, Database, Search, Mail, Phone, Globe, Wifi, ChevronDown, ChevronUp, Download, Upload, FileJson } from 'lucide-react';
import DarkWebConsentModal from '../components/scans/DarkWebConsentModal';
import { motion, AnimatePresence } from 'framer-motion';

export default function Settings() {
  const queryClient = useQueryClient();
  const [showDarkWebConsent, setShowDarkWebConsent] = useState(false);
  const [apiKeys, setApiKeysState] = useState(getApiKeys());
  const [keysSaved, setKeysSaved] = useState(false);
  const [showMoreKeys, setShowMoreKeys] = useState(false);

  const handleSaveKeys = (updates) => {
    const merged = { ...apiKeys, ...updates };
    setApiKeys(merged);
    setApiKeysState(merged);
    setKeysSaved(true);
    setTimeout(() => setKeysSaved(false), 2000);
  };

  const { data: userPreferences = [], refetch } = useQuery({
    queryKey: ['userPreferences'],
    queryFn: () => incognito.entities.UserPreferences.list()
  });

  const { data: scanResults = [] } = useQuery({
    queryKey: ['scanResults'],
    queryFn: () => incognito.entities.ScanResult.list()
  });

  const preference = userPreferences[0] || {};

  const updatePreferencesMutation = useMutation({
    mutationFn: (data) => {
      if (preference.id) {
        return incognito.entities.UserPreferences.update(preference.id, data);
      } else {
        return incognito.entities.UserPreferences.create(data);
      }
    },
    onSuccess: () => {
      refetch();
    }
  });

  const clearScanResultsMutation = useMutation({
    mutationFn: async () => {
      for (const result of scanResults) {
        await incognito.entities.ScanResult.delete(result.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['scanResults']);
    }
  });

  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const EXPORT_ENTITIES = [
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

  const exportAllData = async () => {
    setExporting(true);
    try {
      const backup = { _meta: { version: 1, app: 'incognito', exported_at: new Date().toISOString() }, entities: {} };
      for (const name of EXPORT_ENTITIES) {
        backup.entities[name] = await incognito.entities[name].list();
      }
      backup.apiKeys = getApiKeys();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `incognito-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const importData = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      if (!backup._meta || backup._meta.app !== 'incognito' || !backup.entities) {
        setImportResult({ ok: false, message: 'Invalid backup file — not an Incognito export.' });
        return;
      }
      const mode = window.confirm(
        'How should data be imported?\n\nOK = Merge (add to existing data)\nCancel = Replace (clear existing data first)'
      ) ? 'merge' : 'replace';

      let imported = 0;
      let skipped = 0;
      for (const name of EXPORT_ENTITIES) {
        const items = backup.entities[name];
        if (!Array.isArray(items) || items.length === 0) continue;
        if (mode === 'replace') {
          await incognito.entities[name].clear();
        }
        const existing = mode === 'merge' ? await incognito.entities[name].list() : [];
        const existingIds = new Set(existing.map(i => i.id));
        for (const item of items) {
          if (mode === 'merge' && existingIds.has(item.id)) { skipped++; continue; }
          await incognito.entities[name].create(item);
          imported++;
        }
      }
      if (backup.apiKeys) {
        setApiKeys(backup.apiKeys);
        setApiKeysState(backup.apiKeys);
      }
      queryClient.invalidateQueries();
      setImportResult({ ok: true, message: `Imported ${imported} records${skipped > 0 ? `, skipped ${skipped} duplicates` : ''}.` });
    } catch (err) {
      setImportResult({ ok: false, message: `Import failed: ${err.message}` });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const [wiping, setWiping] = useState(false);
  const wipeAllData = async () => {
    if (!window.confirm(
      'This will permanently delete scan results, findings, alerts, and financial data. ' +
      'Your PROFILES and PERSONAL IDENTIFIERS will be kept. This cannot be undone. Continue?'
    )) return;
    setWiping(true);
    try {
      await Promise.all([
        incognito.entities.ScanResult.clear(),
        incognito.entities.DeletionRequest.clear(),
        incognito.entities.NotificationAlert.clear(),
        incognito.entities.SearchQueryFinding.clear(),
        incognito.entities.SpamIncident.clear(),
        incognito.entities.FinancialAccount.clear(),
        incognito.entities.SuspiciousActivity.clear(),
        incognito.entities.SocialMediaFinding.clear(),
      ]);
      queryClient.invalidateQueries();
      alert('Scan data has been wiped. Your profiles and identifiers were preserved.');
    } finally {
      setWiping(false);
    }
  };

  const handleToggle = (field, value) => {
    updatePreferencesMutation.mutate({ [field]: value });
  };

  const handleDarkWebConsent = async () => {
    await updatePreferencesMutation.mutateAsync({
      dark_web_scan_enabled: true,
      dark_web_consent_given: true,
      consent_timestamp: new Date().toISOString()
    });
  };

  const disableDarkWebScanning = async () => {
    await updatePreferencesMutation.mutateAsync({
      dark_web_scan_enabled: false
    });
  };
  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">Settings</h1>
        <p className="text-purple-300">Configure your privacy preferences</p>
      </div>

      {/* API Keys */}
      <Card className="glass-card border-blue-500/30">
        <CardHeader className="border-b border-blue-500/20">
          <CardTitle className="text-white flex items-center gap-2">
            <Key className="w-5 h-5 text-blue-400" />
            API Keys
            {keysSaved && (
              <span className="ml-auto flex items-center gap-1 text-sm text-green-400 font-normal">
                <CheckCircle className="w-4 h-4" /> Saved
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <p className="text-sm text-gray-400">
            All keys are stored locally in your browser only. They never leave your machine except to call the corresponding API directly.
          </p>

          {/* ── CORE: OpenAI ── */}
          <div className="space-y-2">
            <Label className="text-white flex items-center gap-2">
              <Brain className="w-4 h-4 text-purple-400" /> OpenAI API Key
            </Label>
            <p className="text-xs text-gray-500">Powers AI scans, dispute letters, settlement search, and breach analysis</p>
            <div className="flex gap-2">
              <Input type="password" value={apiKeys.openai_api_key || ''} onChange={(e) => setApiKeysState(prev => ({ ...prev, openai_api_key: e.target.value }))} placeholder="sk-..." className="bg-slate-900/50 border-blue-500/30 text-white font-mono text-sm" />
              <Button size="sm" onClick={() => handleSaveKeys({ openai_api_key: apiKeys.openai_api_key })} className="bg-blue-600 hover:bg-blue-700 shrink-0">Save</Button>
            </div>
            <div className="flex items-center gap-4 pt-1">
              <Label className="text-xs text-gray-400">Model:</Label>
              <Select value={apiKeys.openai_model || 'gpt-4o-mini'} onValueChange={(v) => handleSaveKeys({ openai_model: v })}>
                <SelectTrigger className="w-48 h-8 bg-slate-900/50 border-blue-500/30 text-white text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o-mini">GPT-4o Mini (fast, cheap)</SelectItem>
                  <SelectItem value="gpt-4o">GPT-4o (best quality)</SelectItem>
                  <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                  <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo (cheapest)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300">Get a key at platform.openai.com →</a>
          </div>

          {/* ── CORE: HIBP ── */}
          <div className="space-y-2 pt-4 border-t border-blue-500/20">
            <Label className="text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-red-400" /> HIBP API Key
            </Label>
            <p className="text-xs text-gray-500">Have I Been Pwned — checks if your emails appear in data breaches (real API)</p>
            <div className="flex gap-2">
              <Input type="password" value={apiKeys.hibp_api_key || ''} onChange={(e) => setApiKeysState(prev => ({ ...prev, hibp_api_key: e.target.value }))} placeholder="Your HIBP API key" className="bg-slate-900/50 border-blue-500/30 text-white font-mono text-sm" />
              <Button size="sm" onClick={() => handleSaveKeys({ hibp_api_key: apiKeys.hibp_api_key })} className="bg-blue-600 hover:bg-blue-700 shrink-0">Save</Button>
            </div>
            <a href="https://haveibeenpwned.com/API/Key" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300">Get a key at haveibeenpwned.com/API/Key ($3.50/mo) →</a>
          </div>

          {/* ── CORE: Google Custom Search ── */}
          <div className="space-y-2 pt-4 border-t border-blue-500/20">
            <Label className="text-white flex items-center gap-2">
              <Search className="w-4 h-4 text-blue-400" /> Google Custom Search
            </Label>
            <p className="text-xs text-gray-500">Searches Google for your personal data on data broker and people-search sites (real web results). 100 free searches/day.</p>
            <div className="flex gap-2">
              <Input type="password" value={apiKeys.google_search_api_key || ''} onChange={(e) => setApiKeysState(prev => ({ ...prev, google_search_api_key: e.target.value }))} placeholder="API Key (AIza...)" className="bg-slate-900/50 border-blue-500/30 text-white font-mono text-sm" />
              <Button size="sm" onClick={() => handleSaveKeys({ google_search_api_key: apiKeys.google_search_api_key })} className="bg-blue-600 hover:bg-blue-700 shrink-0">Save</Button>
            </div>
            <div className="flex gap-2">
              <Input value={apiKeys.google_search_cx || ''} onChange={(e) => setApiKeysState(prev => ({ ...prev, google_search_cx: e.target.value }))} placeholder="Search Engine ID (cx)" className="bg-slate-900/50 border-blue-500/30 text-white font-mono text-sm" />
              <Button size="sm" onClick={() => handleSaveKeys({ google_search_cx: apiKeys.google_search_cx })} className="bg-blue-600 hover:bg-blue-700 shrink-0">Save</Button>
            </div>
            <a href="https://programmablesearchengine.google.com/controlpanel/all" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300">1. Create search engine → 2. Get API key from console.cloud.google.com →</a>
          </div>

          {/* ── CORE: Hunter.io ── */}
          <div className="space-y-2 pt-4 border-t border-blue-500/20">
            <Label className="text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-cyan-400" /> Hunter.io API Key
            </Label>
            <p className="text-xs text-gray-500">Email verification and intelligence — checks if your emails are exposed on company domains. 25 free lookups/mo.</p>
            <div className="flex gap-2">
              <Input type="password" value={apiKeys.hunter_api_key || ''} onChange={(e) => setApiKeysState(prev => ({ ...prev, hunter_api_key: e.target.value }))} placeholder="Your Hunter.io API key" className="bg-slate-900/50 border-blue-500/30 text-white font-mono text-sm" />
              <Button size="sm" onClick={() => handleSaveKeys({ hunter_api_key: apiKeys.hunter_api_key })} className="bg-blue-600 hover:bg-blue-700 shrink-0">Save</Button>
            </div>
            <a href="https://hunter.io/api-keys" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300">Get a free key at hunter.io →</a>
          </div>

          {/* ── CORE: Privacy.com ── */}
          <div className="space-y-2 pt-4 border-t border-blue-500/20">
            <Label className="text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-green-400" /> Privacy.com API Key
            </Label>
            <p className="text-xs text-gray-500">Virtual cards, subscription detection, card swap workflows</p>
            <div className="flex gap-2">
              <Input type="password" value={apiKeys.privacy_com_api_key || ''} onChange={(e) => setApiKeysState(prev => ({ ...prev, privacy_com_api_key: e.target.value }))} placeholder="Your Privacy.com API key" className="bg-slate-900/50 border-blue-500/30 text-white font-mono text-sm" />
              <Button size="sm" onClick={() => handleSaveKeys({ privacy_com_api_key: apiKeys.privacy_com_api_key })} className="bg-blue-600 hover:bg-blue-700 shrink-0">Save</Button>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <Label className="text-xs text-gray-400 flex items-center gap-1">
                <Switch checked={apiKeys.privacy_com_sandbox || false} onCheckedChange={(v) => handleSaveKeys({ privacy_com_sandbox: v })} />
                Sandbox mode
              </Label>
              <a href="https://privacy.com/developer" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300">Get API key →</a>
            </div>
          </div>

          {/* ── ADDITIONAL KEYS (collapsible) ── */}
          <button onClick={() => setShowMoreKeys(!showMoreKeys)} className="w-full flex items-center justify-between pt-4 border-t border-blue-500/20 text-sm text-gray-400 hover:text-white transition-colors">
            <span>Additional API Keys ({['numverify_api_key', 'leakcheck_api_key', 'virustotal_api_key', 'shodan_api_key', 'dehashed_api_key'].filter(k => apiKeys[k]).length} configured)</span>
            {showMoreKeys ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showMoreKeys && (
            <div className="space-y-6 animate-in fade-in">
              {/* NumVerify */}
              <div className="space-y-2">
                <Label className="text-white flex items-center gap-2">
                  <Phone className="w-4 h-4 text-green-400" /> NumVerify API Key
                </Label>
                <p className="text-xs text-gray-500">Phone number validation and carrier lookup. 100 free lookups/mo.</p>
                <div className="flex gap-2">
                  <Input type="password" value={apiKeys.numverify_api_key || ''} onChange={(e) => setApiKeysState(prev => ({ ...prev, numverify_api_key: e.target.value }))} placeholder="Your NumVerify API key" className="bg-slate-900/50 border-blue-500/30 text-white font-mono text-sm" />
                  <Button size="sm" onClick={() => handleSaveKeys({ numverify_api_key: apiKeys.numverify_api_key })} className="bg-blue-600 hover:bg-blue-700 shrink-0">Save</Button>
                </div>
                <a href="https://numverify.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300">Free key at numverify.com →</a>
              </div>

              {/* LeakCheck */}
              <div className="space-y-2 pt-4 border-t border-blue-500/20">
                <Label className="text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-orange-400" /> LeakCheck.io API Key
                </Label>
                <p className="text-xs text-gray-500">Additional breach database — checks email, phone, and username exposures. Paid plans start at $2.99.</p>
                <div className="flex gap-2">
                  <Input type="password" value={apiKeys.leakcheck_api_key || ''} onChange={(e) => setApiKeysState(prev => ({ ...prev, leakcheck_api_key: e.target.value }))} placeholder="Your LeakCheck API key" className="bg-slate-900/50 border-blue-500/30 text-white font-mono text-sm" />
                  <Button size="sm" onClick={() => handleSaveKeys({ leakcheck_api_key: apiKeys.leakcheck_api_key })} className="bg-blue-600 hover:bg-blue-700 shrink-0">Save</Button>
                </div>
                <a href="https://leakcheck.io/api" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300">Get key at leakcheck.io →</a>
              </div>

              {/* VirusTotal */}
              <div className="space-y-2 pt-4 border-t border-blue-500/20">
                <Label className="text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-400" /> VirusTotal API Key
                </Label>
                <p className="text-xs text-gray-500">URL and domain safety scanning — checks if links in breach notifications are malicious. 500 free lookups/day.</p>
                <div className="flex gap-2">
                  <Input type="password" value={apiKeys.virustotal_api_key || ''} onChange={(e) => setApiKeysState(prev => ({ ...prev, virustotal_api_key: e.target.value }))} placeholder="Your VirusTotal API key" className="bg-slate-900/50 border-blue-500/30 text-white font-mono text-sm" />
                  <Button size="sm" onClick={() => handleSaveKeys({ virustotal_api_key: apiKeys.virustotal_api_key })} className="bg-blue-600 hover:bg-blue-700 shrink-0">Save</Button>
                </div>
                <a href="https://www.virustotal.com/gui/my-apikey" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300">Free key at virustotal.com →</a>
              </div>

              {/* Shodan */}
              <div className="space-y-2 pt-4 border-t border-blue-500/20">
                <Label className="text-white flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-amber-400" /> Shodan API Key
                </Label>
                <p className="text-xs text-gray-500">Network exposure scanner — shows what devices and services are visible on your IP address.</p>
                <div className="flex gap-2">
                  <Input type="password" value={apiKeys.shodan_api_key || ''} onChange={(e) => setApiKeysState(prev => ({ ...prev, shodan_api_key: e.target.value }))} placeholder="Your Shodan API key" className="bg-slate-900/50 border-blue-500/30 text-white font-mono text-sm" />
                  <Button size="sm" onClick={() => handleSaveKeys({ shodan_api_key: apiKeys.shodan_api_key })} className="bg-blue-600 hover:bg-blue-700 shrink-0">Save</Button>
                </div>
                <a href="https://account.shodan.io/" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300">Free academic key or paid at shodan.io →</a>
              </div>

              {/* Dehashed */}
              <div className="space-y-2 pt-4 border-t border-blue-500/20">
                <Label className="text-white flex items-center gap-2">
                  <Globe className="w-4 h-4 text-red-400" /> Dehashed API
                </Label>
                <p className="text-xs text-gray-500">Comprehensive breach database — searches by email, username, IP, name, phone, address, VIN. Paid ($1.99+).</p>
                <div className="flex gap-2">
                  <Input value={apiKeys.dehashed_email || ''} onChange={(e) => setApiKeysState(prev => ({ ...prev, dehashed_email: e.target.value }))} placeholder="Dehashed account email" className="bg-slate-900/50 border-blue-500/30 text-white font-mono text-sm" />
                </div>
                <div className="flex gap-2">
                  <Input type="password" value={apiKeys.dehashed_api_key || ''} onChange={(e) => setApiKeysState(prev => ({ ...prev, dehashed_api_key: e.target.value }))} placeholder="Dehashed API key" className="bg-slate-900/50 border-blue-500/30 text-white font-mono text-sm" />
                  <Button size="sm" onClick={() => handleSaveKeys({ dehashed_email: apiKeys.dehashed_email, dehashed_api_key: apiKeys.dehashed_api_key })} className="bg-blue-600 hover:bg-blue-700 shrink-0">Save</Button>
                </div>
                <a href="https://www.dehashed.com/register" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300">Register at dehashed.com →</a>
              </div>
            </div>
          )}

          {/* Status indicators */}
          <div className="grid grid-cols-4 gap-2 pt-4 border-t border-blue-500/20">
            {[
              { key: 'openai_api_key', label: 'OpenAI', color: 'text-purple-400' },
              { key: 'hibp_api_key', label: 'HIBP', color: 'text-red-400' },
              { key: 'google_search_api_key', label: 'Google', color: 'text-blue-400' },
              { key: 'hunter_api_key', label: 'Hunter', color: 'text-cyan-400' },
              { key: 'privacy_com_api_key', label: 'Privacy', color: 'text-green-400' },
              { key: 'numverify_api_key', label: 'NumVerify', color: 'text-green-400' },
              { key: 'leakcheck_api_key', label: 'LeakCheck', color: 'text-orange-400' },
              { key: 'virustotal_api_key', label: 'VirusTotal', color: 'text-blue-400' },
              { key: 'shodan_api_key', label: 'Shodan', color: 'text-amber-400' },
              { key: 'dehashed_api_key', label: 'Dehashed', color: 'text-red-400' },
            ].map(({ key, label, color }) => (
              <div key={key} className={`p-2 rounded-lg border text-center ${apiKeys[key] ? 'border-green-500/30 bg-green-500/5' : 'border-slate-700 bg-slate-800/30'}`}>
                <span className={`text-[10px] font-medium ${apiKeys[key] ? color : 'text-gray-600'}`}>{label}</span>
                <p className={`text-[9px] ${apiKeys[key] ? 'text-green-400' : 'text-gray-700'}`}>{apiKeys[key] ? '✓' : '—'}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Scan Settings */}
      <Card className="glass-card border-purple-500/30">
        <CardHeader className="border-b border-purple-500/20">
          <CardTitle className="text-white flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-purple-400" />
            Scan Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white mb-1">Automatic Scans</p>
              <p className="text-sm text-purple-300">Enable scheduled scanning</p>
            </div>
            <Switch 
              checked={preference.auto_scan_enabled || false}
              onCheckedChange={(checked) => handleToggle('auto_scan_enabled', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white mb-1">Scan Frequency</p>
              <p className="text-sm text-purple-300">How often to check for exposures</p>
            </div>
            <Select 
              value={preference.scan_frequency || 'weekly'}
              onValueChange={(value) => handleToggle('scan_frequency', value)}
            >
              <SelectTrigger className="w-40 bg-slate-900/50 border-purple-500/30 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white mb-1">Breach Monitoring</p>
              <p className="text-sm text-purple-300">Check identifiers against breach databases</p>
            </div>
            <Switch 
              checked={preference.breach_monitoring_enabled !== false}
              onCheckedChange={(checked) => handleToggle('breach_monitoring_enabled', checked)}
            />
          </div>

          {preference.breach_monitoring_enabled !== false && (
            <>
              <div className="flex items-center justify-between pt-4 border-t border-purple-500/20">
                <div>
                  <p className="font-medium text-white mb-1">Auto Breach Check</p>
                  <p className="text-sm text-purple-300">Automatically check for breaches on a schedule</p>
                </div>
                <Switch 
                  checked={preference.auto_breach_check_enabled || false}
                  onCheckedChange={(checked) => handleToggle('auto_breach_check_enabled', checked)}
                />
              </div>

              {preference.auto_breach_check_enabled && (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white mb-1">Breach Check Frequency</p>
                    <p className="text-sm text-purple-300">How often to check for new breaches</p>
                  </div>
                  <Select 
                    value={preference.breach_check_frequency || 'weekly'}
                    onValueChange={(value) => handleToggle('breach_check_frequency', value)}
                  >
                    <SelectTrigger className="w-40 bg-slate-900/50 border-purple-500/30 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Dark Web Scanning Settings */}
      <Card className="glass-card border-red-500/30">
        <CardHeader className="border-b border-red-500/20">
          <CardTitle className="text-white flex items-center gap-2">
            <Eye className="w-5 h-5 text-red-400" />
            Dark Web Scanning
            <span className="ml-auto px-3 py-1 rounded-full text-xs font-semibold border border-red-500/50 bg-red-500/10 text-red-300">
              SENSITIVE
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Warning Banner */}
          {preference.dark_web_scan_enabled && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4"
            >
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-amber-200">
                    Dark web scanning is currently <span className="font-semibold">enabled</span>. 
                    This feature uses legal third-party APIs to search breach databases and monitored dark web sources.
                  </p>
                  {preference.consent_timestamp && (
                    <p className="text-xs text-amber-300 mt-2">
                      Consent given: {new Date(preference.consent_timestamp).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white mb-1">Enable Dark Web Monitoring</p>
              <p className="text-sm text-purple-300">Search breach databases and dark web sources</p>
            </div>
            <Switch 
              checked={preference.dark_web_scan_enabled || false}
              onCheckedChange={(checked) => {
                if (checked) {
                  setShowDarkWebConsent(true);
                } else {
                  disableDarkWebScanning();
                }
              }}
            />
          </div>

          {preference.dark_web_scan_enabled && (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4 pt-4 border-t border-red-500/20"
              >
                <div className="space-y-3">
                  <h4 className="font-semibold text-white text-sm flex items-center gap-2">
                    <Shield className="w-4 h-4 text-green-400" />
                    Active Monitoring Includes:
                  </h4>
                  <ul className="space-y-2 text-sm text-purple-200">
                    <li className="flex gap-2">
                      <span className="text-green-400">✓</span>
                      <span>Known data breach databases (HIBP, DeHashed, etc.)</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-green-400">✓</span>
                      <span>Credential dumps and paste sites</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-green-400">✓</span>
                      <span>Dark web marketplaces (legal monitoring only)</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-green-400">✓</span>
                      <span>Encrypted queries for privacy protection</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
                  <p className="text-xs text-purple-300">
                    <strong className="text-purple-200">Privacy Note:</strong> All dark web queries are encrypted 
                    before transmission. We never store raw identifiers in logs, and all results are encrypted at rest.
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </CardContent>
      </Card>

      {/* Dark Web Consent Modal */}
      <DarkWebConsentModal
        open={showDarkWebConsent}
        onClose={() => setShowDarkWebConsent(false)}
        onConsent={handleDarkWebConsent}
      />

      {/* Notifications */}
      <Card className="glass-card border-purple-500/30">
        <CardHeader className="border-b border-purple-500/20">
          <CardTitle className="text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-purple-400" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white mb-1">New Findings Alerts</p>
              <p className="text-sm text-purple-300">Get notified of new exposures</p>
            </div>
            <Switch 
              checked={preference.notifications_new_findings !== false}
              onCheckedChange={(checked) => handleToggle('notifications_new_findings', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white mb-1">High Risk Alerts</p>
              <p className="text-sm text-purple-300">Immediate alerts for critical risks</p>
            </div>
            <Switch 
              checked={preference.notifications_high_risk !== false}
              onCheckedChange={(checked) => handleToggle('notifications_high_risk', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white mb-1">Breach Alerts</p>
              <p className="text-sm text-purple-300">Notify when identifiers appear in data breaches</p>
            </div>
            <Switch 
              checked={preference.notifications_breach_alerts !== false}
              onCheckedChange={(checked) => handleToggle('notifications_breach_alerts', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white mb-1">Deletion Updates</p>
              <p className="text-sm text-purple-300">Updates on removal requests</p>
            </div>
            <Switch 
              checked={preference.notifications_deletion_updates !== false}
              onCheckedChange={(checked) => handleToggle('notifications_deletion_updates', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white mb-1">Exposure Forewarnings</p>
              <p className="text-sm text-purple-300">Proactive alerts before data is exposed</p>
            </div>
            <Switch 
              checked={preference.notifications_forewarnings !== false}
              onCheckedChange={(checked) => handleToggle('notifications_forewarnings', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Background Monitoring */}
      <Card className="glass-card border-purple-500/30">
        <CardHeader className="border-b border-purple-500/20">
          <CardTitle className="text-white flex items-center gap-2">
            <Eye className="w-5 h-5 text-purple-400" />
            Background Monitoring
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white mb-1">Continuous Monitoring</p>
              <p className="text-sm text-purple-300">AI watches for emerging threats 24/7</p>
            </div>
            <Switch 
              checked={preference.background_monitoring_enabled || false}
              onCheckedChange={(checked) => handleToggle('background_monitoring_enabled', checked)}
            />
          </div>

          {preference.background_monitoring_enabled && (
            <div className="flex items-center justify-between pt-4 border-t border-purple-500/20">
              <div>
                <p className="font-medium text-white mb-1">Check Frequency</p>
                <p className="text-sm text-purple-300">How often to scan for threats</p>
              </div>
              <Select 
                value={String(preference.monitoring_frequency_hours || 24)}
                onValueChange={(value) => handleToggle('monitoring_frequency_hours', Number(value))}
              >
                <SelectTrigger className="w-40 bg-slate-900/50 border-purple-500/30 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">Every 6 hours</SelectItem>
                  <SelectItem value="12">Every 12 hours</SelectItem>
                  <SelectItem value="24">Daily</SelectItem>
                  <SelectItem value="168">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Privacy */}
      <Card className="glass-card border-purple-500/30">
        <CardHeader className="border-b border-purple-500/20">
          <CardTitle className="text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-400" />
            Privacy & Security
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white mb-1">Data Encryption</p>
              <p className="text-sm text-purple-300">AES-256 encryption (always enabled)</p>
            </div>
            <div className="px-3 py-1 rounded-full bg-green-500/20 text-green-300 text-sm font-semibold">
              Active
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white mb-1">Two-Factor Authentication</p>
              <p className="text-sm text-purple-300">Local-first app — protected by your device lock</p>
            </div>
            <div className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-sm font-semibold">
              Device-Level
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Backup & Restore */}
      <Card className="glass-card border-blue-500/30">
        <CardHeader className="border-b border-blue-500/20">
          <CardTitle className="text-white flex items-center gap-2">
            <FileJson className="w-5 h-5 text-blue-400" />
            Data Backup & Restore
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <p className="text-sm text-purple-300">
            Your data lives in this browser only. Export regularly to avoid losing your profiles, scan results, and settings.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={exportAllData}
              disabled={exporting}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              {exporting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Exporting...</>
              ) : (
                <><Download className="w-4 h-4 mr-2" />Export All Data</>
              )}
            </Button>
            <label>
              <input type="file" accept=".json" onChange={importData} className="hidden" disabled={importing} />
              <Button
                variant="outline"
                className="border-blue-500/50 text-blue-300 hover:bg-blue-500/10 cursor-pointer"
                disabled={importing}
                asChild
              >
                <span>
                  {importing ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing...</>
                  ) : (
                    <><Upload className="w-4 h-4 mr-2" />Import Backup</>
                  )}
                </span>
              </Button>
            </label>
          </div>
          {importResult && (
            <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
              importResult.ok ? 'bg-green-500/10 text-green-300' : 'bg-red-500/10 text-red-300'
            }`}>
              {importResult.ok ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              {importResult.message}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="glass-card border-red-500/30">
        <CardHeader className="border-b border-red-500/20">
          <CardTitle className="text-white flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-400" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white mb-1">Clear All Scan Results</p>
              <p className="text-sm text-purple-300">Remove all findings from the database ({scanResults.length} results)</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (window.confirm('Are you sure? This will delete all scan results permanently.')) {
                  clearScanResultsMutation.mutate();
                }
              }}
              disabled={clearScanResultsMutation.isPending || scanResults.length === 0}
              className="border-red-500/50 text-red-300 hover:bg-red-500/10"
            >
              {clearScanResultsMutation.isPending ? 'Clearing...' : 'Clear Results'}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white mb-1">Wipe Scan Data</p>
              <p className="text-sm text-purple-300">Erase scan results, findings, alerts, and financial data (profiles and identifiers are preserved)</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={wipeAllData}
              disabled={wiping}
              className="border-red-500/50 text-red-300 hover:bg-red-500/10"
            >
              {wiping ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Wiping...</> : 'Wipe All'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}