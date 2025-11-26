import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function ConsolidatedRiskScore({
  overallRisk,
  totalFindings,
  criticalFindings,
  highFindings,
  breachCount,
  impersonationCount,
  exposureCount,
  analysisResult
}) {
  const getRiskLevel = (score) => {
    if (score >= 80) return { label: 'CRITICAL', color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/50' };
    if (score >= 60) return { label: 'HIGH', color: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500/50' };
    if (score >= 40) return { label: 'MEDIUM', color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/50' };
    if (score >= 20) return { label: 'LOW', color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/50' };
    return { label: 'MINIMAL', color: 'text-green-400', bg: 'bg-green-500/20', border: 'border-green-500/50' };
  };

  const risk = getRiskLevel(overallRisk);

  const getScoreColor = (score) => {
    if (score >= 80) return 'from-red-600 to-red-400';
    if (score >= 60) return 'from-orange-600 to-orange-400';
    if (score >= 40) return 'from-yellow-600 to-yellow-400';
    if (score >= 20) return 'from-blue-600 to-blue-400';
    return 'from-green-600 to-green-400';
  };

  return (
    <Card className={`glass-card ${risk.border} glow-border`}>
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row items-center gap-6">
          {/* Risk Score Circle */}
          <div className="relative">
            <div className={`w-32 h-32 rounded-full ${risk.bg} flex items-center justify-center border-4 ${risk.border}`}>
              <div className="text-center">
                <p className={`text-4xl font-bold ${risk.color}`}>{overallRisk}</p>
                <p className="text-xs text-gray-400">/ 100</p>
              </div>
            </div>
            <Badge className={`absolute -bottom-2 left-1/2 transform -translate-x-1/2 ${risk.bg} ${risk.color} border ${risk.border}`}>
              {risk.label}
            </Badge>
          </div>

          {/* Summary */}
          <div className="flex-1 space-y-4">
            <div>
              <h3 className="text-xl font-bold text-white mb-1">Consolidated Threat Score</h3>
              <p className="text-sm text-purple-300">
                Based on {totalFindings} finding{totalFindings !== 1 ? 's' : ''} across all modules
              </p>
            </div>

            {analysisResult?.executive_summary && (
              <p className="text-sm text-gray-300 bg-slate-800/50 p-3 rounded-lg border border-purple-500/20">
                {analysisResult.executive_summary}
              </p>
            )}

            {/* Breakdown */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                <p className="text-lg font-bold text-red-300">{breachCount}</p>
                <p className="text-xs text-red-400">Breaches</p>
                <div className="w-full bg-slate-700 h-1 mt-2 rounded">
                  <div 
                    className="bg-red-500 h-1 rounded" 
                    style={{ width: `${Math.min(100, breachCount * 10)}%` }}
                  />
                </div>
              </div>
              <div className="text-center p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
                <p className="text-lg font-bold text-orange-300">{impersonationCount}</p>
                <p className="text-xs text-orange-400">Impersonations</p>
                <div className="w-full bg-slate-700 h-1 mt-2 rounded">
                  <div 
                    className="bg-orange-500 h-1 rounded" 
                    style={{ width: `${Math.min(100, impersonationCount * 20)}%` }}
                  />
                </div>
              </div>
              <div className="text-center p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                <p className="text-lg font-bold text-yellow-300">{exposureCount}</p>
                <p className="text-xs text-yellow-400">Exposures</p>
                <div className="w-full bg-slate-700 h-1 mt-2 rounded">
                  <div 
                    className="bg-yellow-500 h-1 rounded" 
                    style={{ width: `${Math.min(100, exposureCount * 10)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Threat Classification */}
          {analysisResult && (
            <div className="text-center p-4 rounded-lg bg-slate-800/50 border border-purple-500/30 min-w-[180px]">
              <Shield className={`w-8 h-8 ${risk.color} mx-auto mb-2`} />
              <p className="text-xs text-purple-400 mb-1">Primary Threat Vector</p>
              <p className="text-sm font-semibold text-white">
                {analysisResult.primary_threat_vector || 'Data Exposure'}
              </p>
              {analysisResult.threat_classification && (
                <Badge className="mt-2 bg-purple-600/30 text-purple-200">
                  {analysisResult.threat_classification}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Vulnerable Data Types */}
        {analysisResult?.vulnerable_data_types?.length > 0 && (
          <div className="mt-4 pt-4 border-t border-purple-500/20">
            <p className="text-xs text-purple-400 mb-2">Most Vulnerable Data Types:</p>
            <div className="flex flex-wrap gap-2">
              {analysisResult.vulnerable_data_types.map((type, idx) => (
                <Badge key={idx} className="bg-red-500/20 text-red-300 border border-red-500/40">
                  {type}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}