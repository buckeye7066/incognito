import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, MapPin, Eye, CheckCircle, User, Clock, Monitor } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';

const PLATFORM_ICONS = {
  google: '🔍',
  bing: '🔎',
  duckduckgo: '🦆',
  facebook: '📘',
  twitter: '🐦',
  instagram: '📷',
  linkedin: '💼',
  tiktok: '🎵',
  reddit: '🤖',
  other: '🌐'
};

export default function SearchQueryFindings({ profileId }) {
  const queryClient = useQueryClient();
  const [detecting, setDetecting] = useState(false);

  const { data: allFindings = [] } = useQuery({
    queryKey: ['searchQueryFindings'],
    queryFn: () => base44.entities.SearchQueryFinding.list(),
    enabled: !!profileId
  });

  const findings = allFindings.filter(f => f.profile_id === profileId);

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.SearchQueryFinding.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries(['searchQueryFindings']);
    }
  });

  const handleDetectSearches = async () => {
    setDetecting(true);
    try {
      const response = await base44.functions.invoke('detectSearchQueries', { profileId });
      queryClient.invalidateQueries(['searchQueryFindings']);
      queryClient.invalidateQueries(['notificationAlerts']);
      alert(response.data.message);
    } catch (error) {
      alert('Search detection failed: ' + error.message);
    } finally {
      setDetecting(false);
    }
  };

  const getRiskColor = (level) => {
    switch (level) {
      case 'critical': return 'bg-red-500/20 text-red-300 border-red-500/40';
      case 'high': return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
      case 'medium': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
      case 'low': return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      default: return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
    }
  };

  return (
    <Card className="glass-card border-purple-500/30">
      <CardHeader className="border-b border-purple-500/20">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Search className="w-5 h-5 text-purple-400" />
            Search Query Monitor
          </CardTitle>
          <Button
            size="sm"
            onClick={handleDetectSearches}
            disabled={detecting}
            className="bg-gradient-to-r from-purple-600 to-indigo-600"
          >
            {detecting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Detecting...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Check Searches
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
          <div className="flex gap-3">
            <Eye className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-purple-200 font-semibold mb-1">
                Active Search Monitoring
              </p>
              <p className="text-xs text-purple-300">
                AI monitors web and social media for searches related to your personal data, alerting you to potential stalking or unauthorized lookups.
              </p>
            </div>
          </div>
        </div>

        {findings.length > 0 ? (
          <div className="space-y-3">
            {findings.map((finding) => (
              <motion.div
                key={finding.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-lg bg-slate-800/50 border border-purple-500/20"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{PLATFORM_ICONS[finding.search_platform] || '🌐'}</span>
                    <div>
                      <p className="text-sm font-semibold text-white capitalize">
                        {finding.search_platform}
                      </p>
                      <p className="text-xs text-purple-400">
                        {new Date(finding.detected_date).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Badge className={getRiskColor(finding.risk_level)}>
                    {finding.risk_level.toUpperCase()}
                  </Badge>
                </div>

                {/* Who, Where, When Section */}
                <div className="grid grid-cols-3 gap-3 mb-3 p-3 rounded-lg bg-slate-900/50 border border-purple-500/10">
                  <div className="flex items-start gap-2">
                    <User className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-purple-400 mb-0.5">Who</p>
                      <p className="text-sm text-white font-semibold">
                        {finding.searcher_identity || 'Anonymous'}
                      </p>
                      {finding.searcher_ip && finding.searcher_ip !== 'Unknown' && (
                        <p className="text-xs text-purple-300 font-mono">{finding.searcher_ip}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-purple-400 mb-0.5">Where</p>
                      <p className="text-sm text-white font-semibold">
                        {finding.geographic_origin || 'Unknown'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Clock className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-purple-400 mb-0.5">When</p>
                      <p className="text-sm text-white font-semibold">
                        {new Date(finding.detected_date).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-purple-300">
                        {new Date(finding.detected_date).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>

                {finding.device_info && finding.device_info !== 'Unknown' && (
                  <div className="flex items-center gap-2 mb-3 text-xs text-purple-300 bg-slate-900/30 px-3 py-2 rounded">
                    <Monitor className="w-3 h-3" />
                    <span>Device: {finding.device_info}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-purple-400 mb-1">Search Query:</p>
                    <p className="text-sm text-white font-mono bg-slate-900/50 px-3 py-2 rounded">
                      "{finding.query_detected}"
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-purple-400 mb-1">Your Data That Matched:</p>
                    <div className="space-y-1">
                      {finding.matched_data_types?.map((type, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded px-3 py-1.5">
                          <Badge variant="outline" className="text-xs bg-red-500/20 text-red-300 border-red-500/40">
                            {type.replace(/_/g, ' ')}
                          </Badge>
                          {finding.matched_values?.[idx] && (
                            <span className="text-sm text-red-200 font-mono">
                              {finding.matched_values[idx]}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-purple-400 mb-1">AI Analysis:</p>
                    <p className="text-sm text-purple-300">{finding.ai_analysis}</p>
                  </div>

                  {finding.search_context && (
                    <div>
                      <p className="text-xs text-purple-400 mb-1">Context:</p>
                      <p className="text-sm text-purple-300">{finding.search_context}</p>
                    </div>
                  )}

                  {finding.status === 'new' && (
                    <div className="flex gap-2 pt-2 border-t border-purple-500/20">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatusMutation.mutate({ id: finding.id, status: 'reviewed' })}
                        className="border-green-500/50 text-green-300"
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Mark Reviewed
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatusMutation.mutate({ id: finding.id, status: 'dismissed' })}
                        className="border-gray-500/50 text-gray-300"
                      >
                        Dismiss
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Search className="w-12 h-12 text-purple-500 mx-auto mb-3 opacity-50" />
            <p className="text-purple-300 mb-2">No search queries detected</p>
            <p className="text-sm text-purple-400">Click "Check Searches" to start monitoring</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}