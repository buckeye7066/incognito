import React, { useState, useMemo } from 'react';
import { incognito } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  FileText, Upload, Loader2, CheckCircle, AlertTriangle, Copy,
  ChevronDown, ChevronUp, Bot, Download, Shield, Scale, Clock,
  Eye, Trash2, Plus, ExternalLink, Mail, Printer, Paperclip,
  ArrowRight, BarChart3, Gavel, Search, RefreshCw, Calendar,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BUREAUS = {
  experian: { label: 'Experian', color: 'text-blue-400 bg-blue-500/20 border-blue-500/30', url: 'https://www.experian.com/disputes/main.html' },
  equifax: { label: 'Equifax', color: 'text-red-400 bg-red-500/20 border-red-500/30', url: 'https://www.equifax.com/personal/credit-report-services/credit-dispute/' },
  transunion: { label: 'TransUnion', color: 'text-green-400 bg-green-500/20 border-green-500/30', url: 'https://www.transunion.com/credit-disputes/dispute-your-credit' },
};

const DISPUTE_CATEGORIES = {
  not_mine: 'Not My Account',
  duplicate_account: 'Duplicate Account',
  identity_theft: 'Identity Theft / Fraud',
  incorrect_balance: 'Incorrect Balance',
  incorrect_late_payment: 'Incorrect Late Payment',
  incorrect_account_status: 'Incorrect Account Status',
  obsolete_information: 'Obsolete Information (>7yr)',
  mixed_file: 'Mixed File (Wrong Person)',
  inaccurate_personal_info: 'Inaccurate Personal Info',
  inquiry_not_authorized: 'Unauthorized Inquiry',
  inconsistent_cross_bureau: 'Inconsistent Across Bureaus',
};

const DISPUTE_STATUSES = {
  identified: { label: 'Identified', color: 'bg-gray-500/20 text-gray-300', icon: Search },
  drafted: { label: 'Drafted', color: 'bg-blue-500/20 text-blue-300', icon: FileText },
  submitted_online: { label: 'Submitted Online', color: 'bg-amber-500/20 text-amber-300', icon: Upload },
  mailed: { label: 'Mailed', color: 'bg-purple-500/20 text-purple-300', icon: Mail },
  awaiting_response: { label: 'Awaiting Response', color: 'bg-amber-500/20 text-amber-300', icon: Clock },
  corrected: { label: 'Corrected', color: 'bg-green-500/20 text-green-300', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-500/20 text-red-300', icon: AlertTriangle },
  escalated: { label: 'Escalated', color: 'bg-orange-500/20 text-orange-300', icon: Gavel },
};

export default function BureauDisputeWorkflow({ profileId }) {
  const queryClient = useQueryClient();

  const [importBureau, setImportBureau] = useState('experian');
  const [importText, setImportText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [generatingKit, setGeneratingKit] = useState(null);
  const [kitData, setKitData] = useState(null);
  const [expandedItem, setExpandedItem] = useState(null);
  const [showAddEvidence, setShowAddEvidence] = useState(false);
  const [evidenceForm, setEvidenceForm] = useState({ title: '', description: '', evidence_type: 'document', related_dispute_id: '' });
  const [copied, setCopied] = useState(null);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualForm, setManualForm] = useState({
    bureau: 'experian', item_type: 'tradeline', creditor: '', account_number: '',
    balance: '', status: 'open', account_type: 'credit_card', remarks: '',
  });

  const { data: reports = [] } = useQuery({ queryKey: ['creditReports'], queryFn: () => incognito.entities.CreditReport.list() });
  const { data: tradelines = [] } = useQuery({ queryKey: ['creditTradelines'], queryFn: () => incognito.entities.CreditTradeline.list() });
  const { data: inquiries = [] } = useQuery({ queryKey: ['creditInquiries'], queryFn: () => incognito.entities.CreditInquiry.list() });
  const { data: collections = [] } = useQuery({ queryKey: ['creditCollections'], queryFn: () => incognito.entities.CreditCollection.list() });
  const { data: disputeItems = [] } = useQuery({ queryKey: ['creditDisputeItems'], queryFn: () => incognito.entities.CreditDisputeItem.list() });
  const { data: disputeCases = [] } = useQuery({ queryKey: ['creditDisputeCases'], queryFn: () => incognito.entities.CreditDisputeCase.list() });
  const { data: evidence = [] } = useQuery({ queryKey: ['creditDisputeEvidence'], queryFn: () => incognito.entities.CreditDisputeEvidence.list() });
  const { data: timeline = [] } = useQuery({ queryKey: ['creditDisputeTimeline'], queryFn: () => incognito.entities.CreditDisputeTimeline.list() });

  const pf = arr => arr.filter(i => !profileId || i.profile_id === profileId);
  const myReports = pf(reports);
  const myTradelines = pf(tradelines);
  const myInquiries = pf(inquiries);
  const myCollections = pf(collections);
  const myDisputeItems = pf(disputeItems);
  const myCases = pf(disputeCases);
  const myEvidence = pf(evidence);
  const myTimeline = pf(timeline).sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  const inv = qk => queryClient.invalidateQueries([qk]);
  const invAll = () => {
    ['creditReports', 'creditTradelines', 'creditInquiries', 'creditCollections', 'creditDisputeItems', 'creditDisputeCases', 'creditDisputeEvidence', 'creditDisputeTimeline'].forEach(inv);
  };

  const handleImport = async () => {
    if (!importText.trim()) return;
    setParsing(true);
    try {
      const result = await incognito.functions.invoke('parseCreditReport', { text: importText, bureau: importBureau });
      const d = result.data || result;

      const report = await incognito.entities.CreditReport.create({
        profile_id: profileId, bureau: importBureau, import_date: new Date().toISOString(),
        item_count: d.item_count || 0, parsed_method: d.parsed_method || 'unknown',
      });

      for (const t of (d.tradelines || [])) {
        await incognito.entities.CreditTradeline.create({
          profile_id: profileId, report_id: report.id, bureau: importBureau,
          creditor: t.creditor, account_number: t.account_number || '',
          account_type: t.account_type || 'other', balance: t.balance || '',
          credit_limit: t.credit_limit || '', payment_status: t.payment_status || '',
          date_opened: t.date_opened || '', date_reported: t.date_reported || '',
          status: t.status || 'open', remarks: t.remarks || '', raw_text: t.raw_text || '',
        });
      }
      for (const i of (d.inquiries || [])) {
        await incognito.entities.CreditInquiry.create({
          profile_id: profileId, report_id: report.id, bureau: importBureau,
          creditor: i.creditor, date: i.date || '', type: i.type || 'hard',
          raw_text: i.raw_text || '',
        });
      }
      for (const c of (d.collections || [])) {
        await incognito.entities.CreditCollection.create({
          profile_id: profileId, report_id: report.id, bureau: importBureau,
          agency: c.agency, amount: c.amount || '', original_creditor: c.original_creditor || '',
          status: c.status || 'open', date_opened: c.date_opened || '', raw_text: c.raw_text || '',
        });
      }

      invAll();
      setImportText('');
      alert(`Imported ${d.item_count || (d.tradelines?.length || 0) + (d.inquiries?.length || 0) + (d.collections?.length || 0)} items from ${importBureau}.`);
    } catch (e) {
      alert('Import failed: ' + (e.message || 'Unknown error'));
    } finally {
      setParsing(false);
    }
  };

  const handleAnalyze = async (bureau) => {
    setAnalyzing(true);
    try {
      const bTradelines = myTradelines.filter(t => t.bureau === bureau);
      const bInquiries = myInquiries.filter(i => i.bureau === bureau);
      const bCollections = myCollections.filter(c => c.bureau === bureau);

      const result = await incognito.functions.invoke('analyzeCreditDisputes', {
        tradelines: bTradelines, inquiries: bInquiries, collections: bCollections, bureau,
      });
      const items = result.data?.items || result.items || [];

      for (const item of items) {
        const exists = myDisputeItems.some(d => d.creditor === item.creditor && d.bureau === bureau);
        if (!exists) {
          await incognito.entities.CreditDisputeItem.create({
            profile_id: profileId, ...item, status: 'identified',
            created_date: new Date().toISOString(),
          });
        }
      }
      invAll();
    } catch (e) {
      alert('Analysis failed: ' + (e.message || 'Unknown error'));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerateKit = async (bureau) => {
    setGeneratingKit(bureau);
    try {
      const items = myDisputeItems.filter(d => d.bureau === bureau && d.status !== 'corrected');
      const result = await incognito.functions.invoke('generateBureauDisputeKit', { bureau, items });
      setKitData(result.data || result);
    } catch (e) {
      alert('Failed to generate dispute kit: ' + (e.message || 'Unknown error'));
    } finally {
      setGeneratingKit(null);
    }
  };

  const updateDisputeItem = async (id, data) => {
    await incognito.entities.CreditDisputeItem.update(id, data);
    if (data.status) {
      await incognito.entities.CreditDisputeTimeline.create({
        profile_id: profileId, dispute_item_id: id, status: data.status,
        note: `Status changed to ${data.status}`, created_date: new Date().toISOString(),
      });
    }
    invAll();
  };

  const addEvidence = async () => {
    await incognito.entities.CreditDisputeEvidence.create({
      profile_id: profileId, ...evidenceForm, created_date: new Date().toISOString(),
    });
    setShowAddEvidence(false);
    setEvidenceForm({ title: '', description: '', evidence_type: 'document', related_dispute_id: '' });
    inv('creditDisputeEvidence');
  };

  const handleManualAdd = async () => {
    if (manualForm.item_type === 'tradeline') {
      await incognito.entities.CreditTradeline.create({
        profile_id: profileId, bureau: manualForm.bureau,
        creditor: manualForm.creditor, account_number: manualForm.account_number,
        account_type: manualForm.account_type, balance: manualForm.balance,
        status: manualForm.status, remarks: manualForm.remarks,
      });
    } else if (manualForm.item_type === 'inquiry') {
      await incognito.entities.CreditInquiry.create({
        profile_id: profileId, bureau: manualForm.bureau,
        creditor: manualForm.creditor, date: '', type: 'hard',
      });
    } else {
      await incognito.entities.CreditCollection.create({
        profile_id: profileId, bureau: manualForm.bureau,
        agency: manualForm.creditor, amount: manualForm.balance,
        original_creditor: '', status: manualForm.status,
      });
    }
    invAll();
    setShowManualAdd(false);
    setManualForm({ bureau: 'experian', item_type: 'tradeline', creditor: '', account_number: '', balance: '', status: 'open', account_type: 'credit_card', remarks: '' });
  };

  const copyText = (key, text) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const exportKit = () => {
    if (!kitData) return;
    const lines = [
      `CREDIT DISPUTE KIT — ${(kitData.bureau || '').toUpperCase()}`,
      `Generated: ${new Date().toLocaleDateString()}`,
      '═'.repeat(60),
      '',
      'MAIL-READY DISPUTE LETTER:',
      '─'.repeat(40),
      kitData.mail_letter || '',
      '',
      'ONLINE DISPUTE COPY:',
      '─'.repeat(40),
      kitData.online_copy || '',
      '',
      'PREPARATION CHECKLIST:',
      '─'.repeat(40),
      ...(kitData.checklist || []).map((s, i) => `☐ ${i + 1}. ${s}`),
    ];
    if (kitData.furnisher_letter) {
      lines.push('', 'FURNISHER DISPUTE LETTER:', '─'.repeat(40), kitData.furnisher_letter);
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `dispute-kit-${kitData.bureau}-${Date.now()}.txt`;
    a.click(); URL.revokeObjectURL(url);
  };

  // Cross-bureau comparison
  const crossBureauData = useMemo(() => {
    const creditorMap = {};
    for (const t of myTradelines) {
      const key = (t.creditor || '').toLowerCase().replace(/\s+/g, '_');
      if (!creditorMap[key]) creditorMap[key] = { creditor: t.creditor, bureaus: {} };
      creditorMap[key].bureaus[t.bureau] = t;
    }
    return Object.values(creditorMap).filter(c => Object.keys(c.bureaus).length >= 1).map(c => {
      const bKeys = Object.keys(c.bureaus);
      const mismatches = [];
      if (bKeys.length >= 2) {
        const vals = bKeys.map(b => c.bureaus[b]);
        const balances = vals.map(v => v.balance).filter(Boolean);
        if (new Set(balances).size > 1) mismatches.push('balance');
        const statuses = vals.map(v => v.status).filter(Boolean);
        if (new Set(statuses).size > 1) mismatches.push('status');
      }
      const missingBureaus = ['experian', 'equifax', 'transunion'].filter(b => !c.bureaus[b]);
      return { ...c, mismatches, missingBureaus, bureauCount: bKeys.length };
    }).sort((a, b) => b.mismatches.length - a.mismatches.length || a.bureauCount - b.bureauCount);
  }, [myTradelines]);

  const totalItems = myTradelines.length + myInquiries.length + myCollections.length;
  const disputeCount = myDisputeItems.length;
  const correctedCount = myDisputeItems.filter(d => d.status === 'corrected').length;

  return (
    <div className="space-y-6">
      {/* Disclaimer */}
      <Card className="bg-amber-500/5 border-amber-500/20">
        <CardContent className="p-3 flex items-start gap-2">
          <Shield className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-200">Informational and drafting assistance only — not legal advice. No guarantee of deletion or correction. Review all materials before submitting. Sensitive documents remain local unless you explicitly export them.</p>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Reports', value: myReports.length, icon: FileText, color: 'text-blue-400' },
          { label: 'Items Parsed', value: totalItems, icon: BarChart3, color: 'text-purple-400' },
          { label: 'Disputes Found', value: disputeCount, icon: Scale, color: disputeCount > 0 ? 'text-amber-400' : 'text-gray-400' },
          { label: 'Corrected', value: correctedCount, icon: CheckCircle, color: 'text-green-400' },
          { label: 'Evidence', value: myEvidence.length, icon: Paperclip, color: 'text-cyan-400' },
        ].map(s => (
          <Card key={s.label} className="glass-card border-slate-700">
            <CardContent className="p-3 flex items-center gap-2">
              <s.icon className={`w-6 h-6 ${s.color}`} />
              <div>
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-gray-500 text-[10px]">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bureau Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(BUREAUS).map(([key, bur]) => {
          const reportCount = myReports.filter(r => r.bureau === key).length;
          const itemCount = myTradelines.filter(t => t.bureau === key).length + myInquiries.filter(i => i.bureau === key).length + myCollections.filter(c => c.bureau === key).length;
          const dCount = myDisputeItems.filter(d => d.bureau === key).length;
          return (
            <Card key={key} className={`glass-card border ${bur.color.split(' ')[2]}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <Badge className={`${bur.color.split(' ').slice(0, 2).join(' ')} border-0`}>{bur.label}</Badge>
                  <a href={bur.url} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-300"><ExternalLink className="w-3.5 h-3.5" /></a>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div><p className="text-white font-bold">{reportCount}</p><p className="text-gray-500">Reports</p></div>
                  <div><p className="text-white font-bold">{itemCount}</p><p className="text-gray-500">Items</p></div>
                  <div><p className="text-amber-400 font-bold">{dCount}</p><p className="text-gray-500">Disputes</p></div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" onClick={() => handleAnalyze(key)} disabled={analyzing || itemCount === 0} className="text-[11px] bg-slate-700 hover:bg-slate-600 h-7 flex-1">
                    {analyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Bot className="w-3 h-3 mr-1" />Analyze</>}
                  </Button>
                  <Button size="sm" onClick={() => handleGenerateKit(key)} disabled={!!generatingKit || dCount === 0} className="text-[11px] bg-slate-700 hover:bg-slate-600 h-7 flex-1">
                    {generatingKit === key ? <Loader2 className="w-3 h-3 animate-spin" /> : <><FileText className="w-3 h-3 mr-1" />Kit</>}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="import" className="space-y-4">
        <TabsList className="bg-slate-800/60 border border-slate-700 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="import" className="data-[state=active]:bg-blue-600 gap-1 text-xs"><Upload className="w-3 h-3" /> Import</TabsTrigger>
          <TabsTrigger value="tradelines" className="data-[state=active]:bg-purple-600 gap-1 text-xs"><BarChart3 className="w-3 h-3" /> Tradelines</TabsTrigger>
          <TabsTrigger value="compare" className="data-[state=active]:bg-amber-600 gap-1 text-xs"><Eye className="w-3 h-3" /> Compare</TabsTrigger>
          <TabsTrigger value="disputes" className="data-[state=active]:bg-red-600 gap-1 text-xs"><Scale className="w-3 h-3" /> Disputes</TabsTrigger>
          <TabsTrigger value="kit" className="data-[state=active]:bg-green-600 gap-1 text-xs"><Printer className="w-3 h-3" /> Dispute Kit</TabsTrigger>
          <TabsTrigger value="evidence" className="data-[state=active]:bg-cyan-600 gap-1 text-xs"><Paperclip className="w-3 h-3" /> Evidence</TabsTrigger>
          <TabsTrigger value="timeline" className="data-[state=active]:bg-orange-600 gap-1 text-xs"><Calendar className="w-3 h-3" /> Timeline</TabsTrigger>
        </TabsList>

        {/* IMPORT TAB */}
        <TabsContent value="import" className="space-y-4">
          <Card className="glass-card border-blue-500/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2 text-base"><Upload className="w-5 h-5 text-blue-400" /> Import Credit Report</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-gray-300 text-xs">Bureau</Label>
                  <Select value={importBureau} onValueChange={setImportBureau}>
                    <SelectTrigger className="bg-slate-800 border-slate-600 text-white h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(BUREAUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2">
                  <Button onClick={() => setShowManualAdd(true)} variant="outline" className="border-slate-600 text-gray-300 h-9">
                    <Plus className="w-4 h-4 mr-1" /> Manual Entry
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-gray-300 text-xs">Paste your credit report text below</Label>
                <Textarea value={importText} onChange={e => setImportText(e.target.value)} placeholder="Copy and paste the full text of your credit report from the bureau website, PDF viewer, or DOCX file..." className="bg-slate-800 border-slate-600 text-white font-mono text-xs min-h-[200px]" />
                <p className="text-[10px] text-gray-500">Supported: Copy-paste from PDF viewers, bureau websites, Word documents. Include all tradelines, inquiries, and collections.</p>
              </div>
              <Button onClick={handleImport} disabled={parsing || !importText.trim()} className="bg-blue-600 hover:bg-blue-700">
                {parsing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Parsing...</> : <><Bot className="w-4 h-4 mr-2" /> Parse & Import</>}
              </Button>
            </CardContent>
          </Card>

          {/* Bureau Guidance */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(BUREAUS).map(([key, bur]) => (
              <Card key={key} className={`glass-card border ${bur.color.split(' ')[2]}`}>
                <CardContent className="p-4">
                  <Badge className={`${bur.color.split(' ').slice(0, 2).join(' ')} border-0 mb-2`}>{bur.label}</Badge>
                  <div className="space-y-2 text-xs text-gray-300">
                    <p className="font-semibold text-white">How to get your report:</p>
                    <ol className="list-decimal list-inside space-y-1 text-gray-400">
                      <li>Visit <a href="https://www.annualcreditreport.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">AnnualCreditReport.com</a></li>
                      <li>Select {bur.label} and complete identity verification</li>
                      <li>View your full report online</li>
                      <li>Select all text (Ctrl+A), copy (Ctrl+C), and paste here</li>
                    </ol>
                    <p className="font-semibold text-white mt-2">Dispute online:</p>
                    <a href={bur.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline flex items-center gap-1">{bur.url.split('/')[2]} <ExternalLink className="w-3 h-3" /></a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* TRADELINES TAB */}
        <TabsContent value="tradelines" className="space-y-3">
          {myTradelines.length === 0 && myInquiries.length === 0 && myCollections.length === 0 ? (
            <Card className="glass-card border-slate-700"><CardContent className="p-10 text-center">
              <BarChart3 className="w-14 h-14 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No credit report items yet. Import a report to get started.</p>
            </CardContent></Card>
          ) : (
            <>
              {myTradelines.length > 0 && (
                <div>
                  <h4 className="text-white font-semibold text-sm mb-2">Tradelines ({myTradelines.length})</h4>
                  <div className="space-y-2">
                    {myTradelines.map(t => (
                      <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-700">
                        <div className="flex items-center gap-3 min-w-0">
                          <Badge className={`text-[10px] border ${BUREAUS[t.bureau]?.color || 'bg-gray-500/20 text-gray-300'}`}>{(t.bureau || '').slice(0, 3).toUpperCase()}</Badge>
                          <div className="min-w-0">
                            <p className="text-white text-sm font-medium truncate">{t.creditor}</p>
                            <p className="text-gray-500 text-[10px]">{t.account_type?.replace(/_/g, ' ')} · {t.account_number ? `••${t.account_number.slice(-4)}` : 'N/A'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {t.balance && <p className="text-white text-sm font-mono">{t.balance}</p>}
                          <Badge className={`text-[10px] border-0 ${t.status === 'delinquent' ? 'bg-red-500/20 text-red-300' : t.status === 'closed' ? 'bg-gray-500/20 text-gray-300' : 'bg-green-500/20 text-green-300'}`}>{t.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {myInquiries.length > 0 && (
                <div>
                  <h4 className="text-white font-semibold text-sm mb-2">Inquiries ({myInquiries.length})</h4>
                  <div className="space-y-2">
                    {myInquiries.map(i => (
                      <div key={i.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-700">
                        <div className="flex items-center gap-3">
                          <Badge className={`text-[10px] border ${BUREAUS[i.bureau]?.color || 'bg-gray-500/20 text-gray-300'}`}>{(i.bureau || '').slice(0, 3).toUpperCase()}</Badge>
                          <p className="text-white text-sm">{i.creditor}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {i.date && <p className="text-gray-400 text-xs">{i.date}</p>}
                          <Badge className={`text-[10px] border-0 ${i.type === 'hard' ? 'bg-red-500/20 text-red-300' : 'bg-gray-500/20 text-gray-300'}`}>{i.type}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {myCollections.length > 0 && (
                <div>
                  <h4 className="text-white font-semibold text-sm mb-2">Collections ({myCollections.length})</h4>
                  <div className="space-y-2">
                    {myCollections.map(c => (
                      <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-red-500/20">
                        <div className="flex items-center gap-3">
                          <Badge className={`text-[10px] border ${BUREAUS[c.bureau]?.color || 'bg-gray-500/20 text-gray-300'}`}>{(c.bureau || '').slice(0, 3).toUpperCase()}</Badge>
                          <div>
                            <p className="text-white text-sm">{c.agency}</p>
                            {c.original_creditor && <p className="text-gray-500 text-[10px]">Original: {c.original_creditor}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {c.amount && <p className="text-white text-sm font-mono">{c.amount}</p>}
                          <Badge className={`text-[10px] border-0 ${c.status === 'paid' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>{c.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* COMPARE BUREAUS TAB */}
        <TabsContent value="compare" className="space-y-4">
          {crossBureauData.length === 0 ? (
            <Card className="glass-card border-slate-700"><CardContent className="p-10 text-center">
              <Eye className="w-14 h-14 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Import reports from at least two bureaus to see cross-bureau comparisons.</p>
            </CardContent></Card>
          ) : (
            <>
              <Card className="bg-amber-500/5 border-amber-500/20"><CardContent className="p-3">
                <p className="text-xs text-amber-200"><AlertTriangle className="w-3 h-3 inline mr-1" />Items with mismatches across bureaus are strong dispute candidates — inconsistent reporting violates FCRA accuracy requirements.</p>
              </CardContent></Card>
              <div className="space-y-3">
                {crossBureauData.map((item, idx) => (
                  <Card key={idx} className={`glass-card ${item.mismatches.length > 0 ? 'border-amber-500/30' : 'border-slate-700'}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-white font-semibold text-sm">{item.creditor}</p>
                        {item.mismatches.length > 0 && <Badge className="text-[10px] bg-amber-500/20 text-amber-300 border-0">Mismatch: {item.mismatches.join(', ')}</Badge>}
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {['experian', 'equifax', 'transunion'].map(b => {
                          const t = item.bureaus[b];
                          return (
                            <div key={b} className={`p-2 rounded text-xs ${t ? 'bg-slate-800/50' : 'bg-slate-900/30 opacity-50'}`}>
                              <Badge className={`text-[10px] border ${BUREAUS[b].color.split(' ').slice(0, 2).join(' ')} ${BUREAUS[b].color.split(' ')[2]} mb-1`}>{BUREAUS[b].label}</Badge>
                              {t ? (
                                <div className="space-y-0.5">
                                  <p className="text-gray-300">Balance: <span className={item.mismatches.includes('balance') ? 'text-amber-300 font-semibold' : ''}>{t.balance || 'N/A'}</span></p>
                                  <p className="text-gray-300">Status: <span className={item.mismatches.includes('status') ? 'text-amber-300 font-semibold' : ''}>{t.status}</span></p>
                                  <p className="text-gray-400">{t.account_type?.replace(/_/g, ' ')}</p>
                                </div>
                              ) : (
                                <p className="text-gray-600 italic">Not reported</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {item.missingBureaus.length > 0 && item.bureauCount >= 1 && (
                        <p className="text-xs text-purple-300 mt-2"><AlertTriangle className="w-3 h-3 inline mr-1" />Missing from: {item.missingBureaus.map(b => BUREAUS[b].label).join(', ')}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* DISPUTES TAB */}
        <TabsContent value="disputes" className="space-y-3">
          {myDisputeItems.length === 0 ? (
            <Card className="glass-card border-slate-700"><CardContent className="p-10 text-center">
              <Scale className="w-14 h-14 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No dispute items yet. Import a report and click "Analyze" on a bureau card above.</p>
            </CardContent></Card>
          ) : (
            myDisputeItems.sort((a, b) => (b.confidence || 0) - (a.confidence || 0)).map(item => {
              const statusMeta = DISPUTE_STATUSES[item.status] || DISPUTE_STATUSES.identified;
              const StatusIcon = statusMeta.icon;
              const isExpanded = expandedItem === item.id;
              return (
                <Card key={item.id} className={`glass-card overflow-hidden ${item.confidence >= 60 ? 'border-amber-500/30' : 'border-slate-700'}`}>
                  <button onClick={() => setExpandedItem(isExpanded ? null : item.id)} className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/40">
                    <div className="flex items-center gap-3 min-w-0">
                      <StatusIcon className={`w-5 h-5 shrink-0 ${statusMeta.color.split(' ')[1]}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-white text-sm font-medium">{item.creditor}</p>
                          <Badge className={`text-[10px] border ${BUREAUS[item.bureau]?.color || 'bg-gray-500/20 text-gray-300'}`}>{(item.bureau || '').slice(0, 3).toUpperCase()}</Badge>
                          <Badge className={`text-[10px] border-0 ${statusMeta.color}`}>{statusMeta.label}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(item.dispute_categories || []).map(cat => (
                            <Badge key={cat} className="text-[10px] border-0 bg-slate-700 text-gray-300">{DISPUTE_CATEGORIES[cat] || cat}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {item.confidence != null && (
                        <div className="text-right">
                          <p className={`text-sm font-bold ${item.confidence >= 60 ? 'text-green-400' : item.confidence >= 40 ? 'text-amber-400' : 'text-gray-400'}`}>{item.confidence}%</p>
                          <p className="text-[10px] text-gray-500">confidence</p>
                        </div>
                      )}
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </button>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="px-4 pb-4 border-t border-slate-700/50 pt-3 space-y-3">
                          {item.rationale && <p className="text-xs text-gray-300">{item.rationale}</p>}
                          {item.risk_notes && <p className="text-xs text-amber-300"><AlertTriangle className="w-3 h-3 inline mr-1" />{item.risk_notes}</p>}
                          {item.dispute_path && <p className="text-xs text-purple-300">Path: <span className="font-semibold">{item.dispute_path?.replace(/_/g, ' ')}</span></p>}
                          {(item.evidence_needed || []).length > 0 && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Evidence needed:</p>
                              <ul className="list-disc list-inside text-xs text-gray-400 space-y-0.5">
                                {item.evidence_needed.map((e, i) => <li key={i}>{e}</li>)}
                              </ul>
                            </div>
                          )}
                          <div className="flex flex-wrap gap-2 pt-1">
                            {item.status === 'identified' && <Button size="sm" onClick={() => updateDisputeItem(item.id, { status: 'drafted' })} className="text-xs bg-blue-600 h-7"><FileText className="w-3 h-3 mr-1" />Mark Drafted</Button>}
                            {item.status === 'drafted' && (
                              <>
                                <Button size="sm" onClick={() => updateDisputeItem(item.id, { status: 'submitted_online' })} className="text-xs bg-amber-600 h-7"><Upload className="w-3 h-3 mr-1" />Submitted Online</Button>
                                <Button size="sm" onClick={() => updateDisputeItem(item.id, { status: 'mailed' })} variant="outline" className="text-xs border-purple-500/40 text-purple-300 h-7"><Mail className="w-3 h-3 mr-1" />Mailed</Button>
                              </>
                            )}
                            {(item.status === 'submitted_online' || item.status === 'mailed' || item.status === 'awaiting_response') && (
                              <>
                                <Button size="sm" onClick={() => updateDisputeItem(item.id, { status: 'corrected' })} className="text-xs bg-green-600 h-7"><CheckCircle className="w-3 h-3 mr-1" />Corrected</Button>
                                <Button size="sm" onClick={() => updateDisputeItem(item.id, { status: 'rejected' })} variant="outline" className="text-xs border-red-500/40 text-red-300 h-7">Rejected</Button>
                                <Button size="sm" onClick={() => updateDisputeItem(item.id, { status: 'escalated' })} variant="outline" className="text-xs border-orange-500/40 text-orange-300 h-7"><Gavel className="w-3 h-3 mr-1" />Escalate</Button>
                              </>
                            )}
                            {item.status === 'rejected' && <Button size="sm" onClick={() => updateDisputeItem(item.id, { status: 'escalated' })} className="text-xs bg-orange-600 h-7"><Gavel className="w-3 h-3 mr-1" />Escalate to CFPB</Button>}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* DISPUTE KIT TAB */}
        <TabsContent value="kit" className="space-y-4">
          {!kitData ? (
            <Card className="glass-card border-slate-700"><CardContent className="p-10 text-center">
              <Printer className="w-14 h-14 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 mb-4">Generate a dispute kit by clicking the "Kit" button on a bureau card above.</p>
              <div className="flex justify-center gap-3">
                {Object.entries(BUREAUS).map(([key, bur]) => {
                  const dCount = myDisputeItems.filter(d => d.bureau === key).length;
                  return (
                    <Button key={key} onClick={() => handleGenerateKit(key)} disabled={!!generatingKit || dCount === 0} variant="outline" className={`border ${bur.color.split(' ')[2]} ${bur.color.split(' ')[0]}`}>
                      {generatingKit === key ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{bur.label} ({dCount})</>}
                    </Button>
                  );
                })}
              </div>
            </CardContent></Card>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Printer className="w-5 h-5 text-green-400" />
                  Dispute Kit — {BUREAUS[kitData.bureau]?.label || kitData.bureau}
                </h3>
                <div className="flex gap-2">
                  <Button size="sm" onClick={exportKit} variant="outline" className="border-green-500/40 text-green-300 text-xs h-8"><Download className="w-3 h-3 mr-1" /> Export All</Button>
                  <Button size="sm" onClick={() => setKitData(null)} variant="outline" className="border-gray-600 text-gray-400 text-xs h-8">Close</Button>
                </div>
              </div>

              {/* Online Dispute */}
              {kitData.online_info && (
                <Card className="glass-card border-blue-500/20">
                  <CardContent className="p-4">
                    <h4 className="text-white text-sm font-semibold mb-2 flex items-center gap-2"><Globe className="w-4 h-4 text-blue-400" /> Dispute Online</h4>
                    <a href={kitData.online_info.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-sm underline flex items-center gap-1 mb-2">{kitData.online_info.url} <ExternalLink className="w-3 h-3" /></a>
                    <p className="text-xs text-gray-400 mb-3">{kitData.online_info.notes}</p>
                    <div className="relative">
                      <pre className="p-3 rounded bg-slate-800/50 border border-slate-700 text-xs text-gray-300 whitespace-pre-wrap font-sans max-h-[200px] overflow-y-auto">{kitData.online_copy}</pre>
                      <Button size="sm" onClick={() => copyText('online', kitData.online_copy)} className="absolute top-2 right-2 h-6 text-[10px] bg-slate-700">
                        {copied === 'online' ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Mail Letter */}
              {kitData.mail_letter && (
                <Card className="glass-card border-purple-500/20">
                  <CardContent className="p-4">
                    <h4 className="text-white text-sm font-semibold mb-2 flex items-center gap-2"><Mail className="w-4 h-4 text-purple-400" /> Mail-Ready Dispute Letter</h4>
                    <p className="text-xs text-gray-500 mb-2">Send to: {kitData.mail_address?.split('\n')[0]}</p>
                    <div className="relative">
                      <pre className="p-3 rounded bg-slate-800/50 border border-slate-700 text-xs text-gray-300 whitespace-pre-wrap font-sans max-h-[300px] overflow-y-auto">{kitData.mail_letter}</pre>
                      <Button size="sm" onClick={() => copyText('mail', kitData.mail_letter)} className="absolute top-2 right-2 h-6 text-[10px] bg-slate-700">
                        {copied === 'mail' ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Furnisher Letter */}
              {kitData.furnisher_letter && (
                <Card className="glass-card border-orange-500/20">
                  <CardContent className="p-4">
                    <h4 className="text-white text-sm font-semibold mb-2 flex items-center gap-2"><Gavel className="w-4 h-4 text-orange-400" /> Direct Furnisher Dispute Letter</h4>
                    <div className="relative">
                      <pre className="p-3 rounded bg-slate-800/50 border border-slate-700 text-xs text-gray-300 whitespace-pre-wrap font-sans max-h-[200px] overflow-y-auto">{kitData.furnisher_letter}</pre>
                      <Button size="sm" onClick={() => copyText('furnisher', kitData.furnisher_letter)} className="absolute top-2 right-2 h-6 text-[10px] bg-slate-700">
                        {copied === 'furnisher' ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Checklist */}
              {(kitData.checklist || []).length > 0 && (
                <Card className="glass-card border-green-500/20">
                  <CardContent className="p-4">
                    <h4 className="text-white text-sm font-semibold mb-2 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400" /> Submission Checklist</h4>
                    <div className="space-y-1.5">
                      {kitData.checklist.map((s, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-gray-300">
                          <div className="w-4 h-4 rounded border border-slate-600 shrink-0 mt-0.5" />
                          <span>{s}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {kitData.follow_up_date && (
                <Card className="bg-amber-500/5 border-amber-500/20"><CardContent className="p-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-400" />
                  <p className="text-xs text-amber-200">Follow-up date: <strong>{kitData.follow_up_date}</strong> — set a calendar reminder. Bureaus must respond within 30 days.</p>
                </CardContent></Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* EVIDENCE TAB */}
        <TabsContent value="evidence" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowAddEvidence(true)} className="bg-cyan-600 hover:bg-cyan-700"><Plus className="w-4 h-4 mr-1" /> Add Evidence</Button>
          </div>
          {myEvidence.length === 0 ? (
            <Card className="glass-card border-slate-700"><CardContent className="p-10 text-center">
              <Paperclip className="w-14 h-14 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No evidence logged yet. Add documents, screenshots, and correspondence to support your disputes.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {myEvidence.map(ev => (
                <div key={ev.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-700">
                  <div className="flex items-center gap-3 min-w-0">
                    <Paperclip className="w-4 h-4 text-cyan-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">{ev.title}</p>
                      <p className="text-gray-500 text-[10px]">{ev.evidence_type?.replace(/_/g, ' ')} · {new Date(ev.created_date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  {ev.description && <p className="text-gray-400 text-xs max-w-[200px] truncate">{ev.description}</p>}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TIMELINE TAB */}
        <TabsContent value="timeline" className="space-y-4">
          {myTimeline.length === 0 ? (
            <Card className="glass-card border-slate-700"><CardContent className="p-10 text-center">
              <Calendar className="w-14 h-14 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No dispute activity yet. Status changes will appear here automatically.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {myTimeline.map((entry, idx) => {
                const statusMeta = DISPUTE_STATUSES[entry.status] || DISPUTE_STATUSES.identified;
                const StatusIcon = statusMeta.icon;
                const relatedItem = myDisputeItems.find(d => d.id === entry.dispute_item_id);
                return (
                  <div key={entry.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${statusMeta.color.split(' ')[0]}`}>
                        <StatusIcon className={`w-4 h-4 ${statusMeta.color.split(' ')[1]}`} />
                      </div>
                      {idx < myTimeline.length - 1 && <div className="w-0.5 flex-1 bg-slate-700 mt-1" />}
                    </div>
                    <div className="pb-4 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`text-[10px] border-0 ${statusMeta.color}`}>{statusMeta.label}</Badge>
                        {relatedItem && <p className="text-white text-sm font-medium">{relatedItem.creditor}</p>}
                      </div>
                      {entry.note && <p className="text-xs text-gray-400 mt-0.5">{entry.note}</p>}
                      <p className="text-[10px] text-gray-600 mt-0.5">{new Date(entry.created_date).toLocaleString()}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Manual Add Dialog */}
      <Dialog open={showManualAdd} onOpenChange={setShowManualAdd}>
        <DialogContent className="bg-slate-900 border-blue-500/30 text-white max-w-md">
          <DialogHeader><DialogTitle>Add Credit Report Item</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-gray-300 text-xs">Bureau</Label>
                <Select value={manualForm.bureau} onValueChange={v => setManualForm({ ...manualForm, bureau: v })}><SelectTrigger className="bg-slate-800 border-slate-600 text-white h-9"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(BUREAUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1"><Label className="text-gray-300 text-xs">Type</Label>
                <Select value={manualForm.item_type} onValueChange={v => setManualForm({ ...manualForm, item_type: v })}><SelectTrigger className="bg-slate-800 border-slate-600 text-white h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="tradeline">Tradeline</SelectItem><SelectItem value="inquiry">Inquiry</SelectItem><SelectItem value="collection">Collection</SelectItem></SelectContent></Select>
              </div>
            </div>
            <div className="space-y-1"><Label className="text-gray-300 text-xs">Creditor / Agency</Label><Input value={manualForm.creditor} onChange={e => setManualForm({ ...manualForm, creditor: e.target.value })} className="bg-slate-800 border-slate-600 text-white h-9" /></div>
            {manualForm.item_type === 'tradeline' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-gray-300 text-xs">Account #</Label><Input value={manualForm.account_number} onChange={e => setManualForm({ ...manualForm, account_number: e.target.value })} className="bg-slate-800 border-slate-600 text-white h-9" /></div>
                <div className="space-y-1"><Label className="text-gray-300 text-xs">Balance</Label><Input value={manualForm.balance} onChange={e => setManualForm({ ...manualForm, balance: e.target.value })} placeholder="$0.00" className="bg-slate-800 border-slate-600 text-white h-9" /></div>
              </div>
            )}
            {manualForm.item_type === 'collection' && (
              <div className="space-y-1"><Label className="text-gray-300 text-xs">Amount</Label><Input value={manualForm.balance} onChange={e => setManualForm({ ...manualForm, balance: e.target.value })} placeholder="$0.00" className="bg-slate-800 border-slate-600 text-white h-9" /></div>
            )}
            <Button onClick={handleManualAdd} disabled={!manualForm.creditor} className="w-full bg-blue-600 hover:bg-blue-700">Add Item</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Evidence Dialog */}
      <Dialog open={showAddEvidence} onOpenChange={setShowAddEvidence}>
        <DialogContent className="bg-slate-900 border-cyan-500/30 text-white max-w-md">
          <DialogHeader><DialogTitle>Log Evidence / Document</DialogTitle>
            <DialogDescription className="text-gray-400">Record documents, screenshots, and correspondence. Files stay local on your device.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1"><Label className="text-gray-300 text-xs">Title</Label><Input value={evidenceForm.title} onChange={e => setEvidenceForm({ ...evidenceForm, title: e.target.value })} placeholder="e.g. Experian dispute letter, police report" className="bg-slate-800 border-slate-600 text-white h-9" /></div>
            <div className="space-y-1"><Label className="text-gray-300 text-xs">Type</Label>
              <Select value={evidenceForm.evidence_type} onValueChange={v => setEvidenceForm({ ...evidenceForm, evidence_type: v })}><SelectTrigger className="bg-slate-800 border-slate-600 text-white h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="document">Document</SelectItem><SelectItem value="screenshot">Screenshot</SelectItem><SelectItem value="letter">Letter / Correspondence</SelectItem><SelectItem value="police_report">Police Report</SelectItem><SelectItem value="ftc_report">FTC Identity Theft Report</SelectItem><SelectItem value="utility_bill">Utility Bill / Address Proof</SelectItem><SelectItem value="id_copy">ID Copy</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-1"><Label className="text-gray-300 text-xs">Notes / Description</Label><Textarea value={evidenceForm.description} onChange={e => setEvidenceForm({ ...evidenceForm, description: e.target.value })} placeholder="Details about this evidence..." className="bg-slate-800 border-slate-600 text-white" /></div>
            <Button onClick={addEvidence} disabled={!evidenceForm.title} className="w-full bg-cyan-600 hover:bg-cyan-700">Log Evidence</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
