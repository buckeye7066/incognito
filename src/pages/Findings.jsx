import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import RiskBadge from '../components/shared/RiskBadge';
import { ExternalLink, Trash2, Eye, EyeOff, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Findings() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');

  const { data: scanResults = [], isLoading } = useQuery({
    queryKey: ['scanResults'],
    queryFn: () => base44.entities.ScanResult.list()
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ScanResult.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['scanResults']);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ScanResult.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['scanResults']);
    }
  });

  const filteredResults = scanResults.filter(result => {
    if (filter === 'all') return true;
    if (filter === 'high_risk') return result.risk_score >= 70;
    if (filter === 'medium_risk') return result.risk_score >= 40 && result.risk_score < 70;
    if (filter === 'low_risk') return result.risk_score < 40;
    return result.status === filter;
  });

  const handleStatusChange = (id, newStatus) => {
    updateMutation.mutate({ id, data: { status: newStatus } });
  };

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">Findings</h1>
        <p className="text-purple-300">Review and manage discovered exposures</p>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-xl p-4">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList className="bg-slate-900/50">
            <TabsTrigger value="all">All ({scanResults.length})</TabsTrigger>
            <TabsTrigger value="high_risk">
              High Risk ({scanResults.filter(r => r.risk_score >= 70).length})
            </TabsTrigger>
            <TabsTrigger value="medium_risk">
              Medium ({scanResults.filter(r => r.risk_score >= 40 && r.risk_score < 70).length})
            </TabsTrigger>
            <TabsTrigger value="low_risk">
              Low ({scanResults.filter(r => r.risk_score < 40).length})
            </TabsTrigger>
            <TabsTrigger value="new">New</TabsTrigger>
            <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Results Grid */}
      <AnimatePresence mode="popLayout">
        {filteredResults.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {filteredResults.map((result) => (
              <motion.div
                key={result.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                layout
              >
                <Card className="glass-card border-purple-500/20 hover:glow-border transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold text-white">{result.source_name}</h3>
                          <RiskBadge score={result.risk_score} />
                        </div>
                        <p className="text-purple-300 text-sm mb-1">
                          {result.source_type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </p>
                        {result.scan_date && (
                          <p className="text-purple-400 text-xs">
                            Discovered: {new Date(result.scan_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {result.source_url && (
                          <a
                            href={result.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg hover:bg-purple-500/10 transition-colors"
                          >
                            <ExternalLink className="w-5 h-5 text-purple-400" />
                          </a>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(result.id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>

                    {result.metadata?.details && (
                      <div className="mb-4 p-3 rounded-lg bg-slate-900/50 border border-purple-500/10">
                        <p className="text-sm text-purple-200">{result.metadata.details}</p>
                      </div>
                    )}

                    {result.data_exposed && result.data_exposed.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-purple-400 mb-2">Exposed Data:</p>
                        <div className="flex flex-wrap gap-2">
                          {result.data_exposed.map((data, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1 rounded-full bg-red-500/20 text-red-300 text-xs border border-red-500/40"
                            >
                              {data.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusChange(result.id, 'monitoring')}
                        disabled={result.status === 'monitoring'}
                        className="border-purple-500/50 text-purple-300"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Monitor
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusChange(result.id, 'ignored')}
                        disabled={result.status === 'ignored'}
                        className="border-purple-500/50 text-purple-300"
                      >
                        <EyeOff className="w-4 h-4 mr-2" />
                        Ignore
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          handleStatusChange(result.id, 'removal_requested');
                          // Navigate to deletion center
                          window.location.href = '/DeletionCenter';
                        }}
                        className="bg-gradient-to-r from-purple-600 to-indigo-600"
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Request Removal
                      </Button>
                    </div>

                    {/* Status Badge */}
                    <div className="mt-4 pt-4 border-t border-purple-500/10">
                      <span className="text-xs text-purple-400">
                        Status: <span className="text-purple-200 font-semibold">
                          {result.status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Eye className="w-16 h-16 text-purple-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Findings</h3>
            <p className="text-purple-300">
              {filter === 'all' 
                ? 'Run a scan to discover where your data appears online' 
                : 'No results match this filter'}
            </p>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}