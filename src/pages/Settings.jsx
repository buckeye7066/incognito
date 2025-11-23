import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings as SettingsIcon, Bell, Shield, Trash2, AlertTriangle, Eye } from 'lucide-react';
import DarkWebConsentModal from '../components/scans/DarkWebConsentModal';
import { motion, AnimatePresence } from 'framer-motion';

export default function Settings() {
  const queryClient = useQueryClient();
  const [showDarkWebConsent, setShowDarkWebConsent] = useState(false);

  const { data: userPreferences = [], refetch } = useQuery({
    queryKey: ['userPreferences'],
    queryFn: () => base44.entities.UserPreferences.list()
  });

  const { data: scanResults = [] } = useQuery({
    queryKey: ['scanResults'],
    queryFn: () => base44.entities.ScanResult.list()
  });

  const preference = userPreferences[0] || {};

  const updatePreferencesMutation = useMutation({
    mutationFn: (data) => {
      if (preference.id) {
        return base44.entities.UserPreferences.update(preference.id, data);
      } else {
        return base44.entities.UserPreferences.create(data);
      }
    },
    onSuccess: () => {
      refetch();
    }
  });

  const clearScanResultsMutation = useMutation({
    mutationFn: async () => {
      for (const result of scanResults) {
        await base44.entities.ScanResult.delete(result.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['scanResults']);
    }
  });

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
              <p className="text-sm text-purple-300">Permanently erase everything (30 sec retention)</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-red-500/50 text-red-300 hover:bg-red-500/10"
            >
              Wipe All
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}