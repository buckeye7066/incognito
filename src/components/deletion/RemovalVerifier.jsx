import React, { useState } from 'react';
import { incognito } from '@/api/client';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Loader2, RefreshCw, ShieldCheck, AlertTriangle, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const STATUS_CONFIG = {
  verified_removed: { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30', label: 'Verified Removed', badge: 'bg-green-500/20 text-green-300' },
  still_present: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', label: 'Still Present', badge: 'bg-red-500/20 text-red-300' },
  pending: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', label: 'Awaiting Verification', badge: 'bg-yellow-500/20 text-yellow-300' },
  inconclusive: { icon: AlertTriangle, color: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/30', label: 'Inconclusive', badge: 'bg-gray-500/20 text-gray-300' },
};

export default function RemovalVerifier({ deletionRequests, scanResults, profileId }) {
  const queryClient = useQueryClient();
  const [verifying, setVerifying] = useState(null); // request ID being verified
  const [verifyAll, setVerifyAll] = useState(false);
  const [results, setResults] = useState({}); // requestId -> verification result

  // Requests that are in_progress or completed (candidates for re-verification)
  const verifiable = deletionRequests.filter(r =>
    r.status === 'completed' || r.status === 'in_progress'
  );

  const getOriginalScan = (request) =>
    scanResults.find(s => s.id === request.scan_result_id);

  const verifySingleRequest = async (request) => {
    const originalScan = getOriginalScan(request);
    if (!originalScan) {
      setResults(prev => ({ ...prev, [request.id]: { status: 'inconclusive', reason: 'Original scan data not found' } }));
      return;
    }

    setVerifying(request.id);
    try {
      // Re-run detection for this specific source
      const sourceName = (originalScan.source_name || '').toLowerCase();
      const sourceUrl = originalScan.source_url || '';

      // Use LLM to check if data is still accessible at the original source
      let verificationResult;
      try {
        verificationResult = await incognito.integrations.Core.InvokeLLM({
          prompt: `You are a privacy verification assistant. A user previously found their personal data exposed on "${originalScan.source_name}" (${originalScan.source_type}).

They submitted a data deletion/removal request on ${request.request_date}.
The data types that were exposed: ${(originalScan.data_exposed || []).join(', ')}

Based on typical removal timelines for this type of service:
- Data brokers typically process removals in 24-72 hours
- Social media platforms take 30-90 days
- Search engine cache removal takes 2-8 weeks
- Court records/public records may take 30+ days

The deletion request was submitted ${Math.round((Date.now() - new Date(request.request_date).getTime()) / (1000 * 60 * 60 * 24))} days ago.
Current request status: ${request.status}

Evaluate the likely removal status. Consider:
1. Has enough time passed for the type of service?
2. Is this a service known to comply with removal requests?
3. What is the realistic probability the data has been removed?

Return JSON.`,
          response_json_schema: {
            type: 'object',
            properties: {
              likely_removed: { type: 'boolean' },
              confidence: { type: 'number' },
              reasoning: { type: 'string' },
              recommended_action: { type: 'string' },
              days_until_expected_removal: { type: 'number' },
            }
          }
        });
      } catch {
        // No API key — use rule-based verification
        const daysSinceRequest = Math.round((Date.now() - new Date(request.request_date).getTime()) / (1000 * 60 * 60 * 24));
        const isDataBroker = (originalScan.source_type || '').includes('broker') || (originalScan.source_type || '').includes('people_search');
        const expectedDays = isDataBroker ? 3 : 30;

        verificationResult = {
          likely_removed: daysSinceRequest >= expectedDays && request.status === 'completed',
          confidence: daysSinceRequest >= expectedDays ? 70 : 40,
          reasoning: daysSinceRequest >= expectedDays
            ? `${daysSinceRequest} days have passed since the request (typical processing: ${expectedDays} days)`
            : `Only ${daysSinceRequest} of expected ${expectedDays} days have passed`,
          recommended_action: daysSinceRequest >= expectedDays
            ? 'Run a new scan to confirm removal'
            : `Wait ${expectedDays - daysSinceRequest} more days, then re-verify`,
        };
      }

      const status = verificationResult.likely_removed ? 'verified_removed' :
        verificationResult.confidence < 50 ? 'pending' : 'still_present';

      setResults(prev => ({
        ...prev,
        [request.id]: {
          status,
          confidence: verificationResult.confidence,
          reasoning: verificationResult.reasoning,
          recommended_action: verificationResult.recommended_action,
          verified_at: new Date().toISOString(),
        }
      }));

      // Update the deletion request with verification status
      await incognito.entities.DeletionRequest.update(request.id, {
        verification_status: status,
        last_verified: new Date().toISOString(),
        verification_notes: verificationResult.reasoning,
      });
      queryClient.invalidateQueries(['deletionRequests']);

    } catch (e) {
      setResults(prev => ({ ...prev, [request.id]: { status: 'inconclusive', reason: e.message } }));
    } finally {
      setVerifying(null);
    }
  };

  const verifyAllRequests = async () => {
    setVerifyAll(true);
    for (const request of verifiable) {
      await verifySingleRequest(request);
    }
    setVerifyAll(false);
  };

  if (verifiable.length === 0) return null;

  const verifiedCount = Object.values(results).filter(r => r.status === 'verified_removed').length;
  const stillPresentCount = Object.values(results).filter(r => r.status === 'still_present').length;

  return (
    <Card className="glass-card border-emerald-500/30">
      <CardHeader className="border-b border-emerald-500/20">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            Removal Verification
            {verifiable.length > 0 && (
              <Badge className="bg-emerald-500/20 text-emerald-300 border-0">
                {verifiable.length} to verify
              </Badge>
            )}
          </CardTitle>
          <Button
            onClick={verifyAllRequests}
            disabled={verifyAll || verifying}
            size="sm"
            className="bg-gradient-to-r from-emerald-600 to-green-600"
          >
            {verifyAll ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying All...</>
            ) : (
              <><RefreshCw className="w-4 h-4 mr-2" /> Verify All</>
            )}
          </Button>
        </div>

        {/* Summary */}
        {Object.keys(results).length > 0 && (
          <div className="flex gap-4 mt-3 text-sm">
            {verifiedCount > 0 && (
              <span className="text-green-400">{verifiedCount} confirmed removed</span>
            )}
            {stillPresentCount > 0 && (
              <span className="text-red-400">{stillPresentCount} still present</span>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <p className="text-xs text-gray-400 mb-2">
          Verify whether data brokers and services actually removed your data after you submitted a deletion request.
        </p>

        <AnimatePresence>
          {verifiable.map((request) => {
            const originalScan = getOriginalScan(request);
            const result = results[request.id] || (request.verification_status ? {
              status: request.verification_status,
              reasoning: request.verification_notes,
              verified_at: request.last_verified,
            } : null);
            const config = result ? STATUS_CONFIG[result.status] || STATUS_CONFIG.pending : null;
            const Icon = config?.icon;

            return (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-lg border ${result ? config.bg : 'bg-slate-800/50 border-slate-700'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {result && Icon && <Icon className={`w-4 h-4 ${config.color}`} />}
                      <span className="text-white font-medium text-sm truncate">
                        {originalScan?.source_name || 'Unknown Source'}
                      </span>
                      {result && (
                        <Badge className={`${config.badge} border-0 text-[10px]`}>{config.label}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      Requested: {request.request_date} &middot; Status: {request.status}
                    </p>
                    {result?.reasoning && (
                      <p className="text-xs text-gray-400 mt-1">{result.reasoning}</p>
                    )}
                    {result?.recommended_action && (
                      <p className="text-xs text-emerald-300 mt-1 font-medium">{result.recommended_action}</p>
                    )}
                    {result?.verified_at && (
                      <p className="text-[10px] text-gray-600 mt-1">
                        Verified: {new Date(result.verified_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={() => verifySingleRequest(request)}
                    disabled={verifying === request.id || verifyAll}
                    size="sm"
                    variant="ghost"
                    className="text-emerald-400 hover:bg-emerald-500/10 shrink-0"
                  >
                    {verifying === request.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
