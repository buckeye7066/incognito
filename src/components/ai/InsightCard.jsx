import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingUp, Shield, Lightbulb, Eye, Brain } from 'lucide-react';
import { motion } from 'framer-motion';

const insightIcons = {
  pattern_analysis: Brain,
  risk_prediction: AlertTriangle,
  mitigation_strategy: Shield,
  trend_alert: TrendingUp,
  exposure_forecast: Eye
};

const severityColors = {
  critical: 'bg-red-500/20 text-red-300 border-red-500/40',
  high: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  medium: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  low: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  info: 'bg-purple-500/20 text-purple-300 border-purple-500/40'
};

export default function InsightCard({ insight, onClick }) {
  const Icon = insightIcons[insight.insight_type] || Lightbulb;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      onClick={onClick}
    >
      <Card className={`glass-card border-purple-500/20 hover:glow-border transition-all duration-300 cursor-pointer ${!insight.is_read ? 'border-l-4 border-l-purple-500' : ''}`}>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <Icon className="w-6 h-6 text-white" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="text-lg font-bold text-white">{insight.title}</h3>
                <Badge className={`${severityColors[insight.severity]} border flex-shrink-0`}>
                  {insight.severity}
                </Badge>
              </div>

              <p className="text-purple-300 text-sm mb-3 line-clamp-2">
                {insight.description}
              </p>

              {insight.confidence_score && (
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-purple-400 mb-1">
                    <span>AI Confidence</span>
                    <span>{insight.confidence_score}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full"
                      style={{ width: `${insight.confidence_score}%` }}
                    />
                  </div>
                </div>
              )}

              {insight.recommendations && insight.recommendations.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-purple-400">Actionable Pathways:</p>
                  <ul className="text-sm text-purple-200 space-y-2">
                    {insight.recommendations.slice(0, 2).map((rec, idx) => {
                      const pathway = insight.metadata?.action_pathways?.[idx];
                      return (
                        <li key={idx} className="space-y-1">
                          <div className="flex items-start gap-2">
                            <span className="text-purple-400 flex-shrink-0">→</span>
                            <span className="font-medium">{rec}</span>
                          </div>
                          {pathway?.pathway && (
                            <div className="ml-5 pl-3 border-l-2 border-purple-500/30 space-y-0.5">
                              {pathway.pathway.slice(0, 2).map((step, i) => (
                                <div key={i} className="text-xs text-purple-300">
                                  {i + 1}. {step}
                                </div>
                              ))}
                            </div>
                          )}
                          {pathway?.steps && (
                            <div className="ml-5 pl-3 border-l-2 border-purple-500/30 space-y-0.5">
                              {pathway.steps.slice(0, 2).map((step, i) => (
                                <div key={i} className="text-xs text-purple-300">
                                  {i + 1}. {step}
                                </div>
                              ))}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-purple-500/20">
                <span className="text-xs text-purple-400">
                  {insight.insight_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </span>
                <span className="text-xs text-purple-400">
                  {new Date(insight.created_date).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}