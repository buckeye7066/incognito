import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import RiskBadge from '../components/shared/RiskBadge';
import { ExternalLink, Trash2, Eye, EyeOff, FileText, Shield, AlertTriangle, Brain, Loader2, Scale, Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SearchQueryFindings from '../components/monitoring/SearchQueryFindings';

export default function Findings() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [analyzingId, setAnalyzingId] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState({});
  const [loadingLegal, setLoadingLegal] = useState(null);
  const [legalInfo, setLegalInfo] = useState({});

  const activeProfileId = typeof window !== 'undefined' ? window.activeProfileId : null;

  const { data: allScanResults = [], isLoading } = useQuery({
    queryKey: ['scanResults'],
    queryFn: () => base44.entities.ScanResult.list()
  });

  const { data: allSearchQueries = [] } = useQuery({
    queryKey: ['searchQueryFindings'],
    queryFn: () => base44.entities.SearchQueryFinding.list()
  });

  const scanResults = allScanResults.filter(r => !activeProfileId || r.profile_id === activeProfileId);
  const searchQueries = allSearchQueries.filter(q => !activeProfileId || q.profile_id === activeProfileId);

  // Combine leaks and inquiries
  const leaks = scanResults.map(r => ({ ...r, type: 'leak' }));
  const inquiries = searchQueries.map(q => ({ ...q, type: 'inquiry' }));
  const allFindings = [...leaks, ...inquiries].sort((a, b) => 
    new Date(b.created_date || b.detected_date) - new Date(a.created_date || a.detected_date)
  );

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ScanResult.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['scanResults']);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ScanResult.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['scanResults']);
    }
  });

  const filteredResults = allFindings.filter(result => {
    if (filter === 'all') return true;
    if (filter === 'leaks') return result.type === 'leak';
    if (filter === 'inquiries') return result.type === 'inquiry';
    if (filter === 'high_risk') {
      if (result.type === 'leak') return result.risk_score >= 70;
      if (result.type === 'inquiry') return result.risk_level === 'critical' || result.risk_level === 'high';
    }
    if (filter === 'medium_risk') {
      if (result.type === 'leak') return result.risk_score >= 40 && result.risk_score < 70;
      if (result.type === 'inquiry') return result.risk_level === 'medium';
    }
    if (filter === 'low_risk') {
      if (result.type === 'leak') return result.risk_score < 40;
      if (result.type === 'inquiry') return result.risk_level === 'low';
    }
    return result.status === filter;
  });

  const handleStatusChange = (id, newStatus) => {
    updateMutation.mutate({ id, data: { status: newStatus } });
  };

  const getLegalAction = async (finding) => {
    setLoadingLegal(finding.id);
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
1. COMPANY_INFO: Full legal name, headquarters address, registered agent, and contact info (email, fax, physical address for sending notices)
2. APPLICABLE_LAWS: ONLY list laws that ACTUALLY APPLY to this specific breach based on: the data types exposed, the company's jurisdiction, the breach nature, and the victim's location (TN). For EACH law, explain WHY it applies.
3. LEGAL_BASIS: Specific legal grounds for action
4. DAMAGES: Potential damages (actual, statutory, punitive)
5. STATUTE_LIMITATIONS: Filing deadlines
6. CLASS_ACTION: Existing class action? If yes, case name, court, lead counsel
7. ATTORNEY: Find a real, verified attorney who handles data breach/privacy cases. Start with Cleveland, TN area but expand to Chattanooga, Knoxville, Nashville, or broader Tennessee/Southeast if needed. Must include: name, firm, phone, email.
8. LEGALLY_REQUIRED_STEPS: For EACH required step, provide:
   - Clear explanation of what the step means in plain language
   - Specific contact info (email, fax, physical address) if notification is required
   - Step-by-step pathway to complete the action
   - Any forms, templates, or specific procedures needed`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            company_legal_name: { type: 'string' },
            company_contact: {
              type: 'object',
              properties: {
                email: { type: 'string' },
                fax: { type: 'string' },
                address: { type: 'string' }
              }
            },
            applicable_laws: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  law_name: { type: 'string' },
                  why_applicable: { type: 'string' }
                }
              }
            },
            existing_class_action: { type: 'boolean' },
            class_action_details: { type: 'string' },
            attorney_name: { type: 'string' },
            attorney_firm: { type: 'string' },
            attorney_location: { type: 'string' },
            attorney_phone: { type: 'string' },
            attorney_email: { type: 'string' },
            legal_basis: { type: 'string' },
            potential_damages: { type: 'string' },
            legally_required_steps: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  step_title: { type: 'string' },
                  explanation: { type: 'string' },
                  contact_info: { type: 'string' },
                  how_to_complete: { type: 'string' }
                }
              }
            },
            statute_deadline: { type: 'string' }
          }
        }
      });

      setLegalInfo(prev => ({
        ...prev,
        [finding.id]: result
      }));
    } catch (error) {
      alert('Failed to retrieve legal information: ' + error.message);
    } finally {
      setLoadingLegal(null);
    }
  };

  const printLegalInfo = (finding, legalData) => {
    const printWindow = window.open('', '_blank');
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Legal Consultation Package - ${finding.source_name} Data Breach</title>
        <style>
          body {
            font-family: 'Times New Roman', serif;
            margin: 40px;
            color: #000;
            line-height: 1.6;
          }
          h1 { font-size: 24px; margin-bottom: 10px; text-align: center; }
          h2 { font-size: 18px; margin-top: 30px; margin-bottom: 10px; border-bottom: 2px solid #000; padding-bottom: 5px; }
          h3 { font-size: 16px; margin-top: 20px; margin-bottom: 8px; }
          p { margin: 8px 0; }
          .header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid #000; padding-bottom: 20px; }
          .section { margin-bottom: 30px; page-break-inside: avoid; }
          .client-info { border: 2px solid #000; padding: 15px; margin: 20px 0; background: #f9f9f9; }
          .law-item { margin-left: 20px; margin-bottom: 15px; }
          .warning { background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; }
          .highlight { background: #ffffcc; padding: 10px; border: 1px solid #ccc; margin: 10px 0; }
          ol { margin-left: 20px; }
          li { margin-bottom: 8px; }
          .footer { margin-top: 50px; border-top: 2px solid #000; padding-top: 20px; font-size: 10px; }
          @media print {
            body { margin: 20px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>ATTORNEY CONSULTATION PACKAGE</h1>
          <p><strong>Data Breach Legal Action Information</strong></p>
          <p>Prepared: ${today}</p>
        </div>

        <div class="section client-info">
          <h2>CLIENT INFORMATION (Please Complete Before Attorney Meeting)</h2>
          <p><strong>Client Name:</strong> _____________________________________________</p>
          <p><strong>Address:</strong> _____________________________________________</p>
          <p><strong>City, State, ZIP:</strong> _____________________________________________</p>
          <p><strong>Phone:</strong> ______________________ <strong>Email:</strong> ______________________</p>
          <p><strong>Date of Birth:</strong> ______________________ <strong>SSN (last 4):</strong> _________</p>
        </div>

        <div class="section">
          <h2>I. INCIDENT SUMMARY</h2>
          <p><strong>Breach Source:</strong> ${finding.source_name}</p>
          <p><strong>Source Type:</strong> ${finding.source_type?.replace(/_/g, ' ').toUpperCase()}</p>
          <p><strong>Date Discovered:</strong> ${finding.scan_date || 'Unknown'}</p>
          <p><strong>Risk Assessment:</strong> ${finding.risk_score}/100 ${finding.risk_score >= 70 ? '(CRITICAL)' : finding.risk_score >= 40 ? '(HIGH)' : '(MODERATE)'}</p>
          ${finding.source_url ? `<p><strong>Source URL:</strong> ${finding.source_url}</p>` : ''}
        </div>

        <div class="section">
          <h2>II. PERSONAL DATA COMPROMISED</h2>
          <div class="highlight">
            <p><strong>The following personal information was exposed in this breach:</strong></p>
            <ul>
              ${finding.data_exposed?.map(data => `<li>${data.replace(/_/g, ' ').toUpperCase()}</li>`).join('') || '<li>Unknown data types</li>'}
            </ul>
          </div>
          ${finding.metadata?.details ? `<p><strong>Additional Details:</strong> ${finding.metadata.details}</p>` : ''}
        </div>

        <div class="section">
          <h2>III. RESPONSIBLE PARTY INFORMATION</h2>
          <p><strong>Company Legal Name:</strong> ${legalData.company_legal_name}</p>
          <p><strong>Business Type:</strong> ${finding.source_type?.replace(/_/g, ' ')}</p>
          ${legalData.company_contact ? `
            <div class="highlight" style="margin-top: 15px;">
              <p><strong>Contact Information for Notifications:</strong></p>
              ${legalData.company_contact.email ? `<p>Email: ${legalData.company_contact.email}</p>` : ''}
              ${legalData.company_contact.fax ? `<p>Fax: ${legalData.company_contact.fax}</p>` : ''}
              ${legalData.company_contact.address ? `<p>Address: ${legalData.company_contact.address}</p>` : ''}
            </div>
          ` : ''}
        </div>

        ${legalData.applicable_laws?.length > 0 ? `
        <div class="section">
          <h2>V. APPLICABLE LEGAL FRAMEWORK</h2>
          <p><strong>The following laws provide basis for legal action:</strong></p>
          ${legalData.applicable_laws.map((law, idx) => `
            <div class="law-item">
              <p><strong>${idx + 1}. ${law.law_name}</strong></p>
              <p><em>Applicability:</em> ${law.why_applicable}</p>
            </div>
          `).join('')}
        </div>
        ` : ''}

        <div class="section">
          <h2>VI. LEGAL BASIS FOR ACTION</h2>
          <p>${legalData.legal_basis}</p>
        </div>

        <div class="section">
          <h2>VII. DAMAGES ANALYSIS</h2>
          <p>${legalData.potential_damages}</p>
          <div class="highlight" style="margin-top: 15px;">
            <p><strong>For Attorney Discussion:</strong></p>
            <ul>
              <li>Document all actual damages (identity theft costs, credit monitoring, etc.)</li>
              <li>Gather evidence of emotional distress</li>
              <li>Track time spent resolving breach-related issues</li>
              <li>Preserve all correspondence with the company</li>
            </ul>
          </div>
        </div>

        ${legalData.statute_deadline ? `
        <div class="section warning">
          <h2>⏰ VIII. TIME-SENSITIVE INFORMATION</h2>
          <h3>STATUTE OF LIMITATIONS:</h3>
          <p><strong>${legalData.statute_deadline}</strong></p>
          <p style="color: red; font-weight: bold;">ACTION REQUIRED: Consult with attorney immediately to preserve your rights.</p>
        </div>
        ` : ''}

        ${legalData.existing_class_action ? `
        <div class="section">
          <h2>IX. CLASS ACTION LITIGATION</h2>
          <p><strong>Status:</strong> Active class action lawsuit exists</p>
          <p>${legalData.class_action_details}</p>
          <p style="margin-top: 10px;"><em>Attorney should evaluate whether joining the class action or pursuing individual litigation is more advantageous.</em></p>
        </div>
        ` : ''}

        ${legalData.legally_required_steps?.length > 0 ? `
        <div class="section">
          <h2>X. LEGALLY REQUIRED STEPS</h2>
          <p><em>Actions you must take to comply with applicable laws:</em></p>
          ${legalData.legally_required_steps.map((step, idx) => `
            <div style="margin: 15px 0; padding: 15px; border: 1px solid #ccc; background: #fafafa;">
              <p style="font-weight: bold; font-size: 14px;">${idx + 1}. ${step.step_title || step}</p>
              ${step.explanation ? `<p style="margin-top: 8px;"><strong>What this means:</strong> ${step.explanation}</p>` : ''}
              ${step.contact_info ? `<p style="margin-top: 8px;"><strong>Contact Information:</strong> ${step.contact_info}</p>` : ''}
              ${step.how_to_complete ? `<p style="margin-top: 8px;"><strong>How to Complete:</strong> ${step.how_to_complete}</p>` : ''}
            </div>
          `).join('')}
        </div>
        ` : ''}

        <div class="section" style="border: 3px solid #000; padding: 20px; background: #f0f0f0;">
          <h2>RECOMMENDED LEGAL COUNSEL</h2>
          <p style="font-size: 16px;"><strong>${legalData.attorney_name}</strong></p>
          <p><strong>Law Firm:</strong> ${legalData.attorney_firm}</p>
          <p><strong>Location:</strong> ${legalData.attorney_location || 'Tennessee'}</p>
          <p><strong>Phone:</strong> <span style="font-size: 16px;">${legalData.attorney_phone}</span></p>
          <p><strong>Email:</strong> ${legalData.attorney_email}</p>
          <p style="margin-top: 15px;"><em>Attorney selected based on data breach/privacy law experience. Client should verify credentials.</em></p>
        </div>

        <div class="section">
          <h2>XI. DOCUMENTS TO BRING TO ATTORNEY CONSULTATION</h2>
          <ul>
            <li>☐ This legal consultation package</li>
            <li>☐ Government-issued photo ID</li>
            <li>☐ Any breach notification letters received</li>
            <li>☐ Credit reports showing fraudulent activity (if applicable)</li>
            <li>☐ Documentation of financial losses</li>
            <li>☐ Records of time spent resolving the breach</li>
            <li>☐ All correspondence with ${finding.source_name}</li>
            <li>☐ Police reports (if identity theft occurred)</li>
            <li>☐ Credit monitoring statements</li>
          </ul>
        </div>

        <div class="section">
          <h2>XII. QUESTIONS TO ASK YOUR ATTORNEY</h2>
          <ol>
            <li>What is the likelihood of success in pursuing legal action?</li>
            <li>What are the expected costs and fee structure?</li>
            <li>What is the typical timeline for this type of case?</li>
            <li>Should I join a class action or pursue individual litigation?</li>
            <li>What documentation should I start gathering immediately?</li>
            <li>Are there any actions I should avoid that could harm my case?</li>
            <li>What is the potential range of damages I could recover?</li>
          </ol>
        </div>

        <div class="footer">
          <p><strong>LEGAL DISCLAIMER:</strong></p>
          <p>This document is for informational purposes only and does not constitute legal advice, create an attorney-client relationship, 
          or serve as a substitute for consultation with a qualified attorney. The information provided is based on publicly available 
          data and AI analysis and should be independently verified. All legal decisions should be made in consultation with licensed 
          legal counsel familiar with your specific circumstances and applicable jurisdiction.</p>
          <p style="margin-top: 10px;"><strong>Document prepared:</strong> ${today}</p>
        </div>
      </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  };

  const analyzeWithAI = async (finding) => {
    setAnalyzingId(finding.id);
    try {
      const allPersonalData = await base44.entities.PersonalData.list();
      const myData = allPersonalData.filter(d => d.profile_id === activeProfileId);

      const prompt = `Analyze this finding and determine:
      1. Does this finding include MY personal data?
      2. If yes, what specific data of mine is included?

      MY PERSONAL DATA (these are MY actual values):
      ${myData.map(d => `- ${d.data_type}: ${d.value}`).join('\n')}

      FINDING DETAILS:
      Type: ${finding.type}
      ${finding.type === 'leak' ? `
      Source: ${finding.source_name}
      Exposed Data Types: ${finding.data_exposed?.join(', ') || 'Unknown'}
      Details: ${finding.metadata?.details || 'None'}
      ` : `
      Search Query: ${finding.query_detected}
      Platform: ${finding.search_platform}
      Matched Data Types: ${finding.matched_data_types?.join(', ') || 'Unknown'}
      Searcher: ${finding.searcher_identity || 'Anonymous'}
      `}

      CRITICAL INSTRUCTIONS:
      - Return includes_me=true if ANY of MY personal data values match what's in the finding, even if just ONE identifier matches
      - Compare the ACTUAL VALUES in the finding details against MY values
      - The breach may mix MY data with OTHER PEOPLE'S data - if even one of my values appears, it's a HIT
      - For my_data_found, return ONLY MY values that actually match in readable format like "SSN: 123-45-6789"
      - In the explanation, clearly state which values are MINE and note if other data belongs to someone else

      Return JSON with: includes_me (boolean - true if ANY of my values match), my_data_found (array of strings with only MY matched values), explanation (string explaining which data is mine and which belongs to others)`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            includes_me: { type: "boolean" },
            my_data_found: { type: "array", items: { type: "string" } },
            explanation: { type: "string" }
          }
        }
      });

      setAiAnalysis(prev => ({
        ...prev,
        [finding.id]: result
      }));
    } catch (error) {
      alert('AI analysis failed: ' + error.message);
    } finally {
      setAnalyzingId(null);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">Findings</h1>
        <p className="text-purple-300">Review and manage discovered exposures</p>
      </div>

      {/* Search Query Monitor */}
      <SearchQueryFindings profileId={activeProfileId} />

      {/* Filters */}
      <div className="glass-card rounded-xl p-4">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList className="bg-slate-900/50">
            <TabsTrigger value="all">All ({allFindings.length})</TabsTrigger>
            <TabsTrigger value="leaks">
              🔓 Leaks ({leaks.length})
            </TabsTrigger>
            <TabsTrigger value="inquiries">
              🔍 Inquiries ({inquiries.length})
            </TabsTrigger>
            <TabsTrigger value="high_risk">
              High Risk ({allFindings.filter(f => 
                (f.type === 'leak' && f.risk_score >= 70) || 
                (f.type === 'inquiry' && (f.risk_level === 'critical' || f.risk_level === 'high'))
              ).length})
            </TabsTrigger>
            <TabsTrigger value="medium_risk">
              Medium ({allFindings.filter(f => 
                (f.type === 'leak' && f.risk_score >= 40 && f.risk_score < 70) || 
                (f.type === 'inquiry' && f.risk_level === 'medium')
              ).length})
            </TabsTrigger>
            <TabsTrigger value="low_risk">
              Low ({allFindings.filter(f => 
                (f.type === 'leak' && f.risk_score < 40) || 
                (f.type === 'inquiry' && f.risk_level === 'low')
              ).length})
            </TabsTrigger>
            <TabsTrigger value="new">New</TabsTrigger>
            <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Results Grid */}
      <AnimatePresence mode="popLayout">
        {filteredResults.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {filteredResults.map((result) => (
              <motion.div
                key={result.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                layout
              >
                <Card className="glass-card border-red-600/20 hover:glow-border transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge className={result.type === 'leak' ? 'bg-red-900/40 text-red-200' : 'bg-amber-900/40 text-amber-200'}>
                            {result.type === 'leak' ? '🔓 LEAK' : '🔍 INQUIRY'}
                          </Badge>
                          <h3 className="text-xl font-bold text-white">
                            {result.type === 'leak' ? result.source_name : result.query_detected}
                          </h3>
                          {result.type === 'leak' ? (
                            <RiskBadge score={result.risk_score} />
                          ) : (
                            <Badge className={`
                              ${result.risk_level === 'critical' ? 'bg-red-600/20 text-red-300 border-red-600/40' : ''}
                              ${result.risk_level === 'high' ? 'bg-orange-600/20 text-orange-300 border-orange-600/40' : ''}
                              ${result.risk_level === 'medium' ? 'bg-amber-600/20 text-amber-300 border-amber-600/40' : ''}
                              ${result.risk_level === 'low' ? 'bg-green-600/20 text-green-300 border-green-600/40' : ''}
                            `}>
                              {result.risk_level?.toUpperCase()}
                            </Badge>
                          )}
                          {result.type === 'leak' && result.metadata?.scan_type === 'dark_web' && (
                            <Badge className="bg-red-500/20 text-red-300 border-red-500/40 flex items-center gap-1">
                              <Shield className="w-3 h-3" />
                              Dark Web
                            </Badge>
                          )}
                        </div>
                        {result.type === 'leak' ? (
                          <>
                            <p className="text-gray-300 text-sm mb-1">
                              {result.source_type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </p>
                            {result.scan_date && (
                              <p className="text-gray-400 text-xs">
                                Discovered: {new Date(result.scan_date).toLocaleDateString()}
                              </p>
                            )}
                          </>
                        ) : (
                          <>
                            <p className="text-gray-300 text-sm mb-1">
                              {result.search_platform} • {result.searcher_identity || 'Anonymous'}
                            </p>
                            {result.detected_date && (
                              <p className="text-gray-400 text-xs">
                                Detected: {new Date(result.detected_date).toLocaleDateString()} {new Date(result.detected_date).toLocaleTimeString()}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {result.source_url && (
                          <a
                            href={result.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg hover:bg-purple-500/10 transition-colors"
                          >
                            <ExternalLink className="w-5 h-5 text-purple-400" />
                          </a>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(result.id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>

                    {result.metadata?.details && (
                      <div className="mb-4 p-3 rounded-lg bg-slate-900/50 border border-purple-500/10">
                        <p className="text-sm text-purple-200">{result.metadata.details}</p>
                      </div>
                    )}

                    {result.type === 'leak' && result.data_exposed && result.data_exposed.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-gray-400 mb-2">Exposed Data:</p>
                        <div className="flex flex-wrap gap-2">
                          {result.data_exposed.map((data, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1 rounded-full bg-red-500/20 text-red-300 text-xs border border-red-500/40"
                            >
                              {data.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.type === 'inquiry' && result.matched_data_types && result.matched_data_types.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-gray-400 mb-2">Data They Searched For:</p>
                        <div className="flex flex-wrap gap-2">
                          {result.matched_data_types.map((data, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs border border-amber-500/40"
                            >
                              {data.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.type === 'inquiry' && (result.geographic_origin || result.searcher_ip) && (
                      <div className="mb-4 p-3 rounded-lg bg-amber-900/20 border border-amber-600/30">
                        {result.geographic_origin && (
                          <p className="text-xs text-amber-300 mb-1">
                            <strong>Location:</strong> {result.geographic_origin}
                          </p>
                        )}
                        {result.searcher_ip && (
                          <p className="text-xs text-amber-300">
                            <strong>IP:</strong> {result.searcher_ip}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Dark Web Specific Info */}
                    {result.type === 'leak' && result.metadata?.scan_type === 'dark_web' && result.metadata?.recommendations && (
                      <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                        <div className="flex items-start gap-2 mb-2">
                          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                          <p className="text-sm font-semibold text-red-300">Dark Web Breach Detected</p>
                        </div>
                        {result.metadata.recommendations.length > 0 && (
                          <div className="mt-2 space-y-1">
                            <p className="text-xs text-red-200 font-semibold">Recommended Actions:</p>
                            <ul className="text-xs text-red-200 space-y-1 ml-4">
                              {result.metadata.recommendations.map((rec, idx) => (
                                <li key={idx} className="list-disc">{rec}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* AI Analysis */}
                    {aiAnalysis[result.id] && (
                      <div className={`mb-4 p-4 rounded-lg border ${
                        aiAnalysis[result.id].includes_me 
                          ? 'bg-red-500/10 border-red-500/30' 
                          : 'bg-green-500/10 border-green-500/30'
                      }`}>
                        <div className="flex items-start gap-2 mb-2">
                          <Brain className={`w-5 h-5 ${aiAnalysis[result.id].includes_me ? 'text-red-400' : 'text-green-400'} flex-shrink-0 mt-0.5`} />
                          <div>
                            <p className={`text-sm font-semibold ${aiAnalysis[result.id].includes_me ? 'text-red-300' : 'text-green-300'}`}>
                              {aiAnalysis[result.id].includes_me ? '⚠️ This includes YOUR data' : '✓ This does NOT include your data'}
                            </p>
                            <p className={`text-xs mt-1 ${aiAnalysis[result.id].includes_me ? 'text-red-200' : 'text-green-200'}`}>
                              {aiAnalysis[result.id].explanation}
                            </p>
                            {aiAnalysis[result.id].includes_me && aiAnalysis[result.id].my_data_found?.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs text-red-300 font-semibold mb-1">Your data found:</p>
                                <div className="flex flex-wrap gap-1">
                                  {aiAnalysis[result.id].my_data_found.map((data, idx) => (
                                    <span key={idx} className="px-2 py-0.5 rounded bg-red-600/30 text-red-200 text-xs">
                                      {data}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => analyzeWithAI(result)}
                        disabled={analyzingId === result.id}
                        className="bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600"
                      >
                        {analyzingId === result.id ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <Brain className="w-4 h-4 mr-2" />
                            Does it include me?
                          </>
                        )}
                      </Button>

                      {result.type === 'leak' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => getLegalAction(result)}
                          disabled={loadingLegal === result.id}
                          className="bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600"
                        >
                          {loadingLegal === result.id ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Loading...
                            </>
                          ) : (
                            <>
                              <Scale className="w-4 h-4 mr-2" />
                              Legal Action
                            </>
                          )}
                        </Button>
                      )}
                    </div>

                    {/* Legal Information Display */}
                    {legalInfo[result.id] && (
                      <div className="mb-4 p-4 rounded-lg bg-blue-900/20 border border-blue-600/30 space-y-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Scale className="w-5 h-5 text-blue-400" />
                            <h4 className="font-semibold text-blue-300">Legal Action Information</h4>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => printLegalInfo(result, legalInfo[result.id])}
                            className="bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600"
                          >
                            <Printer className="w-4 h-4 mr-2" />
                            Print
                          </Button>
                        </div>

                        <div className="space-y-2 text-sm text-gray-300">
                          <p><strong>Company:</strong> {legalInfo[result.id].company_legal_name}</p>

                          {legalInfo[result.id].applicable_laws && legalInfo[result.id].applicable_laws.length > 0 && (
                            <div className="p-3 rounded bg-red-500/10 border border-red-500/30">
                              <p className="text-red-300 font-semibold mb-2">⚖️ Applicable Laws</p>
                              <div className="space-y-2">
                                {legalInfo[result.id].applicable_laws.map((law, idx) => (
                                  <div key={idx} className="text-xs">
                                    <p className="font-semibold text-red-200">{law.law_name}</p>
                                    <p className="text-gray-300 mt-0.5">{law.why_applicable}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {legalInfo[result.id].existing_class_action && (
                            <div className="p-3 rounded bg-purple-500/10 border border-purple-500/30">
                              <p className="text-purple-300 font-semibold mb-1">⚖️ Class Action Available</p>
                              <p className="text-xs">{legalInfo[result.id].class_action_details}</p>
                            </div>
                          )}

                          <div className="p-3 rounded bg-green-500/10 border border-green-500/30">
                            <p className="text-green-300 font-semibold mb-1">👨‍⚖️ Attorney</p>
                            <p className="text-xs"><strong>Name:</strong> {legalInfo[result.id].attorney_name}</p>
                            <p className="text-xs"><strong>Firm:</strong> {legalInfo[result.id].attorney_firm}</p>
                            {legalInfo[result.id].attorney_location && (
                              <p className="text-xs"><strong>Location:</strong> {legalInfo[result.id].attorney_location}</p>
                            )}
                            <p className="text-xs"><strong>Phone:</strong> <a href={`tel:${legalInfo[result.id].attorney_phone}`} className="text-blue-400 hover:underline">{legalInfo[result.id].attorney_phone}</a></p>
                            <p className="text-xs"><strong>Email:</strong> <a href={`mailto:${legalInfo[result.id].attorney_email}`} className="text-blue-400 hover:underline">{legalInfo[result.id].attorney_email}</a></p>
                          </div>

                          <p><strong>Legal Basis:</strong> {legalInfo[result.id].legal_basis}</p>
                          <p><strong>Potential Damages:</strong> {legalInfo[result.id].potential_damages}</p>
                          
                          {legalInfo[result.id].statute_deadline && (
                            <div className="p-3 rounded bg-red-500/10 border border-red-500/30">
                              <p className="text-red-300 text-xs">
                                <strong>⏰ Filing Deadline:</strong> {legalInfo[result.id].statute_deadline}
                              </p>
                            </div>
                          )}

                          {legalInfo[result.id].legally_required_steps && legalInfo[result.id].legally_required_steps.length > 0 && (
                            <div className="p-3 rounded bg-blue-500/10 border border-blue-500/30">
                              <p className="font-semibold text-blue-300 mb-2">⚠️ Legally Required Steps</p>
                              <div className="space-y-3">
                                {legalInfo[result.id].legally_required_steps.map((step, idx) => (
                                  <div key={idx} className="border-l-2 border-blue-400 pl-3">
                                    <p className="text-xs font-semibold text-blue-200">{idx + 1}. {step.step_title || step}</p>
                                    {step.explanation && (
                                      <p className="text-xs text-gray-300 mt-1"><strong>What this means:</strong> {step.explanation}</p>
                                    )}
                                    {step.contact_info && (
                                      <p className="text-xs text-gray-300 mt-1"><strong>Contact:</strong> {step.contact_info}</p>
                                    )}
                                    {step.how_to_complete && (
                                      <p className="text-xs text-gray-300 mt-1"><strong>How to complete:</strong> {step.how_to_complete}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {result.type === 'leak' ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusChange(result.id, 'monitoring')}
                          disabled={result.status === 'monitoring'}
                          className="bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Monitor
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusChange(result.id, 'ignored')}
                          disabled={result.status === 'ignored'}
                          className="bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600"
                        >
                          <EyeOff className="w-4 h-4 mr-2" />
                          Ignore
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            handleStatusChange(result.id, 'removal_requested');
                            window.location.href = '/DeletionCenter';
                          }}
                          className="bg-gradient-to-r from-red-600 to-orange-600"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          Request Removal
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newStatus = result.status === 'reviewed' ? 'new' : 'reviewed';
                            base44.entities.SearchQueryFinding.update(result.id, { status: newStatus });
                            queryClient.invalidateQueries(['searchQueryFindings']);
                          }}
                          className="bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600"
                        >
                          {result.status === 'reviewed' ? 'Mark Unreviewed' : 'Mark Reviewed'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            base44.entities.SearchQueryFinding.update(result.id, { status: 'dismissed' });
                            queryClient.invalidateQueries(['searchQueryFindings']);
                          }}
                          disabled={result.status === 'dismissed'}
                          className="bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600"
                        >
                          <EyeOff className="w-4 h-4 mr-2" />
                          Dismiss
                        </Button>
                      </div>
                    )}

                    {/* Status Badge */}
                    <div className="mt-4 pt-4 border-t border-red-500/10">
                      <span className="text-xs text-gray-400">
                        Status: <span className="text-gray-200 font-semibold">
                          {result.status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Eye className="w-16 h-16 text-purple-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Findings</h3>
            <p className="text-purple-300">
              {filter === 'all' 
                ? 'Run a scan to discover where your data appears online' 
                : 'No results match this filter'}
            </p>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}