import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Globe, Loader2, Eye, CheckCircle, Trash2 } from 'lucide-react';
import { incognito, resolvePersonalDataValue } from '@/api/client';
import { notify } from '@/lib/notify';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';

const SOURCE_ICONS = {
  spokeo: '🔍',
  beenverified: '🔎',
  whitepages: '📄',
  truepeoplesearch: '👤',
  radaris: '📊',
  zillow: '🏠',
  facebook: '📘',
  twitter: '🐦',
  instagram: '📷',
  linkedin: '💼',
  reddit: '🤖',
  google: '🔍',
  other: '🌐'
};

export default function SearchQueryFindings({ profileId }) {
  const queryClient = useQueryClient();
  const [detecting, setDetecting] = useState(false);

  const { data: allFindings = [] } = useQuery({
    queryKey: ['searchQueryFindings'],
    queryFn: () => incognito.entities.SearchQueryFinding.list(),
    enabled: !!profileId
  });

  const findings = allFindings.filter(f => f.profile_id === profileId);

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => incognito.entities.SearchQueryFinding.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['searchQueryFindings'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => incognito.entities.SearchQueryFinding.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['searchQueryFindings'] });
    }
  });

  const handleDetectSearches = async () => {
    setDetecting(true);
    try {
      const allPersonalData = await incognito.entities.PersonalData.list();
      const myData = allPersonalData.filter(d => d.profile_id === profileId);

      const fnItem = myData.find(d => d.data_type === 'full_name');
      const fullName = fnItem ? resolvePersonalDataValue(fnItem) : '';
      const emails = myData.filter(d => d.data_type === 'email').map(d => resolvePersonalDataValue(d));
      const phones = myData.filter(d => d.data_type === 'phone').map(d => resolvePersonalDataValue(d));
      const addresses = myData.filter(d => d.data_type === 'address').map(d => resolvePersonalDataValue(d));

      const response = await incognito.functions.invoke('detectSearchQueries', {
        profileId,
        fullName,
        emails,
        phones,
        addresses,
      });

      queryClient.invalidateQueries({ queryKey: ['searchQueryFindings'] });
      queryClient.invalidateQueries({ queryKey: ['notificationAlerts'] });

      const d = response.data || {};
      const newCount = d.new_count ?? d.total ?? 0;
      const existingCount = d.existing_count ?? 0;
      const msg = newCount > 0
        ? `Found ${newCount} new exposure(s).${existingCount > 0 ? ` (${existingCount} already tracked)` : ''}`
        : existingCount > 0
          ? `No new exposures. ${existingCount} already tracked.`
          : `Scan complete — ${d.total || 0} broker(s) checked.`;
      notify.success(msg);
    } catch (error) {
      const msg = error?.message || 'Unknown error';
      if (msg.includes('Failed to fetch') || msg.includes('API key')) {
        notify.error(`Search scan could not complete: ${msg}. Tip: Check your API keys in Settings and try again.`);
      } else {
        notify.error('Search detection failed: ' + msg);
      }
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
            <Globe className="w-5 h-5 text-purple-400" />
            Public Exposure Monitor
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
                Scanning...
              </>
            ) : (
              <>
                <Globe className="w-4 h-4 mr-2" />
                Scan for Exposures
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
                Public Data Exposure Detection
              </p>
              <p className="text-xs text-purple-300">
                Scans 25+ data brokers and people search sites to find where your personal information appears online. Works out-of-the-box — add API keys in Settings for deeper results.
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
                    <span className="text-2xl">{SOURCE_ICONS[finding.site_name?.toLowerCase()] || '🌐'}</span>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {finding.site_name}
                      </p>
                      {finding.site_url && (
                        <a href={finding.site_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline">
                          {finding.site_url}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getRiskColor(finding.risk_level)}>
                      {finding.risk_level?.toUpperCase()}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(finding.id)}
                      className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {finding.data_found?.length > 0 && (
                    <div>
                      <p className="text-xs text-purple-400 mb-1">Exposed Data:</p>
                      <div className="flex flex-wrap gap-1">
                        {finding.data_found.map((type, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs bg-red-500/20 text-red-300 border-red-500/40">
                            {type}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-xs text-purple-400">
                    <span>Removal: <span className="text-white capitalize">{finding.removal_difficulty || 'unknown'}</span></span>
                    {finding.removal_url && (
                      <a href={finding.removal_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                        Removal Link
                      </a>
                    )}
                  </div>

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
            <Globe className="w-12 h-12 text-purple-500 mx-auto mb-3 opacity-50" />
            <p className="text-purple-300 mb-2">No public exposures detected</p>
            <p className="text-sm text-purple-400">Click "Scan for Exposures" to check data broker sites</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}