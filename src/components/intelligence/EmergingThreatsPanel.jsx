import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, Shield, AlertTriangle, Target, ArrowUpRight } from 'lucide-react';

export default function EmergingThreatsPanel({ analysisResult, personalData }) {
  const emergingThreats = analysisResult?.emerging_threats || [];
  const predictedExposure = analysisResult?.predicted_next_exposure;
  const attackSurface = analysisResult?.attack_surface_analysis;

  const getLikelihoodColor = (likelihood) => {
    switch (likelihood?.toLowerCase()) {
      case 'high': return 'bg-red-500/20 text-red-300 border-red-500/40';
      case 'medium': return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
      case 'low': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
      default: return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
    }
  };

  const getAttackIcon = (method) => {
    if (method?.toLowerCase().includes('phishing')) return '🎣';
    if (method?.toLowerCase().includes('identity')) return '🆔';
    if (method?.toLowerCase().includes('social')) return '🗣️';
    if (method?.toLowerCase().includes('fraud')) return '💳';
    return '⚠️';
  };

  // Default threats based on available data if no analysis
  const defaultThreats = personalData.length > 0 ? [
    {
      threat_name: 'Credential Stuffing Attack',
      likelihood: 'Medium',
      description: 'Attackers may attempt to use leaked credentials on other services',
      target_data: ['email', 'username'],
      attack_method: 'Automated login attempts using breached passwords',
      prevention_steps: ['Enable 2FA on all accounts', 'Use unique passwords', 'Monitor for unauthorized logins']
    },
    {
      threat_name: 'Targeted Phishing',
      likelihood: 'High',
      description: 'Personalized phishing using your exposed personal information',
      target_data: ['full_name', 'email', 'employer'],
      attack_method: 'Spear phishing emails referencing your real details',
      prevention_steps: ['Verify sender identity', 'Don\'t click suspicious links', 'Report phishing attempts']
    }
  ] : [];

  const threats = emergingThreats.length > 0 ? emergingThreats : defaultThreats;

  return (
    <div className="space-y-6">
      {/* Attack Surface Analysis */}
      {attackSurface && (
        <Card className="glass-card border-purple-500/30">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-400" />
              Attack Surface Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-purple-300">{attackSurface}</p>
          </CardContent>
        </Card>
      )}

      {/* Predicted Next Exposure */}
      {predictedExposure && (
        <Card className="glass-card border-amber-500/30">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-amber-400" />
              Predicted Next Exposure
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-200">{predictedExposure}</p>
          </CardContent>
        </Card>
      )}

      {/* Emerging Threats */}
      <Card className="glass-card border-red-500/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-red-400" />
            Emerging Threat Vectors
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {threats.length > 0 ? (
            threats.map((threat, idx) => (
              <div 
                key={idx}
                className="p-4 rounded-lg bg-slate-800/50 border border-red-500/20"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{getAttackIcon(threat.attack_method)}</span>
                    <p className="font-semibold text-white">{threat.threat_name}</p>
                  </div>
                  <Badge className={getLikelihoodColor(threat.likelihood)}>
                    {threat.likelihood} Likelihood
                  </Badge>
                </div>

                <p className="text-sm text-purple-300 mb-3">{threat.description}</p>

                {/* Target Data */}
                <div className="mb-3">
                  <p className="text-xs text-gray-400 mb-1">Target Data:</p>
                  <div className="flex flex-wrap gap-1">
                    {threat.target_data?.map((data, i) => (
                      <Badge key={i} className="text-xs bg-red-500/20 text-red-300 border border-red-500/40">
                        {data}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Attack Method */}
                <div className="mb-3 p-2 rounded bg-slate-900/50">
                  <p className="text-xs text-gray-400 mb-1">Attack Method:</p>
                  <p className="text-xs text-white">{threat.attack_method}</p>
                </div>

                {/* Prevention Steps */}
                <div className="p-3 rounded bg-green-500/10 border border-green-500/30">
                  <p className="text-xs text-green-300 font-semibold mb-2 flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    Prevention Steps
                  </p>
                  <ul className="space-y-1">
                    {threat.prevention_steps?.map((step, i) => (
                      <li key={i} className="text-xs text-gray-300 flex gap-2">
                        <span className="text-green-400">✓</span>
                        {step}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <Zap className="w-12 h-12 text-red-500 mx-auto mb-3 opacity-50" />
              <p className="text-purple-300">No emerging threats analyzed</p>
              <p className="text-sm text-purple-400">Run threat analysis to identify future risks</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}