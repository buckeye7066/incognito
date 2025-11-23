import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import InsightCard from '../components/ai/InsightCard';
import ReportPreview from '../components/ai/ReportPreview';
import { Brain, Sparkles, FileText, Loader2, AlertTriangle, TrendingUp, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AIInsights() {
  const queryClient = useQueryClient();
  const [analyzing, setAnalyzing] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState(null);

  const activeProfileId = typeof window !== 'undefined' ? window.activeProfileId : null;

  const { data: allInsights = [] } = useQuery({
    queryKey: ['aiInsights'],
    queryFn: () => base44.entities.AIInsight.list()
  });

  const { data: allReports = [] } = useQuery({
    queryKey: ['digitalFootprintReports'],
    queryFn: () => base44.entities.DigitalFootprintReport.list()
  });

  const { data: allScanResults = [] } = useQuery({
    queryKey: ['scanResults'],
    queryFn: () => base44.entities.ScanResult.list()
  });

  const { data: allPersonalData = [] } = useQuery({
    queryKey: ['personalData'],
    queryFn: () => base44.entities.PersonalData.list()
  });

  const insights = allInsights.filter(i => !activeProfileId || i.profile_id === activeProfileId);
  const reports = allReports.filter(r => !activeProfileId || r.profile_id === activeProfileId);
  const scanResults = allScanResults.filter(r => !activeProfileId || r.profile_id === activeProfileId);
  const personalData = allPersonalData.filter(d => !activeProfileId || d.profile_id === activeProfileId);

  const latestReport = reports.sort((a, b) => new Date(b.report_date) - new Date(a.report_date))[0];

  const createInsightMutation = useMutation({
    mutationFn: (data) => base44.entities.AIInsight.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['aiInsights']);
    }
  });

  const createReportMutation = useMutation({
    mutationFn: (data) => base44.entities.DigitalFootprintReport.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['digitalFootprintReports']);
    }
  });

  const runAIAnalysis = async () => {
    if (!activeProfileId) {
      alert('Please select a profile first');
      return;
    }

    setAnalyzing(true);

    try {
      // 1. Pattern Analysis
      const patternAnalysis = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an expert cybersecurity analyst. Analyze the following data exposure patterns:

Scan Results: ${JSON.stringify(scanResults.map(r => ({
  source: r.source_name,
  type: r.source_type,
  risk_score: r.risk_score,
  data_exposed: r.data_exposed,
  scan_date: r.scan_date
})))}

Identify:
1. Common patterns across exposures (e.g., same breach affecting multiple identifiers)
2. Temporal patterns (clustering of breaches)
3. High-risk source types
4. Correlation between data types and exposure frequency

Provide actionable insights with specific recommendations.`,
        response_json_schema: {
          type: 'object',
          properties: {
            patterns: { type: 'array', items: { type: 'string' } },
            insights: { type: 'array', items: { type: 'string' } },
            recommendations: { type: 'array', items: { type: 'string' } },
            confidence: { type: 'number' }
          }
        }
      });

      if (patternAnalysis.insights && patternAnalysis.insights.length > 0) {
        for (const insight of patternAnalysis.insights.slice(0, 2)) {
          await createInsightMutation.mutateAsync({
            profile_id: activeProfileId,
            insight_type: 'pattern_analysis',
            title: 'Pattern Detected in Data Exposures',
            description: insight,
            severity: 'medium',
            recommendations: patternAnalysis.recommendations || [],
            confidence_score: patternAnalysis.confidence || 85,
            data_points: scanResults.map(r => r.id)
          });
        }
      }

      // 2. Risk Predictions
      const riskPrediction = await base44.integrations.Core.InvokeLLM({
        prompt: `Based on the following current exposures and data types, predict potential future risks:

Current Exposures: ${scanResults.length}
High Risk Exposures: ${scanResults.filter(r => r.risk_score >= 70).length}
Data Types Monitored: ${[...new Set(personalData.map(d => d.data_type))].join(', ')}
Recent Trends: ${JSON.stringify(scanResults.slice(0, 5).map(r => ({ source: r.source_name, risk: r.risk_score })))}

Predict:
1. Likelihood of future breaches affecting monitored identifiers
2. Emerging threats based on current exposure patterns
3. Data types most at risk in the next 3-6 months
4. Preventive measures to implement now`,
        response_json_schema: {
          type: 'object',
          properties: {
            predictions: { type: 'array', items: { type: 'string' } },
            emerging_threats: { type: 'array', items: { type: 'string' } },
            preventive_measures: { type: 'array', items: { type: 'string' } },
            confidence: { type: 'number' }
          }
        }
      });

      if (riskPrediction.predictions && riskPrediction.predictions.length > 0) {
        await createInsightMutation.mutateAsync({
          profile_id: activeProfileId,
          insight_type: 'risk_prediction',
          title: 'Future Risk Prediction',
          description: riskPrediction.predictions[0],
          severity: 'high',
          recommendations: riskPrediction.preventive_measures || [],
          confidence_score: riskPrediction.confidence || 75,
          metadata: {
            emerging_threats: riskPrediction.emerging_threats
          }
        });
      }

      // 3. Mitigation Strategies
      const highRiskResults = scanResults.filter(r => r.risk_score >= 70);
      if (highRiskResults.length > 0) {
        const mitigationStrategy = await base44.integrations.Core.InvokeLLM({
          prompt: `Provide advanced mitigation strategies for these high-risk exposures:

${JSON.stringify(highRiskResults.map(r => ({
  source: r.source_name,
  risk_score: r.risk_score,
  data_exposed: r.data_exposed
})))}

Go beyond simple deletion. Include:
1. Immediate actions (deletion, password changes, 2FA)
2. Medium-term strategies (monitoring, alerts, legal action)
3. Long-term preventive measures (identity protection services, behavior changes)
4. Alternative approaches if deletion is not possible`,
          response_json_schema: {
            type: 'object',
            properties: {
              immediate_actions: { type: 'array', items: { type: 'string' } },
              medium_term: { type: 'array', items: { type: 'string' } },
              long_term: { type: 'array', items: { type: 'string' } },
              alternatives: { type: 'array', items: { type: 'string' } }
            }
          }
        });

        await createInsightMutation.mutateAsync({
          profile_id: activeProfileId,
          insight_type: 'mitigation_strategy',
          title: 'Advanced Risk Mitigation Plan',
          description: 'Comprehensive strategy to address high-risk exposures beyond standard deletion',
          severity: 'critical',
          recommendations: [
            ...(mitigationStrategy.immediate_actions || []),
            ...(mitigationStrategy.medium_term || []),
            ...(mitigationStrategy.long_term || [])
          ],
          confidence_score: 90,
          metadata: {
            alternatives: mitigationStrategy.alternatives
          }
        });
      }

    } catch (error) {
      console.error('AI Analysis error:', error);
    }

    setAnalyzing(false);
  };

  const generateReport = async () => {
    if (!activeProfileId) {
      alert('Please select a profile first');
      return;
    }

    setGeneratingReport(true);

    try {
      const avgRiskScore = scanResults.length > 0
        ? Math.round(scanResults.reduce((sum, r) => sum + (r.risk_score || 0), 0) / scanResults.length)
        : 0;

      // Determine risk trend (simplified - compare with previous data)
      const recentScans = scanResults.filter(r => 
        new Date(r.scan_date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      );
      const recentAvg = recentScans.length > 0
        ? recentScans.reduce((sum, r) => sum + r.risk_score, 0) / recentScans.length
        : avgRiskScore;
      
      const riskTrend = recentAvg < avgRiskScore - 5 ? 'improving' : 
                       recentAvg > avgRiskScore + 5 ? 'worsening' : 'stable';

      // Generate comprehensive report with AI
      const reportData = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a comprehensive Digital Footprint Report for this profile:

PROFILE STATISTICS:
- Total Identifiers Monitored: ${personalData.length}
- Total Exposures Found: ${scanResults.length}
- High Risk Exposures: ${scanResults.filter(r => r.risk_score >= 70).length}
- Average Risk Score: ${avgRiskScore}
- Risk Trend: ${riskTrend}
- Dark Web Breaches: ${scanResults.filter(r => r.metadata?.scan_type === 'dark_web').length}

EXPOSURE BREAKDOWN:
${JSON.stringify(scanResults.reduce((acc, r) => {
  acc[r.source_type] = (acc[r.source_type] || 0) + 1;
  return acc;
}, {}))}

DATA TYPES EXPOSED:
${JSON.stringify([...new Set(scanResults.flatMap(r => r.data_exposed || []))])}

RECENT AI INSIGHTS:
${insights.slice(0, 3).map(i => i.description).join('\n')}

Generate a professional report including:
1. Executive summary (2-3 sentences)
2. Key findings (3-5 bullet points)
3. High priority actions (3-5 specific actions)
4. Predictions for next 90 days (2-3 predictions)
5. Comprehensive recommendations (5-7 actionable items)

Be specific, actionable, and professional.`,
        response_json_schema: {
          type: 'object',
          properties: {
            executive_summary: { type: 'string' },
            key_findings: { type: 'array', items: { type: 'string' } },
            high_priority_actions: { type: 'array', items: { type: 'string' } },
            predictions: { type: 'array', items: { 
              type: 'object',
              properties: {
                prediction: { type: 'string' },
                likelihood: { type: 'string' },
                timeframe: { type: 'string' }
              }
            }},
            recommendations: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      const exposureBreakdown = scanResults.reduce((acc, r) => {
        acc[r.source_type] = (acc[r.source_type] || 0) + 1;
        return acc;
      }, {});

      const progressMetrics = {
        total_scans: scanResults.length,
        identifiers_monitored: personalData.length,
        exposures_removed: scanResults.filter(r => r.status === 'removed').length,
        high_risk_count: scanResults.filter(r => r.risk_score >= 70).length,
        dark_web_breaches: scanResults.filter(r => r.metadata?.scan_type === 'dark_web').length
      };

      await createReportMutation.mutateAsync({
        profile_id: activeProfileId,
        report_date: new Date().toISOString().split('T')[0],
        overall_risk_score: avgRiskScore,
        risk_trend: riskTrend,
        executive_summary: reportData.executive_summary,
        key_findings: reportData.key_findings,
        exposure_breakdown: exposureBreakdown,
        high_priority_actions: reportData.high_priority_actions,
        predictions: reportData.predictions,
        progress_metrics: progressMetrics,
        recommendations: reportData.recommendations
      });

    } catch (error) {
      console.error('Report generation error:', error);
    }

    setGeneratingReport(false);
  };

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <Brain className="w-10 h-10 text-purple-400" />
            AI Insights & Intelligence
          </h1>
          <p className="text-purple-300">AI-powered analysis and actionable recommendations</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={runAIAnalysis}
            disabled={analyzing || !activeProfileId}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Run AI Analysis
              </>
            )}
          </Button>
          <Button
            onClick={generateReport}
            disabled={generatingReport || !activeProfileId}
            variant="outline"
            className="border-purple-500/50 text-purple-300"
          >
            {generatingReport ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="w-5 h-5 mr-2" />
                Generate Report
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Latest Report */}
      {latestReport && (
        <ReportPreview 
          report={latestReport}
          onDownload={() => alert('PDF download feature coming soon!')}
        />
      )}

      {/* Insights Tabs */}
      <Tabs defaultValue="all" className="space-y-6">
        <TabsList className="bg-slate-900/50">
          <TabsTrigger value="all">All Insights ({insights.length})</TabsTrigger>
          <TabsTrigger value="patterns">
            Patterns ({insights.filter(i => i.insight_type === 'pattern_analysis').length})
          </TabsTrigger>
          <TabsTrigger value="predictions">
            Predictions ({insights.filter(i => i.insight_type === 'risk_prediction').length})
          </TabsTrigger>
          <TabsTrigger value="strategies">
            Strategies ({insights.filter(i => i.insight_type === 'mitigation_strategy').length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <AnimatePresence mode="popLayout">
            {insights.length > 0 ? (
              insights
                .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
                .map((insight) => (
                  <InsightCard
                    key={insight.id}
                    insight={insight}
                    onClick={() => setSelectedInsight(insight)}
                  />
                ))
            ) : (
              <Card className="glass-card border-purple-500/20">
                <CardContent className="p-16 text-center">
                  <Brain className="w-16 h-16 text-purple-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">No AI Insights Yet</h3>
                  <p className="text-purple-300 mb-4">
                    Run AI analysis to generate intelligent insights about your digital footprint
                  </p>
                  <Button
                    onClick={runAIAnalysis}
                    disabled={analyzing}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600"
                  >
                    <Sparkles className="w-5 h-5 mr-2" />
                    Run First Analysis
                  </Button>
                </CardContent>
              </Card>
            )}
          </AnimatePresence>
        </TabsContent>

        <TabsContent value="patterns" className="space-y-4">
          {insights.filter(i => i.insight_type === 'pattern_analysis').map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              onClick={() => setSelectedInsight(insight)}
            />
          ))}
        </TabsContent>

        <TabsContent value="predictions" className="space-y-4">
          {insights.filter(i => i.insight_type === 'risk_prediction').map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              onClick={() => setSelectedInsight(insight)}
            />
          ))}
        </TabsContent>

        <TabsContent value="strategies" className="space-y-4">
          {insights.filter(i => i.insight_type === 'mitigation_strategy').map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              onClick={() => setSelectedInsight(insight)}
            />
          ))}
        </TabsContent>
      </Tabs>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card border-purple-500/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <Brain className="w-8 h-8 text-purple-400 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-white mb-1">Pattern Analysis</h3>
                <p className="text-sm text-purple-300">
                  AI identifies common patterns across your exposures to reveal systemic vulnerabilities
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-purple-500/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-8 h-8 text-amber-400 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-white mb-1">Risk Predictions</h3>
                <p className="text-sm text-purple-300">
                  Predictive analytics forecast future exposures based on current trends and behaviors
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-purple-500/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-8 h-8 text-green-400 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-white mb-1">Smart Strategies</h3>
                <p className="text-sm text-purple-300">
                  Advanced mitigation strategies go beyond deletion with comprehensive action plans
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}