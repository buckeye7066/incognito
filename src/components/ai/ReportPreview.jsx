import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ReportPreview({ report, onDownload }) {
  const getTrendIcon = () => {
    switch (report.risk_trend) {
      case 'improving': return <TrendingDown className="w-5 h-5 text-green-400" />;
      case 'worsening': return <TrendingUp className="w-5 h-5 text-red-400" />;
      default: return <Minus className="w-5 h-5 text-amber-400" />;
    }
  };

  const getTrendColor = () => {
    switch (report.risk_trend) {
      case 'improving': return 'text-green-400';
      case 'worsening': return 'text-red-400';
      default: return 'text-amber-400';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <Card className="glass-card border-purple-500/30 glow-border">
        <CardHeader className="border-b border-purple-500/20">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">Latest Digital Footprint Report</CardTitle>
            <Button
              onClick={onDownload}
              size="sm"
              className="bg-gradient-to-r from-purple-600 to-indigo-600"
            >
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Overall Score */}
          <div className="text-center p-6 rounded-xl bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-500/30">
            <p className="text-sm text-purple-300 mb-2">Overall Risk Score</p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-5xl font-bold text-white">{report.overall_risk_score}</span>
              <div className="flex flex-col items-start">
                {getTrendIcon()}
                <span className={`text-sm font-semibold ${getTrendColor()}`}>
                  {report.risk_trend}
                </span>
              </div>
            </div>
          </div>

          {/* Executive Summary */}
          <div>
            <h3 className="text-white font-semibold mb-3">Executive Summary</h3>
            <p className="text-purple-300 text-sm leading-relaxed">
              {report.executive_summary}
            </p>
          </div>

          {/* Key Findings */}
          {report.key_findings && report.key_findings.length > 0 && (
            <div>
              <h3 className="text-white font-semibold mb-3">Key Findings</h3>
              <ul className="space-y-2">
                {report.key_findings.slice(0, 3).map((finding, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-purple-300">
                    <span className="text-purple-400 flex-shrink-0 mt-1">•</span>
                    <span>{finding}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* High Priority Actions */}
          {report.high_priority_actions && report.high_priority_actions.length > 0 && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
              <h3 className="text-red-300 font-semibold mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                High Priority Actions
              </h3>
              <ul className="space-y-2">
                {report.high_priority_actions.slice(0, 3).map((action, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-red-200">
                    <span className="text-red-400 flex-shrink-0 mt-1">→</span>
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-center pt-4 border-t border-purple-500/20">
            <p className="text-xs text-purple-400">
              Report generated on {new Date(report.report_date).toLocaleDateString()}
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}