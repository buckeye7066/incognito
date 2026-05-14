import { useState, useMemo } from 'react';
import { incognito } from '@/api/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Shield, Eye, ShieldOff, ShieldCheck, AlertTriangle,
  ChevronDown, ChevronUp, ExternalLink, Copy, CheckCircle,
  Loader2, Mail, Ban, Globe, Users,
  Fingerprint, AtSign, Phone, MapPin, CreditCard, FileText,
  Lock, Send,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const DATA_TYPE_META = {
  email:       { icon: AtSign,      label: 'Email',       color: 'text-blue-400',   bg: 'bg-blue-500/15 border-blue-500/30' },
  phone:       { icon: Phone,       label: 'Phone',       color: 'text-green-400',  bg: 'bg-green-500/15 border-green-500/30' },
  full_name:   { icon: Users,       label: 'Full Name',   color: 'text-purple-400', bg: 'bg-purple-500/15 border-purple-500/30' },
  address:     { icon: MapPin,      label: 'Address',     color: 'text-amber-400',  bg: 'bg-amber-500/15 border-amber-500/30' },
  credit_card: { icon: CreditCard,  label: 'Credit Card', color: 'text-red-400',    bg: 'bg-red-500/15 border-red-500/30' },
  ssn:         { icon: Fingerprint, label: 'SSN',         color: 'text-red-400',    bg: 'bg-red-500/15 border-red-500/30' },
  username:    { icon: AtSign,      label: 'Username',    color: 'text-cyan-400',   bg: 'bg-cyan-500/15 border-cyan-500/30' },
  password:    { icon: Lock,        label: 'Password',    color: 'text-red-400',    bg: 'bg-red-500/15 border-red-500/30' },
  dob:         { icon: FileText,    label: 'Date of Birth', color: 'text-pink-400', bg: 'bg-pink-500/15 border-pink-500/30' },
};

const maskValue = (type, value) => {
  if (!value) return '[unknown]';
  if (type === 'email') return value.replace(/(.{2}).+(@.+)/, '$1***$2');
  if (type === 'phone') return value.replace(/\d(?=\d{4})/g, '*');
  if (type === 'credit_card') return '•••• ' + value.slice(-4);
  if (type === 'ssn') return '***-**-' + value.slice(-4);
  if (type === 'address') return value.replace(/^\d+\s+/, '*** ');
  if (value.length > 6) return value.slice(0, 2) + '•••' + value.slice(-2);
  return value;
};

const SOURCE_TYPE_LABELS = {
  breach_database: 'Data Breach',
  identity_scan: 'Identity Scan',
  dark_web: 'Dark Web',
  breach_notice: 'Breach Notice',
  data_broker: 'Data Broker',
  people_search: 'People Search',
  social_media: 'Social Media',
};

export default function ExposureTracker({ profileId }) {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState(null);
  const [blockModal, setBlockModal] = useState(null);
  const [blockData, setBlockData] = useState(null);
  const [blockLoading, setBlockLoading] = useState(false);
  const [copied, setCopied] = useState(null);

  const { data: personalData = [] } = useQuery({
    queryKey: ['personalData'],
    queryFn: () => incognito.entities.PersonalData.list(),
  });

  const { data: scanResults = [] } = useQuery({
    queryKey: ['scanResults'],
    queryFn: () => incognito.entities.ScanResult.list(),
  });

  const { data: searchFindings = [] } = useQuery({
    queryKey: ['searchQueryFindings'],
    queryFn: () => incognito.entities.SearchQueryFinding.list(),
  });

  const { data: socialFindings = [] } = useQuery({
    queryKey: ['socialMediaFindings'],
    queryFn: () => incognito.entities.SocialMediaFinding.list(),
  });

  const myData = personalData.filter(d => !profileId || d.profile_id === profileId);
  const myScanResults = scanResults.filter(r => !profileId || r.profile_id === profileId);
  const mySearchFindings = searchFindings.filter(f => !profileId || f.profile_id === profileId);
  const mySocialFindings = socialFindings.filter(f => !profileId || f.profile_id === profileId);

  const identifierExposures = useMemo(() => {
    return myData.map(pd => {
      const exposures = [];

      myScanResults.forEach(sr => {
        const matches =
          sr.personal_data_id === pd.id ||
          (pd.data_type === 'email' && sr.metadata?.email?.toLowerCase() === pd.value?.toLowerCase()) ||
          (sr.data_exposed || []).some(d => d.toLowerCase().includes(pd.data_type.replace(/_/g, ' ')) || d.toLowerCase().includes(pd.data_type));
        if (matches) {
          exposures.push({
            id: sr.id,
            entity_type: 'scan_result',
            source_name: sr.source_name,
            source_url: sr.source_url,
            source_type: sr.metadata?.scan_type === 'dark_web' ? 'dark_web' : (sr.source_type || 'breach_database'),
            risk: sr.risk_score || 50,
            data_exposed: sr.data_exposed || [],
            status: sr.status,
            date: sr.scan_date || sr.created_date,
            description: sr.description || sr.metadata?.details,
            is_dark_web: sr.metadata?.scan_type === 'dark_web',
          });
        }
      });

      mySearchFindings.forEach(sf => {
        const dataTypes = (sf.data_found || []).map(d => d.toLowerCase());
        const matches =
          dataTypes.some(d => d.includes(pd.data_type.replace(/_/g, ' ')) || d.includes(pd.data_type)) ||
          (pd.data_type === 'full_name' && dataTypes.some(d => d.includes('name'))) ||
          (pd.data_type === 'email' && dataTypes.some(d => d.includes('email'))) ||
          (pd.data_type === 'phone' && dataTypes.some(d => d.includes('phone'))) ||
          (pd.data_type === 'address' && dataTypes.some(d => d.includes('address')));
        if (matches) {
          exposures.push({
            id: sf.id,
            entity_type: 'search_finding',
            source_name: sf.site_name,
            source_url: sf.site_url,
            source_type: 'data_broker',
            risk: sf.risk_level === 'high' ? 80 : sf.risk_level === 'medium' ? 50 : 25,
            data_exposed: sf.data_found || [],
            status: sf.status,
            date: sf.created_date,
            removal_url: sf.removal_url,
            removal_difficulty: sf.removal_difficulty,
          });
        }
      });

      mySocialFindings.forEach(sf => {
        const misusedTypes = (sf.misused_data || []).map(d => d.toLowerCase());
        const matches =
          misusedTypes.some(d => d.includes(pd.data_type.replace(/_/g, ' ')) || d.includes(pd.data_type)) ||
          (pd.data_type === 'full_name' && sf.match_type === 'impersonation');
        if (matches) {
          exposures.push({
            id: sf.id,
            entity_type: 'social_finding',
            source_name: `${sf.platform} — ${sf.suspicious_username || 'Unknown'}`,
            source_url: sf.profile_url || sf.suspicious_profile_url,
            source_type: 'social_media',
            risk: sf.confidence || 50,
            data_exposed: sf.misused_data || [],
            status: sf.status,
            date: sf.detected_date || sf.created_date,
            description: sf.description,
          });
        }
      });

      const deduped = [];
      const seen = new Set();
      for (const exp of exposures) {
        const key = `${exp.entity_type}:${exp.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(exp);
        }
      }

      deduped.sort((a, b) => b.risk - a.risk);

      return {
        identifier: pd,
        exposures: deduped,
        highRiskCount: deduped.filter(e => e.risk >= 70).length,
        totalRisk: deduped.reduce((s, e) => s + e.risk, 0),
      };
    })
    .filter(item => item.exposures.length > 0)
    .sort((a, b) => b.totalRisk - a.totalRisk);
  }, [myData, myScanResults, mySearchFindings, mySocialFindings]);

  const totalExposures = identifierExposures.reduce((s, i) => s + i.exposures.length, 0);
  const totalHighRisk = identifierExposures.reduce((s, i) => s + i.highRiskCount, 0);
  const identifiersExposed = identifierExposures.length;

  const handleBlock = async (exposure, identifier) => {
    setBlockModal({ exposure, identifier });
    setBlockData(null);
    setBlockLoading(true);
    try {
      const result = await incognito.functions.invoke('blockExposureSource', {
        sourceName: exposure.source_name,
        sourceUrl: exposure.source_url,
        sourceType: exposure.source_type,
        personalData: [{ data_type: identifier.data_type, value: identifier.value }],
      });
      setBlockData(result.data || result);
    } catch (e) {
      setBlockData({
        block_steps: ['Visit the source website and look for an opt-out page.', 'Submit a removal request.', 'If no response in 30 days, file an FTC complaint.'],
        removal_email: { subject: `Data Removal Request — ${exposure.source_name}`, body: 'Please remove all my personal data from your systems...' },
      });
    } finally {
      setBlockLoading(false);
    }
  };

  const handleMarkBlocked = (exposure) => {
    if (exposure.entity_type === 'scan_result') {
      incognito.entities.ScanResult.update(exposure.id, { status: 'removal_requested' });
      queryClient.invalidateQueries({ queryKey: ['scanResults'] });
    } else if (exposure.entity_type === 'search_finding') {
      incognito.entities.SearchQueryFinding.update(exposure.id, { status: 'dismissed' });
      queryClient.invalidateQueries({ queryKey: ['searchQueryFindings'] });
    } else if (exposure.entity_type === 'social_finding') {
      incognito.entities.SocialMediaFinding.update(exposure.id, { status: 'reported' });
      queryClient.invalidateQueries({ queryKey: ['socialMediaFindings'] });
    }
  };

  const copyText = (key, text) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Identifiers Exposed', value: identifiersExposed, icon: Fingerprint, color: identifiersExposed > 0 ? 'text-red-400' : 'text-green-400' },
          { label: 'Total Exposures', value: totalExposures, icon: Eye, color: totalExposures > 0 ? 'text-amber-400' : 'text-green-400' },
          { label: 'High Risk', value: totalHighRisk, icon: AlertTriangle, color: totalHighRisk > 0 ? 'text-red-400' : 'text-green-400' },
          { label: 'Sources Tracking You', value: new Set(identifierExposures.flatMap(i => i.exposures.map(e => e.source_name))).size, icon: Globe, color: 'text-purple-400' },
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

      {/* Identifier list */}
      {identifierExposures.length === 0 ? (
        <Card className="glass-card border-slate-700">
          <CardContent className="p-10 text-center">
            <ShieldCheck className="w-14 h-14 text-green-500 mx-auto mb-4" />
            <p className="text-green-300 text-lg font-semibold">No exposures found</p>
            <p className="text-gray-400 text-sm mt-1">
              Run a scan to check if your personal identifiers appear online.
              Go to Scans or use the Search Query monitor above.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {identifierExposures.map(({ identifier, exposures, highRiskCount }) => {
            const meta = DATA_TYPE_META[identifier.data_type] || DATA_TYPE_META.username;
            const Icon = meta.icon;
            const isExpanded = expandedId === identifier.id;

            return (
              <Card key={identifier.id} className={`glass-card overflow-hidden ${highRiskCount > 0 ? 'border-red-500/30' : 'border-slate-700'}`}>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : identifier.id)}
                  className="w-full p-5 flex items-center justify-between text-left hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${meta.bg}`}>
                      <Icon className={`w-6 h-6 ${meta.color}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white font-semibold">{meta.label}</p>
                        <span className="text-gray-400 font-mono text-sm">{maskValue(identifier.data_type, identifier.value)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={`text-[10px] border-0 ${highRiskCount > 0 ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'}`}>
                          {exposures.length} source{exposures.length !== 1 ? 's' : ''} have this data
                        </Badge>
                        {highRiskCount > 0 && (
                          <Badge className="text-[10px] border-0 bg-red-600/30 text-red-200">
                            {highRiskCount} high risk
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 ml-3">
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
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
                      <div className="px-5 pb-5 border-t border-slate-700/50 pt-4 space-y-3">
                        {exposures.map((exp) => {
                          const isBlocked = exp.status === 'removal_requested' || exp.status === 'dismissed' || exp.status === 'reported' || exp.status === 'removed';
                          return (
                            <div
                              key={`${exp.entity_type}-${exp.id}`}
                              className={`rounded-lg border p-4 ${isBlocked ? 'border-green-500/20 bg-green-500/5 opacity-60' : 'border-slate-700 bg-slate-800/30'}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <p className="text-white font-medium text-sm">{exp.source_name}</p>
                                    <Badge className={`text-[10px] border-0 ${
                                      exp.is_dark_web ? 'bg-red-600/30 text-red-200' :
                                      exp.source_type === 'data_broker' ? 'bg-amber-500/20 text-amber-300' :
                                      exp.source_type === 'social_media' ? 'bg-blue-500/20 text-blue-300' :
                                      'bg-purple-500/20 text-purple-300'
                                    }`}>
                                      {SOURCE_TYPE_LABELS[exp.source_type] || exp.source_type}
                                    </Badge>
                                    <Badge className={`text-[10px] border-0 ${
                                      exp.risk >= 70 ? 'bg-red-500/20 text-red-300' :
                                      exp.risk >= 40 ? 'bg-amber-500/20 text-amber-300' :
                                      'bg-green-500/20 text-green-300'
                                    }`}>
                                      Risk: {exp.risk}
                                    </Badge>
                                    {isBlocked && (
                                      <Badge className="text-[10px] border-0 bg-green-500/20 text-green-300">
                                        <ShieldCheck className="w-3 h-3 mr-0.5" /> Blocked
                                      </Badge>
                                    )}
                                  </div>

                                  {exp.data_exposed.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-2">
                                      {exp.data_exposed.map((d, i) => (
                                        <span key={i} className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700/50 text-gray-400">
                                          {d.replace(/_/g, ' ')}
                                        </span>
                                      ))}
                                    </div>
                                  )}

                                  {exp.description && (
                                    <p className="text-xs text-gray-500 mb-2 line-clamp-2">{exp.description}</p>
                                  )}

                                  {exp.date && (
                                    <p className="text-[10px] text-gray-600">
                                      {new Date(exp.date).toLocaleDateString()}
                                    </p>
                                  )}
                                </div>

                                <div className="flex flex-col gap-1.5 shrink-0">
                                  {!isBlocked && (
                                    <Button
                                      size="sm"
                                      onClick={() => handleBlock(exp, identifier)}
                                      className="bg-red-600 hover:bg-red-700 text-xs h-8"
                                    >
                                      <Ban className="w-3 h-3 mr-1" /> Block
                                    </Button>
                                  )}
                                  {exp.source_url && (
                                    <a href={exp.source_url} target="_blank" rel="noopener noreferrer">
                                      <Button size="sm" variant="outline" className="text-xs border-slate-600 text-gray-300 h-8 w-full">
                                        <ExternalLink className="w-3 h-3 mr-1" /> View
                                      </Button>
                                    </a>
                                  )}
                                  {exp.removal_url && (
                                    <a href={exp.removal_url} target="_blank" rel="noopener noreferrer">
                                      <Button size="sm" variant="outline" className="text-xs border-amber-500/40 text-amber-300 h-8 w-full">
                                        <ShieldOff className="w-3 h-3 mr-1" /> Opt Out
                                      </Button>
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            );
          })}
        </div>
      )}

      {/* Block / Removal Modal */}
      <Dialog open={!!blockModal} onOpenChange={() => { setBlockModal(null); setBlockData(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-slate-900 border-red-500/30">
          {blockModal && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl text-white flex items-center gap-2">
                  <Ban className="w-5 h-5 text-red-400" />
                  Block: {blockModal.exposure.source_name}
                </DialogTitle>
                <DialogDescription className="text-gray-400">
                  Remove your {DATA_TYPE_META[blockModal.identifier.data_type]?.label || 'data'} ({maskValue(blockModal.identifier.data_type, blockModal.identifier.value)}) from this source
                </DialogDescription>
              </DialogHeader>

              {blockLoading && (
                <div className="text-center py-10">
                  <Loader2 className="w-10 h-10 text-red-400 mx-auto mb-3 animate-spin" />
                  <p className="text-gray-400">Generating removal instructions for {blockModal.exposure.source_name}...</p>
                </div>
              )}

              {blockData && (
                <div className="space-y-4 pt-2">
                  {/* Steps */}
                  <Card className="bg-slate-800/50 border-red-500/20">
                    <CardContent className="p-4">
                      <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-red-400" /> Removal Steps
                      </h4>
                      <ol className="space-y-2 list-decimal list-inside">
                        {(blockData.block_steps || []).map((s, i) => (
                          <li key={i} className="text-sm text-gray-300 leading-relaxed pl-1">{s}</li>
                        ))}
                      </ol>
                    </CardContent>
                  </Card>

                  {/* Quick actions */}
                  <div className="flex flex-wrap gap-3">
                    {blockData.opt_out_url && (
                      <a href={blockData.opt_out_url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="border-red-500/40 text-red-300 hover:bg-red-500/10">
                          <ExternalLink className="w-3 h-3 mr-1" /> Opt-Out Page
                        </Button>
                      </a>
                    )}
                    {blockData.support_email && (
                      <a href={`mailto:${blockData.support_email}?subject=${encodeURIComponent(blockData.removal_email?.subject || 'Data Removal Request')}&body=${encodeURIComponent(blockData.removal_email?.body || '')}`}>
                        <Button size="sm" variant="outline" className="border-blue-500/40 text-blue-300 hover:bg-blue-500/10">
                          <Send className="w-3 h-3 mr-1" /> Email Support
                        </Button>
                      </a>
                    )}
                  </div>

                  {/* Removal email */}
                  {blockData.removal_email && (
                    <Card className="bg-slate-800/50 border-purple-500/20">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-white font-semibold flex items-center gap-2">
                            <Mail className="w-4 h-4 text-purple-400" /> Removal Demand Email
                          </h4>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyText('email', `Subject: ${blockData.removal_email.subject}\n\n${blockData.removal_email.body}`)}
                            className="border-purple-500/40 text-purple-300 text-xs h-7"
                          >
                            {copied === 'email' ? <CheckCircle className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                            {copied === 'email' ? 'Copied!' : 'Copy All'}
                          </Button>
                        </div>
                        <div className="rounded bg-slate-900/50 p-3 mb-2">
                          <p className="text-xs text-gray-500 mb-1">Subject:</p>
                          <p className="text-sm text-white font-mono">{blockData.removal_email.subject}</p>
                        </div>
                        <div className="rounded bg-slate-900/50 p-3">
                          <p className="text-xs text-gray-500 mb-1">Body:</p>
                          <pre className="text-xs text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">
                            {blockData.removal_email.body}
                          </pre>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Legal basis */}
                  {blockData.legal_basis?.length > 0 && (
                    <Card className="bg-amber-500/5 border-amber-500/20">
                      <CardContent className="p-3">
                        <h4 className="text-amber-300 font-semibold text-sm mb-2">Legal Basis</h4>
                        <div className="flex flex-wrap gap-2">
                          {blockData.legal_basis.map((law, i) => (
                            <Badge key={i} className="bg-amber-500/15 text-amber-200 border-0 text-xs">{law}</Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Escalation */}
                  {blockData.escalation_steps?.length > 0 && (
                    <Card className="bg-red-500/5 border-red-500/20">
                      <CardContent className="p-3">
                        <h4 className="text-red-300 font-semibold text-sm flex items-center gap-1 mb-2">
                          <AlertTriangle className="w-4 h-4" /> If They Refuse
                        </h4>
                        <ol className="space-y-1 list-decimal list-inside">
                          {blockData.escalation_steps.map((s, i) => (
                            <li key={i} className="text-xs text-red-200 leading-relaxed">{s}</li>
                          ))}
                        </ol>
                      </CardContent>
                    </Card>
                  )}

                  {blockData.estimated_removal_time && (
                    <p className="text-xs text-gray-500">
                      Estimated removal time: <span className="text-gray-300">{blockData.estimated_removal_time}</span>
                    </p>
                  )}

                  <Button
                    onClick={() => {
                      handleMarkBlocked(blockModal.exposure);
                      setBlockModal(null);
                      setBlockData(null);
                    }}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    <ShieldCheck className="w-4 h-4 mr-2" /> Mark as Blocked / Removal Requested
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
