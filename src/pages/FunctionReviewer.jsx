import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Code, ChevronLeft, ChevronRight, Search, Copy, Check, 
  FileCode, FolderTree, Lock, Loader2, AlertCircle,
  ChevronDown, ChevronUp
} from 'lucide-react';

// Static registry - kept in sync with functionRegistry.js
const KNOWN_FUNCTIONS = [
  { functionId: 'testAllFunctions', filePath: 'functions/testAllFunctions.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'testing', description: 'Heavyweight test runner for all backend functions' },
  { functionId: 'getFunctionDetails', filePath: 'functions/getFunctionDetails.js', exportType: 'default', namedExports: [], dependencyPaths: ['functionRegistry.js'], category: 'testing', description: 'Fetches function source code and metadata' },
  { functionId: 'runIdentityScan', filePath: 'functions/runIdentityScan.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'scanning', description: 'OSINT identity scan across web sources' },
  { functionId: 'checkBreaches', filePath: 'functions/checkBreaches.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'scanning', description: 'Check emails against HIBP breach database' },
  { functionId: 'checkBreachAlerts', filePath: 'functions/checkBreachAlerts.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'scanning', description: 'Check for breach alerts on user data' },
  { functionId: 'checkHIBP', filePath: 'functions/checkHIBP.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'scanning', description: 'Direct HIBP API lookup for single email' },
  { functionId: 'detectSearchQueries', filePath: 'functions/detectSearchQueries.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'scanning', description: 'Detect public exposures of personal data' },
  { functionId: 'monitorSocialMedia', filePath: 'functions/monitorSocialMedia.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'social', description: 'Monitor social media for mentions and exposures' },
  { functionId: 'checkSocialMediaImpersonation', filePath: 'functions/checkSocialMediaImpersonation.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'social', description: 'Detect impersonation attempts on social platforms' },
  { functionId: 'fetchInboxEmails', filePath: 'functions/fetchInboxEmails.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'email', description: 'Fetch inbox emails for display' },
  { functionId: 'bulkDeleteEmails', filePath: 'functions/bulkDeleteEmails.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'email', description: 'Bulk delete email messages' },
  { functionId: 'monitorEmails', filePath: 'functions/monitorEmails.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'email', description: 'Monitor email accounts for spam' },
  { functionId: 'generateEmailAlias', filePath: 'functions/generateEmailAlias.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'email', description: 'Generate deterministic email alias' },
  { functionId: 'automateDataDeletion', filePath: 'functions/automateDataDeletion.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'deletion', description: 'Automate GDPR/CCPA deletion requests' },
  { functionId: 'automatedPlatformDeletion', filePath: 'functions/automatedPlatformDeletion.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'deletion', description: 'Automate platform account deletion' },
  { functionId: 'automateGDPRDeletion', filePath: 'functions/automateGDPRDeletion.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'deletion', description: 'Generate GDPR deletion request details' },
  { functionId: 'monitorDeletionResponses', filePath: 'functions/monitorDeletionResponses.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'deletion', description: 'Monitor for deletion request responses' },
  { functionId: 'calculateAdvancedRiskScore', filePath: 'functions/calculateAdvancedRiskScore.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'analysis', description: 'Calculate advanced risk score for profile' },
  { functionId: 'correlateProfileData', filePath: 'functions/correlateProfileData.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'analysis', description: 'Correlate profile data with scan findings' },
  { functionId: 'checkClassActions', filePath: 'functions/checkClassActions.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'legal', description: 'Check for class action lawsuits' },
  { functionId: 'findAttorneys', filePath: 'functions/findAttorneys.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'legal', description: 'Find attorneys by specialty and location' },
  { functionId: 'generateEvidencePacket', filePath: 'functions/generateEvidencePacket.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'legal', description: 'Generate forensic evidence packet' },
  { functionId: 'fixExposure', filePath: 'functions/fixExposure.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'legal', description: 'Initiate remediation for exposures' },
  { functionId: 'generateVirtualCard', filePath: 'functions/generateVirtualCard.js', exportType: 'default', namedExports: [], dependencyPaths: [], category: 'credentials', description: 'Generate virtual credit card via Privacy.com' }
];

const CATEGORY_COLORS = {
  testing: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  scanning: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  social: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  email: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  deletion: 'bg-red-500/20 text-red-300 border-red-500/30',
  analysis: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  legal: 'bg-green-500/20 text-green-300 border-green-500/30',
  credentials: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
};

function CodeBlock({ title, code, filePath, defaultExpanded = true }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="glass-card border-slate-700/50 mb-4">
      <CardHeader className="py-3 px-4 border-b border-slate-700/50 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-white">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <FileCode className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-medium text-white">{title}</span>
          {filePath && <span className="text-xs text-gray-500">({filePath})</span>}
        </div>
        <Button variant="ghost" size="sm" onClick={handleCopy} className="text-gray-400 hover:text-white">
          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
        </Button>
      </CardHeader>
      {expanded && (
        <CardContent className="p-0">
          <pre className="text-xs text-cyan-300 bg-slate-950 p-4 overflow-x-auto whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">
            {code}
          </pre>
        </CardContent>
      )}
    </Card>
  );
}

export default function FunctionReviewer() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFunctionId, setSelectedFunctionId] = useState(null);
  const [functionDetails, setFunctionDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  // Filter functions by search
  const filteredFunctions = useMemo(() => {
    if (!searchTerm) return KNOWN_FUNCTIONS;
    const term = searchTerm.toLowerCase();
    return KNOWN_FUNCTIONS.filter(f =>
      f.functionId.toLowerCase().includes(term) ||
      f.description.toLowerCase().includes(term) ||
      f.category.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  // Group by category
  const groupedFunctions = useMemo(() => {
    const groups = {};
    filteredFunctions.forEach(f => {
      if (!groups[f.category]) groups[f.category] = [];
      groups[f.category].push(f);
    });
    return groups;
  }, [filteredFunctions]);

  // Current index for prev/next navigation
  const currentIndex = useMemo(() => {
    if (!selectedFunctionId) return -1;
    return filteredFunctions.findIndex(f => f.functionId === selectedFunctionId);
  }, [selectedFunctionId, filteredFunctions]);

  // Load function details
  const loadFunctionDetails = async (functionId) => {
    setLoading(true);
    setError(null);
    setSelectedFunctionId(functionId);

    try {
      const response = await base44.functions.invoke('getFunctionDetails', { functionId });
      setFunctionDetails(response.data);
    } catch (err) {
      setError(err.message);
      // Use local data as fallback
      const localFunc = KNOWN_FUNCTIONS.find(f => f.functionId === functionId);
      if (localFunc) {
        setFunctionDetails({
          ok: true,
          data: {
            ...localFunc,
            sourceCode: `// Source code for ${localFunc.filePath}\n// View in Base44 dashboard: Code > Functions > ${localFunc.functionId}`,
            dependencies: localFunc.dependencyPaths.map(dep => ({ filePath: dep, code: `// Dependency: ${dep}` })),
            sourceAvailable: false
          }
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Navigate prev/next
  const goToPrev = () => {
    if (currentIndex > 0) {
      loadFunctionDetails(filteredFunctions[currentIndex - 1].functionId);
    }
  };

  const goToNext = () => {
    if (currentIndex < filteredFunctions.length - 1) {
      loadFunctionDetails(filteredFunctions[currentIndex + 1].functionId);
    }
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

  const selectedFunc = KNOWN_FUNCTIONS.find(f => f.functionId === selectedFunctionId);

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-6">
      {/* Sidebar */}
      <div className="w-80 flex flex-col">
        <Card className="glass-card border-purple-500/30 flex-1 flex flex-col">
          <CardHeader className="border-b border-purple-500/20 pb-4">
            <CardTitle className="text-white flex items-center gap-2">
              <Code className="w-5 h-5 text-purple-400" />
              Function Registry
            </CardTitle>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search functions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-slate-900/50 border-slate-700 text-white"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">{filteredFunctions.length} of {KNOWN_FUNCTIONS.length} functions</p>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-3 space-y-4">
                {Object.entries(groupedFunctions).map(([category, funcs]) => (
                  <div key={category}>
                    <div className="flex items-center gap-2 mb-2 px-2">
                      <FolderTree className="w-3 h-3 text-gray-500" />
                      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{category}</span>
                      <Badge variant="outline" className="text-xs px-1.5 py-0 text-gray-500">{funcs.length}</Badge>
                    </div>
                    <div className="space-y-1">
                      {funcs.map(func => (
                        <button
                          key={func.functionId}
                          onClick={() => loadFunctionDetails(func.functionId)}
                          className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm ${
                            selectedFunctionId === func.functionId
                              ? 'bg-purple-600/30 text-white border border-purple-500/50'
                              : 'text-gray-300 hover:bg-slate-800/50 hover:text-white'
                          }`}
                        >
                          <div className="font-medium truncate">{func.functionId}</div>
                          <div className="text-xs text-gray-500 truncate">{func.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Navigation */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPrev}
              disabled={currentIndex <= 0}
              className="border-slate-600 text-gray-300"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToNext}
              disabled={currentIndex >= filteredFunctions.length - 1}
              className="border-slate-600 text-gray-300"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          {selectedFunc && (
            <Badge className={`${CATEGORY_COLORS[selectedFunc.category]} border`}>
              {selectedFunc.category}
            </Badge>
          )}
        </div>

        {/* Content Area */}
        {!selectedFunctionId ? (
          <Card className="glass-card border-slate-700/50 flex-1 flex items-center justify-center">
            <div className="text-center">
              <Code className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">Select a Function</h2>
              <p className="text-gray-400">Choose a function from the sidebar to view its details</p>
            </div>
          </Card>
        ) : loading ? (
          <Card className="glass-card border-slate-700/50 flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          </Card>
        ) : (
          <div className="flex-1 overflow-auto">
            {error && (
              <div className="flex items-center gap-2 text-amber-400 text-sm mb-4 bg-amber-500/10 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4" />
                <span>Using local registry data. Backend error: {error}</span>
              </div>
            )}

            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="bg-slate-900/50 border border-slate-700">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="source">Source Code</TabsTrigger>
                <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
                <TabsTrigger value="raw">Raw JSON</TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <Card className="glass-card border-slate-700/50">
                  <CardHeader>
                    <CardTitle className="text-white text-2xl">{selectedFunc?.functionId}</CardTitle>
                    <p className="text-gray-400">{selectedFunc?.description}</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-gray-500 uppercase tracking-wide">File Path</label>
                        <p className="text-white font-mono text-sm">{selectedFunc?.filePath}</p>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 uppercase tracking-wide">Export Type</label>
                        <p className="text-white">{selectedFunc?.exportType}</p>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 uppercase tracking-wide">Category</label>
                        <Badge className={`${CATEGORY_COLORS[selectedFunc?.category]} border mt-1`}>
                          {selectedFunc?.category}
                        </Badge>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 uppercase tracking-wide">Dependencies</label>
                        <p className="text-white">{selectedFunc?.dependencyPaths?.length || 0} files</p>
                      </div>
                    </div>
                    
                    {selectedFunc?.namedExports?.length > 0 && (
                      <div>
                        <label className="text-xs text-gray-500 uppercase tracking-wide">Named Exports</label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {selectedFunc.namedExports.map(exp => (
                            <Badge key={exp} variant="outline" className="text-cyan-300 border-cyan-500/30">
                              {exp}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedFunc?.dependencyPaths?.length > 0 && (
                      <div>
                        <label className="text-xs text-gray-500 uppercase tracking-wide">Dependency Paths</label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {selectedFunc.dependencyPaths.map(dep => (
                            <Badge key={dep} variant="outline" className="text-amber-300 border-amber-500/30 font-mono text-xs">
                              {dep}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="source">
                <CodeBlock
                  title="Main Source"
                  code={functionDetails?.data?.sourceCode || `// Source code for ${selectedFunc?.filePath}`}
                  filePath={selectedFunc?.filePath}
                />
                <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700/50">
                  <p className="text-sm text-gray-400">
                    <strong>Note:</strong> Base44 does not provide runtime file reading APIs.
                    To view the full source code, navigate to your Base44 dashboard:
                    <span className="text-cyan-400 font-mono"> Code → Functions → {selectedFunc?.functionId}</span>
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="dependencies">
                {selectedFunc?.dependencyPaths?.length > 0 ? (
                  <>
                    {(functionDetails?.data?.dependencies || []).map((dep, idx) => (
                      <CodeBlock
                        key={idx}
                        title={`Dependency ${idx + 1}`}
                        code={dep.code}
                        filePath={dep.filePath}
                        defaultExpanded={false}
                      />
                    ))}
                  </>
                ) : (
                  <Card className="glass-card border-slate-700/50">
                    <CardContent className="p-8 text-center">
                      <FolderTree className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-gray-400">No dependencies registered for this function</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="raw">
                <CodeBlock
                  title="Raw JSON Response"
                  code={JSON.stringify(functionDetails || { localData: selectedFunc }, null, 2)}
                  filePath={null}
                />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
}