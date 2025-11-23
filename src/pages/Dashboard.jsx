import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import StatCard from '../components/shared/StatCard';
import RiskBadge from '../components/shared/RiskBadge';
import { Shield, Eye, Trash2, AlertTriangle, TrendingDown, ArrowRight, Brain, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { motion } from 'framer-motion';
import RiskTrendsChart from '../components/dashboard/RiskTrendsChart';
import CorrelationRiskCard from '../components/dashboard/CorrelationRiskCard';

export default function Dashboard() {
  const activeProfileId = typeof window !== 'undefined' ? window.activeProfileId : null;
  const [analyzingRisk, setAnalyzingRisk] = useState(false);
  const [correlations, setCorrelations] = useState(null);

  const { data: allPersonalData = [] } = useQuery({
    queryKey: ['personalData'],
    queryFn: () => base44.entities.PersonalData.list()
  });

  const { data: allScanResults = [] } = useQuery({
    queryKey: ['scanResults'],
    queryFn: () => base44.entities.ScanResult.list()
  });

  const { data: allDeletionRequests = [] } = useQuery({
    queryKey: ['deletionRequests'],
    queryFn: () => base44.entities.DeletionRequest.list()
  });

  const { data: allAIInsights = [] } = useQuery({
    queryKey: ['aiInsights'],
    queryFn: () => base44.entities.AIInsight.list()
  });

  const { data: allSpamIncidents = [] } = useQuery({
    queryKey: ['spamIncidents'],
    queryFn: () => base44.entities.SpamIncident.list()
  });

  const { data: allReports = [] } = useQuery({
    queryKey: ['digitalFootprintReports'],
    queryFn: () => base44.entities.DigitalFootprintReport.list()
  });

  // Filter by active profile
  const personalData = allPersonalData.filter(d => !activeProfileId || d.profile_id === activeProfileId);
  const scanResults = allScanResults.filter(r => !activeProfileId || r.profile_id === activeProfileId);
  const deletionRequests = allDeletionRequests.filter(r => !activeProfileId || r.profile_id === activeProfileId);
  const aiInsights = allAIInsights.filter(i => !activeProfileId || i.profile_id === activeProfileId);
  const spamIncidents = allSpamIncidents.filter(i => !activeProfileId || i.profile_id === activeProfileId);

  const activeFindings = scanResults.filter(r => r.status === 'new' || r.status === 'monitoring');
  const highRiskFindings = scanResults.filter(r => r.risk_score >= 70);
  const darkWebFindings = scanResults.filter(r => r.metadata?.scan_type === 'dark_web');
  const completedRemovals = deletionRequests.filter(r => r.status === 'completed');
  
  const avgRiskScore = scanResults.length > 0 
    ? Math.round(scanResults.reduce((sum, r) => sum + (r.risk_score || 0), 0) / scanResults.length)
    : 0;

  const recentFindings = [...scanResults]
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
    .slice(0, 5);

  const criticalInsights = aiInsights.filter(i => i.severity === 'critical' || i.severity === 'high');
  const unreadInsights = aiInsights.filter(i => !i.is_read);

  const reports = allReports.filter(r => !activeProfileId || r.profile_id === activeProfileId);

  const handleAdvancedRiskAnalysis = async () => {
    if (!activeProfileId) {
      alert('Please select a profile first');
      return;
    }

    setAnalyzingRisk(true);
    try {
      const response = await base44.functions.invoke('calculateAdvancedRiskScore', {
        profileId: activeProfileId
      });

      setCorrelations(response.data.high_risk_combinations);
      alert(`Advanced risk analysis complete! Found ${response.data.high_risk_combinations.length} high-risk data correlations.`);
    } catch (error) {
      alert('Risk analysis failed: ' + error.message);
    } finally {
      setAnalyzingRisk(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Privacy Dashboard</h1>
          <p className="text-purple-300">Monitor and minimize your digital footprint</p>
        </div>
        <Button
          onClick={handleAdvancedRiskAnalysis}
          disabled={analyzingRisk}
          className="bg-gradient-to-r from-orange-600 to-red-600"
        >
          {analyzingRisk ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Brain className="w-4 h-4 mr-2" />
              Run Advanced Risk Analysis
            </>
          )}
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
        <StatCard
          title="Identifiers Monitored"
          value={personalData.filter(p => p.monitoring_enabled).length}
          icon={Shield}
          color="purple"
          trend={`${personalData.length} total in vault`}
        />
        <StatCard
          title="Active Findings"
          value={activeFindings.length}
          icon={Eye}
          color="amber"
          trend={`${highRiskFindings.length} high risk`}
        />
        <StatCard
          title="Dark Web Breaches"
          value={darkWebFindings.length}
          icon={AlertTriangle}
          color="red"
          trend={darkWebFindings.length > 0 ? 'Requires action' : 'None detected'}
        />
        <StatCard
          title="Avg Risk Score"
          value={avgRiskScore}
          icon={TrendingDown}
          color={avgRiskScore >= 70 ? 'red' : avgRiskScore >= 40 ? 'amber' : 'green'}
          trend={avgRiskScore < 50 ? 'Looking good' : 'Needs attention'}
        />
        <StatCard
          title="Successful Removals"
          value={completedRemovals.length}
          icon={Trash2}
          color="green"
          trend={`${deletionRequests.filter(r => r.status === 'pending').length} pending`}
        />
        <StatCard
          title="Spam (30 Days)"
          value={spamIncidents.filter(i => {
            const date = new Date(i.date_received);
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            return date >= thirtyDaysAgo;
          }).length}
          icon={Shield}
          color="amber"
          trend={`${spamIncidents.length} total logged`}
        />
      </div>

      {/* AI Insights Alert */}
      {criticalInsights.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-6 border-2 border-amber-500/50 bg-amber-500/5"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <Brain className="w-6 h-6 text-amber-400 animate-pulse" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-xl font-bold text-white">AI Insights Available</h3>
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40">
                  {criticalInsights.length} Critical
                </Badge>
                {unreadInsights.length > 0 && (
                  <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40">
                    {unreadInsights.length} Unread
                  </Badge>
                )}
              </div>
              <p className="text-purple-300 mb-3">
                AI has detected critical patterns and generated actionable recommendations for your digital footprint.
              </p>
              <Link to={createPageUrl('AIInsights')}>
                <Button className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700">
                  <Sparkles className="w-4 h-4 mr-2" />
                  View AI Insights
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      )}

      {/* Risk Trends and Correlations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Footprint Score */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card rounded-2xl p-8 glow-border"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Your Digital Footprint Score</h2>
              <p className="text-purple-300">Lower is better — track your progress over time</p>
            </div>
            <div className="text-right">
              <div className="text-5xl font-bold text-white mb-1">{avgRiskScore}</div>
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <TrendingDown className="w-4 h-4" />
                <span>Improving</span>
              </div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="relative h-4 bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${avgRiskScore}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className={`h-full rounded-full ${
                avgRiskScore >= 70 ? 'bg-gradient-to-r from-red-600 to-red-400' :
                avgRiskScore >= 40 ? 'bg-gradient-to-r from-amber-600 to-amber-400' :
                'bg-gradient-to-r from-green-600 to-green-400'
              }`}
            />
          </div>
        </motion.div>

        {correlations && <CorrelationRiskCard correlations={correlations} />}
      </div>

      {/* Risk Trends Chart */}
      {reports.length > 0 && <RiskTrendsChart reports={reports} />}

      {/* Recent Findings */}
      <Card className="glass-card border-purple-500/20">
        <CardHeader className="border-b border-purple-500/20">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold text-white">Recent Findings</CardTitle>
            <Link to={createPageUrl('Findings')}>
              <Button variant="ghost" className="text-purple-300 hover:text-white">
                View All <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {recentFindings.length > 0 ? (
            <div className="space-y-4">
              {recentFindings.map((finding) => (
                <motion.div
                  key={finding.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between p-4 rounded-xl bg-slate-900/50 border border-purple-500/10 hover:border-purple-500/30 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-white">{finding.source_name}</h3>
                      <RiskBadge score={finding.risk_score} size="sm" />
                    </div>
                    <p className="text-sm text-purple-300">{finding.source_type?.replace(/_/g, ' ')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-purple-400">
                      {new Date(finding.created_date).toLocaleDateString()}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Shield className="w-12 h-12 text-purple-500 mx-auto mb-3" />
              <p className="text-purple-300 mb-2">No findings yet</p>
              <p className="text-sm text-purple-400">Run your first scan to discover exposures</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Link to={createPageUrl('AIInsights')} className="block">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="glass-card rounded-xl p-6 hover:glow-border transition-all duration-300 cursor-pointer border-purple-500/30"
          >
            <div className="flex items-center justify-between mb-3">
              <Brain className="w-8 h-8 text-purple-400" />
              {unreadInsights.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              )}
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">AI Insights</h3>
            <p className="text-sm text-purple-300">Get AI recommendations</p>
          </motion.div>
        </Link>

        <Link to={createPageUrl('Vault')} className="block">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="glass-card rounded-xl p-6 hover:glow-border transition-all duration-300 cursor-pointer"
          >
            <Shield className="w-8 h-8 text-purple-400 mb-3" />
            <h3 className="text-lg font-semibold text-white mb-1">Add to Vault</h3>
            <p className="text-sm text-purple-300">Store identifiers to monitor</p>
          </motion.div>
        </Link>
        
        <Link to={createPageUrl('Scans')} className="block">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="glass-card rounded-xl p-6 hover:glow-border transition-all duration-300 cursor-pointer"
          >
            <Eye className="w-8 h-8 text-purple-400 mb-3" />
            <h3 className="text-lg font-semibold text-white mb-1">Run Scan</h3>
            <p className="text-sm text-purple-300">Check for new exposures</p>
          </motion.div>
        </Link>
        
        <Link to={createPageUrl('DeletionCenter')} className="block">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="glass-card rounded-xl p-6 hover:glow-border transition-all duration-300 cursor-pointer"
          >
            <Trash2 className="w-8 h-8 text-purple-400 mb-3" />
            <h3 className="text-lg font-semibold text-white mb-1">Remove Data</h3>
            <p className="text-sm text-purple-300">Request deletions</p>
          </motion.div>
        </Link>
      </div>
    </div>
  );
}