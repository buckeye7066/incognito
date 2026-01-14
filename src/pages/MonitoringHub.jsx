import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, Plus, RefreshCw, CheckCircle, AlertCircle, Smartphone } from 'lucide-react';
import { motion } from 'framer-motion';
import DisposableCredentialCard from '../components/monitoring/DisposableCredentialCard';
import AIActivityAnalyzer from '../components/monitoring/AIActivityAnalyzer';
import QuickGenerateCard from '../components/monitoring/QuickGenerateCard';
import BulkEmailCleaner from '../components/monitoring/BulkEmailCleaner';

export default function MonitoringHub() {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const [darkWebScanning, setDarkWebScanning] = useState(false);
  const [socialMediaScanning, setSocialMediaScanning] = useState(false);
  const [formData, setFormData] = useState({
    account_type: 'gmail',
    account_identifier: '',
    check_frequency_hours: 6
  });

  const activeProfileId = typeof window !== 'undefined' ? window.activeProfileId : null;

  const { data: allAccounts = [] } = useQuery({
    queryKey: ['monitoredAccounts'],
    queryFn: () => base44.entities.MonitoredAccount.list()
  });

  const accounts = allAccounts.filter(a => !activeProfileId || a.profile_id === activeProfileId);

  const { data: allCredentials = [] } = useQuery({
    queryKey: ['disposableCredentials'],
    queryFn: () => base44.entities.DisposableCredential.list()
  });

  const credentials = allCredentials.filter(c => !activeProfileId || c.profile_id === activeProfileId);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.MonitoredAccount.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['monitoredAccounts']);
      setShowAddForm(false);
      setFormData({ account_type: 'gmail', account_identifier: '', check_frequency_hours: 6 });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.MonitoredAccount.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['monitoredAccounts']);
    }
  });

  const createCredentialMutation = useMutation({
    mutationFn: (data) => base44.entities.DisposableCredential.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['disposableCredentials']);
    }
  });

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!activeProfileId) {
      alert('Please select a profile first');
      return;
    }

    // For email accounts, we need OAuth - for phone forwarding, just save it
    if (formData.account_type === 'phone_forwarding') {
      await createMutation.mutateAsync({
        ...formData,
        profile_id: activeProfileId,
        oauth_connected: false
      });
    } else {
      // Create the monitored account
      await createMutation.mutateAsync({
        ...formData,
        profile_id: activeProfileId,
        oauth_connected: true
      });

      alert(`✓ Account added! Use "Scan Email Spam" to check for spam in all your connected accounts.`);
    }

    // Clear form but keep it open for adding more accounts
    setFormData({
      account_type: 'gmail',
      account_identifier: '',
      check_frequency_hours: 6
    });
  };

  const runMonitoring = async () => {
    if (!activeProfileId) {
      alert('Please select a profile first');
      return;
    }

    setMonitoring(true);
    try {
      // Server-side monitoring only (prevents client-side PII leakage to LLMs)
      const response = await base44.functions.invoke('monitorEmails', { profileId: activeProfileId });
      alert(`Monitoring complete! Logged ${response.data?.totalSpamFound || 0} spam incident(s).`);
      queryClient.invalidateQueries(['spamIncidents']);
    } catch (error) {
      alert('Monitoring failed: ' + error.message);
    } finally {
      setMonitoring(false);
    }
  };

  const runDarkWebScan = async () => {
    if (!activeProfileId) {
      alert('Please select a profile first');
      return;
    }

    setDarkWebScanning(true);
    try {
      // Server-side breach monitoring only (avoids client-side PII→LLM)
      const result = await base44.functions.invoke('checkBreachAlerts', { profileId: activeProfileId });
      alert(result.data?.message || 'Dark web scan complete.');
      queryClient.invalidateQueries(['scanResults']);
      queryClient.invalidateQueries(['notifications']);
    } catch (error) {
      alert('Dark web scan failed: ' + error.message);
    } finally {
      setDarkWebScanning(false);
    }
  };

  const runSocialMediaScan = async () => {
    if (!activeProfileId) {
      alert('Please select a profile first');
      return;
    }

    setSocialMediaScanning(true);
    try {
      const response = await base44.functions.invoke('monitorSocialMedia', { profileId: activeProfileId });
      alert(response.data.message);
      queryClient.invalidateQueries(['socialMediaMentions']);
      queryClient.invalidateQueries(['socialMediaFindings']);
    } catch (error) {
      alert('Social media scan failed: ' + error.message);
    } finally {
      setSocialMediaScanning(false);
    }
  };

  const accountIcons = {
    gmail: Mail,
    outlook: Mail,
    icloud: Mail,
    phone_forwarding: Phone
  };

  const handleCreateCredential = async (credData) => {
    if (!activeProfileId) {
      alert('Please select a profile first');
      return;
    }

    await createCredentialMutation.mutateAsync({
      ...credData,
      profile_id: activeProfileId
    });
  };

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <Smartphone className="w-10 h-10 text-purple-400" />
            Monitoring Hub
          </h1>
          <p className="text-purple-300">Monitor your profile data across emails, dark web, and social media</p>
        </div>
        <Button
          onClick={() => {
            setShowAddForm(!showAddForm);
          }}
          className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
        >
          <Plus className="w-5 h-5 mr-2" />
          {showAddForm ? 'Cancel' : 'Add Account'}
        </Button>
      </div>

      {/* Quick Scan Actions */}
      <Card className="glass-card border-purple-500/30">
        <CardHeader className="border-b border-purple-500/20">
          <CardTitle className="text-white">Quick Monitoring Actions</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              onClick={runMonitoring}
              disabled={monitoring}
              variant="outline"
              className="h-24 border-purple-500/50 text-purple-300 flex-col gap-2"
            >
              <Mail className={`w-8 h-8 ${monitoring ? 'animate-pulse' : ''}`} />
              <span>{monitoring ? 'Scanning Emails...' : 'Scan Email Spam'}</span>
            </Button>
            <Button
              onClick={runDarkWebScan}
              disabled={darkWebScanning}
              variant="outline"
              className="h-24 border-red-500/50 text-red-300 flex-col gap-2"
            >
              <AlertCircle className={`w-8 h-8 ${darkWebScanning ? 'animate-pulse' : ''}`} />
              <span>{darkWebScanning ? 'Scanning Dark Web...' : 'Dark Web Scan'}</span>
            </Button>
            <Button
              onClick={runSocialMediaScan}
              disabled={socialMediaScanning}
              variant="outline"
              className="h-24 border-blue-500/50 text-blue-300 flex-col gap-2"
            >
              <RefreshCw className={`w-8 h-8 ${socialMediaScanning ? 'animate-spin' : ''}`} />
              <span>{socialMediaScanning ? 'Scanning Social Media...' : 'Social Media Scan'}</span>
            </Button>
          </div>
          <p className="text-xs text-purple-400 mt-4 text-center">
            All scans are filtered to only find mentions and exposures of YOUR profile data
          </p>
        </CardContent>
      </Card>

      {/* Setup Instructions */}
      <Card className="glass-card border-purple-500/30">
        <CardHeader className="border-b border-purple-500/20">
          <CardTitle className="text-white">Quick Setup Guide</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
              <Mail className="w-8 h-8 text-purple-400 mb-3" />
              <h3 className="font-semibold text-white mb-2">Email Monitoring</h3>
              <p className="text-sm text-purple-300">
                Connect Gmail, Outlook, or iCloud. Works on all devices (iOS, Android, Windows, Mac).
              </p>
            </div>
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <Phone className="w-8 h-8 text-blue-400 mb-3" />
              <h3 className="font-semibold text-white mb-2">Phone Monitoring</h3>
              <p className="text-sm text-purple-300">
                Set up email forwarding for spam texts. Forward to a dedicated email we'll monitor.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <CheckCircle className="w-8 h-8 text-green-400 mb-3" />
              <h3 className="font-semibold text-white mb-2">Auto-Logging</h3>
              <p className="text-sm text-purple-300">
                Spam is automatically detected and logged to your Spam Tracker.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* T-Mobile Specific Setup */}
      <Card className="glass-card border-pink-500/30">
        <CardHeader className="border-b border-pink-500/20">
          <CardTitle className="text-white flex items-center gap-2">
            <Phone className="w-5 h-5 text-pink-400" />
            T-Mobile Setup Instructions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-pink-500/10 border border-pink-500/30">
              <h4 className="font-semibold text-white mb-2">1. Enable T-Mobile Scam Shield (Free)</h4>
              <ul className="text-sm text-purple-300 space-y-1 list-disc list-inside">
                <li>Download "Scam Shield" app from App Store or Google Play</li>
                <li>Or dial #662# from your T-Mobile phone</li>
                <li>Blocks known scam calls automatically</li>
                <li>Enable "Scam Block" and "Scam ID" features</li>
              </ul>
            </div>

            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
              <h4 className="font-semibold text-white mb-2">2. Forward Spam Texts to 7726 (SPAM)</h4>
              <ul className="text-sm text-purple-300 space-y-1 list-disc list-inside">
                <li>When you receive spam text, forward to 7726</li>
                <li>T-Mobile investigates and blocks the sender</li>
                <li>Free service, works on all T-Mobile plans</li>
                <li>You'll get confirmation that report was received</li>
              </ul>
            </div>

            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <h4 className="font-semibold text-white mb-2">3. Set Up Monitoring Email (Optional)</h4>
              <ul className="text-sm text-purple-300 space-y-1 list-disc list-inside">
                <li>Create a dedicated Gmail for spam tracking (e.g., familyspam@gmail.com)</li>
                <li>Add it to your vault first</li>
                <li>Connect it here in Monitoring Hub</li>
                <li>Forward spam texts to that email as BCC for automatic logging</li>
              </ul>
            </div>

            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <h4 className="font-semibold text-white mb-2">4. For Each Family Member</h4>
              <ul className="text-sm text-purple-300 space-y-1 list-disc list-inside">
                <li>Create a profile for each person</li>
                <li>Add their email (Gmail, iCloud, Outlook) here</li>
                <li>Add their phone number (we'll track manually reported spam)</li>
                <li>They'll need to authorize email access once (one-click OAuth)</li>
              </ul>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
            <p className="text-sm text-green-300 flex items-start gap-2">
              <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>
                <strong>What Gets Monitored:</strong> Once connected, we'll automatically check spam folders every {accounts[0]?.check_frequency_hours || 6} hours, 
                detect phishing/spam emails, and log them to your Spam Tracker. No manual work needed!
              </span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Add Account Form */}
      {showAddForm && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
          <Card className="glass-card border-purple-500/30">
            <CardHeader className="border-b border-purple-500/20">
              <CardTitle className="text-white">Add Account to Monitor</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-purple-200">Account Type</label>
                  <Select value={formData.account_type} onValueChange={(v) => setFormData({...formData, account_type: v})}>
                    <SelectTrigger className="bg-slate-900/50 border-purple-500/30 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gmail">Gmail (All devices)</SelectItem>
                      <SelectItem value="outlook">Outlook/Microsoft (All devices)</SelectItem>
                      <SelectItem value="icloud">iCloud Mail (Apple devices)</SelectItem>
                      <SelectItem value="phone_forwarding">Phone via Email Forwarding</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-purple-200">
                    {formData.account_type === 'phone_forwarding' ? 'Phone Number' : 'Email Address'}
                  </label>
                  <Input
                    value={formData.account_identifier}
                    onChange={(e) => setFormData({...formData, account_identifier: e.target.value})}
                    placeholder={formData.account_type === 'phone_forwarding' ? '+1-555-0123' : 'email@example.com'}
                    className="bg-slate-900/50 border-purple-500/30 text-white"
                    required
                  />
                </div>

                {formData.account_type === 'phone_forwarding' && (
                  <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                    <p className="text-sm text-blue-300 mb-2 font-semibold">Setup Instructions:</p>
                    <ol className="text-xs text-purple-300 space-y-1 list-decimal list-inside">
                      <li>Add a dedicated email to your vault for spam forwarding</li>
                      <li>Set up auto-forwarding on your phone carrier for spam texts/voicemails</li>
                      <li>Most carriers: Forward spam texts to 7726 (SPAM) and CC the email</li>
                      <li>We'll monitor that email and auto-log incidents</li>
                    </ol>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-purple-200">Check Frequency</label>
                  <Select 
                    value={String(formData.check_frequency_hours)} 
                    onValueChange={(v) => setFormData({...formData, check_frequency_hours: Number(v)})}
                  >
                    <SelectTrigger className="bg-slate-900/50 border-purple-500/30 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Every hour</SelectItem>
                      <SelectItem value="6">Every 6 hours</SelectItem>
                      <SelectItem value="12">Every 12 hours</SelectItem>
                      <SelectItem value="24">Daily</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={() => setShowAddForm(false)} className="border-purple-500/50 text-purple-300">
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-gradient-to-r from-purple-600 to-indigo-600">
                    Add Account
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Monitored Accounts */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-white">Monitored Accounts</h2>
        {accounts.length > 0 ? (
          accounts.map((account) => {
            const Icon = accountIcons[account.account_type] || Mail;
            return (
              <motion.div key={account.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="glass-card border-purple-500/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-white">{account.account_identifier}</h3>
                          <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40">
                            {account.account_type.replace('_', ' ')}
                          </Badge>
                          <Badge className="bg-green-500/20 text-green-300 border-green-500/40">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            {account.account_type === 'phone_forwarding' ? 'Active' : 'Ready to Scan'}
                          </Badge>
                        </div>
                        <p className="text-xs text-purple-400">
                          Checks every {account.check_frequency_hours}h
                          {account.last_check && ` • Last: ${new Date(account.last_check).toLocaleString()}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={account.is_active}
                          onCheckedChange={(checked) => updateMutation.mutate({ id: account.id, data: { is_active: checked } })}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })
        ) : (
          <Card className="glass-card border-purple-500/20">
            <CardContent className="p-16 text-center">
              <Smartphone className="w-16 h-16 text-purple-500 mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-semibold text-white mb-2">No Accounts Connected</h3>
              <p className="text-purple-300">Add an email or phone account to start monitoring</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick Generate */}
      <QuickGenerateCard 
        profileId={activeProfileId}
        onGenerated={() => queryClient.invalidateQueries(['disposableCredentials'])}
      />

      {/* Bulk Email Cleaner */}
      <BulkEmailCleaner />

      {/* Disposable Credentials & AI Analyzer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DisposableCredentialCard
          credentials={credentials}
          onCreate={handleCreateCredential}
          profileId={activeProfileId}
          onRevoked={() => queryClient.invalidateQueries(['disposableCredentials'])}
        />
        <AIActivityAnalyzer profileId={activeProfileId} />
      </div>
    </div>
  );
}