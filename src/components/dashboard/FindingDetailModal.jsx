import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Brain, Loader2, MapPin, Clock, User, Globe, Scale, Briefcase } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import RiskBadge from '../shared/RiskBadge';

export default function FindingDetailModal({ finding, open, onClose }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [loadingLegal, setLoadingLegal] = useState(false);
  const [legalInfo, setLegalInfo] = useState(null);

  const isLeak = finding?.type === 'leak';
  const isInquiry = finding?.type === 'inquiry';

  const handleLegalAction = async () => {
    setLoadingLegal(true);
    try {
      const prompt = `Provide comprehensive legal action information for a data breach/leak incident:

Finding Details:
- Source/Company: ${finding.source_name}
- Source Type: ${finding.source_type}
- Data Exposed: ${finding.data_exposed?.join(', ') || 'Unknown'}
- Risk Score: ${finding.risk_score}/100
- Detected Date: ${finding.scan_date}
- Location: Cleveland, TN

Provide:
1. COMPANY_INFO: Full legal name, headquarters address, registered agent, corporate structure of ${finding.source_name}
2. BREACH_TYPE: Classify the breach type (negligence, security failure, etc.) and applicable laws violated (CCPA, GDPR, state breach laws)
3. LEGAL_BASIS: Specific legal grounds for action (negligence, breach of duty, violations)
4. DAMAGES: Potential damages (actual, statutory, punitive) that can be claimed
5. EVIDENCE_NEEDED: What documentation/evidence is required for the case
6. STATUTE_LIMITATIONS: Filing deadlines and time limits
7. CLASS_ACTION: Is there an existing class action lawsuit? If yes, provide case name, court, lead counsel
8. ATTORNEY_RECOMMENDATION: Name, firm, phone, and email of a Cleveland, TN attorney specializing in data breach/privacy law (real, verified attorney)
9. NEXT_STEPS: Exact step-by-step process to pursue legal action
10. ESTIMATED_COSTS: Legal fees, court costs, and potential recovery amounts`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            company_info: {
              type: 'object',
              properties: {
                legal_name: { type: 'string' },
                headquarters: { type: 'string' },
                registered_agent: { type: 'string' },
                corporate_structure: { type: 'string' }
              }
            },
            breach_classification: {
              type: 'object',
              properties: {
                breach_type: { type: 'string' },
                laws_violated: { type: 'array', items: { type: 'string' } }
              }
            },
            legal_basis: { type: 'string' },
            potential_damages: {
              type: 'object',
              properties: {
                actual_damages: { type: 'string' },
                statutory_damages: { type: 'string' },
                punitive_damages: { type: 'string' }
              }
            },
            evidence_required: { type: 'array', items: { type: 'string' } },
            statute_of_limitations: { type: 'string' },
            existing_class_action: {
              type: 'object',
              properties: {
                exists: { type: 'boolean' },
                case_name: { type: 'string' },
                court: { type: 'string' },
                lead_counsel: { type: 'string' },
                how_to_join: { type: 'string' }
              }
            },
            attorney_recommendation: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                firm: { type: 'string' },
                phone: { type: 'string' },
                email: { type: 'string' },
                specialization: { type: 'string' },
                website: { type: 'string' }
              }
            },
            next_steps: { type: 'array', items: { type: 'string' } },
            estimated_costs: {
              type: 'object',
              properties: {
                filing_fees: { type: 'string' },
                attorney_fees: { type: 'string' },
                contingency_available: { type: 'boolean' },
                potential_recovery: { type: 'string' }
              }
            }
          }
        }
      });

      setLegalInfo(result);
    } catch (error) {
      alert('Failed to retrieve legal information: ' + error.message);
    } finally {
      setLoadingLegal(false);
    }
  };

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

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-4">
            {!analysis && (
              <Button
                onClick={handleAIAnalysis}
                disabled={analyzing}
                className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Brain className="w-5 h-5 mr-2" />
                    AI Analysis
                  </>
                )}
              </Button>
            )}

            {isLeak && !legalInfo && (
              <Button
                onClick={handleLegalAction}
                disabled={loadingLegal}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                {loadingLegal ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Scale className="w-5 h-5 mr-2" />
                    Legal Action
                  </>
                )}
              </Button>
            )}
          </div>

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

          {/* Legal Action Information */}
          {legalInfo && (
            <Card className="glass-card border-blue-600/30 bg-blue-950/20">
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <Scale className="w-6 h-6 text-blue-400" />
                  <h3 className="text-xl font-bold text-white">Legal Action Information</h3>
                </div>

                {/* Company Info */}
                <div className="p-4 rounded-lg bg-blue-900/20 border border-blue-600/30">
                  <h4 className="font-semibold text-blue-300 mb-3 flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    Company Information
                  </h4>
                  <div className="space-y-2 text-sm text-gray-300">
                    <p><strong>Legal Name:</strong> {legalInfo.company_info?.legal_name}</p>
                    <p><strong>Headquarters:</strong> {legalInfo.company_info?.headquarters}</p>
                    <p><strong>Registered Agent:</strong> {legalInfo.company_info?.registered_agent}</p>
                    <p><strong>Structure:</strong> {legalInfo.company_info?.corporate_structure}</p>
                  </div>
                </div>

                {/* Existing Class Action */}
                {legalInfo.existing_class_action?.exists && (
                  <div className="p-4 rounded-lg bg-purple-900/20 border border-purple-600/30">
                    <h4 className="font-semibold text-purple-300 mb-3">⚖️ Existing Class Action Lawsuit</h4>
                    <div className="space-y-2 text-sm text-gray-300">
                      <p><strong>Case:</strong> {legalInfo.existing_class_action.case_name}</p>
                      <p><strong>Court:</strong> {legalInfo.existing_class_action.court}</p>
                      <p><strong>Lead Counsel:</strong> {legalInfo.existing_class_action.lead_counsel}</p>
                      <p><strong>How to Join:</strong> {legalInfo.existing_class_action.how_to_join}</p>
                    </div>
                  </div>
                )}

                {/* Attorney Recommendation */}
                <div className="p-4 rounded-lg bg-green-900/20 border border-green-600/30">
                  <h4 className="font-semibold text-green-300 mb-3">👨‍⚖️ Recommended Attorney (Cleveland, TN)</h4>
                  <div className="space-y-2 text-sm text-gray-300">
                    <p><strong>Name:</strong> {legalInfo.attorney_recommendation?.name}</p>
                    <p><strong>Firm:</strong> {legalInfo.attorney_recommendation?.firm}</p>
                    <p><strong>Phone:</strong> <a href={`tel:${legalInfo.attorney_recommendation?.phone}`} className="text-blue-400 hover:underline">{legalInfo.attorney_recommendation?.phone}</a></p>
                    <p><strong>Email:</strong> <a href={`mailto:${legalInfo.attorney_recommendation?.email}`} className="text-blue-400 hover:underline">{legalInfo.attorney_recommendation?.email}</a></p>
                    <p><strong>Specialization:</strong> {legalInfo.attorney_recommendation?.specialization}</p>
                    {legalInfo.attorney_recommendation?.website && (
                      <p><strong>Website:</strong> <a href={legalInfo.attorney_recommendation.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{legalInfo.attorney_recommendation.website}</a></p>
                    )}
                  </div>
                </div>

                {/* Legal Basis */}
                <div>
                  <h4 className="font-semibold text-white mb-2">Legal Grounds</h4>
                  <p className="text-gray-300 text-sm leading-relaxed">{legalInfo.legal_basis}</p>
                </div>

                {/* Laws Violated */}
                <div>
                  <h4 className="font-semibold text-white mb-2">Laws Potentially Violated</h4>
                  <div className="flex flex-wrap gap-2">
                    {legalInfo.breach_classification?.laws_violated?.map((law, idx) => (
                      <Badge key={idx} className="bg-red-600/20 text-red-300 border-red-600/40">
                        {law}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Potential Damages */}
                <div className="p-4 rounded-lg bg-amber-900/20 border border-amber-600/30">
                  <h4 className="font-semibold text-amber-300 mb-3">💰 Potential Damages</h4>
                  <div className="space-y-2 text-sm text-gray-300">
                    <p><strong>Actual Damages:</strong> {legalInfo.potential_damages?.actual_damages}</p>
                    <p><strong>Statutory Damages:</strong> {legalInfo.potential_damages?.statutory_damages}</p>
                    <p><strong>Punitive Damages:</strong> {legalInfo.potential_damages?.punitive_damages}</p>
                  </div>
                </div>

                {/* Evidence Required */}
                <div>
                  <h4 className="font-semibold text-white mb-2">📄 Evidence Required</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-300">
                    {legalInfo.evidence_required?.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>

                {/* Costs */}
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-600/30">
                  <h4 className="font-semibold text-white mb-3">💵 Estimated Costs</h4>
                  <div className="space-y-2 text-sm text-gray-300">
                    <p><strong>Filing Fees:</strong> {legalInfo.estimated_costs?.filing_fees}</p>
                    <p><strong>Attorney Fees:</strong> {legalInfo.estimated_costs?.attorney_fees}</p>
                    <p><strong>Contingency Available:</strong> {legalInfo.estimated_costs?.contingency_available ? 'Yes (no upfront cost)' : 'No'}</p>
                    <p><strong>Potential Recovery:</strong> {legalInfo.estimated_costs?.potential_recovery}</p>
                  </div>
                </div>

                {/* Statute of Limitations */}
                <div className="p-4 rounded-lg bg-red-900/20 border border-red-600/30">
                  <h4 className="font-semibold text-red-300 mb-2">⏰ Important: Statute of Limitations</h4>
                  <p className="text-gray-300 text-sm">{legalInfo.statute_of_limitations}</p>
                </div>

                {/* Next Steps */}
                <div>
                  <h4 className="font-semibold text-white mb-2">📋 Next Steps</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
                    {legalInfo.next_steps?.map((step, idx) => (
                      <li key={idx} className="pl-2">{step}</li>
                    ))}
                  </ol>
                </div>

                <Button
                  onClick={() => setLegalInfo(null)}
                  variant="outline"
                  className="w-full border-blue-600/50 text-gray-300"
                >
                  Close Legal Information
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}