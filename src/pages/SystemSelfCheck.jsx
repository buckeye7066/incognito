import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, AlertTriangle, CheckCircle, XCircle, Loader2, 
  Download, ChevronDown, ChevronUp, Database, Code, 
  Lock, Settings, Zap, FileWarning, RefreshCw, Copy, FileText,
  Wrench, RotateCcw, PlayCircle
} from 'lucide-react';

const CATEGORY_ICONS = {
  environment: Settings,
  database: Database,
  function: Code,
  integration: Zap,
  isolation: Lock,
  static_analysis: FileWarning,
  access: Shield,
  system: AlertTriangle
};

const CATEGORY_COLORS = {
  environment: 'text-blue-400',
  database: 'text-purple-400',
  function: 'text-cyan-400',
  integration: 'text-yellow-400',
  isolation: 'text-red-400',
  static_analysis: 'text-orange-400',
  access: 'text-green-400',
  system: 'text-gray-400'
};

function CheckRow({ check, expanded, onToggle }) {
  const Icon = CATEGORY_ICONS[check.category] || AlertTriangle;
  const color = CATEGORY_COLORS[check.category] || 'text-gray-400';
  
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'text-red-400 bg-red-500/20';
      case 'high': return 'text-orange-400 bg-orange-500/20';
      case 'medium': return 'text-yellow-400 bg-yellow-500/20';
      case 'warning': return 'text-amber-400 bg-amber-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };
  
  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      <div 
        className={`p-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/50 ${
          !check.ok ? 'bg-red-900/20' : check.warning ? 'bg-yellow-900/10' : 'bg-slate-800/30'
        }`}
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <Icon className={`w-5 h-5 ${color}`} />
          <div>
            <p className="text-white font-medium">{check.name}</p>
            {check.filePath && (
              <p className="text-xs text-gray-500 font-mono">{check.filePath}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {check.retriedSuccessfully && (
            <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40">Fixed on Retry</Badge>
          )}
          {check.autoFixResult?.success && (
            <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40">Auto-Fixed</Badge>
          )}
          {check.ok ? (
            check.warning ? (
              <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/40">Warning</Badge>
            ) : (
              <Badge className="bg-green-500/20 text-green-300 border-green-500/40">Passed</Badge>
            )
          ) : (
            <Badge className="bg-red-500/20 text-red-300 border-red-500/40">Failed</Badge>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>
      
      {expanded && (
        <div className="p-4 bg-slate-900/50 border-t border-slate-700 space-y-3">
          {check.error && (
            <div>
              <p className="text-xs text-red-400 mb-1">Error:</p>
              <p className="text-sm text-red-300 bg-red-900/20 p-2 rounded font-mono">{check.error}</p>
            </div>
          )}
          
          {/* Remediation Suggestion */}
          {check.remediation && !check.ok && (
            <div className="border border-purple-500/30 rounded-lg p-3 bg-purple-900/10">
              <div className="flex items-center gap-2 mb-2">
                <Wrench className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-medium text-purple-300">How to Fix</span>
                <Badge className={`text-xs ${getSeverityColor(check.remediation.severity)}`}>
                  {check.remediation.severity}
                </Badge>
              </div>
              <p className="text-sm text-purple-200">{check.remediation.suggestion}</p>
              {check.remediation.autoFix && (
                <p className="text-xs text-green-400 mt-2 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Auto-fix available - enable "Auto-Fix" option and re-run
                </p>
              )}
            </div>
          )}
          
          {/* Auto-fix result */}
          {check.autoFixResult && (
            <div className={`rounded-lg p-3 ${check.autoFixResult.success ? 'bg-green-900/20 border border-green-500/30' : 'bg-red-900/20 border border-red-500/30'}`}>
              <p className={`text-sm ${check.autoFixResult.success ? 'text-green-300' : 'text-red-300'}`}>
                {check.autoFixResult.success ? '✓ Auto-fix applied: ' : '✗ Auto-fix failed: '}
                {check.autoFixResult.message}
              </p>
            </div>
          )}
          
          {check.warning && (
            <div>
              <p className="text-xs text-yellow-400 mb-1">Warning:</p>
              <p className="text-sm text-yellow-300 bg-yellow-900/20 p-2 rounded">{check.warning}</p>
            </div>
          )}
          {check.stack && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Stack Trace:</p>
              <pre className="text-xs text-gray-400 bg-slate-900 p-2 rounded overflow-x-auto max-h-48 overflow-y-auto">
                {check.stack}
              </pre>
            </div>
          )}
          {check.patterns && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Risk Patterns:</p>
              <div className="space-y-2">
                {check.patterns.map((p, idx) => (
                  <div key={idx} className="text-sm bg-slate-900 p-2 rounded">
                    <span className={`font-medium ${p.risk === 'high' ? 'text-red-400' : 'text-yellow-400'}`}>
                      {p.pattern}
                    </span>
                    <p className="text-gray-400 text-xs mt-1">{p.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ContaminationRow({ item, expanded, onToggle }) {
  return (
    <div className="border border-red-500/30 rounded-lg overflow-hidden bg-red-900/10">
      <div 
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-red-900/20"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <div>
            <p className="text-white font-medium">{item.functionName || 'Data Issue'}</p>
            <p className="text-xs text-red-400">{item.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-red-500/20 text-red-300 border-red-500/40">Leak Detected</Badge>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>
      
      {expanded && (
        <div className="p-4 bg-slate-900/50 border-t border-red-500/20 space-y-3">
          {item.filePath && (
            <div>
              <p className="text-xs text-gray-400 mb-1">File Path:</p>
              <p className="text-sm font-mono text-purple-300">{item.filePath}</p>
            </div>
          )}
          {item.offendingCode && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Issue:</p>
              <pre className="text-sm text-red-300 bg-red-900/20 p-3 rounded overflow-x-auto">
                {item.offendingCode}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SystemSelfCheck() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [expandedChecks, setExpandedChecks] = useState({});
  const [expandedContamination, setExpandedContamination] = useState({});
  const [activeTab, setActiveTab] = useState('all');
  const [autoFixEnabled, setAutoFixEnabled] = useState(false);
  const [retryEnabled, setRetryEnabled] = useState(false);
  const [retryDelay, setRetryDelay] = useState(2000);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['systemCheckLogs'],
    queryFn: () => base44.entities.SystemCheckLog.list('-timestamp', 10)
  });

  const runDiagnostic = async (options = {}) => {
    setRunning(true);
    setResults(null);
    
    try {
      const response = await base44.functions.invoke('systemSelfCheck', {
        autoFix: options.autoFix ?? autoFixEnabled,
        retryFailed: options.retryFailed ?? retryEnabled,
        retryDelayMs: retryDelay
      });
      setResults(response.data);
    } catch (error) {
      setResults({
        ok: false,
        error: error.message,
        summary: { total: 0, passed: 0, failed: 1 },
        checks: [],
        contamination: { ok: true, results: [] }
      });
    } finally {
      setRunning(false);
    }
  };
  
  const runWithAutoFix = () => runDiagnostic({ autoFix: true, retryFailed: true });
  const retryFailedChecks = () => runDiagnostic({ retryFailed: true });

  const downloadReport = () => {
    if (!results) return;
    
    const report = {
      ...results,
      generated_at: new Date().toISOString(),
      generated_by: user?.email
    };
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system-check-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyErrorReport = () => {
    if (!results?.combinedErrorReport) return;
    navigator.clipboard.writeText(results.combinedErrorReport);
    alert('Error report copied to clipboard');
  };

  const toggleCheck = (idx) => {
    setExpandedChecks(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const toggleContamination = (idx) => {
    setExpandedContamination(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const getFilteredChecks = () => {
    if (!results?.checks) return [];
    if (activeTab === 'all') return results.checks;
    if (activeTab === 'failed') return results.checks.filter(c => !c.ok);
    if (activeTab === 'warnings') return results.checks.filter(c => c.warning);
    return results.checks.filter(c => c.category === activeTab);
  };

  // Admin check
  if (user && user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="glass-card border-red-500/30 max-w-md">
          <CardContent className="p-8 text-center">
            <Lock className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Admin Access Required</h2>
            <p className="text-gray-400">This page is restricted to administrators only.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">System Self-Check</h1>
          <p className="text-purple-300">Full-stack diagnostic for backend, database, and security</p>
        </div>
        <div className="flex gap-3 flex-wrap justify-end">
          {results && (
            <>
              <Button
                variant="outline"
                onClick={() => setResults(null)}
                className="border-gray-500/50 text-gray-300"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Clear
              </Button>
              <Button
                variant="outline"
                onClick={downloadReport}
                className="border-purple-500/50 text-purple-300"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              {results.summary?.failed > 0 && (
                <>
                  <Button
                    variant="outline"
                    onClick={retryFailedChecks}
                    disabled={running}
                    className="border-blue-500/50 text-blue-300"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Retry Failed
                  </Button>
                  <Button
                    variant="outline"
                    onClick={runWithAutoFix}
                    disabled={running}
                    className="border-green-500/50 text-green-300"
                  >
                    <Wrench className="w-4 h-4 mr-2" />
                    Auto-Fix & Retry
                  </Button>
                </>
              )}
            </>
          )}
          <Button
            onClick={() => runDiagnostic()}
            disabled={running}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
          >
            {running ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <PlayCircle className="w-4 h-4 mr-2" />
                Run Diagnostic
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Options Panel */}
      <Card className="glass-card border-purple-500/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-6 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoFixEnabled}
                onChange={(e) => setAutoFixEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-purple-500 bg-slate-800 text-purple-600"
              />
              <span className="text-sm text-purple-300">Auto-Fix Issues</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={retryEnabled}
                onChange={(e) => setRetryEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-purple-500 bg-slate-800 text-purple-600"
              />
              <span className="text-sm text-purple-300">Auto-Retry Failed</span>
            </label>
            {retryEnabled && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Retry delay:</span>
                <select
                  value={retryDelay}
                  onChange={(e) => setRetryDelay(Number(e.target.value))}
                  className="bg-slate-800 border border-purple-500/30 rounded px-2 py-1 text-sm text-white"
                >
                  <option value={1000}>1s</option>
                  <option value={2000}>2s</option>
                  <option value={5000}>5s</option>
                  <option value={10000}>10s</option>
                </select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Card */}
      {results && (
        <Card className={`glass-card ${results.ok ? 'border-green-500/30' : 'border-red-500/30'}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                {results.ok ? (
                  <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-green-400" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                    <XCircle className="w-8 h-8 text-red-400" />
                  </div>
                )}
                <div>
                  <h2 className={`text-2xl font-bold ${results.ok ? 'text-green-400' : 'text-red-400'}`}>
                    {results.ok ? 'All Systems Operational' : 'Issues Detected'}
                  </h2>
                  <p className="text-gray-400">
                    Completed in {results.summary?.duration_ms || 0}ms
                    {results.summary?.autoFixEnabled && ' • Auto-fix enabled'}
                    {results.summary?.retryEnabled && ' • Retry enabled'}
                  </p>
                </div>
              </div>

              <div className="flex gap-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-white">{results.summary?.total || 0}</p>
                  <p className="text-xs text-gray-400">Total</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-400">{results.summary?.passed || 0}</p>
                  <p className="text-xs text-gray-400">Passed</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-red-400">{results.summary?.failed || 0}</p>
                  <p className="text-xs text-gray-400">Failed</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-yellow-400">{results.summary?.warnings || 0}</p>
                  <p className="text-xs text-gray-400">Warnings</p>
                </div>
              </div>
            </div>

            {/* Auto-fix & Retry Results */}
            {(results.autoFix?.results?.length > 0 || results.retry?.improvements?.length > 0) && (
              <div className="mt-4 pt-4 border-t border-slate-700">
                <div className="flex gap-4 flex-wrap">
                  {results.autoFix?.results?.length > 0 && (
                    <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-3">
                      <p className="text-sm text-purple-300 font-medium mb-1">Auto-Fix Results</p>
                      {results.autoFix.results.map((r, idx) => (
                        <p key={idx} className={`text-xs ${r.success ? 'text-green-400' : 'text-red-400'}`}>
                          {r.success ? '✓' : '✗'} {r.checkName}: {r.message}
                        </p>
                      ))}
                    </div>
                  )}
                  {results.retry?.improvements?.length > 0 && (
                    <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
                      <p className="text-sm text-blue-300 font-medium mb-1">
                        Retry Improvements ({results.retry.improvements.length})
                      </p>
                      {results.retry.improvements.map((name, idx) => (
                        <p key={idx} className="text-xs text-green-400">✓ {name} now passing</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Combined Error Report */}
      {results && !results.ok && results.combinedErrorReport && (
        <Card className="glass-card border-red-500/30">
          <CardHeader className="border-b border-red-500/20">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-red-400" />
                Combined Error Report
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={copyErrorReport}
                className="border-red-500/50 text-red-300"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Full Error Report
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <pre className="text-sm text-red-300 bg-slate-900 p-4 rounded-lg overflow-x-auto max-h-96 overflow-y-auto font-mono whitespace-pre-wrap">
              {results.combinedErrorReport}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Contamination Results */}
      {results?.contamination?.length > 0 && (
        <Card className="glass-card border-red-500/30">
          <CardHeader className="border-b border-red-500/20">
            <CardTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Cross-Contamination Detected ({results.contamination.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {results.contamination.map((item, idx) => (
              <ContaminationRow
                key={idx}
                item={item}
                expanded={expandedContamination[idx]}
                onToggle={() => toggleContamination(idx)}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Check Results */}
      {results && (
        <Card className="glass-card border-purple-500/30">
          <CardHeader className="border-b border-purple-500/20">
            <CardTitle className="text-white">Diagnostic Results</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-slate-900/50 mb-4 flex-wrap h-auto gap-1">
                <TabsTrigger value="all">All ({results.checks?.length || 0})</TabsTrigger>
                <TabsTrigger value="failed" className="text-red-400">
                  Failed ({results.checks?.filter(c => !c.ok).length || 0})
                </TabsTrigger>
                <TabsTrigger value="warnings" className="text-yellow-400">
                  Warnings ({results.checks?.filter(c => c.warning).length || 0})
                </TabsTrigger>
                <TabsTrigger value="environment">Environment</TabsTrigger>
                <TabsTrigger value="database">Database</TabsTrigger>
                <TabsTrigger value="function">Functions</TabsTrigger>
                <TabsTrigger value="isolation">Isolation</TabsTrigger>
              </TabsList>

              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {getFilteredChecks().map((check, idx) => (
                  <CheckRow
                    key={idx}
                    check={check}
                    expanded={expandedChecks[idx]}
                    onToggle={() => toggleCheck(idx)}
                  />
                ))}
                
                {getFilteredChecks().length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    No checks in this category
                  </div>
                )}
              </div>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Recent Logs */}
      {logs.length > 0 && (
        <Card className="glass-card border-purple-500/20">
          <CardHeader className="border-b border-purple-500/20">
            <CardTitle className="text-white">Recent Check Logs</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-2">
              {logs.map((log) => (
                <div 
                  key={log.id}
                  className={`p-3 rounded-lg border ${
                    log.overall_ok 
                      ? 'bg-green-900/10 border-green-500/20' 
                      : 'bg-red-900/10 border-red-500/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {log.overall_ok ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400" />
                      )}
                      <span className="text-white">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-green-400">{log.summary?.passed || 0} passed</span>
                      <span className="text-red-400">{log.summary?.failed || 0} failed</span>
                      <span className="text-gray-400">{log.user_email}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Results Yet */}
      {!results && !running && (
        <Card className="glass-card border-purple-500/20">
          <CardContent className="p-12 text-center">
            <Shield className="w-16 h-16 text-purple-400 mx-auto mb-4 opacity-50" />
            <h2 className="text-xl font-semibold text-white mb-2">Ready to Run Diagnostic</h2>
            <p className="text-gray-400 mb-6">
              Click the button above to run a full system self-check
            </p>
            <div className="text-left max-w-md mx-auto text-sm text-gray-500 space-y-2">
              <p>• Environment variables validation</p>
              <p>• Database entity accessibility</p>
              <p>• Backend function health</p>
              <p>• Integration availability</p>
              <p>• Cross-user data isolation</p>
              <p>• Service role access</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}