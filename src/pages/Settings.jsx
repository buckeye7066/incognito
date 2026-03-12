import React, { useState, useEffect } from 'react';
import { incognito, getApiKeys, setApiKeys } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings as SettingsIcon, Bell, Shield, Trash2, AlertTriangle, Eye, Loader2, Key, CheckCircle, CreditCard, Brain, Database } from 'lucide-react';
import DarkWebConsentModal from '../components/scans/DarkWebConsentModal';
import { motion, AnimatePresence } from 'framer-motion';

export default function Settings() {
  const queryClient = useQueryClient();
  const [showDarkWebConsent, setShowDarkWebConsent] = useState(false);
  const [apiKeys, setApiKeysState] = useState(getApiKeys());
  const [keysSaved, setKeysSaved] = useState(false);

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

  const [wiping, setWiping] = useState(false);
  const wipeAllData = async () => {
    if (!window.confirm('This will permanently delete ALL your data including vault, scan results, deletion requests, and alerts. This cannot be undone. Continue?')) return;
    setWiping(true);
    try {
      const [personalData, deletionRequests, alerts, searchQueries, spamIncidents, financialAccounts, suspiciousActivities] = await Promise.all([
        incognito.entities.PersonalData.list(),
        incognito.entities.DeletionRequest.list(),
        incognito.entities.NotificationAlert.list(),
        incognito.entities.SearchQueryFinding.list(),
        incognito.entities.SpamIncident.list(),
        incognito.entities.FinancialAccount.list(),
        incognito.entities.SuspiciousActivity.list(),
      ]);
      await Promise.all([
        ...scanResults.map(r => incognito.entities.ScanResult.delete(r.id)),
        ...personalData.map(r => incognito.entities.PersonalData.delete(r.id)),
        ...deletionRequests.map(r => incognito.entities.DeletionRequest.delete(r.id)),
        ...alerts.map(r => incognito.entities.NotificationAlert.delete(r.id)),
        ...searchQueries.map(r => incognito.entities.SearchQueryFinding.delete(r.id)),
        ...spamIncidents.map(r => incognito.entities.SpamIncident.delete(r.id)),
        ...financialAccounts.map(r => incognito.entities.FinancialAccount.delete(r.id)),
        ...suspiciousActivities.map(r => incognito.entities.SuspiciousActivity.delete(r.id)),
      ]);
      queryClient.invalidateQueries();
      alert('All data has been wiped successfully.');
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
            These keys are stored locally in your browser only. They never leave your machine.
          </p>

          <div className="space-y-2">
            <Label className="text-white flex items-center gap-2">
              <Brain className="w-4 h-4 text-purple-400" /> OpenAI API Key
            </Label>
            <p className="text-xs text-gray-500">Powers AI scans, dispute letters, settlement search, and breach analysis</p>
            <div className="flex gap-2">
              <Input
                type="password"
                value={apiKeys.openai_api_key || ''}
                onChange={(e) => setApiKeysState(prev => ({ ...prev, openai_api_key: e.target.value }))}
                placeholder="sk-..."
                className="bg-slate-900/50 border-blue-500/30 text-white font-mono text-sm"
              />
              <Button
                size="sm"
                onClick={() => handleSaveKeys({ openai_api_key: apiKeys.openai_api_key })}
                className="bg-blue-600 hover:bg-blue-700 shrink-0"
              >
                Save
              </Button>
            </div>
            <div className="flex items-center gap-4 pt-1">
              <Label className="text-xs text-gray-400">Model:</Label>
              <Select
                value={apiKeys.openai_model || 'gpt-4o-mini'}
                onValueChange={(v) => handleSaveKeys({ openai_model: v })}
              >
                <SelectTrigger className="w-48 h-8 bg-slate-900/50 border-blue-500/30 text-white text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o-mini">GPT-4o Mini (fast, cheap)</SelectItem>
                  <SelectItem value="gpt-4o">GPT-4o (best quality)</SelectItem>
                  <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                  <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo (cheapest)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t border-blue-500/20">
            <Label className="text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-red-400" /> HIBP API Key
            </Label>
            <p className="text-xs text-gray-500">Have I Been Pwned - checks if your emails appear in data breaches</p>
            <div className="flex gap-2">
              <Input
                type="password"
                value={apiKeys.hibp_api_key || ''}
                onChange={(e) => setApiKeysState(prev => ({ ...prev, hibp_api_key: e.target.value }))}
                placeholder="Your HIBP API key"
                className="bg-slate-900/50 border-blue-500/30 text-white font-mono text-sm"
              />
              <Button
                size="sm"
                onClick={() => handleSaveKeys({ hibp_api_key: apiKeys.hibp_api_key })}
                className="bg-blue-600 hover:bg-blue-700 shrink-0"
              >
                Save
              </Button>
            </div>
            <a href="https://haveibeenpwned.com/API/Key" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300">
              Get a key at haveibeenpwned.com/API/Key →
            </a>
          </div>

          <div className="space-y-2 pt-4 border-t border-blue-500/20">
            <Label className="text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-green-400" /> Privacy.com API Key
            </Label>
            <p className="text-xs text-gray-500">Virtual cards, subscription detection, card swap</p>
            <div className="flex gap-2">
              <Input
                type="password"
                value={apiKeys.privacy_com_api_key || ''}
                onChange={(e) => setApiKeysState(prev => ({ ...prev, privacy_com_api_key: e.target.value }))}
                placeholder="Your Privacy.com API key"
                className="bg-slate-900/50 border-blue-500/30 text-white font-mono text-sm"
              />
              <Button
                size="sm"
                onClick={() => handleSaveKeys({ privacy_com_api_key: apiKeys.privacy_com_api_key })}
                className="bg-blue-600 hover:bg-blue-700 shrink-0"
              >
                Save
              </Button>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <Label className="text-xs text-gray-400 flex items-center gap-1">
                <Switch
                  checked={apiKeys.privacy_com_sandbox || false}
                  onCheckedChange={(v) => handleSaveKeys({ privacy_com_sandbox: v })}
                />
                Sandbox mode
              </Label>
              <a href="https://privacy.com/developer" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300">
                Get API key →
              </a>
            </div>
          </div>

          {/* Status indicators */}
          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-blue-500/20">
            {[
              { key: 'openai_api_key', label: 'OpenAI', icon: Brain, color: 'purple' },
              { key: 'hibp_api_key', label: 'HIBP', icon: Database, color: 'red' },
              { key: 'privacy_com_api_key', label: 'Privacy.com', icon: CreditCard, color: 'green' },
            ].map(({ key, label, icon: Icon, color }) => (
              <div key={key} className={`p-3 rounded-lg border ${apiKeys[key] ? `border-${color}-500/40 bg-${color}-500/10` : 'border-slate-700 bg-slate-800/30'}`}>
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${apiKeys[key] ? `text-${color}-400` : 'text-gray-500'}`} />
                  <span className={`text-xs font-medium ${apiKeys[key] ? 'text-white' : 'text-gray-500'}`}>{label}</span>
                </div>
                <p className={`text-[10px] mt-1 ${apiKeys[key] ? `text-${color}-300` : 'text-gray-600'}`}>
                  {apiKeys[key] ? '✓ Configured' : '✗ Not set'}
                </p>
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
              <p className="text-sm text-purple-300">Add an extra layer of security</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-purple-500/50 text-purple-300"
            >
              Enable
            </Button>
          </div>
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
              <p className="font-medium text-white mb-1">Delete All Data</p>
              <p className="text-sm text-purple-300">Permanently erase vault, scan results, alerts and all records</p>
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