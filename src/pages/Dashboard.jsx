import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, Eye, Trash2, AlertTriangle, ArrowRight, Loader2, CheckCircle, XCircle, Database, Phone, Mail, MapPin, User, CreditCard, FileText } from 'lucide-react';
import CreditFreezeCard from '../components/dashboard/CreditFreezeCard';
import PrivacyHealthScore from '../components/dashboard/PrivacyHealthScore';
import RecentActivityFeed from '../components/dashboard/RecentActivityFeed';
import PrivacyAssistant from '../components/dashboard/PrivacyAssistant';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function Dashboard() {
  const activeProfileId = typeof window !== 'undefined' ? window.activeProfileId : null;
  const queryClient = useQueryClient();
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatus, setScanStatus] = useState('');

  const { data: allPersonalData = [] } = useQuery({
    queryKey: ['personalData'],
    queryFn: () => base44.entities.PersonalData.list()
  });

  const { data: allScanResults = [] } = useQuery({
    queryKey: ['scanResults'],
    queryFn: () => base44.entities.ScanResult.list()
  });

  const { data: allSearchQueries = [] } = useQuery({
    queryKey: ['searchQueryFindings'],
    queryFn: () => base44.entities.SearchQueryFinding.list()
  });

  const { data: allDeletionRequests = [] } = useQuery({
    queryKey: ['deletionRequests'],
    queryFn: () => base44.entities.DeletionRequest.list()
  });

  const { data: allProfiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => base44.entities.Profile.list()
  });

  const { data: allAccounts = [] } = useQuery({
    queryKey: ['financialAccounts'],
    queryFn: () => base44.entities.FinancialAccount.list()
  });

  const activeProfile = allProfiles.find(p => p.id === activeProfileId);

  // Filter by active profile
  const personalData = allPersonalData.filter(d => !activeProfileId || d.profile_id === activeProfileId);
  const scanResults = allScanResults.filter(r => !activeProfileId || r.profile_id === activeProfileId);
  const searchQueries = allSearchQueries.filter(q => !activeProfileId || q.profile_id === activeProfileId);
  const deletionRequests = allDeletionRequests.filter(r => !activeProfileId || r.profile_id === activeProfileId);
  const accounts = allAccounts.filter(a => !activeProfileId || a.profile_id === activeProfileId);

  // Calculate stats like Cloaked
  const totalExposures = scanResults.length + searchQueries.length;
  const dataBrokerExposures = searchQueries.length;
  const breachExposures = scanResults.filter(r => r.source_type === 'breach_database').length;
  const removalsInProgress = deletionRequests.filter(r => r.status === 'pending' || r.status === 'in_progress').length;
  const removalsCompleted = deletionRequests.filter(r => r.status === 'completed').length;

  // Risk score calculation
  const calculateRiskScore = () => {
    if (totalExposures === 0) return 0;
    const highRisk = scanResults.filter(r => r.risk_score >= 70).length;
    const criticalExposures = searchQueries.filter(q => q.risk_level === 'critical' || q.risk_level === 'high').length;
    return Math.min(100, Math.round((highRisk * 15 + criticalExposures * 10 + totalExposures * 2)));
  };

  const riskScore = calculateRiskScore();

  // Data type icons
  const getDataTypeIcon = (type) => {
    const icons = {
      email: Mail,
      phone: Phone,
      address: MapPin,
      full_name: User,
      credit_card: CreditCard,
      ssn: FileText,
    };
    return icons[type] || Database;
  };

  // Run comprehensive scan like Cloaked
  const runFullScan = async () => {
    if (!activeProfileId) {
      alert('Please select a profile first');
      return;
    }

    setScanning(true);
    setScanProgress(0);

    try {
      // Step 1: Check data brokers
      setScanStatus('Scanning 120+ data broker sites...');
      setScanProgress(20);
      await base44.functions.invoke('detectSearchQueries', { profileId: activeProfileId });
      
      // Step 2: Check breach databases
      setScanStatus('Checking breach databases...');
      setScanProgress(50);
      const emails = personalData.filter(d => d.data_type === 'email' && d.monitoring_enabled);
      if (emails.length > 0) {
        await base44.functions.invoke('checkBreaches', {
          profileId: activeProfileId,
          identifiers: emails.map(e => ({ id: e.id, data_type: e.data_type, value: e.value }))
        });
      }

      // Step 3: Check social media
      setScanStatus('Scanning social media...');
      setScanProgress(80);
      await base44.functions.invoke('monitorSocialMedia', { profileId: activeProfileId });

      setScanProgress(100);
      setScanStatus('Scan complete!');
      
      // Refresh data
      queryClient.invalidateQueries(['scanResults']);
      queryClient.invalidateQueries(['searchQueryFindings']);
      queryClient.invalidateQueries(['socialMediaFindings']);

      setTimeout(() => {
        setScanning(false);
        setScanProgress(0);
        setScanStatus('');
      }, 2000);

    } catch (error) {
      console.error('Scan error:', error);
      setScanStatus('Scan completed with some errors');
      setTimeout(() => {
        setScanning(false);
        setScanProgress(0);
        setScanStatus('');
      }, 2000);
    }
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
                const exposureCount = [...scanResults, ...searchQueries].filter(r => 
                  r.matched_data_types?.includes(data.data_type) ||
                  r.data_exposed?.includes(data.data_type)
                ).length;

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
                    <p className="text-xs text-gray-500 truncate">{data.value.slice(0, 20)}...</p>
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
    </div>
  );
}