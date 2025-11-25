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
      // Determine data categories for legal analysis
      const dataExposed = finding.data_exposed || [];
      const hasFinancialData = dataExposed.some(d => 
        /credit|bank|financial|payment|card/i.test(d)
      );
      const hasHealthData = dataExposed.some(d => 
        /health|medical|hipaa|patient/i.test(d)
      );
      const hasSSN = dataExposed.some(d => 
        /ssn|social security/i.test(d)
      );
      const hasDriversLicense = dataExposed.some(d => 
        /driver|license|dmv/i.test(d)
      );

      // Build dynamic legal analysis based on exposed data
      const dataAnalysis = `
DATA CATEGORY ANALYSIS:
- Contains Financial Data: ${hasFinancialData ? 'YES - FCRA, GLBA may apply' : 'NO'}
- Contains Health Data: ${hasHealthData ? 'YES - HIPAA may apply' : 'NO'}
- Contains SSN: ${hasSSN ? 'YES - Identity theft laws apply, higher damages' : 'NO'}
- Contains Driver License: ${hasDriversLicense ? 'YES - State DMV breach laws may apply' : 'NO'}
- Total Data Types Exposed: ${dataExposed.length}
- Risk Score: ${finding.risk_score}/100 (${finding.risk_score >= 70 ? 'CRITICAL' : finding.risk_score >= 40 ? 'HIGH' : 'MODERATE'})
`;

      const prompt = `You are an expert data breach attorney assistant. Provide COMPREHENSIVE legal action information for this breach. Research REAL, CURRENT information.

DATA BREACH DETAILS:
- Company/Source: ${finding.source_name}
- Type: ${finding.source_type?.replace(/_/g, ' ')}
- Data Exposed: ${dataExposed.join(', ') || 'personal information'}
- Risk Level: ${finding.risk_score}/100
- Discovered: ${finding.scan_date || 'Recently'}
- Victim Location: Cleveland, Tennessee (Bradley County)
${dataAnalysis}

RESEARCH REQUIREMENTS:

1. ATTORNEY SEARCH (CRITICAL - must be REAL and VERIFIED):
   Search for data breach/privacy attorneys in this EXACT order of preference:
   a) Cleveland, TN or Bradley County area
   b) Chattanooga, TN (30 miles away)
   c) Knoxville, TN
   d) Nashville, TN
   e) Tennessee statewide firms that handle data breach cases
   
   Provide a REAL attorney with:
   - Full name and credentials (JD, etc.)
   - Law firm name
   - Exact office location/city
   - Working phone number
   - Email address
   - Their specific experience with data breach cases if available
   
   Also provide 2 ALTERNATIVE attorneys as backup options.

2. LEGAL BASIS ANALYSIS:
   Based on the specific data exposed (${dataExposed.join(', ')}), explain:
   - Primary legal theory for recovery
   - Secondary claims that may apply
   - Strength of the case (strong/moderate/weak)
   - Key elements the victim must prove

3. DAMAGES CALCULATION:
   Based on ${hasSSN ? 'SSN exposure (typically $1,000-$10,000 statutory)' : ''} ${hasFinancialData ? 'financial data exposure (FCRA damages $100-$1,000 per violation)' : ''} ${hasHealthData ? 'health data exposure (HIPAA penalties)' : ''}:
   - Statutory damages available under each applicable law
   - Actual damages that can be claimed
   - Potential for punitive damages
   - Estimated total recovery range (low to high)
   - Attorney fee recovery availability

4. APPLICABLE LAWS (be specific based on data types):
   List 3-5 laws with SPECIFIC sections/provisions that apply

5. CLASS ACTION RESEARCH:
   Search for ANY existing class action against "${finding.source_name}" related to data breaches. Include case names, court, and how to join if available.

IMPORTANT: All attorney information must be REAL and VERIFIABLE. Search current legal directories.`;

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
                  specific_section: { type: 'string' },
                  why_applicable: { type: 'string' },
                  damages_available: { type: 'string' }
                }
              }
            },
            existing_class_action: { type: 'boolean' },
            class_action_details: { type: 'string' },
            class_action_how_to_join: { type: 'string' },
            attorney_name: { type: 'string' },
            attorney_credentials: { type: 'string' },
            attorney_firm: { type: 'string' },
            attorney_location: { type: 'string' },
            attorney_phone: { type: 'string' },
            attorney_email: { type: 'string' },
            attorney_experience: { type: 'string' },
            alternative_attorneys: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  firm: { type: 'string' },
                  location: { type: 'string' },
                  phone: { type: 'string' },
                  email: { type: 'string' }
                }
              }
            },
            legal_basis: { type: 'string' },
            legal_basis_strength: { type: 'string' },
            key_elements_to_prove: {
              type: 'array',
              items: { type: 'string' }
            },
            potential_damages: { type: 'string' },
            damages_breakdown: {
              type: 'object',
              properties: {
                statutory_damages: { type: 'string' },
                actual_damages: { type: 'string' },
                punitive_damages: { type: 'string' },
                estimated_recovery_low: { type: 'string' },
                estimated_recovery_high: { type: 'string' },
                attorney_fees_recoverable: { type: 'boolean' }
              }
            },
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

      const prompt = `Analyze this data breach finding and determine if it contains MY personal data.

  MY PERSONAL DATA IN VAULT (these are my EXACT values to match against):
  ${myData.map(d => `- ${d.data_type}: "${d.value}"`).join('\n')}

  BREACH/FINDING DETAILS:
  Type: ${finding.type}
  ${finding.type === 'leak' ? `
  Source: ${finding.source_name}
  Data Types Exposed: ${finding.data_exposed?.join(', ') || 'Unknown'}
  Raw Details: ${finding.metadata?.details || 'No additional details'}
  Source URL: ${finding.source_url || 'Not available'}
  ` : `
  Search Query: ${finding.query_detected}
  Platform: ${finding.search_platform}
  Matched Data Types: ${finding.matched_data_types?.join(', ') || 'Unknown'}
  Searcher: ${finding.searcher_identity || 'Anonymous'}
  `}

  MATCHING INSTRUCTIONS:
  1. Compare MY EXACT VALUES from the vault against what's in this breach
  2. A "hit" means my SPECIFIC value (like my exact email "john@example.com") appears in the breach data
  3. Just because a breach contains "email addresses" doesn't mean MY email is in it - you need evidence my specific value is there
  4. If the breach details mention or contain my exact values, that's a match
  5. If you cannot confirm my specific values are in this breach, includes_me should be false

  Return JSON with:
  - includes_me: true ONLY if you can confirm my specific values appear in this breach
  - my_data_found: array of my matched values in format "type: value" (e.g., "email: john@example.com")
  - explanation: explain what evidence shows my data is or isn't in this breach`;

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

                        <div className="space-y-3 text-sm text-gray-300">
                          <p><strong>Company:</strong> {legalInfo[result.id].company_legal_name}</p>

                          {/* Applicable Laws with Damages */}
                          {legalInfo[result.id].applicable_laws && legalInfo[result.id].applicable_laws.length > 0 && (
                            <div className="p-3 rounded bg-red-500/10 border border-red-500/30">
                              <p className="text-red-300 font-semibold mb-2">⚖️ Applicable Laws</p>
                              <div className="space-y-3">
                                {legalInfo[result.id].applicable_laws.map((law, idx) => (
                                  <div key={idx} className="text-xs border-l-2 border-red-400 pl-3">
                                    <p className="font-semibold text-red-200">{law.law_name}</p>
                                    {law.specific_section && (
                                      <p className="text-red-300 font-mono text-xs">{law.specific_section}</p>
                                    )}
                                    <p className="text-gray-300 mt-0.5">{law.why_applicable}</p>
                                    {law.damages_available && (
                                      <p className="text-green-300 mt-1">💰 Damages: {law.damages_available}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Legal Basis with Strength Indicator */}
                          <div className="p-3 rounded bg-amber-500/10 border border-amber-500/30">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-amber-300 font-semibold">📋 Legal Basis</p>
                              {legalInfo[result.id].legal_basis_strength && (
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                  legalInfo[result.id].legal_basis_strength.toLowerCase().includes('strong') 
                                    ? 'bg-green-600/30 text-green-300' 
                                    : legalInfo[result.id].legal_basis_strength.toLowerCase().includes('moderate')
                                    ? 'bg-amber-600/30 text-amber-300'
                                    : 'bg-red-600/30 text-red-300'
                                }`}>
                                  {legalInfo[result.id].legal_basis_strength}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-300">{legalInfo[result.id].legal_basis}</p>
                            {legalInfo[result.id].key_elements_to_prove && legalInfo[result.id].key_elements_to_prove.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs text-amber-200 font-semibold mb-1">Key Elements to Prove:</p>
                                <ul className="text-xs text-gray-300 space-y-1 ml-3">
                                  {legalInfo[result.id].key_elements_to_prove.map((elem, idx) => (
                                    <li key={idx} className="list-disc">{elem}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>

                          {/* Damages Breakdown */}
                          <div className="p-3 rounded bg-green-500/10 border border-green-500/30">
                            <p className="text-green-300 font-semibold mb-2">💰 Potential Damages</p>
                            <p className="text-xs text-gray-300 mb-2">{legalInfo[result.id].potential_damages}</p>
                            {legalInfo[result.id].damages_breakdown && (
                              <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                                {legalInfo[result.id].damages_breakdown.statutory_damages && (
                                  <div className="p-2 rounded bg-slate-800/50">
                                    <p className="text-green-200 font-semibold">Statutory</p>
                                    <p className="text-gray-300">{legalInfo[result.id].damages_breakdown.statutory_damages}</p>
                                  </div>
                                )}
                                {legalInfo[result.id].damages_breakdown.actual_damages && (
                                  <div className="p-2 rounded bg-slate-800/50">
                                    <p className="text-green-200 font-semibold">Actual</p>
                                    <p className="text-gray-300">{legalInfo[result.id].damages_breakdown.actual_damages}</p>
                                  </div>
                                )}
                                {legalInfo[result.id].damages_breakdown.punitive_damages && (
                                  <div className="p-2 rounded bg-slate-800/50">
                                    <p className="text-green-200 font-semibold">Punitive</p>
                                    <p className="text-gray-300">{legalInfo[result.id].damages_breakdown.punitive_damages}</p>
                                  </div>
                                )}
                                {(legalInfo[result.id].damages_breakdown.estimated_recovery_low || legalInfo[result.id].damages_breakdown.estimated_recovery_high) && (
                                  <div className="p-2 rounded bg-slate-800/50">
                                    <p className="text-green-200 font-semibold">Est. Recovery Range</p>
                                    <p className="text-gray-300">
                                      {legalInfo[result.id].damages_breakdown.estimated_recovery_low} - {legalInfo[result.id].damages_breakdown.estimated_recovery_high}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                            {legalInfo[result.id].damages_breakdown?.attorney_fees_recoverable && (
                              <p className="text-xs text-green-300 mt-2">✓ Attorney fees may be recoverable</p>
                            )}
                          </div>

                          {/* Class Action */}
                          {legalInfo[result.id].existing_class_action && (
                            <div className="p-3 rounded bg-purple-500/10 border border-purple-500/30">
                              <p className="text-purple-300 font-semibold mb-1">⚖️ Class Action Available</p>
                              <p className="text-xs text-gray-300">{legalInfo[result.id].class_action_details}</p>
                              {legalInfo[result.id].class_action_how_to_join && (
                                <div className="mt-2 p-2 rounded bg-purple-600/20">
                                  <p className="text-xs text-purple-200 font-semibold">How to Join:</p>
                                  <p className="text-xs text-gray-300">{legalInfo[result.id].class_action_how_to_join}</p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Primary Attorney */}
                          <div className="p-3 rounded bg-blue-500/10 border border-blue-500/30">
                            <p className="text-blue-300 font-semibold mb-2">👨‍⚖️ Recommended Attorney</p>
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-white">
                                {legalInfo[result.id].attorney_name}
                                {legalInfo[result.id].attorney_credentials && (
                                  <span className="text-blue-300 text-xs ml-2">{legalInfo[result.id].attorney_credentials}</span>
                                )}
                              </p>
                              <p className="text-xs"><strong>Firm:</strong> {legalInfo[result.id].attorney_firm}</p>
                              {legalInfo[result.id].attorney_location && (
                                <p className="text-xs"><strong>Location:</strong> {legalInfo[result.id].attorney_location}</p>
                              )}
                              <p className="text-xs">
                                <strong>Phone:</strong>{' '}
                                <a href={`tel:${legalInfo[result.id].attorney_phone}`} className="text-blue-400 hover:underline">
                                  {legalInfo[result.id].attorney_phone}
                                </a>
                              </p>
                              <p className="text-xs">
                                <strong>Email:</strong>{' '}
                                <a href={`mailto:${legalInfo[result.id].attorney_email}`} className="text-blue-400 hover:underline">
                                  {legalInfo[result.id].attorney_email}
                                </a>
                              </p>
                              {legalInfo[result.id].attorney_experience && (
                                <p className="text-xs mt-1 text-blue-200"><strong>Experience:</strong> {legalInfo[result.id].attorney_experience}</p>
                              )}
                            </div>
                          </div>

                          {/* Alternative Attorneys */}
                          {legalInfo[result.id].alternative_attorneys && legalInfo[result.id].alternative_attorneys.length > 0 && (
                            <div className="p-3 rounded bg-slate-700/30 border border-slate-500/30">
                              <p className="text-slate-300 font-semibold mb-2">📋 Alternative Attorneys</p>
                              <div className="space-y-2">
                                {legalInfo[result.id].alternative_attorneys.map((alt, idx) => (
                                  <div key={idx} className="text-xs p-2 rounded bg-slate-800/50">
                                    <p className="font-semibold text-white">{alt.name}</p>
                                    <p className="text-gray-400">{alt.firm} • {alt.location}</p>
                                    <div className="flex gap-3 mt-1">
                                      {alt.phone && (
                                        <a href={`tel:${alt.phone}`} className="text-blue-400 hover:underline">{alt.phone}</a>
                                      )}
                                      {alt.email && (
                                        <a href={`mailto:${alt.email}`} className="text-blue-400 hover:underline">{alt.email}</a>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {legalInfo[result.id].statute_deadline && (
                            <div className="p-3 rounded bg-red-500/10 border border-red-500/30">
                              <p className="text-red-300 text-xs">
                                <strong>⏰ Filing Deadline:</strong> {legalInfo[result.id].statute_deadline}
                              </p>
                            </div>
                          )}

                          {legalInfo[result.id].legally_required_steps && legalInfo[result.id].legally_required_steps.length > 0 && (
                            <div className="p-3 rounded bg-indigo-500/10 border border-indigo-500/30">
                              <p className="font-semibold text-indigo-300 mb-2">⚠️ Legally Required Steps</p>
                              <div className="space-y-3">
                                {legalInfo[result.id].legally_required_steps.map((step, idx) => (
                                  <div key={idx} className="border-l-2 border-indigo-400 pl-3">
                                    <p className="text-xs font-semibold text-indigo-200">{idx + 1}. {step.step_title || step}</p>
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