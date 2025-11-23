import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Brain, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AIActivityAnalyzer({ profileId, onAnalysisComplete }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [recommendations, setRecommendations] = useState(null);

  const runAnalysis = async () => {
    setAnalyzing(true);
    
    // This would be a backend function call in production
    // Simulating AI analysis for now
    setTimeout(() => {
      setRecommendations({
        high_risk_activities: [
          'Newsletter signups without email alias',
          'Online shopping with primary phone number',
          'Social media registration with real email'
        ],
        recommendations: [
          'Use SimpleLogin for all newsletter signups',
          'Get a Google Voice number for online shopping',
          'Create email aliases for each social platform',
          'Use Burner app for one-time verifications'
        ],
        spam_sources: [
          { activity: 'Newsletter signups', estimated_spam: '40%' },
          { activity: 'Online shopping', estimated_spam: '35%' },
          { activity: 'Contest entries', estimated_spam: '25%' }
        ]
      });
      setAnalyzing(false);
      if (onAnalysisComplete) onAnalysisComplete();
    }, 3000);
  };

  return (
    <Card className="glass-card border-indigo-500/30">
      <CardHeader className="border-b border-indigo-500/20">
        <CardTitle className="text-white flex items-center gap-2">
          <Brain className="w-5 h-5 text-indigo-400" />
          AI Activity Analyzer
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <div className="p-4 rounded-lg bg-indigo-500/10 border border-indigo-500/30">
          <p className="text-sm text-indigo-300">
            AI analyzes your online activities and spam patterns to recommend when to use disposable credentials.
          </p>
        </div>

        {!recommendations && (
          <Button
            onClick={runAnalysis}
            disabled={analyzing}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Analyzing Your Activity Patterns...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Run AI Analysis
              </>
            )}
          </Button>
        )}

        {recommendations && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {/* High Risk Activities */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                High-Risk Activities Detected
              </h4>
              {recommendations.high_risk_activities.map((activity, i) => (
                <div key={i} className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <p className="text-sm text-amber-200">{activity}</p>
                </div>
              ))}
            </div>

            {/* Recommendations */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-green-400" />
                AI Recommendations
              </h4>
              {recommendations.recommendations.map((rec, i) => (
                <div key={i} className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                  <p className="text-sm text-green-200">{rec}</p>
                </div>
              ))}
            </div>

            {/* Spam Sources */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-white">Estimated Spam Sources</h4>
              {recommendations.spam_sources.map((source, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
                  <span className="text-sm text-purple-200">{source.activity}</span>
                  <span className="text-sm font-semibold text-purple-300">{source.estimated_spam}</span>
                </div>
              ))}
            </div>

            <Button
              onClick={runAnalysis}
              variant="outline"
              size="sm"
              className="w-full border-indigo-500/50 text-indigo-300"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Re-analyze
            </Button>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}