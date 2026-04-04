import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Shield, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { incognito } from '@/api/client';
import { notify } from '@/lib/notify';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function BreachCheckButton({ personalData, profileId }) {
  const [checking, setChecking] = useState(false);
  const [results, setResults] = useState(null);
  const [showResults, setShowResults] = useState(false);

  const checkForBreaches = async () => {
    setChecking(true);
    try {
      // Filter to only emails and usernames
      const checkableData = personalData.filter(
        d => (d.data_type === 'email' || d.data_type === 'username') && d.monitoring_enabled
      );

      if (checkableData.length === 0) {
        notify.warn('No emails or usernames found to check. Add some to your vault first.');
        return;
      }

      const emails = checkableData.map(d => d.value).filter(Boolean);
      const response = await incognito.functions.invoke('checkBreaches', {
        profileId,
        emails
      });

      setResults(response.data);
      setShowResults(true);
    } catch (error) {
      notify.error('Failed to check breaches: ' + error.message);
    } finally {
      setChecking(false);
    }
  };

  const breachesFound = results?.breaches || [];
  const totalBreaches = results?.total || 0;

  return (
    <>
      <Button
        onClick={checkForBreaches}
        disabled={checking}
        variant="outline"
        className="border-purple-500/50 text-purple-300"
      >
        {checking ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Checking...
          </>
        ) : (
          <>
            <Shield className="w-4 h-4 mr-2" />
            Check for Breaches
          </>
        )}
      </Button>

      <Dialog open={showResults} onOpenChange={setShowResults}>
        <DialogContent className="bg-slate-900 border-purple-500/50 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Breach Check Results</DialogTitle>
            <DialogDescription className="text-purple-300">
              {totalBreaches > 0 
                ? `Found ${totalBreaches} breach${totalBreaches > 1 ? 'es' : ''} affecting your identifiers`
                : 'No breaches found - your identifiers are safe!'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {totalBreaches === 0 && (
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <h3 className="font-semibold text-green-300">All Clear</h3>
                </div>
                <p className="text-sm text-green-200 mt-1">No breaches found for your monitored identifiers.</p>
              </div>
            )}

            {breachesFound.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <h3 className="font-semibold text-red-300">Breaches Found ({breachesFound.length})</h3>
                </div>
                {breachesFound.map((breach, idx) => (
                  <div 
                    key={idx} 
                    className={`p-4 rounded-lg border ${
                      breach.risk_score >= 80 
                        ? 'bg-red-500/10 border-red-500/30' 
                        : 'bg-amber-500/10 border-amber-500/30'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-white">{breach.source_name}</h4>
                        <p className="text-sm text-purple-300">{breach.email}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${
                        breach.risk_score >= 80 ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        Risk: {breach.risk_score}
                      </span>
                    </div>
                    <p className="text-sm text-purple-200 mb-2">
                      Breach Date: {breach.breach_date}
                    </p>
                    <div className="mb-3">
                      <p className="text-xs text-purple-400 mb-1">Data Exposed:</p>
                      <div className="flex flex-wrap gap-1">
                        {(breach.data_exposed || []).map((dc, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-200">
                            {dc}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="p-3 rounded bg-slate-900/50 border border-purple-500/20">
                      <p className="text-xs font-semibold text-purple-300 mb-2">Recommended Actions:</p>
                      <ul className="text-xs text-purple-200 space-y-1 list-disc list-inside">
                        {(breach.data_exposed || []).some(d => /password/i.test(d)) && (
                          <li>Change your password immediately for this service</li>
                        )}
                        {(breach.data_exposed || []).some(d => /email/i.test(d)) && (
                          <li>Monitor this email for phishing attempts</li>
                        )}
                        {(breach.data_exposed || []).some(d => /credit|card/i.test(d)) && (
                          <li>Contact your bank and consider freezing your credit</li>
                        )}
                        <li>Enable two-factor authentication (2FA) on all affected accounts</li>
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}