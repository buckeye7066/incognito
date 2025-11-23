import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Shield, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
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
        alert('No emails or usernames found to check. Add some to your vault first.');
        return;
      }

      const response = await base44.functions.invoke('checkBreaches', {
        profileId,
        identifiers: checkableData
      });

      setResults(response.data);
      setShowResults(true);
    } catch (error) {
      alert('Failed to check breaches: ' + error.message);
    } finally {
      setChecking(false);
    }
  };

  const breachesFound = results?.results?.filter(r => r.breach_name) || [];
  const cleanIdentifiers = results?.results?.filter(r => r.status === 'clean') || [];

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
              {results?.breaches_found > 0 
                ? `Found ${results.breaches_found} breach${results.breaches_found > 1 ? 'es' : ''} affecting your identifiers`
                : 'No breaches found - your identifiers are safe!'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Clean Results */}
            {cleanIdentifiers.length > 0 && (
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <h3 className="font-semibold text-green-300">Clean ({cleanIdentifiers.length})</h3>
                </div>
                <div className="space-y-1">
                  {cleanIdentifiers.map((item, idx) => (
                    <p key={idx} className="text-sm text-green-200">
                      {item.identifier_value} - No breaches found
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Breach Results */}
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
                      breach.is_sensitive 
                        ? 'bg-red-500/10 border-red-500/30' 
                        : 'bg-amber-500/10 border-amber-500/30'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-white">{breach.breach_name}</h4>
                        <p className="text-sm text-purple-300">{breach.identifier_value}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${
                        breach.is_sensitive ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {breach.is_sensitive ? 'Sensitive' : 'Verified'}
                      </span>
                    </div>
                    <p className="text-sm text-purple-200 mb-2">
                      Breach Date: {new Date(breach.breach_date).toLocaleDateString()}
                    </p>
                    <div className="mb-3">
                      <p className="text-xs text-purple-400 mb-1">Data Exposed:</p>
                      <div className="flex flex-wrap gap-1">
                        {breach.data_classes.map((dc, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-200">
                            {dc}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="p-3 rounded bg-slate-900/50 border border-purple-500/20">
                      <p className="text-xs font-semibold text-purple-300 mb-2">Recommended Actions:</p>
                      <ul className="text-xs text-purple-200 space-y-1 list-disc list-inside">
                        {breach.data_classes.includes('Passwords') && (
                          <li>Change your password immediately for this service and any others using the same password</li>
                        )}
                        {breach.data_classes.includes('Email addresses') && (
                          <li>Monitor this email for phishing attempts and suspicious activity</li>
                        )}
                        {breach.data_classes.includes('Credit cards') && (
                          <li>Contact your bank and consider freezing your credit</li>
                        )}
                        <li>Enable two-factor authentication (2FA) on all accounts using this identifier</li>
                        <li>Consider using a password manager with unique passwords for each service</li>
                        <li>Keep monitoring enabled in your vault for this identifier</li>
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