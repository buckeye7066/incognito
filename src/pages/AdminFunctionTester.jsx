import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlayCircle, Loader2, CheckCircle, XCircle, AlertTriangle, Copy, Download, Lock } from 'lucide-react';

export default function AdminFunctionTester() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  const runFullTestSuite = async () => {
    setRunning(true);
    setResults(null);
    
    try {
      const response = await base44.functions.invoke('testAllFunctions', {});
      setResults(response.data);
    } catch (error) {
      setResults({
        ok: false,
        error: error.message,
        data: {
          checked: 0,
          failed: 1,
          failures: [{
            functionId: 'testAllFunctions',
            errorMessage: error.message,
            stack: error.stack
          }],
          combinedReport: `ERROR: ${error.message}\n\nSTACK:\n${error.stack}`
        }
      });
    } finally {
      setRunning(false);
    }
  };

  const copyReport = () => {
    if (results?.data?.combinedReport) {
      navigator.clipboard.writeText(results.data.combinedReport);
    }
  };

  const downloadReport = () => {
    if (!results) return;
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `function-test-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Function Tester</h1>
          <p className="text-gray-400">Test all backend functions with real payloads</p>
        </div>
        <div className="flex gap-3">
          {results && (
            <>
              <Button variant="outline" onClick={copyReport} className="border-gray-500/50 text-gray-300">
                <Copy className="w-4 h-4 mr-2" />
                Copy Report
              </Button>
              <Button variant="outline" onClick={downloadReport} className="border-purple-500/50 text-purple-300">
                <Download className="w-4 h-4 mr-2" />
                Download JSON
              </Button>
            </>
          )}
          <Button
            onClick={runFullTestSuite}
            disabled={running}
            className="bg-gradient-to-r from-red-600 to-purple-600 hover:from-red-700 hover:to-purple-700"
          >
            {running ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Running Tests...
              </>
            ) : (
              <>
                <PlayCircle className="w-4 h-4 mr-2" />
                Run Full Test Suite
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
                    {results.ok ? 'All Tests Passed' : `${results.data?.failed || 0} Failures`}
                  </h2>
                  <p className="text-gray-400">
                    {results.data?.checked || 0} functions tested in {results.data?.duration_ms || 0}ms
                  </p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{results.data?.checked || 0}</p>
                  <p className="text-xs text-gray-400">Total</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-400">{results.data?.passed || 0}</p>
                  <p className="text-xs text-gray-400">Passed</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-400">{results.data?.expectedErrors || 0}</p>
                  <p className="text-xs text-gray-400">Expected Errors</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-400">{results.data?.failed || 0}</p>
                  <p className="text-xs text-gray-400">Failed</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Combined Report - ALWAYS VISIBLE, NO COLLAPSE */}
      {results?.data?.combinedReport && (
        <Card className="glass-card border-red-500/30">
          <CardHeader className="border-b border-red-500/20">
            <CardTitle className="text-white">Combined Test Report</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <pre className="text-sm text-gray-300 bg-slate-950 p-6 overflow-x-auto whitespace-pre-wrap font-mono" style={{ maxHeight: 'none' }}>
              {results.data.combinedReport}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Full JSON Output */}
      {results && (
        <Card className="glass-card border-purple-500/30">
          <CardHeader className="border-b border-purple-500/20">
            <CardTitle className="text-white">Full JSON Response</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <pre className="text-xs text-cyan-300 bg-slate-950 p-6 overflow-x-auto whitespace-pre-wrap font-mono" style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {JSON.stringify(results, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* No Results Yet */}
      {!results && !running && (
        <Card className="glass-card border-purple-500/20">
          <CardContent className="p-12 text-center">
            <PlayCircle className="w-16 h-16 text-purple-400 mx-auto mb-4 opacity-50" />
            <h2 className="text-xl font-semibold text-white mb-2">Ready to Test</h2>
            <p className="text-gray-400 mb-4">
              Click "Run Full Test Suite" to test all backend functions
            </p>
            <p className="text-sm text-gray-500">
              Tests all {22} functions with real payloads and captures any failures
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}