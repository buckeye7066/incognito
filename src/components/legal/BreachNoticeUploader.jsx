import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Upload, FileText, Loader2, AlertTriangle, CheckCircle, Scale,
  ExternalLink, Clock, Shield, ChevronDown, ChevronUp, Clipboard, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const SEVERITY_CONFIG = {
  critical: { color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/40', label: 'CRITICAL' },
  high: { color: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500/40', label: 'HIGH' },
  medium: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/40', label: 'MEDIUM' },
  low: { color: 'text-green-400', bg: 'bg-green-500/20', border: 'border-green-500/40', label: 'LOW' },
};

export default function BreachNoticeUploader({ profileId }) {
  const [inputMode, setInputMode] = useState('paste');
  const [noticeText, setNoticeText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [expandedAction, setExpandedAction] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      const text = await file.text();
      setNoticeText(text);
    } else if (file.type === 'application/pdf') {
      setNoticeText(`[PDF uploaded: ${file.name}] — PDF text extraction requires the ExtractDataFromUploadedFile integration. Please paste the text content instead.`);
    } else {
      const text = await file.text();
      setNoticeText(text);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setNoticeText(text);
    } catch {
      setError('Could not read clipboard. Please paste manually.');
    }
  };

  const analyzeNotice = async () => {
    if (!noticeText.trim() || noticeText.trim().length < 20) {
      setError('Please provide the breach notice text (at least a few sentences).');
      return;
    }

    setAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const resp = await base44.functions.invoke('analyzeBreachNotice', {
        noticeText: noticeText.trim(),
        profileId,
      });
      setResult(resp.data || resp);
    } catch (err) {
      setError('Analysis failed: ' + (err.message || 'Unknown error'));
    } finally {
      setAnalyzing(false);
    }
  };

  const reset = () => {
    setNoticeText('');
    setResult(null);
    setError(null);
    setExpandedAction(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const analysis = result?.analysis;
  const classActions = result?.class_actions;
  const impact = result?.profile_impact;
  const sev = SEVERITY_CONFIG[impact?.severity] || SEVERITY_CONFIG.medium;

  return (
    <div className="space-y-6">
      {/* Upload / Paste Area */}
      {!result && (
        <Card className="glass-card border-purple-500/30">
          <CardHeader className="border-b border-purple-500/20">
            <CardTitle className="text-white flex items-center gap-2">
              <Upload className="w-5 h-5 text-purple-400" />
              Upload Breach Notice
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <p className="text-sm text-gray-400">
              Paste or upload a data breach notification you received. We'll extract the details,
              check for pending class action lawsuits, and tell you what to do next.
            </p>

            <Tabs value={inputMode} onValueChange={setInputMode}>
              <TabsList className="bg-slate-800">
                <TabsTrigger value="paste">Paste Text</TabsTrigger>
                <TabsTrigger value="upload">Upload File</TabsTrigger>
              </TabsList>

              <TabsContent value="paste" className="space-y-3 pt-3">
                <div className="relative">
                  <textarea
                    value={noticeText}
                    onChange={(e) => setNoticeText(e.target.value)}
                    placeholder="Paste the full text of the breach notice here...&#10;&#10;Example: &quot;Dear Customer, We are writing to inform you of a data security incident that may have affected your personal information...&quot;"
                    className="w-full h-48 bg-slate-800 border border-slate-600 rounded-lg p-4 text-white text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-gray-400 hover:text-white"
                      onClick={handlePasteFromClipboard}
                      title="Paste from clipboard"
                    >
                      <Clipboard className="w-3.5 h-3.5" />
                    </Button>
                    {noticeText && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-gray-400 hover:text-red-400"
                        onClick={() => setNoticeText('')}
                        title="Clear"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-500">{noticeText.length} characters</p>
              </TabsContent>

              <TabsContent value="upload" className="space-y-3 pt-3">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center cursor-pointer hover:border-purple-500/50 transition-colors"
                >
                  <Upload className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">Click to upload a breach notice (.txt, .html, .eml)</p>
                  <p className="text-gray-500 text-xs mt-1">Or paste the text in the other tab</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.html,.eml,.msg"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                {noticeText && (
                  <div className="p-3 bg-slate-800/60 rounded-lg border border-slate-700">
                    <p className="text-xs text-green-300">File loaded — {noticeText.length} characters extracted</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <Button
              onClick={analyzeNotice}
              disabled={analyzing || !noticeText.trim()}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing breach notice...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Analyze Notice & Check for Lawsuits
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      <AnimatePresence>
        {result && analysis && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Severity Banner */}
            <Card className={`glass-card ${sev.border}`}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl ${sev.bg} flex items-center justify-center`}>
                    <AlertTriangle className={`w-6 h-6 ${sev.color}`} />
                  </div>
                  <div>
                    <h2 className="text-white font-bold text-lg">{analysis.company_name || 'Unknown Company'}</h2>
                    <p className="text-gray-400 text-sm">
                      Breach date: {analysis.breach_date || 'Unknown'} · Severity: <span className={sev.color}>{sev.label}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {classActions?.total_found > 0 && (
                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40">
                      <Scale className="w-3 h-3 mr-1" />
                      {classActions.total_found} Lawsuit{classActions.total_found !== 1 ? 's' : ''} Found
                    </Badge>
                  )}
                  <Button size="sm" variant="outline" onClick={reset} className="border-gray-500/50 text-gray-300">
                    Analyze Another
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Breach Details */}
            <Card className="glass-card border-slate-700">
              <CardHeader className="border-b border-slate-700">
                <CardTitle className="text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-400" />
                  Breach Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {analysis.breach_description && (
                  <p className="text-gray-300 text-sm">{analysis.breach_description}</p>
                )}

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { label: 'Company', value: analysis.company_name },
                    { label: 'Breach Date', value: analysis.breach_date },
                    { label: 'Discovery Date', value: analysis.discovery_date },
                    { label: 'Notification Date', value: analysis.notification_date },
                    { label: 'People Affected', value: analysis.affected_count },
                    { label: 'Reference #', value: analysis.reference_number },
                  ].filter(f => f.value).map(f => (
                    <div key={f.label} className="p-2 rounded bg-slate-800/50">
                      <p className="text-gray-500 text-[10px] uppercase">{f.label}</p>
                      <p className="text-white text-sm">{f.value}</p>
                    </div>
                  ))}
                </div>

                {/* Data Exposed */}
                {analysis.data_types_exposed?.length > 0 && (
                  <div>
                    <p className="text-gray-400 text-xs mb-2 uppercase">Data Types Exposed</p>
                    <div className="flex flex-wrap gap-1.5">
                      {analysis.data_types_exposed.map((dt, i) => {
                        const isCritical = /ssn|social security|credit card|bank account|financial/i.test(dt);
                        return (
                          <Badge
                            key={i}
                            className={isCritical
                              ? 'bg-red-500/20 text-red-300 border-red-500/40'
                              : 'bg-slate-700 text-gray-300 border-slate-600'
                            }
                          >
                            {dt}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Remediation */}
                {analysis.remediation_offered && (
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                    <div className="flex items-center gap-2 mb-1">
                      <Shield className="w-4 h-4 text-green-400" />
                      <p className="text-green-300 font-medium text-sm">Remediation Offered</p>
                    </div>
                    <p className="text-green-200/80 text-sm">{analysis.remediation_offered}</p>
                    {analysis.remediation_provider && (
                      <p className="text-green-300/60 text-xs mt-1">Provider: {analysis.remediation_provider}</p>
                    )}
                    {analysis.claim_deadline && (
                      <p className="text-amber-300 text-xs mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Deadline: {analysis.claim_deadline}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Class Actions */}
            <Card className="glass-card border-amber-500/30">
              <CardHeader className="border-b border-amber-500/20">
                <CardTitle className="text-white flex items-center gap-2">
                  <Scale className="w-5 h-5 text-amber-400" />
                  Class Action Lawsuits
                  {classActions?.total_found > 0 && (
                    <Badge className="bg-amber-500/20 text-amber-300 ml-2">{classActions.total_found}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {/* From the notice itself */}
                {analysis.class_action_mentioned && analysis.class_action_details && (
                  <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Scale className="w-4 h-4 text-amber-400" />
                      <p className="text-amber-300 font-medium text-sm">Lawsuit Referenced in Notice</p>
                    </div>
                    {analysis.class_action_details.case_name && (
                      <p className="text-white text-sm font-medium">{analysis.class_action_details.case_name}</p>
                    )}
                    {analysis.class_action_details.court && (
                      <p className="text-gray-400 text-xs">{analysis.class_action_details.court}</p>
                    )}
                    {analysis.class_action_details.settlement_url && (
                      <a
                        href={analysis.class_action_details.settlement_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-2"
                      >
                        <ExternalLink className="w-3 h-3" /> File Claim
                      </a>
                    )}
                  </div>
                )}

                {/* Combined class action results */}
                {classActions?.combined?.length > 0 ? (
                  <div className="space-y-3">
                    {classActions.combined.map((ca, idx) => {
                      const isExpanded = expandedAction === idx;
                      const name = ca.title || ca.lawsuit_name || ca.settlement_name || 'Unknown';
                      const status = ca.status || 'unknown';
                      const statusColors = {
                        active: 'bg-green-500/20 text-green-300',
                        settled: 'bg-blue-500/20 text-blue-300',
                        pending: 'bg-yellow-500/20 text-yellow-300',
                        investigation: 'bg-purple-500/20 text-purple-300',
                        open: 'bg-green-500/20 text-green-300',
                      };

                      return (
                        <div key={idx} className="rounded-lg border border-slate-700 bg-slate-800/30 overflow-hidden">
                          <button
                            onClick={() => setExpandedAction(isExpanded ? null : idx)}
                            className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/60 transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="text-white font-medium text-sm truncate">{name}</p>
                              <p className="text-gray-400 text-xs">
                                {ca.company || ca.matched_company} · {ca.court || 'Court unknown'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                              <Badge className={`text-[10px] border-0 ${statusColors[status] || 'bg-gray-500/20 text-gray-300'}`}>
                                {status}
                              </Badge>
                              {ca.source && (
                                <Badge className="text-[10px] bg-slate-700 text-gray-400 border-0">
                                  {ca.source === 'known_registry' ? 'Verified' : 'AI Found'}
                                </Badge>
                              )}
                              {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                            </div>
                          </button>

                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="px-4 pb-4 border-t border-slate-700/50 pt-3 space-y-2 text-sm">
                                  {ca.description && <p className="text-gray-300">{ca.description}</p>}
                                  {ca.eligibility && <p className="text-gray-400 text-xs"><strong className="text-gray-300">Eligible:</strong> {ca.eligibility}</p>}
                                  {(ca.settlement_amount || ca.estimated_payout) && (
                                    <p className="text-green-300 text-xs">
                                      Settlement: {ca.settlement_amount || 'N/A'} · Est. payout: {ca.estimated_payout || 'N/A'}
                                    </p>
                                  )}
                                  {(ca.claim_deadline || ca.deadline) && (
                                    <p className="text-amber-300 text-xs flex items-center gap-1">
                                      <Clock className="w-3 h-3" /> Deadline: {ca.claim_deadline || ca.deadline}
                                    </p>
                                  )}
                                  {ca.how_to_join && <p className="text-gray-400 text-xs">{ca.how_to_join}</p>}
                                  <div className="flex gap-2 pt-1">
                                    {(ca.website || ca.url || ca.claim_url) && (
                                      <a
                                        href={ca.website || ca.url || ca.claim_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                        {ca.claim_url ? 'File Claim' : 'More Info'}
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Scale className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">No class action lawsuits found for this breach.</p>
                    <p className="text-gray-500 text-xs mt-1">
                      This doesn't mean one won't be filed. Check back later or consult an attorney.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
