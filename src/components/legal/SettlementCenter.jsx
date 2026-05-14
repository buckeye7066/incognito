import { useState, useMemo } from 'react';
import { incognito } from '@/api/client';
import { notify } from '@/lib/notify';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Gavel, Loader2, Clock, CheckCircle,
  ExternalLink, Plus, Bot, Sparkles, FileText, Trash2,
  ChevronDown, ChevronUp, Star, Shield,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CONFIDENCE_META = {
  likely_eligible: { label: 'Likely Eligible', color: 'bg-green-500/20 text-green-300 border-green-500/30', icon: CheckCircle },
  possible_match: { label: 'Possible Match', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30', icon: Star },
  needs_proof: { label: 'Needs Proof', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', icon: FileText },
  unlikely: { label: 'Unlikely', color: 'bg-gray-500/20 text-gray-300 border-gray-500/30', icon: Shield },
};

const CATEGORY_LABELS = {
  data_breach: 'Data Breach', privacy: 'Privacy', consumer_fraud: 'Consumer Fraud',
  product_liability: 'Product', employment: 'Employment', financial: 'Financial',
};

export default function SettlementCenter({ profileId }) {
  const queryClient = useQueryClient();
  const [scanning, setScanning] = useState(false);
  const [expandedCase, setExpandedCase] = useState(null);
  const [showAddCase, setShowAddCase] = useState(null);
  const [showClaimPrep, setShowClaimPrep] = useState(null);
  const [filterConf, setFilterConf] = useState('all');
  const [filterNoProof, setFilterNoProof] = useState(false);
  const [claimNotes, setClaimNotes] = useState('');
  const [copied, setCopied] = useState(false);
  const [caseForm, setCaseForm] = useState({
    case_name: '', company: '', category: 'data_breach', deadline: '',
    payout: '', no_proof: false, proof_required: '', eligibility: '',
    url: '', notes: '',
  });

  const { data: cases = [] } = useQuery({
    queryKey: ['settlementCases'],
    queryFn: () => incognito.entities.SettlementCase.list(),
  });
  const { data: matches = [] } = useQuery({
    queryKey: ['settlementMatches'],
    queryFn: () => incognito.entities.SettlementMatch.list(),
  });
  const { data: claims = [] } = useQuery({
    queryKey: ['settlementClaims'],
    queryFn: () => incognito.entities.SettlementClaim.list(),
  });
  const { data: personalData = [] } = useQuery({
    queryKey: ['personalData'],
    queryFn: () => incognito.entities.PersonalData.list(),
  });
  const { data: scanResults = [] } = useQuery({
    queryKey: ['scanResults'],
    queryFn: () => incognito.entities.ScanResult.list(),
  });
  const { data: subscriptions = [] } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => incognito.entities.Subscription.list(),
  });

  const myCases = cases.filter(c => !profileId || c.profile_id === profileId);
  const myMatches = matches.filter(m => !profileId || m.profile_id === profileId);
  const myClaims = claims.filter(c => !profileId || c.profile_id === profileId);
  const myData = personalData.filter(d => !profileId || d.profile_id === profileId);
  const myBreaches = scanResults.filter(r => !profileId || r.profile_id === profileId);
  const mySubs = subscriptions.filter(s => !profileId || s.profile_id === profileId);

  const createCase = useMutation({
    mutationFn: (data) => incognito.entities.SettlementCase.create({ ...data, profile_id: profileId, status: 'tracked', created_date: new Date().toISOString() }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['settlementCases'] }); setShowAddCase(null); setCaseForm({ case_name: '', company: '', category: 'data_breach', deadline: '', payout: '', no_proof: false, proof_required: '', eligibility: '', url: '', notes: '' }); },
  });

  const createClaim = useMutation({
    mutationFn: (data) => incognito.entities.SettlementClaim.create({ ...data, profile_id: profileId, status: 'preparing', created_date: new Date().toISOString() }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['settlementClaims'] }); setShowClaimPrep(null); setClaimNotes(''); },
  });

  const deleteCase = useMutation({
    mutationFn: (id) => incognito.entities.SettlementCase.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settlementCases'] }),
  });

  const handleScan = async () => {
    setScanning(true);
    try {
      const result = await incognito.functions.invoke('matchSettlements', {
        profileData: myData, breaches: myBreaches, subscriptions: mySubs,
      });
      const found = result.data?.cases || result.cases || [];
      for (const c of found) {
        const exists = myCases.some(ec => ec.case_name?.toLowerCase() === c.case_name?.toLowerCase());
        if (!exists) {
          await incognito.entities.SettlementCase.create({
            ...c, profile_id: profileId, status: 'tracked',
            created_date: new Date().toISOString(),
          });
        }
      }
      queryClient.invalidateQueries({ queryKey: ['settlementCases'] });
    } catch (e) {
      notify.error('Settlement search failed: ' + (e.message || 'Unknown error'));
    } finally {
      setScanning(false);
    }
  };

  const allCombined = useMemo(() => {
    let items = [...myCases];
    if (filterConf !== 'all') items = items.filter(c => c.confidence === filterConf);
    if (filterNoProof) items = items.filter(c => c.no_proof);
    items.sort((a, b) => {
      const confOrder = { likely_eligible: 0, possible_match: 1, needs_proof: 2, unlikely: 3 };
      return (confOrder[a.confidence] || 4) - (confOrder[b.confidence] || 4);
    });
    return items;
  }, [myCases, filterConf, filterNoProof]);

  const noProofCount = myCases.filter(c => c.no_proof).length;
  const likelyCount = myCases.filter(c => c.confidence === 'likely_eligible').length;
  const claimedCount = myClaims.length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Cases Found', value: myCases.length, icon: Gavel, color: 'text-purple-400' },
          { label: 'Likely Eligible', value: likelyCount, icon: CheckCircle, color: likelyCount > 0 ? 'text-green-400' : 'text-gray-400' },
          { label: 'No-Proof Claims', value: noProofCount, icon: Sparkles, color: noProofCount > 0 ? 'text-amber-400' : 'text-gray-400' },
          { label: 'Claims Started', value: claimedCount, icon: FileText, color: 'text-blue-400' },
        ].map(s => (
          <Card key={s.label} className="glass-card border-purple-500/10">
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

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        <Button onClick={handleScan} disabled={scanning} className="bg-gradient-to-r from-purple-600 to-indigo-600">
          {scanning ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scanning...</> : <><Bot className="w-4 h-4 mr-2" /> Find Settlements</>}
        </Button>
        <Button onClick={() => setShowAddCase(true)} variant="outline" className="border-purple-500/40 text-purple-300">
          <Plus className="w-4 h-4 mr-1" /> Add Manually
        </Button>
        <div className="flex-1" />
        <Button size="sm" variant={filterNoProof ? 'default' : 'outline'} onClick={() => setFilterNoProof(!filterNoProof)}
          className={filterNoProof ? 'bg-amber-600' : 'border-amber-500/40 text-amber-300'}>
          <Sparkles className="w-3 h-3 mr-1" /> No-Proof Only
        </Button>
        <Select value={filterConf} onValueChange={setFilterConf}>
          <SelectTrigger className="bg-slate-800 border-slate-600 text-white h-9 w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Confidence</SelectItem>
            <SelectItem value="likely_eligible">Likely Eligible</SelectItem>
            <SelectItem value="possible_match">Possible Match</SelectItem>
            <SelectItem value="needs_proof">Needs Proof</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cases */}
      {allCombined.length === 0 ? (
        <Card className="glass-card border-slate-700">
          <CardContent className="p-10 text-center">
            <Gavel className="w-14 h-14 text-purple-500 mx-auto mb-4 opacity-50" />
            <p className="text-gray-300 text-lg">No settlement cases tracked yet</p>
            <p className="text-gray-500 text-sm mt-1">Click "Find Settlements" to scan your breach history for matches</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {allCombined.map(c => {
            const conf = CONFIDENCE_META[c.confidence] || CONFIDENCE_META.possible_match;
            const ConfIcon = conf.icon;
            const isExpanded = expandedCase === c.id;
            const hasClaim = myClaims.some(cl => cl.case_id === c.id);

            return (
              <Card key={c.id} className={`glass-card overflow-hidden ${c.no_proof ? 'border-amber-500/30' : 'border-slate-700'}`}>
                <button onClick={() => setExpandedCase(isExpanded ? null : c.id)} className="w-full p-5 flex items-center justify-between text-left hover:bg-slate-800/40 transition-colors">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                      <Gavel className="w-5 h-5 text-purple-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white font-semibold text-sm">{c.case_name || c.company}</p>
                        <Badge className={`text-[10px] border ${conf.color}`}><ConfIcon className="w-3 h-3 mr-0.5" />{conf.label}</Badge>
                        {c.no_proof && <Badge className="text-[10px] border-0 bg-amber-500/20 text-amber-300"><Sparkles className="w-3 h-3 mr-0.5" />No Proof</Badge>}
                        {hasClaim && <Badge className="text-[10px] border-0 bg-blue-500/20 text-blue-300">Claim Started</Badge>}
                      </div>
                      <p className="text-gray-400 text-xs mt-0.5">
                        {c.company} · {CATEGORY_LABELS[c.category] || c.category}
                        {c.payout && ` · ${c.payout}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {c.deadline && c.deadline !== 'closed' && (
                      <div className="text-right">
                        <p className="text-xs text-amber-400 flex items-center gap-1"><Clock className="w-3 h-3" />{c.deadline}</p>
                      </div>
                    )}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="px-5 pb-5 border-t border-slate-700/50 pt-4 space-y-3">
                        {c.eligibility && <p className="text-sm text-gray-300"><strong className="text-gray-400">Who qualifies:</strong> {c.eligibility}</p>}
                        {c.proof_required && <p className="text-sm text-gray-300"><strong className="text-gray-400">Proof needed:</strong> {c.proof_required}</p>}
                        {c.matched_via && <p className="text-sm text-purple-300"><strong className="text-gray-400">Matched via:</strong> {c.matched_via}</p>}
                        {c.notes && <p className="text-sm text-gray-400">{c.notes}</p>}
                        <div className="flex flex-wrap gap-2 pt-2">
                          {c.url && (
                            <a href={c.url} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="outline" className="text-xs border-blue-500/40 text-blue-300 h-8">
                                <ExternalLink className="w-3 h-3 mr-1" /> Settlement Site
                              </Button>
                            </a>
                          )}
                          {!hasClaim && (
                            <Button size="sm" onClick={() => setShowClaimPrep(c)} className="text-xs bg-green-600 hover:bg-green-700 h-8">
                              <FileText className="w-3 h-3 mr-1" /> Start Claim Prep
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => { if (confirm('Remove this case?')) deleteCase.mutate(c.id); }} className="text-xs border-gray-600 text-gray-400 h-8">
                            <Trash2 className="w-3 h-3 mr-1" /> Remove
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Case Dialog */}
      <Dialog open={!!showAddCase} onOpenChange={() => setShowAddCase(null)}>
        <DialogContent className="bg-slate-900 border-purple-500/30 text-white max-w-md">
          <DialogHeader><DialogTitle>Add Settlement Case</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1"><Label className="text-gray-300 text-xs">Case Name</Label><Input value={caseForm.case_name} onChange={e => setCaseForm({ ...caseForm, case_name: e.target.value })} placeholder="e.g. Equifax Data Breach Settlement" className="bg-slate-800 border-slate-600 text-white h-9" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-gray-300 text-xs">Company</Label><Input value={caseForm.company} onChange={e => setCaseForm({ ...caseForm, company: e.target.value })} placeholder="Defendant" className="bg-slate-800 border-slate-600 text-white h-9" /></div>
              <div className="space-y-1"><Label className="text-gray-300 text-xs">Category</Label>
                <Select value={caseForm.category} onValueChange={v => setCaseForm({ ...caseForm, category: v })}><SelectTrigger className="bg-slate-800 border-slate-600 text-white h-9"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(CATEGORY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-gray-300 text-xs">Deadline</Label><Input type="date" value={caseForm.deadline} onChange={e => setCaseForm({ ...caseForm, deadline: e.target.value })} className="bg-slate-800 border-slate-600 text-white h-9" /></div>
              <div className="space-y-1"><Label className="text-gray-300 text-xs">Est. Payout</Label><Input value={caseForm.payout} onChange={e => setCaseForm({ ...caseForm, payout: e.target.value })} placeholder="$25-$500" className="bg-slate-800 border-slate-600 text-white h-9" /></div>
            </div>
            <div className="space-y-1"><Label className="text-gray-300 text-xs">Settlement URL</Label><Input value={caseForm.url} onChange={e => setCaseForm({ ...caseForm, url: e.target.value })} placeholder="https://..." className="bg-slate-800 border-slate-600 text-white h-9" /></div>
            <div className="space-y-1"><Label className="text-gray-300 text-xs">Eligibility</Label><Input value={caseForm.eligibility} onChange={e => setCaseForm({ ...caseForm, eligibility: e.target.value })} placeholder="Who qualifies?" className="bg-slate-800 border-slate-600 text-white h-9" /></div>
            <div className="space-y-1"><Label className="text-gray-300 text-xs">Notes</Label><Textarea value={caseForm.notes} onChange={e => setCaseForm({ ...caseForm, notes: e.target.value })} placeholder="Additional info..." className="bg-slate-800 border-slate-600 text-white" /></div>
            <Button onClick={() => createCase.mutate({ ...caseForm, confidence: 'possible_match' })} disabled={!caseForm.case_name || createCase.isPending} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600">
              {createCase.isPending ? 'Adding...' : 'Add Case'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Claim Prep Dialog */}
      <Dialog open={!!showClaimPrep} onOpenChange={() => setShowClaimPrep(null)}>
        <DialogContent className="bg-slate-900 border-green-500/30 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-green-400" /> Claim Preparation</DialogTitle>
            <DialogDescription className="text-gray-400">{showClaimPrep?.case_name}</DialogDescription>
          </DialogHeader>
          {showClaimPrep && (
            <div className="space-y-4 pt-2">
              <Card className="bg-slate-800/50 border-green-500/20"><CardContent className="p-3">
                <h4 className="text-white text-sm font-semibold mb-2">Why you may qualify</h4>
                <p className="text-xs text-gray-300">{showClaimPrep.matched_via || showClaimPrep.eligibility || 'Your breach history or subscriptions match this company.'}</p>
              </CardContent></Card>

              <div>
                <h4 className="text-white text-sm font-semibold mb-2">Checklist</h4>
                <div className="space-y-2">
                  {[
                    showClaimPrep.no_proof ? 'No proof of purchase required — just submit the claim' : 'Gather proof of purchase or account membership',
                    'Visit the settlement website and read eligibility requirements',
                    'Collect any breach notification emails or letters',
                    'Note dates you used the product/service',
                    'Document any losses or damages from the breach',
                    `Submit claim ${showClaimPrep.deadline ? `before ${showClaimPrep.deadline}` : 'as soon as possible'}`,
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-gray-300">
                      <div className="w-5 h-5 rounded border border-slate-600 shrink-0 mt-0.5" />
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-gray-300 text-xs">Your Notes</Label>
                <Textarea value={claimNotes} onChange={e => setClaimNotes(e.target.value)} placeholder="Evidence, account numbers, dates..." className="bg-slate-800 border-slate-600 text-white" />
              </div>

              <Button onClick={() => createClaim.mutate({ case_id: showClaimPrep.id, case_name: showClaimPrep.case_name, company: showClaimPrep.company, notes: claimNotes, deadline: showClaimPrep.deadline, payout: showClaimPrep.payout })} disabled={createClaim.isPending} className="w-full bg-green-600 hover:bg-green-700">
                {createClaim.isPending ? 'Saving...' : 'Save Claim Prep'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
