import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import StatCard from '../components/shared/StatCard';
import RiskBadge from '../components/shared/RiskBadge';
import { Shield, Eye, Trash2, AlertTriangle, TrendingDown, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const { data: personalData = [] } = useQuery({
    queryKey: ['personalData'],
    queryFn: () => base44.entities.PersonalData.list()
  });

  const { data: scanResults = [] } = useQuery({
    queryKey: ['scanResults'],
    queryFn: () => base44.entities.ScanResult.list()
  });

  const { data: deletionRequests = [] } = useQuery({
    queryKey: ['deletionRequests'],
    queryFn: () => base44.entities.DeletionRequest.list()
  });

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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">Privacy Dashboard</h1>
        <p className="text-purple-300">Monitor and minimize your digital footprint</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
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
      </div>

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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