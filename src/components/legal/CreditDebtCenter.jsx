import { useState } from 'react';
import { incognito } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DollarSign, Plus, Loader2, FileText, Copy, CheckCircle, AlertTriangle,
  Trash2, Scale, Shield, TrendingDown, TrendingUp, Calculator,
  ChevronDown, ChevronUp, Landmark,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ISSUE_TYPES = {
  collection: { label: 'Collection', color: 'text-red-400 bg-red-500/15' },
  charge_off: { label: 'Charge-Off', color: 'text-orange-400 bg-orange-500/15' },
  late_payment: { label: 'Late Payment', color: 'text-amber-400 bg-amber-500/15' },
  identity_theft_debt: { label: 'ID Theft Debt', color: 'text-purple-400 bg-purple-500/15' },
  medical_debt: { label: 'Medical Debt', color: 'text-blue-400 bg-blue-500/15' },
  disputed_tradeline: { label: 'Disputed Tradeline', color: 'text-cyan-400 bg-cyan-500/15' },
  settlement_offer: { label: 'Settlement Offer', color: 'text-green-400 bg-green-500/15' },
};

const LETTER_TYPES = [
  { value: 'dispute', label: 'Credit Dispute (FCRA)' },
  { value: 'debt_validation', label: 'Debt Validation (FDCPA)' },
  { value: 'goodwill', label: 'Goodwill Adjustment' },
  { value: 'cease_contact', label: 'Cease Communication' },
  { value: 'identity_theft', label: 'Identity Theft Affidavit' },
];

const RELIEF_SCENARIOS = [
  { id: 'pay_full', label: 'Pay in Full', score_impact: '+30-50 pts over 6mo', risk: 'None', burden: 'High cost', pro: 'Best long-term credit impact', con: 'Requires full payment' },
  { id: 'settle', label: 'Negotiate Settlement', score_impact: '+10-30 pts', risk: 'Low — may report as "settled"', burden: 'Moderate cost (40-60%)', pro: 'Lower cost than full payment', con: 'May still show negative mark' },
  { id: 'hardship', label: 'Hardship Request', score_impact: 'Varies', risk: 'Low', burden: 'Documentation', pro: 'May reduce payments/interest', con: 'Temporary solution' },
  { id: 'dispute', label: 'Dispute Accuracy', score_impact: 'Removed if invalid (+50-100 pts)', risk: 'None', burden: 'Letters + follow-up', pro: 'Free, can fully remove item', con: 'Only works if legitimately inaccurate' },
  { id: 'validate', label: 'Validate Debt', score_impact: 'Removed if unverified', risk: 'None', burden: 'One letter', pro: 'May eliminate debt entirely', con: 'Creditor may still validate' },
  { id: 'identity_theft', label: 'Identity Theft Claim', score_impact: 'Removed (+50-100 pts)', risk: 'Legal risk if fraudulent claim', burden: 'Police report + affidavit', pro: 'Full removal if legitimate', con: 'Only for actual ID theft' },
];

export default function CreditDebtCenter({ profileId }) {
  const queryClient = useQueryClient();
  const [showAddIssue, setShowAddIssue] = useState(false);
  const [showLetterGen, setShowLetterGen] = useState(null);
  const [expandedIssue, setExpandedIssue] = useState(null);
  const [letterLoading, setLetterLoading] = useState(false);
  const [generatedLetter, setGeneratedLetter] = useState(null);
  const [copied, setCopied] = useState(false);
  const [issueForm, setIssueForm] = useState({
    issue_type: 'collection', creditor: '', amount: '', account_number: '',
    original_creditor: '', date_opened: '', description: '', status: 'active',
  });
  const [letterType, setLetterType] = useState('dispute');
  const [letterReason, setLetterReason] = useState('');

  const { data: issues = [] } = useQuery({
    queryKey: ['debtIssues'],
    queryFn: () => incognito.entities.DebtIssue.list(),
  });
  const { data: disputes = [] } = useQuery({
    queryKey: ['creditDisputes'],
    queryFn: () => incognito.entities.CreditDispute.list(),
  });

  const myIssues = issues.filter(i => !profileId || i.profile_id === profileId);
  const myDisputes = disputes.filter(d => !profileId || d.profile_id === profileId);

  const totalDebt = myIssues.filter(i => i.status !== 'resolved').reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const activeCount = myIssues.filter(i => i.status === 'active').length;
  const disputedCount = myIssues.filter(i => i.status === 'disputed').length;

  const createIssue = useMutation({
    mutationFn: (data) => incognito.entities.DebtIssue.create({ ...data, profile_id: profileId, amount: parseFloat(data.amount) || 0, created_date: new Date().toISOString() }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['debtIssues'] }); setShowAddIssue(false); setIssueForm({ issue_type: 'collection', creditor: '', amount: '', account_number: '', original_creditor: '', date_opened: '', description: '', status: 'active' }); },
  });

  const updateIssue = useMutation({
    mutationFn: ({ id, data }) => incognito.entities.DebtIssue.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['debtIssues'] }),
  });

  const deleteIssue = useMutation({
    mutationFn: (id) => incognito.entities.DebtIssue.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['debtIssues'] }),
  });

  const handleGenerateLetter = async () => {
    setLetterLoading(true);
    setGeneratedLetter(null);
    try {
      const issue = showLetterGen;
      const result = await incognito.functions.invoke('generateDisputeLetter', {
        issueType: letterType,
        creditor: issue?.creditor,
        amount: issue?.amount,
        accountNumber: issue?.account_number,
        reason: letterReason || issue?.description,
        bureaus: ['Equifax', 'Experian', 'TransUnion'],
      });
      setGeneratedLetter(result.data?.letter || result.letter || 'Failed to generate letter.');
    } catch (e) {
      setGeneratedLetter('Error generating letter. Please try again.');
    } finally {
      setLetterLoading(false);
    }
  };

  const copyLetter = () => {
    if (generatedLetter) {
      navigator.clipboard.writeText(generatedLetter);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="space-y-6">
      {/* Disclaimer */}
      <Card className="bg-amber-500/5 border-amber-500/20">
        <CardContent className="p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-200">This tool provides informational guidance only — not legal advice. Outcomes are not guaranteed. Consult a licensed attorney for your specific situation.</p>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Debt Issues', value: myIssues.length, icon: DollarSign, color: 'text-red-400' },
          { label: 'Active Issues', value: activeCount, icon: AlertTriangle, color: activeCount > 0 ? 'text-red-400' : 'text-green-400' },
          { label: 'Under Dispute', value: disputedCount, icon: Scale, color: 'text-amber-400' },
          { label: 'Total Amount', value: `$${totalDebt.toLocaleString()}`, icon: Landmark, color: 'text-purple-400' },
        ].map(s => (
          <Card key={s.label} className="glass-card border-red-500/10">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`w-7 h-7 ${s.color}`} />
              <div>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-gray-400 text-xs">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="issues" className="space-y-4">
        <TabsList className="bg-slate-800/60 border border-slate-700">
          <TabsTrigger value="issues" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-600 data-[state=active]:to-purple-600">Debt Issues</TabsTrigger>
          <TabsTrigger value="scenarios" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600">Relief Scenarios</TabsTrigger>
          <TabsTrigger value="roadmap" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-600 data-[state=active]:to-emerald-600">Recovery Roadmap</TabsTrigger>
        </TabsList>

        <TabsContent value="issues" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowAddIssue(true)} className="bg-gradient-to-r from-red-600 to-purple-600"><Plus className="w-4 h-4 mr-1" /> Log Debt Issue</Button>
          </div>

          {myIssues.length === 0 ? (
            <Card className="glass-card border-slate-700"><CardContent className="p-10 text-center">
              <DollarSign className="w-14 h-14 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No debt issues logged yet. Add collections, charge-offs, or disputed accounts to start planning.</p>
            </CardContent></Card>
          ) : (
            myIssues.sort((a, b) => (b.amount || 0) - (a.amount || 0)).map(issue => {
              const meta = ISSUE_TYPES[issue.issue_type] || ISSUE_TYPES.collection;
              const isExpanded = expandedIssue === issue.id;
              return (
                <Card key={issue.id} className="glass-card overflow-hidden border-slate-700">
                  <button onClick={() => setExpandedIssue(isExpanded ? null : issue.id)} className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/40">
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge className={`text-xs border-0 ${meta.color}`}>{meta.label}</Badge>
                      <div className="min-w-0">
                        <p className="text-white font-medium text-sm truncate">{issue.creditor}</p>
                        <p className="text-gray-400 text-xs">{issue.original_creditor ? `Original: ${issue.original_creditor}` : issue.account_number || ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {issue.amount > 0 && <p className="text-white font-mono text-sm">${Number(issue.amount).toLocaleString()}</p>}
                      <Badge className={`text-[10px] border-0 ${issue.status === 'resolved' ? 'bg-green-500/20 text-green-300' : issue.status === 'disputed' ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300'}`}>{issue.status}</Badge>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </button>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="px-4 pb-4 border-t border-slate-700/50 pt-3 space-y-3">
                          {issue.description && <p className="text-xs text-gray-400">{issue.description}</p>}
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" onClick={() => { setShowLetterGen(issue); setGeneratedLetter(null); }} className="text-xs bg-purple-600 hover:bg-purple-700 h-8"><FileText className="w-3 h-3 mr-1" /> Generate Letter</Button>
                            {issue.status === 'active' && <Button size="sm" variant="outline" onClick={() => updateIssue.mutate({ id: issue.id, data: { status: 'disputed' } })} className="text-xs border-amber-500/40 text-amber-300 h-8"><Scale className="w-3 h-3 mr-1" /> Mark Disputed</Button>}
                            {issue.status !== 'resolved' && <Button size="sm" variant="outline" onClick={() => updateIssue.mutate({ id: issue.id, data: { status: 'resolved' } })} className="text-xs border-green-500/40 text-green-300 h-8"><CheckCircle className="w-3 h-3 mr-1" /> Resolve</Button>}
                            <Button size="sm" variant="outline" onClick={() => { if (confirm('Delete this issue?')) deleteIssue.mutate(issue.id); }} className="text-xs border-gray-600 text-gray-400 h-8"><Trash2 className="w-3 h-3 mr-1" /> Delete</Button>
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

        <TabsContent value="scenarios">
          <Card className="glass-card border-blue-500/20"><CardHeader><CardTitle className="text-white flex items-center gap-2"><Calculator className="w-5 h-5 text-blue-400" /> Debt Relief Strategy Comparison</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {RELIEF_SCENARIOS.map(s => (
                  <div key={s.id} className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-white font-semibold text-sm">{s.label}</h4>
                      <Badge className="text-[10px] bg-blue-500/20 text-blue-300 border-0">{s.score_impact}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div><p className="text-gray-500">Risk</p><p className="text-gray-300">{s.risk}</p></div>
                      <div><p className="text-gray-500">Effort</p><p className="text-gray-300">{s.burden}</p></div>
                      <div><p className="text-gray-500 flex items-center gap-1"><TrendingUp className="w-3 h-3 text-green-400" />Pro</p><p className="text-green-300">{s.pro}</p></div>
                      <div><p className="text-gray-500 flex items-center gap-1"><TrendingDown className="w-3 h-3 text-red-400" />Con</p><p className="text-red-300">{s.con}</p></div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roadmap">
          <Card className="glass-card border-green-500/20"><CardHeader><CardTitle className="text-white flex items-center gap-2"><Shield className="w-5 h-5 text-green-400" /> Credit Recovery Roadmap</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { phase: 'Week 1-2', title: 'Assess & Document', tasks: ['Pull free credit reports from AnnualCreditReport.com', 'List every negative item', 'Log each issue in this tool', 'Identify items that are inaccurate or unverifiable'] },
                  { phase: 'Week 3-4', title: 'Dispute Inaccuracies', tasks: ['Generate dispute letters for each inaccurate item', 'Send certified mail to all three bureaus', 'Send debt validation letters to collection agencies', 'Keep copies of everything'] },
                  { phase: 'Month 2-3', title: 'Negotiate & Settle', tasks: ['Review dispute results (30 days)', 'Negotiate pay-for-delete on valid collections', 'Request goodwill adjustments for late payments', 'Accept or counter settlement offers'] },
                  { phase: 'Month 3-6', title: 'Rebuild', tasks: ['Open secured credit card if needed', 'Become authorized user on established account', 'Set all bills to autopay', 'Keep utilization under 30%', 'Do NOT close old accounts'] },
                  { phase: 'Month 6-12', title: 'Monitor & Maintain', tasks: ['Check credit reports monthly', 'Dispute any new inaccuracies immediately', 'Graduate secured card to unsecured', 'Apply for credit increases (soft pull only)'] },
                ].map((phase, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center shrink-0"><span className="text-white font-bold text-sm">{i + 1}</span></div>
                      {i < 4 && <div className="w-0.5 flex-1 bg-green-600/30 mt-1" />}
                    </div>
                    <div className="pb-6 min-w-0">
                      <p className="text-xs text-green-400 font-semibold">{phase.phase}</p>
                      <h4 className="text-white font-semibold mb-2">{phase.title}</h4>
                      <div className="space-y-1">
                        {phase.tasks.map((t, j) => (
                          <div key={j} className="flex items-start gap-2 text-xs text-gray-300">
                            <div className="w-4 h-4 rounded border border-slate-600 shrink-0 mt-0.5" />
                            <span>{t}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Issue Dialog */}
      <Dialog open={showAddIssue} onOpenChange={setShowAddIssue}>
        <DialogContent className="bg-slate-900 border-red-500/30 text-white max-w-md">
          <DialogHeader><DialogTitle>Log Debt Issue</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-gray-300 text-xs">Type</Label>
                <Select value={issueForm.issue_type} onValueChange={v => setIssueForm({ ...issueForm, issue_type: v })}><SelectTrigger className="bg-slate-800 border-slate-600 text-white h-9"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(ISSUE_TYPES).map(([v, m]) => <SelectItem key={v} value={v}>{m.label}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1"><Label className="text-gray-300 text-xs">Amount ($)</Label><Input type="number" value={issueForm.amount} onChange={e => setIssueForm({ ...issueForm, amount: e.target.value })} placeholder="0.00" className="bg-slate-800 border-slate-600 text-white h-9" /></div>
            </div>
            <div className="space-y-1"><Label className="text-gray-300 text-xs">Creditor / Collection Agency</Label><Input value={issueForm.creditor} onChange={e => setIssueForm({ ...issueForm, creditor: e.target.value })} placeholder="Name" className="bg-slate-800 border-slate-600 text-white h-9" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-gray-300 text-xs">Account #</Label><Input value={issueForm.account_number} onChange={e => setIssueForm({ ...issueForm, account_number: e.target.value })} className="bg-slate-800 border-slate-600 text-white h-9" /></div>
              <div className="space-y-1"><Label className="text-gray-300 text-xs">Original Creditor</Label><Input value={issueForm.original_creditor} onChange={e => setIssueForm({ ...issueForm, original_creditor: e.target.value })} className="bg-slate-800 border-slate-600 text-white h-9" /></div>
            </div>
            <div className="space-y-1"><Label className="text-gray-300 text-xs">Description</Label><Textarea value={issueForm.description} onChange={e => setIssueForm({ ...issueForm, description: e.target.value })} placeholder="Details..." className="bg-slate-800 border-slate-600 text-white" /></div>
            <Button onClick={() => createIssue.mutate(issueForm)} disabled={!issueForm.creditor || createIssue.isPending} className="w-full bg-gradient-to-r from-red-600 to-purple-600">{createIssue.isPending ? 'Saving...' : 'Log Issue'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Letter Generator Dialog */}
      <Dialog open={!!showLetterGen} onOpenChange={() => { setShowLetterGen(null); setGeneratedLetter(null); }}>
        <DialogContent className="bg-slate-900 border-purple-500/30 text-white max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-purple-400" /> Generate Letter — {showLetterGen?.creditor}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-gray-300 text-xs">Letter Type</Label>
                <Select value={letterType} onValueChange={setLetterType}><SelectTrigger className="bg-slate-800 border-slate-600 text-white h-9"><SelectValue /></SelectTrigger><SelectContent>{LETTER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1"><Label className="text-gray-300 text-xs">Reason / Details</Label><Input value={letterReason} onChange={e => setLetterReason(e.target.value)} placeholder="Why disputing..." className="bg-slate-800 border-slate-600 text-white h-9" /></div>
            </div>
            <Button onClick={handleGenerateLetter} disabled={letterLoading} className="bg-purple-600 hover:bg-purple-700">
              {letterLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</> : <><FileText className="w-4 h-4 mr-2" /> Generate</>}
            </Button>
            {generatedLetter && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-400">Generated Letter</p>
                  <Button size="sm" variant="outline" onClick={copyLetter} className="border-purple-500/40 text-purple-300 text-xs h-7">
                    {copied ? <><CheckCircle className="w-3 h-3 mr-1" /> Copied!</> : <><Copy className="w-3 h-3 mr-1" /> Copy</>}
                  </Button>
                </div>
                <pre className="p-4 rounded-lg bg-slate-800/50 border border-slate-700 text-xs text-gray-300 whitespace-pre-wrap font-sans leading-relaxed max-h-[400px] overflow-y-auto">{generatedLetter}</pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
