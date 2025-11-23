import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Shield, Link2 } from 'lucide-react';

export default function CorrelationRiskCard({ correlations }) {
  if (!correlations || correlations.length === 0) {
    return null;
  }

  const getSeverityColor = (score) => {
    if (score >= 80) return 'bg-red-500/20 text-red-300 border-red-500/40';
    if (score >= 60) return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
    if (score >= 40) return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
  };

  return (
    <Card className="glass-card border-orange-500/30">
      <CardHeader className="border-b border-orange-500/20">
        <CardTitle className="text-white flex items-center gap-2">
          <Link2 className="w-5 h-5 text-orange-400" />
          High-Risk Data Correlations
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-orange-200 font-semibold mb-1">
                Correlated Data Exposure
              </p>
              <p className="text-xs text-orange-300">
                These combinations of exposed data points significantly increase your identity theft risk.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {correlations.slice(0, 5).map((correlation, idx) => (
            <div
              key={idx}
              className="p-4 rounded-lg bg-slate-800/50 border border-purple-500/20"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-red-400" />
                  <span className="text-sm font-semibold text-white">
                    Risk Combination #{idx + 1}
                  </span>
                </div>
                <Badge className={getSeverityColor(correlation.risk_score)}>
                  Risk: {correlation.risk_score}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {correlation.data_types.map((type, i) => (
                  <Badge key={i} variant="outline" className="text-xs text-purple-300">
                    {type.replace(/_/g, ' ').toUpperCase()}
                  </Badge>
                ))}
              </div>

              <p className="text-sm text-purple-300">{correlation.threat}</p>
            </div>
          ))}
        </div>

        {correlations.length > 5 && (
          <p className="text-xs text-purple-400 text-center">
            +{correlations.length - 5} more correlation{correlations.length - 5 !== 1 ? 's' : ''}
          </p>
        )}
      </CardContent>
    </Card>
  );
}