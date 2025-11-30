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
  Lock, Settings, Zap, FileWarning, RefreshCw
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

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['systemCheckLogs'],
    queryFn: () => base44.entities.SystemCheckLog.list('-timestamp', 10)
  });

  const runDiagnostic = async () => {
    setRunning(true);
    setResults(null);
    
    try {
      const response = await base44.functions.invoke('systemSelfCheck', {});
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
        <div className="flex gap-3">
          {results && (
            <Button
              variant="outline"
              onClick={downloadReport}
              className="border-purple-500/50 text-purple-300"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Report
            </Button>
          )}
          <Button
            onClick={runDiagnostic}
            disabled={running}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
          >
            {running ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Running Diagnostic...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Run Full System Diagnostic
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Summary Card */}
      {results && (
        <Card className={`glass-card ${results.ok ? 'border-green-500/30' : 'border-red-500/30'}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
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
                  </p>
                </div>
              </div>
              
              <div className="flex gap-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-white">{results.summary?.total || 0}</p>
                  <p className="text-xs text-gray-400">Total Checks</p>
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
          </CardContent>
        </Card>
      )}

      {/* Contamination Results */}
      {results?.contamination?.results?.length > 0 && (
        <Card className="glass-card border-red-500/30">
          <CardHeader className="border-b border-red-500/20">
            <CardTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Cross-Contamination Detected ({results.contamination.results.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {results.contamination.results.map((item, idx) => (
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