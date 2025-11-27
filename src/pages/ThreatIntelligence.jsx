import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  Shield, Brain, AlertTriangle, TrendingUp, RefreshCw, Loader2,
  Target, Link2, Eye, Users, Database, Zap
} from 'lucide-react';
import ThreatCorrelationCard from '../components/intelligence/ThreatCorrelationCard';
import ConsolidatedRiskScore from '../components/intelligence/ConsolidatedRiskScore';
import EmergingThreatsPanel from '../components/intelligence/EmergingThreatsPanel';
import ThreatTimelineChart from '../components/intelligence/ThreatTimelineChart';

export default function ThreatIntelligence() {
  const queryClient = useQueryClient();
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  const activeProfileId = typeof window !== 'undefined' ? window.activeProfileId : null;

  // Fetch all relevant data for correlation
  const { data: scanResults = [] } = useQuery({
    queryKey: ['scanResults'],
    queryFn: () => base44.entities.ScanResult.list()
  });

  const { data: socialFindings = [] } = useQuery({
    queryKey: ['socialMediaFindings'],
    queryFn: () => base44.entities.SocialMediaFinding.list()
  });

  const { data: searchFindings = [] } = useQuery({
    queryKey: ['searchQueryFindings'],
    queryFn: () => base44.entities.SearchQueryFinding.list()
  });

  const { data: mentions = [] } = useQuery({
    queryKey: ['socialMediaMentions'],
    queryFn: () => base44.entities.SocialMediaMention.list()
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['notificationAlerts'],
    queryFn: () => base44.entities.NotificationAlert.list()
  });

  const { data: personalData = [] } = useQuery({
    queryKey: ['personalData'],
    queryFn: () => base44.entities.PersonalData.list()
  });

  // Filter by profile
  const profileScanResults = scanResults.filter(r => !activeProfileId || r.profile_id === activeProfileId);
  const profileSocialFindings = socialFindings.filter(f => !activeProfileId || f.profile_id === activeProfileId);
  const profileSearchFindings = searchFindings.filter(f => !activeProfileId || f.profile_id === activeProfileId);
  const profileMentions = mentions.filter(m => !activeProfileId || m.profile_id === activeProfileId);
  const profileAlerts = alerts.filter(a => !activeProfileId || a.profile_id === activeProfileId);
  const profilePersonalData = personalData.filter(d => !activeProfileId || d.profile_id === activeProfileId);

  // Calculate consolidated metrics
  const totalFindings = profileScanResults.length + profileSocialFindings.length + profileSearchFindings.length;
  const criticalFindings = [
    ...profileScanResults.filter(r => r.risk_score >= 80),
    ...profileSocialFindings.filter(f => f.severity === 'critical'),
    ...profileSearchFindings.filter(f => f.risk_level === 'critical')
  ].length;
  const highFindings = [
    ...profileScanResults.filter(r => r.risk_score >= 60 && r.risk_score < 80),
    ...profileSocialFindings.filter(f => f.severity === 'high'),
    ...profileSearchFindings.filter(f => f.risk_level === 'high')
  ].length;

  // Calculate consolidated risk score
  const calculateOverallRisk = () => {
    if (totalFindings === 0) return 0;
    
    let score = 0;
    // Breach/leak weight
    profileScanResults.forEach(r => score += r.risk_score * 0.4);
    // Impersonation weight (higher because active threat)
    profileSocialFindings.forEach(f => {
      const sev = { critical: 100, high: 80, medium: 50, low: 20 }[f.severity] || 30;
      score += sev * 0.35;
    });
    // Public exposure weight
    profileSearchFindings.forEach(f => {
      const risk = { critical: 90, high: 70, medium: 40, low: 15 }[f.risk_level] || 25;
      score += risk * 0.25;
    });
    
    return Math.min(100, Math.round(score / Math.max(totalFindings, 1)));
  };

  const overallRisk = calculateOverallRisk();

  // Run comprehensive threat analysis
  const runThreatAnalysis = async () => {
    setAnalyzing(true);
    try {
      const prompt = `IMPORTANT:
Never fabricate breach data, impersonation findings, personal records, or any PII that was not explicitly found in the provided data. If unsure, state uncertainty clearly. Never guess. Never invent people, platforms, or profiles. Only analyze the actual data provided.

You are INCÓGNITO Threat Intelligence, a professional-grade security analyst. Analyze this user's complete threat landscape and provide actionable intelligence.

=== USER'S PROTECTED DATA ===
${profilePersonalData.map(d => `${d.data_type}: "${d.value}"`).join('\n')}

=== DATA BREACHES & LEAKS (${profileScanResults.length} total) ===
${profileScanResults.slice(0, 10).map(r => `- ${r.source_name}: Risk ${r.risk_score}/100, Data: ${r.data_exposed?.join(', ')}`).join('\n') || 'None'}

=== IMPERSONATION THREATS (${profileSocialFindings.length} total) ===
${profileSocialFindings.slice(0, 10).map(f => `- ${f.platform} @${f.suspicious_username}: ${f.severity} severity, Type: ${f.finding_type}`).join('\n') || 'None'}

=== PUBLIC DATA EXPOSURES (${profileSearchFindings.length} total) ===
${profileSearchFindings.slice(0, 10).map(f => `- ${f.search_platform}: ${f.risk_level} risk, Data: ${f.matched_data_types?.join(', ')}`).join('\n') || 'None'}

=== SOCIAL MEDIA MENTIONS (${profileMentions.length} total) ===
${profileMentions.slice(0, 5).map(m => `- ${m.platform}: ${m.privacy_risk_level} risk, Sentiment: ${m.sentiment}`).join('\n') || 'None'}

=== ANALYSIS REQUIREMENTS ===

1. THREAT CORRELATION ANALYSIS
Identify connections between findings:
- Are multiple exposures from the same source?
- Is there evidence of coordinated attacks?
- Are impersonators using leaked data?
- Pattern recognition across platforms

2. CONSOLIDATED RISK ASSESSMENT
Provide:
- Overall threat level (0-100)
- Primary threat vector
- Most vulnerable data types
- Attack surface analysis

3. EMERGING THREAT VECTORS
Based on current exposures, predict:
- Future attack likelihood
- Likely attack methods (phishing, identity theft, social engineering)
- Platforms most at risk
- Data most likely to be exploited next

4. COORDINATED THREAT DETECTION
Look for:
- Same data appearing in multiple places
- Timeline correlations
- Cross-platform impersonation patterns
- Data broker chain analysis

5. ACTIONABLE RECOMMENDATIONS
Priority-ordered actions:
- Immediate (do now)
- Short-term (this week)
- Long-term (ongoing protection)

Return structured JSON with all analysis.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            overall_threat_level: { type: "number" },
            threat_classification: { type: "string" },
            executive_summary: { type: "string" },
            correlations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  correlation_type: { type: "string" },
                  description: { type: "string" },
                  connected_findings: { type: "array", items: { type: "string" } },
                  risk_multiplier: { type: "number" },
                  evidence: { type: "string" }
                }
              }
            },
            primary_threat_vector: { type: "string" },
            vulnerable_data_types: { type: "array", items: { type: "string" } },
            attack_surface_analysis: { type: "string" },
            emerging_threats: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  threat_name: { type: "string" },
                  likelihood: { type: "string" },
                  description: { type: "string" },
                  target_data: { type: "array", items: { type: "string" } },
                  attack_method: { type: "string" },
                  prevention_steps: { type: "array", items: { type: "string" } }
                }
              }
            },
            coordinated_threats: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  threat_name: { type: "string" },
                  platforms_involved: { type: "array", items: { type: "string" } },
                  evidence_of_coordination: { type: "string" },
                  severity: { type: "string" }
                }
              }
            },
            recommendations: {
              type: "object",
              properties: {
                immediate: { type: "array", items: { type: "string" } },
                short_term: { type: "array", items: { type: "string" } },
                long_term: { type: "array", items: { type: "string" } }
              }
            },
            data_broker_chain: { type: "array", items: { type: "string" } },
            predicted_next_exposure: { type: "string" }
          }
        }
      });

      setAnalysisResult(result);

      // Create AI insight record
      await base44.entities.AIInsight.create({
        profile_id: activeProfileId,
        insight_type: 'pattern_analysis',
        title: 'Threat Intelligence Analysis',
        description: result.executive_summary,
        severity: result.overall_threat_level >= 70 ? 'high' : result.overall_threat_level >= 40 ? 'medium' : 'low',
        recommendations: result.recommendations?.immediate || [],
        confidence_score: 85,
        is_read: false,
        metadata: {
          correlations: result.correlations,
          emerging_threats: result.emerging_threats
        }
      });

      queryClient.invalidateQueries(['aiInsights']);

    } catch (error) {
      alert('Threat analysis failed: ' + error.message);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <Shield className="w-10 h-10 text-red-500" />
            Threat Intelligence
          </h1>
          <p className="text-purple-300">Advanced correlation analysis and emerging threat detection</p>
        </div>
        <Button
          onClick={runThreatAnalysis}
          disabled={analyzing}
          className="bg-gradient-to-r from-red-600 to-purple-600 hover:from-red-700 hover:to-purple-700"
        >
          {analyzing ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Analyzing Threats...
            </>
          ) : (
            <>
              <Brain className="w-5 h-5 mr-2" />
              Run Threat Analysis
            </>
          )}
        </Button>
      </div>

      {/* Consolidated Risk Score */}
      <ConsolidatedRiskScore
        overallRisk={overallRisk}
        totalFindings={totalFindings}
        criticalFindings={criticalFindings}
        highFindings={highFindings}
        breachCount={profileScanResults.length}
        impersonationCount={profileSocialFindings.length}
        exposureCount={profileSearchFindings.length}
        analysisResult={analysisResult}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card border-red-500/30">
          <CardContent className="p-4 text-center">
            <Database className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{profileScanResults.length}</p>
            <p className="text-xs text-red-300">Data Breaches</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-orange-500/30">
          <CardContent className="p-4 text-center">
            <Users className="w-8 h-8 text-orange-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{profileSocialFindings.length}</p>
            <p className="text-xs text-orange-300">Impersonations</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-yellow-500/30">
          <CardContent className="p-4 text-center">
            <Eye className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{profileSearchFindings.length}</p>
            <p className="text-xs text-yellow-300">Public Exposures</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-purple-500/30">
          <CardContent className="p-4 text-center">
            <AlertTriangle className="w-8 h-8 text-purple-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{criticalFindings + highFindings}</p>
            <p className="text-xs text-purple-300">High Priority</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Analysis Tabs */}
      <Tabs defaultValue="correlations" className="space-y-6">
        <TabsList className="bg-slate-900/50 border border-purple-500/20">
          <TabsTrigger value="correlations" className="data-[state=active]:bg-purple-600">
            <Link2 className="w-4 h-4 mr-2" />
            Correlations
          </TabsTrigger>
          <TabsTrigger value="emerging" className="data-[state=active]:bg-purple-600">
            <Zap className="w-4 h-4 mr-2" />
            Emerging Threats
          </TabsTrigger>
          <TabsTrigger value="timeline" className="data-[state=active]:bg-purple-600">
            <TrendingUp className="w-4 h-4 mr-2" />
            Threat Timeline
          </TabsTrigger>
        </TabsList>

        <TabsContent value="correlations">
          <ThreatCorrelationCard
            analysisResult={analysisResult}
            scanResults={profileScanResults}
            socialFindings={profileSocialFindings}
            searchFindings={profileSearchFindings}
          />
        </TabsContent>

        <TabsContent value="emerging">
          <EmergingThreatsPanel
            analysisResult={analysisResult}
            personalData={profilePersonalData}
          />
        </TabsContent>

        <TabsContent value="timeline">
          <ThreatTimelineChart
            scanResults={profileScanResults}
            socialFindings={profileSocialFindings}
            searchFindings={profileSearchFindings}
          />
        </TabsContent>
      </Tabs>

      {/* Recommendations */}
      {analysisResult?.recommendations && (
        <Card className="glass-card border-green-500/30">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-green-400" />
              Actionable Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Immediate */}
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                <p className="text-sm font-semibold text-red-300 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  IMMEDIATE (Do Now)
                </p>
                <ul className="space-y-2">
                  {analysisResult.recommendations.immediate?.map((rec, idx) => (
                    <li key={idx} className="text-xs text-gray-300 flex gap-2">
                      <span className="text-red-400">•</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Short-term */}
              <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                <p className="text-sm font-semibold text-yellow-300 mb-3 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  SHORT-TERM (This Week)
                </p>
                <ul className="space-y-2">
                  {analysisResult.recommendations.short_term?.map((rec, idx) => (
                    <li key={idx} className="text-xs text-gray-300 flex gap-2">
                      <span className="text-yellow-400">•</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Long-term */}
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                <p className="text-sm font-semibold text-green-300 mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  LONG-TERM (Ongoing)
                </p>
                <ul className="space-y-2">
                  {analysisResult.recommendations.long_term?.map((rec, idx) => (
                    <li key={idx} className="text-xs text-gray-300 flex gap-2">
                      <span className="text-green-400">•</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}