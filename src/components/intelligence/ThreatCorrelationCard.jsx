import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link2, AlertTriangle, ArrowRight, Database, Users, Eye } from 'lucide-react';

export default function ThreatCorrelationCard({
  analysisResult,
  scanResults,
  socialFindings,
  searchFindings
}) {
  // Build automatic correlations if no analysis result
  const buildAutoCorrelations = () => {
    const correlations = [];

    // Check for same data appearing in multiple places
    const exposedEmails = new Set();
    const exposedPhones = new Set();
    const exposedAddresses = new Set();

    scanResults.forEach(r => {
      r.data_exposed?.forEach(d => {
        if (d.includes('email')) exposedEmails.add(r.source_name);
        if (d.includes('phone')) exposedPhones.add(r.source_name);
        if (d.includes('address')) exposedAddresses.add(r.source_name);
      });
    });

    searchFindings.forEach(f => {
      f.matched_data_types?.forEach(d => {
        if (d.includes('email')) exposedEmails.add(f.search_platform);
        if (d.includes('phone')) exposedPhones.add(f.search_platform);
        if (d.includes('address')) exposedAddresses.add(f.search_platform);
      });
    });

    if (exposedEmails.size > 1) {
      correlations.push({
        correlation_type: 'Multi-Source Email Exposure',
        description: `Your email appears on ${exposedEmails.size} different sources`,
        connected_findings: Array.from(exposedEmails),
        risk_multiplier: 1.5,
        evidence: 'Same email identifier found across multiple data brokers and breach databases'
      });
    }

    if (exposedAddresses.size > 1) {
      correlations.push({
        correlation_type: 'Address Propagation',
        description: `Your address is exposed on ${exposedAddresses.size} sources`,
        connected_findings: Array.from(exposedAddresses),
        risk_multiplier: 1.3,
        evidence: 'Physical address data has spread across data broker network'
      });
    }

    // Check for impersonation + breach correlation
    if (socialFindings.length > 0 && scanResults.length > 0) {
      correlations.push({
        correlation_type: 'Breach-to-Impersonation Risk',
        description: 'Data from breaches may be fueling impersonation attempts',
        connected_findings: ['Breach Data', 'Active Impersonation'],
        risk_multiplier: 2.0,
        evidence: 'Impersonators often use leaked data to create convincing fake profiles'
      });
    }

    return correlations;
  };

  const correlations = analysisResult?.correlations?.length > 0 
    ? analysisResult.correlations 
    : buildAutoCorrelations();

  const coordinatedThreats = analysisResult?.coordinated_threats || [];

  const getCorrelationIcon = (type) => {
    if (type.toLowerCase().includes('breach')) return <Database className="w-4 h-4" />;
    if (type.toLowerCase().includes('impersonation')) return <Users className="w-4 h-4" />;
    return <Eye className="w-4 h-4" />;
  };

  const getRiskColor = (multiplier) => {
    if (multiplier >= 2) return 'bg-red-500/20 text-red-300 border-red-500/40';
    if (multiplier >= 1.5) return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
    return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
  };

  return (
    <div className="space-y-6">
      {/* Correlation Cards */}
      <Card className="glass-card border-purple-500/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Link2 className="w-5 h-5 text-purple-400" />
            Threat Correlations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {correlations.length > 0 ? (
            correlations.map((correlation, idx) => (
              <div 
                key={idx}
                className="p-4 rounded-lg bg-slate-800/50 border border-purple-500/20"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {getCorrelationIcon(correlation.correlation_type)}
                    <p className="font-semibold text-white">{correlation.correlation_type}</p>
                  </div>
                  <Badge className={getRiskColor(correlation.risk_multiplier)}>
                    {correlation.risk_multiplier}x Risk
                  </Badge>
                </div>
                
                <p className="text-sm text-purple-300 mb-3">{correlation.description}</p>
                
                {/* Connected Findings */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {correlation.connected_findings?.map((finding, i) => (
                    <React.Fragment key={i}>
                      <Badge variant="outline" className="text-xs bg-slate-700/50 text-gray-300">
                        {finding}
                      </Badge>
                      {i < correlation.connected_findings.length - 1 && (
                        <ArrowRight className="w-3 h-3 text-purple-400" />
                      )}
                    </React.Fragment>
                  ))}
                </div>

                <p className="text-xs text-gray-400 bg-slate-900/50 p-2 rounded">
                  <strong>Evidence:</strong> {correlation.evidence}
                </p>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <Link2 className="w-12 h-12 text-purple-500 mx-auto mb-3 opacity-50" />
              <p className="text-purple-300">No correlations detected</p>
              <p className="text-sm text-purple-400">Run threat analysis to find connections</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Coordinated Threats */}
      {coordinatedThreats.length > 0 && (
        <Card className="glass-card border-red-500/30">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Coordinated Threats Detected
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {coordinatedThreats.map((threat, idx) => (
              <div 
                key={idx}
                className="p-4 rounded-lg bg-red-500/10 border border-red-500/30"
              >
                <div className="flex items-start justify-between mb-2">
                  <p className="font-semibold text-red-300">{threat.threat_name}</p>
                  <Badge className="bg-red-600/30 text-red-200">
                    {threat.severity?.toUpperCase()}
                  </Badge>
                </div>
                
                <div className="flex flex-wrap gap-2 mb-2">
                  {threat.platforms_involved?.map((platform, i) => (
                    <Badge key={i} variant="outline" className="text-xs text-red-300 border-red-500/40">
                      {platform}
                    </Badge>
                  ))}
                </div>
                
                <p className="text-xs text-gray-300">{threat.evidence_of_coordination}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Data Broker Chain */}
      {analysisResult?.data_broker_chain?.length > 0 && (
        <Card className="glass-card border-yellow-500/30">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-yellow-400" />
              Data Broker Chain
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-yellow-300 mb-3">
              How your data propagates through the data broker ecosystem:
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {analysisResult.data_broker_chain.map((broker, idx) => (
                <React.Fragment key={idx}>
                  <Badge className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">
                    {broker}
                  </Badge>
                  {idx < analysisResult.data_broker_chain.length - 1 && (
                    <ArrowRight className="w-4 h-4 text-yellow-400" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}