import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Brain, Loader2, MapPin, Clock, User, Globe } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import RiskBadge from '../shared/RiskBadge';

export default function FindingDetailModal({ finding, open, onClose }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);

  const isLeak = finding?.type === 'leak';
  const isInquiry = finding?.type === 'inquiry';

  const handleAIAnalysis = async () => {
    setAnalyzing(true);
    try {
      const prompt = isInquiry ? 
        `You are a cybersecurity analyst explaining search query detections to a non-technical user. Analyze this inquiry in plain, conversational language:

Inquiry Details:
- Search Platform: ${finding.search_platform}
- Query Detected: ${finding.query_detected}
- Matched Data: ${finding.matched_data_types?.join(', ') || 'Unknown'}
- Searcher Identity: ${finding.searcher_identity || 'Anonymous'}
- IP Address: ${finding.searcher_ip || 'Unknown'}
- Device Info: ${finding.device_info || 'Unknown'}
- Location: ${finding.geographic_origin || 'Unknown'}
- Risk Level: ${finding.risk_level}
- Detected: ${finding.detected_date}
- Context: ${finding.search_context || 'Unknown'}

Provide a plain language explanation covering:
1. WHERE was this search performed? (What platform, what location?)
2. WHEN was this search detected?
3. WHO searched for you? (Be as specific as possible based on available data)
4. WHAT information were they looking for? (What data types matched?)
5. WHY should you be concerned? (Intent analysis - is this normal or suspicious?)
6. WHAT should you do about it? (Simple, clear action steps)

Write as if you're talking to a friend. No jargon. Be conversational but informative.`
        :
        `You are a cybersecurity analyst explaining data exposure findings to a non-technical user. Analyze this finding in plain, conversational language:

Finding Details:
- Source: ${finding.source_name}
- Source Type: ${finding.source_type}
- Risk Score: ${finding.risk_score}/100
- Data Exposed: ${finding.data_exposed?.join(', ') || 'Unknown'}
- First Detected: ${finding.scan_date}
- Current Status: ${finding.status}
- Additional Info: ${JSON.stringify(finding.metadata || {})}

Provide a plain language explanation covering:
1. WHERE did this information appear? (Explain the type of website/database in simple terms)
2. WHEN was it detected and how long might it have been there?
3. WHO likely put it there or has access to it? (Be specific if possible, or explain who typically has access)
4. WHY is this concerning? (What could someone do with this information?)
5. WHAT should the user do about it? (Simple, clear action steps)

Write as if you're talking to a friend. No jargon. Be conversational but informative.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            where_originated: { type: 'string' },
            when_originated: { type: 'string' },
            who_posted: { type: 'string' },
            why_concerning: { type: 'string' },
            what_to_do: { type: 'string' },
            summary: { type: 'string' }
          }
        }
      });

      setAnalysis(result);
    } catch (error) {
      alert('AI analysis failed: ' + error.message);
    } finally {
      setAnalyzing(false);
    }
  };

  if (!finding) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl bg-slate-900 border-red-600/30 text-white max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-3">
            <Badge className={isLeak ? 'bg-red-900/40 text-red-200' : 'bg-amber-900/40 text-amber-200'}>
              {isLeak ? '🔓 DATA LEAK' : '🔍 SEARCH INQUIRY'}
            </Badge>
            {isLeak ? (
              <>
                <span>{finding.source_name}</span>
                <RiskBadge score={finding.risk_score} />
              </>
            ) : (
              <>
                <span className="text-lg">{finding.query_detected}</span>
                <Badge className={`
                  ${finding.risk_level === 'critical' ? 'bg-red-600/20 text-red-300 border-red-600/40' : ''}
                  ${finding.risk_level === 'high' ? 'bg-orange-600/20 text-orange-300 border-orange-600/40' : ''}
                  ${finding.risk_level === 'medium' ? 'bg-amber-600/20 text-amber-300 border-amber-600/40' : ''}
                  ${finding.risk_level === 'low' ? 'bg-green-600/20 text-green-300 border-green-600/40' : ''}
                `}>
                  {finding.risk_level?.toUpperCase()}
                </Badge>
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Basic Details */}
          <Card className="glass-card border-red-600/20">
            <CardContent className="p-4 space-y-3">
              {isLeak && (
                <>
                  <div className="flex items-center gap-2 text-gray-300">
                    <Globe className="w-4 h-4 text-red-400" />
                    <span className="text-sm font-medium">Source Type:</span>
                    <span className="text-sm">{finding.source_type?.replace(/_/g, ' ')}</span>
                  </div>

                  {finding.source_url && (
                    <div className="flex items-center gap-2 text-gray-300">
                      <MapPin className="w-4 h-4 text-red-400" />
                      <span className="text-sm font-medium">URL:</span>
                      <a 
                        href={finding.source_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-blue-400 hover:underline truncate"
                      >
                        {finding.source_url}
                      </a>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-gray-300">
                    <Clock className="w-4 h-4 text-red-400" />
                    <span className="text-sm font-medium">Detected:</span>
                    <span className="text-sm">{new Date(finding.scan_date || finding.created_date).toLocaleDateString()}</span>
                  </div>

                  {finding.data_exposed && finding.data_exposed.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-300 mb-2">Data Exposed:</p>
                      <div className="flex flex-wrap gap-2">
                        {finding.data_exposed.map((data, idx) => (
                          <Badge key={idx} className="bg-red-600/20 text-red-300 border-red-600/40">
                            {data}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {isInquiry && (
                <>
                  <div className="flex items-center gap-2 text-gray-300">
                    <Globe className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-medium">Search Platform:</span>
                    <span className="text-sm">{finding.search_platform}</span>
                  </div>

                  <div className="flex items-center gap-2 text-gray-300">
                    <User className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-medium">Searcher:</span>
                    <span className="text-sm">{finding.searcher_identity || 'Anonymous'}</span>
                  </div>

                  {finding.geographic_origin && (
                    <div className="flex items-center gap-2 text-gray-300">
                      <MapPin className="w-4 h-4 text-amber-400" />
                      <span className="text-sm font-medium">Location:</span>
                      <span className="text-sm">{finding.geographic_origin}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-gray-300">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-medium">Detected:</span>
                    <span className="text-sm">{new Date(finding.detected_date).toLocaleDateString()} {new Date(finding.detected_date).toLocaleTimeString()}</span>
                  </div>

                  {finding.matched_data_types && finding.matched_data_types.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-300 mb-2">Data They Searched For:</p>
                      <div className="flex flex-wrap gap-2">
                        {finding.matched_data_types.map((data, idx) => (
                          <Badge key={idx} className="bg-amber-600/20 text-amber-300 border-amber-600/40">
                            {data}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {finding.searcher_ip && (
                    <div className="p-3 rounded-lg bg-amber-900/20 border border-amber-600/30">
                      <p className="text-xs text-amber-300">
                        <strong>IP Address:</strong> {finding.searcher_ip}
                      </p>
                      {finding.device_info && (
                        <p className="text-xs text-amber-300 mt-1">
                          <strong>Device:</strong> {finding.device_info}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* AI Analysis Button */}
          {!analysis && (
            <Button
              onClick={handleAIAnalysis}
              disabled={analyzing}
              className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  AI Analyzing...
                </>
              ) : (
                <>
                  <Brain className="w-5 h-5 mr-2" />
                  Run AI Analysis
                </>
              )}
            </Button>
          )}

          {/* AI Analysis Results */}
          {analysis && (
            <Card className="glass-card border-red-600/30 bg-red-950/20">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Brain className="w-6 h-6 text-red-400" />
                  <h3 className="text-xl font-bold text-white">AI Analysis</h3>
                </div>

                {/* Summary */}
                {analysis.summary && (
                  <div className="p-4 rounded-lg bg-red-900/20 border border-red-600/30">
                    <p className="text-gray-200 leading-relaxed">{analysis.summary}</p>
                  </div>
                )}

                {/* Detailed Breakdown */}
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-5 h-5 text-red-400" />
                      <h4 className="font-semibold text-white">Where did this come from?</h4>
                    </div>
                    <p className="text-gray-300 pl-7 leading-relaxed">{analysis.where_originated}</p>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-5 h-5 text-red-400" />
                      <h4 className="font-semibold text-white">When did this happen?</h4>
                    </div>
                    <p className="text-gray-300 pl-7 leading-relaxed">{analysis.when_originated}</p>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <User className="w-5 h-5 text-red-400" />
                      <h4 className="font-semibold text-white">Who is responsible?</h4>
                    </div>
                    <p className="text-gray-300 pl-7 leading-relaxed">{analysis.who_posted}</p>
                  </div>

                  <div className="p-4 rounded-lg bg-amber-900/20 border border-amber-600/30">
                    <h4 className="font-semibold text-amber-300 mb-2">Why should you care?</h4>
                    <p className="text-gray-300 leading-relaxed">{analysis.why_concerning}</p>
                  </div>

                  <div className="p-4 rounded-lg bg-green-900/20 border border-green-600/30">
                    <h4 className="font-semibold text-green-300 mb-2">What should you do?</h4>
                    <p className="text-gray-300 leading-relaxed">{analysis.what_to_do}</p>
                  </div>
                </div>

                <Button
                  onClick={() => setAnalysis(null)}
                  variant="outline"
                  className="w-full border-red-600/50 text-gray-300"
                >
                  Run New Analysis
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}