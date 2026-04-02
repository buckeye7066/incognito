import { useActiveProfile } from '@/hooks/useActiveProfile';
import React, { useState, useMemo } from 'react';
import { incognito, resolvePersonalDataValue } from '@/api/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, Eye, Trash2, AlertTriangle, ArrowRight, Loader2, CheckCircle, XCircle, Database, Phone, Mail, MapPin, User, CreditCard, FileText, Gavel, Rocket, DollarSign } from 'lucide-react';
import CreditFreezeCard from '../components/dashboard/CreditFreezeCard';
import PrivacyHealthScore from '../components/dashboard/PrivacyHealthScore';
import RecentActivityFeed from '../components/dashboard/RecentActivityFeed';
import PrivacyAssistant from '../components/dashboard/PrivacyAssistant';
import ActionRecommendations from '../components/dashboard/ActionRecommendations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { motion, AnimatePresence } from 'framer-motion';

const DATA_TYPE_ICONS = {
  email: Mail, phone: Phone, address: MapPin,
  full_name: User, credit_card: CreditCard, ssn: FileText,
};

export default function Dashboard() {
  const { activeProfileId } = useActiveProfile();
  const queryClient = useQueryClient();
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatus, setScanStatus] = useState('');

  const { data: allPersonalData = [] } = useQuery({
    queryKey: ['personalData'],
    queryFn: () => incognito.entities.PersonalData.list()
  });

  const { data: allScanResults = [] } = useQuery({
    queryKey: ['scanResults'],
    queryFn: () => incognito.entities.ScanResult.list()
  });

  const { data: allSearchQueries = [] } = useQuery({
    queryKey: ['searchQueryFindings'],
    queryFn: () => incognito.entities.SearchQueryFinding.list()
  });

  const { data: allDeletionRequests = [] } = useQuery({
    queryKey: ['deletionRequests'],
    queryFn: () => incognito.entities.DeletionRequest.list()
  });

  const { data: allProfiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => incognito.entities.Profile.list()
  });

  const { data: allAccounts = [] } = useQuery({
    queryKey: ['financialAccounts'],
    queryFn: () => incognito.entities.FinancialAccount.list()
  });

  const activeProfile = allProfiles.find(p => p.id === activeProfileId);

  const personalData = useMemo(() => allPersonalData.filter(d => !activeProfileId || d.profile_id === activeProfileId), [allPersonalData, activeProfileId]);
  const scanResults = useMemo(() => allScanResults.filter(r => !activeProfileId || r.profile_id === activeProfileId), [allScanResults, activeProfileId]);
  const searchQueries = useMemo(() => allSearchQueries.filter(q => !activeProfileId || q.profile_id === activeProfileId), [allSearchQueries, activeProfileId]);
  const deletionRequests = useMemo(() => allDeletionRequests.filter(r => !activeProfileId || r.profile_id === activeProfileId), [allDeletionRequests, activeProfileId]);
  const accounts = useMemo(() => allAccounts.filter(a => !activeProfileId || a.profile_id === activeProfileId), [allAccounts, activeProfileId]);

  const stats = useMemo(() => {
    const totalExposures = scanResults.length + searchQueries.length;
    const dataBrokerExposures = searchQueries.length;
    const breachExposures = scanResults.filter(r => r.source_type === 'breach_database').length;
    const removalsInProgress = deletionRequests.filter(r => r.status === 'pending' || r.status === 'in_progress').length;
    const removalsCompleted = deletionRequests.filter(r => r.status === 'completed').length;
    const highRisk = scanResults.filter(r => r.risk_score >= 70).length;
    const criticalExposures = searchQueries.filter(q => q.risk_level === 'critical' || q.risk_level === 'high').length;
    const riskScore = totalExposures === 0 ? 0 : Math.min(100, Math.round((highRisk * 15 + criticalExposures * 10 + totalExposures * 2)));
    return { totalExposures, dataBrokerExposures, breachExposures, removalsInProgress, removalsCompleted, riskScore };
  }, [scanResults, searchQueries, deletionRequests]);

  const { totalExposures, dataBrokerExposures, breachExposures, removalsInProgress, removalsCompleted, riskScore } = stats;

  const exposureCountByType = useMemo(() => {
    const counts = {};
    for (const r of scanResults) {
      for (const dt of (r.matched_data_types || r.data_exposed || [])) {
        counts[dt] = (counts[dt] || 0) + 1;
      }
    }
    for (const q of searchQueries) {
      for (const dt of (q.matched_data_types || q.data_exposed || [])) {
        counts[dt] = (counts[dt] || 0) + 1;
      }
    }
    return counts;
  }, [scanResults, searchQueries]);

  const getDataTypeIcon = (type) => DATA_TYPE_ICONS[type] || Database;

  // Run comprehensive scan like Cloaked
  const runFullScan = async () => {
    if (!activeProfileId) {
      alert('Please select a profile first');
      return;
    }

    setScanning(true);
    setScanProgress(0);

    const stepErrors = [];
    try {
      const fnItem = personalData.find(p => p.data_type === 'full_name');
      const fullName = fnItem ? resolvePersonalDataValue(fnItem) : '';
      const emailItems = personalData.filter(d => d.data_type === 'email' && d.monitoring_enabled);
      const emailValues = emailItems.map(e => e.value).filter(Boolean);
      const phones = personalData.filter(p => p.data_type === 'phone').map(p => resolvePersonalDataValue(p));
      const addresses = personalData.filter(p => p.data_type === 'address').map(p => resolvePersonalDataValue(p));

      // Step 1: Data brokers
      setScanStatus('Scanning data broker sites...');
      setScanProgress(20);
      try {
        await incognito.functions.invoke('detectSearchQueries', {
          profileId: activeProfileId, fullName, emails: emailValues, phones, addresses,
        });
      } catch (e) { stepErrors.push('Data broker scan: ' + e.message); }

      // Step 2: Breach databases
      setScanStatus('Checking breach databases...');
      setScanProgress(50);
      if (emailValues.length > 0) {
        try {
          await incognito.functions.invoke('checkBreaches', {
            profileId: activeProfileId,
            emails: emailValues,
          });
        } catch (e) { stepErrors.push('Breach check: ' + e.message); }
      }

      // Step 3: Social media
      setScanStatus('Scanning social media...');
      setScanProgress(80);
      try {
        await incognito.functions.invoke('monitorSocialMedia', { profileId: activeProfileId });
      } catch (e) { stepErrors.push('Social media: ' + e.message); }

      setScanProgress(100);
      setScanStatus(stepErrors.length > 0 ? `Scan done with ${stepErrors.length} warning(s)` : 'Scan complete!');

      queryClient.invalidateQueries({ queryKey: ['scanResults'] });
      queryClient.invalidateQueries({ queryKey: ['searchQueryFindings'] });
      queryClient.invalidateQueries({ queryKey: ['socialMediaFindings'] });

    } catch (error) {
      setScanStatus('Scan failed — check console for details');
    }
    setTimeout(() => {
      setScanning(false);
      setScanProgress(0);
      setScanStatus('');
    }, 2500);
  };

  const getRiskColor = (score) => {
    if (score >= 70) return { bg: 'from-red-600 to-red-500', text: 'text-red-400', label: 'High Risk' };
    if (score >= 40) return { bg: 'from-orange-600 to-amber-500', text: 'text-orange-400', label: 'Medium Risk' };
    if (score > 0) return { bg: 'from-yellow-600 to-yellow-500', text: 'text-yellow-400', label: 'Low Risk' };
    return { bg: 'from-green-600 to-green-500', text: 'text-green-400', label: 'Protected' };
  };

  const risk = getRiskColor(riskScore);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-2">
          {activeProfile ? `${activeProfile.name}'s Privacy Report` : 'Your Privacy Report'}
        </h1>
        <p className="text-gray-400">See where your personal information is exposed online</p>
      </div>

      {/* Main Risk Score Card - Like Cloaked */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-3xl p-8 glow-border relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-red-600/10 to-purple-600/5" />
        
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            {/* Risk Score Circle */}
            <div className="flex flex-col items-center">
              <div className={`w-40 h-40 rounded-full bg-gradient-to-br ${risk.bg} flex items-center justify-center shadow-2xl`}>
                <div className="w-32 h-32 rounded-full bg-slate-900 flex flex-col items-center justify-center">
                  <span className="text-5xl font-bold text-white">{riskScore}</span>
                  <span className="text-xs text-gray-400 uppercase tracking-wider">Risk Score</span>
                </div>
              </div>
              <Badge className={`mt-4 ${risk.text} bg-slate-800 border-0 px-4 py-1`}>
                {risk.label}
              </Badge>
            </div>

            {/* Exposure Summary */}
            <div className="flex-1 grid grid-cols-2 gap-6">
              <Link to={createPageUrl('Findings')} className="block">
                <div className="text-center p-4 rounded-2xl bg-slate-800/50 border border-red-500/20 hover:bg-slate-700/60 hover:border-red-500/50 transition-all cursor-pointer">
                  <Database className="w-8 h-8 text-red-400 mx-auto mb-2" />
                  <p className="text-3xl font-bold text-white">{dataBrokerExposures}</p>
                  <p className="text-sm text-gray-400">Data Broker Sites</p>
                </div>
              </Link>
              <Link to={createPageUrl('Findings')} className="block">
                <div className="text-center p-4 rounded-2xl bg-slate-800/50 border border-orange-500/20 hover:bg-slate-700/60 hover:border-orange-500/50 transition-all cursor-pointer">
                  <AlertTriangle className="w-8 h-8 text-orange-400 mx-auto mb-2" />
                  <p className="text-3xl font-bold text-white">{breachExposures}</p>
                  <p className="text-sm text-gray-400">Breach Exposures</p>
                </div>
              </Link>
              <Link to={createPageUrl('DeletionCenter')} className="block">
                <div className="text-center p-4 rounded-2xl bg-slate-800/50 border border-yellow-500/20 hover:bg-slate-700/60 hover:border-yellow-500/50 transition-all cursor-pointer">
                  <Loader2 className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                  <p className="text-3xl font-bold text-white">{removalsInProgress}</p>
                  <p className="text-sm text-gray-400">Removals In Progress</p>
                </div>
              </Link>
              <Link to={createPageUrl('DeletionCenter')} className="block">
                <div className="text-center p-4 rounded-2xl bg-slate-800/50 border border-green-500/20 hover:bg-slate-700/60 hover:border-green-500/50 transition-all cursor-pointer">
                  <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                  <p className="text-3xl font-bold text-white">{removalsCompleted}</p>
                  <p className="text-sm text-gray-400">Successfully Removed</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Scan Button */}
          <div className="mt-8 flex justify-center">
            <Button
              size="lg"
              onClick={runFullScan}
              disabled={scanning || personalData.length === 0}
              className={`px-8 py-6 text-lg rounded-full ${
                scanning 
                  ? 'bg-slate-700' 
                  : 'bg-gradient-to-r from-red-600 to-purple-600 hover:from-red-700 hover:to-purple-700'
              }`}
            >
              {scanning ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{scanStatus}</span>
                </div>
              ) : (
                <>
                  <Eye className="w-5 h-5 mr-2" />
                  Scan for Exposures
                </>
              )}
            </Button>
          </div>

          {/* Scan Progress */}
          <AnimatePresence>
            {scanning && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-6"
              >
                <Progress value={scanProgress} className="h-2 bg-slate-700" />
                <p className="text-center text-sm text-gray-400 mt-2">{scanProgress}% complete</p>
              </motion.div>
            )}
          </AnimatePresence>

          {personalData.length === 0 && (
            <p className="text-center text-amber-400 mt-4 text-sm">
              Add your personal data to the Vault to start scanning
            </p>
          )}
        </div>
      </motion.div>

      {/* Priority Actions */}
      <ActionRecommendations profileId={activeProfileId} maxItems={5} />

      {/* What We Monitor */}
      <Card className="glass-card border-purple-500/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-400" />
            Your Protected Data ({personalData.filter(d => d.monitoring_enabled).length} items)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {personalData.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {personalData.filter(d => d.monitoring_enabled).slice(0, 8).map((data) => {
                const Icon = getDataTypeIcon(data.data_type);
                const exposureCount = exposureCountByType[data.data_type] || 0;

                return (
                  <div
                    key={data.id}
                    className={`p-4 rounded-xl border ${
                      exposureCount > 0 
                        ? 'bg-red-500/10 border-red-500/30' 
                        : 'bg-green-500/10 border-green-500/30'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Icon className={`w-5 h-5 ${exposureCount > 0 ? 'text-red-400' : 'text-green-400'}`} />
                      <span className="text-sm text-gray-300 capitalize">{data.data_type.replace(/_/g, ' ')}</span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{(data.value || '').slice(0, 20)}...</p>
                    <div className="flex items-center gap-1 mt-2">
                      {exposureCount > 0 ? (
                        <>
                          <XCircle className="w-4 h-4 text-red-400" />
                          <span className="text-xs text-red-400">{exposureCount} exposures</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-400" />
                          <span className="text-xs text-green-400">Protected</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Shield className="w-12 h-12 text-purple-500 mx-auto mb-3 opacity-50" />
              <p className="text-purple-300 mb-4">No data in your vault yet</p>
              <Link to={createPageUrl('Vault')}>
                <Button className="bg-gradient-to-r from-purple-600 to-pink-600">
                  Add Your Data
                </Button>
              </Link>
            </div>
          )}

          {personalData.length > 8 && (
            <div className="text-center mt-4">
              <Link to={createPageUrl('Vault')}>
                <Button variant="ghost" className="text-purple-400">
                  View all {personalData.length} items <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Exposures */}
      {totalExposures > 0 && (
        <Card className="glass-card border-red-500/20">
          <CardHeader className="border-b border-red-500/20">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                Recent Exposures
              </CardTitle>
              <Link to={createPageUrl('Findings')}>
                <Button variant="ghost" className="text-red-400 hover:text-red-300">
                  View All <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              {[...scanResults.slice(0, 3), ...searchQueries.slice(0, 3)]
                .sort((a, b) => new Date(b.created_date || b.detected_date) - new Date(a.created_date || a.detected_date))
                .slice(0, 5)
                .map((item, idx) => {
                  const isBreach = !!item.source_name;
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-red-500/20"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          isBreach ? 'bg-red-500/20' : 'bg-orange-500/20'
                        }`}>
                          {isBreach ? (
                            <AlertTriangle className="w-5 h-5 text-red-400" />
                          ) : (
                            <Database className="w-5 h-5 text-orange-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-white">
                            {isBreach ? item.source_name : item.search_platform}
                          </p>
                          <p className="text-sm text-gray-400">
                            {isBreach ? 'Data Breach' : 'Data Broker'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={`${
                          (item.risk_score >= 70 || item.risk_level === 'high' || item.risk_level === 'critical')
                            ? 'bg-red-500/20 text-red-300'
                            : 'bg-orange-500/20 text-orange-300'
                        }`}>
                          {isBreach ? `${item.risk_score}%` : item.risk_level?.toUpperCase()}
                        </Badge>
                        <Link to={createPageUrl('DeletionCenter')}>
                          <Button size="sm" variant="outline" className="border-red-500/50 text-red-300 hover:bg-red-500/20">
                            <Trash2 className="w-4 h-4 mr-1" />
                            Remove
                          </Button>
                        </Link>
                      </div>
                    </motion.div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Privacy Health Score + Credit Freeze + Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <PrivacyHealthScore
          personalData={personalData}
          scanResults={scanResults}
          deletionRequests={deletionRequests}
          accounts={accounts}
        />
        <CreditFreezeCard />
      </div>
      <RecentActivityFeed activeProfileId={activeProfileId} />

      {/* AI Assistant */}
      <PrivacyAssistant
        scanResults={scanResults}
        personalData={personalData}
        deletionRequests={deletionRequests}
        riskScore={riskScore}
      />

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to={createPageUrl('Vault')} className="block">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="glass-card rounded-xl p-6 hover:glow-border transition-all cursor-pointer h-full"
          >
            <Shield className="w-10 h-10 text-purple-400 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Add to Vault</h3>
            <p className="text-sm text-gray-400">Add emails, phones, addresses to monitor</p>
          </motion.div>
        </Link>

        <Link to={createPageUrl('DeletionCenter')} className="block">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="glass-card rounded-xl p-6 hover:glow-border transition-all cursor-pointer h-full"
          >
            <Trash2 className="w-10 h-10 text-red-400 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Remove My Data</h3>
            <p className="text-sm text-gray-400">Request removal from {dataBrokerExposures} sites</p>
          </motion.div>
        </Link>

        <Link to={createPageUrl('Findings')} className="block">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="glass-card rounded-xl p-6 hover:glow-border transition-all cursor-pointer h-full"
          >
            <Eye className="w-10 h-10 text-amber-400 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">View All Exposures</h3>
            <p className="text-sm text-gray-400">See detailed breakdown of {totalExposures} findings</p>
          </motion.div>
        </Link>
      </div>

      {/* Extended Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to={createPageUrl('LegalSupport')} className="block">
          <motion.div whileHover={{ scale: 1.02 }} className="glass-card rounded-xl p-6 hover:glow-border transition-all cursor-pointer h-full">
            <Gavel className="w-10 h-10 text-purple-400 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Settlement Finder</h3>
            <p className="text-sm text-gray-400">Find class actions and no-proof settlements you may qualify for</p>
          </motion.div>
        </Link>
        <Link to={createPageUrl('DeletionCenter')} className="block">
          <motion.div whileHover={{ scale: 1.02 }} className="glass-card rounded-xl p-6 hover:glow-border transition-all cursor-pointer h-full">
            <Rocket className="w-10 h-10 text-indigo-400 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Removal Campaigns</h3>
            <p className="text-sm text-gray-400">Launch automated opt-out campaigns across data brokers</p>
          </motion.div>
        </Link>
        <Link to={createPageUrl('FinancialMonitor')} className="block">
          <motion.div whileHover={{ scale: 1.02 }} className="glass-card rounded-xl p-6 hover:glow-border transition-all cursor-pointer h-full">
            <DollarSign className="w-10 h-10 text-green-400 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Subscription Control</h3>
            <p className="text-sm text-gray-400">Track, cancel, and protect your recurring payments</p>
          </motion.div>
        </Link>
      </div>
    </div>
  );
}