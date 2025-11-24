import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Trash2, Loader2, Zap, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';

export default function BulkDeletionPanel({ scanResults, profileId }) {
  const queryClient = useQueryClient();
  const [selectedResults, setSelectedResults] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState(null);

  const removableCandidates = scanResults.filter(
    r => r.status === 'new' || r.status === 'monitoring'
  );

  const toggleSelection = (id) => {
    setSelectedResults(prev => 
      prev.includes(id) 
        ? prev.filter(x => x !== id)
        : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedResults(removableCandidates.map(r => r.id));
  };

  const clearSelection = () => {
    setSelectedResults([]);
  };

  const handleAutomatedDeletion = async () => {
    if (selectedResults.length === 0) {
      alert('Please select at least one finding to remove');
      return;
    }

    if (!confirm(`Send automated deletion requests to ${selectedResults.length} data broker(s)?\n\nThis will:\n• Find contact emails using AI\n• Send GDPR/CCPA deletion requests\n• Track responses automatically`)) {
      return;
    }

    setProcessing(true);
    setResults(null);

    try {
      const response = await base44.functions.invoke('automateDataDeletion', {
        profileId,
        scanResultIds: selectedResults
      });

      setResults(response.data);
      
      queryClient.invalidateQueries(['deletionRequests']);
      queryClient.invalidateQueries(['scanResults']);
      
      clearSelection();
    } catch (error) {
      alert('Failed to automate deletion requests: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  if (removableCandidates.length === 0) {
    return null;
  }

  return (
    <Card className="glass-card border-purple-500/30">
      <CardHeader className="border-b border-purple-500/20">
        <CardTitle className="text-white flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-400" />
          Automated Bulk Deletion
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-amber-200 font-semibold mb-1">
                Automated Deletion System
              </p>
              <p className="text-xs text-amber-300">
                This will automatically generate and send GDPR/CCPA deletion request emails to selected data brokers. 
                Each broker will be contacted with a legally compliant removal request.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-purple-300">
            {selectedResults.length} of {removableCandidates.length} selected
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAll}
              className="border-purple-500/50 text-purple-300"
            >
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearSelection}
              className="border-purple-500/50 text-purple-300"
            >
              Clear
            </Button>
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto space-y-2 border border-purple-500/20 rounded-lg p-3">
          {removableCandidates.map((result) => (
            <div
              key={result.id}
              className="flex items-center gap-3 p-2 rounded bg-slate-800/50 hover:bg-slate-800/70 transition-colors"
            >
              <Checkbox
                checked={selectedResults.includes(result.id)}
                onCheckedChange={() => toggleSelection(result.id)}
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{result.source_name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={`text-xs ${
                    result.risk_score >= 70 ? 'bg-red-500/20 text-red-300' :
                    result.risk_score >= 40 ? 'bg-amber-500/20 text-amber-300' :
                    'bg-blue-500/20 text-blue-300'
                  }`}>
                    Risk: {result.risk_score}
                  </Badge>
                  <span className="text-xs text-purple-400">
                    {result.source_type?.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <Button
          onClick={handleAutomatedDeletion}
          disabled={processing || selectedResults.length === 0}
          className="w-full bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700"
        >
          {processing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing Requests...
            </>
          ) : (
            <>
              <Trash2 className="w-4 h-4 mr-2" />
              Send {selectedResults.length} Deletion Request{selectedResults.length !== 1 ? 's' : ''}
            </>
          )}
        </Button>

        {results && (
          <div className="mt-4 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <p className="text-sm font-semibold text-green-300">
                Deletion Requests Processed
              </p>
            </div>
            <div className="space-y-1 text-xs text-green-200">
              <p>✓ {results.requestsCreated} requests created</p>
              <p>✓ {results.emailsSent} emails sent successfully</p>
              {results.emailsFailed > 0 && (
                <p className="text-amber-300">⚠ {results.emailsFailed} emails failed</p>
              )}
              {results.skippedPlatforms > 0 && (
                <p className="text-blue-300">ℹ {results.skippedPlatforms} platform(s) require manual deletion (see guide below)</p>
              )}
            </div>
            {results.details && results.details.length > 0 && (
              <div className="mt-3 space-y-1">
                {results.details.map((detail, idx) => (
                  <div key={idx} className="text-xs text-purple-300">
                    {detail.status === 'sent' ? '✓' : '✗'} {detail.broker} ({detail.email})
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}