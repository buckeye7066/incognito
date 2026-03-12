import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Scale, Loader2, ExternalLink, Clock, DollarSign,
  CheckCircle, Star, FileCheck, ChevronDown, ChevronUp,
  RefreshCw, Filter, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CATEGORY_ICONS = {
  data_breach: '🔓',
  privacy: '🔒',
  consumer: '🛒',
  financial: '💳',
  tcpa: '📱',
  product: '📦',
  other: '📋',
};

const DIFFICULTY_CONFIG = {
  none: { label: 'No Proof Needed', color: 'text-green-300', bg: 'bg-green-500/20', border: 'border-green-500/40' },
  minimal: { label: 'Minimal Proof', color: 'text-blue-300', bg: 'bg-blue-500/20', border: 'border-blue-500/40' },
  moderate: { label: 'Some Proof', color: 'text-yellow-300', bg: 'bg-yellow-500/20', border: 'border-yellow-500/40' },
};

export default function NoProofSettlementScanner({ profileId }) {
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState(null);
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [filterDifficulty, setFilterDifficulty] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [error, setError] = useState(null);

  const runScan = async () => {
    setScanning(true);
    setError(null);
    setResults(null);
    setExpandedIdx(null);

    try {
      const resp = await base44.functions.invoke('searchNoProofSettlements', {
        profileId,
      });
      setResults(resp.data || resp);
    } catch (err) {
      setError('Search failed: ' + (err.message || 'Unknown error'));
    } finally {
      setScanning(false);
    }
  };

  const settlements = results?.settlements || [];
  const stats = results?.stats || {};

  const filtered = settlements.filter(s => {
    if (filterDifficulty !== 'all' && s.proof_difficulty !== filterDifficulty) return false;
    if (filterCategory !== 'all' && s.category !== filterCategory) return false;
    return true;
  });

  const categories = [...new Set(settlements.map(s => s.category).filter(Boolean))];

  return (
    <div className="space-y-6">
      {/* Scanner Card */}
      <Card className="glass-card border-green-500/30">
        <CardHeader className="border-b border-green-500/20">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-green-400" />
              No-Proof Settlement Scanner
            </CardTitle>
            <Button
              onClick={runScan}
              disabled={scanning}
              className="bg-gradient-to-r from-green-600 to-emerald-600"
            >
              {scanning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Scanning...
                </>
              ) : results ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Rescan
                </>
              ) : (
                <>
                  <Scale className="w-4 h-4 mr-2" />
                  Find Open Settlements
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <p className="text-sm text-gray-400">
            Search for open class action settlements you can claim money from <strong className="text-green-300">without needing proof of purchase or harm</strong>.
            These are court-approved settlements where you only need to attest that you were a customer or affected person.
          </p>
          {profileId && (
            <p className="text-xs text-green-300/70 mt-2">
              Results will be prioritized based on your profile's breach history and scan results.
            </p>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      <AnimatePresence>
        {results && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="glass-card border-slate-700">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-white">{stats.total_found || 0}</p>
                  <p className="text-[10px] text-gray-400 uppercase">Total Found</p>
                </CardContent>
              </Card>
              <Card className="glass-card border-green-500/30">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-green-400">{stats.no_proof_count || 0}</p>
                  <p className="text-[10px] text-gray-400 uppercase">No Proof Needed</p>
                </CardContent>
              </Card>
              <Card className="glass-card border-blue-500/30">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-blue-400">{stats.minimal_proof_count || 0}</p>
                  <p className="text-[10px] text-gray-400 uppercase">Minimal Proof</p>
                </CardContent>
              </Card>
              <Card className="glass-card border-amber-500/30">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-amber-400">{stats.profile_matches || 0}</p>
                  <p className="text-[10px] text-gray-400 uppercase">Profile Matches</p>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            {settlements.length > 0 && (
              <div className="flex flex-wrap gap-2 items-center">
                <Filter className="w-4 h-4 text-gray-400" />
                <button
                  onClick={() => setFilterDifficulty('all')}
                  className={`px-3 py-1 rounded-full text-xs transition-colors ${filterDifficulty === 'all' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  All
                </button>
                {Object.entries(DIFFICULTY_CONFIG).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => setFilterDifficulty(filterDifficulty === key ? 'all' : key)}
                    className={`px-3 py-1 rounded-full text-xs transition-colors ${filterDifficulty === key ? `${cfg.bg} ${cfg.color}` : 'text-gray-400 hover:text-white'}`}
                  >
                    {cfg.label}
                  </button>
                ))}
                {categories.length > 1 && (
                  <>
                    <span className="text-gray-600 mx-1">|</span>
                    {categories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setFilterCategory(filterCategory === cat ? 'all' : cat)}
                        className={`px-3 py-1 rounded-full text-xs transition-colors ${filterCategory === cat ? 'bg-purple-500/20 text-purple-300' : 'text-gray-400 hover:text-white'}`}
                      >
                        {CATEGORY_ICONS[cat] || '📋'} {cat?.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* Settlement List */}
            {filtered.length === 0 ? (
              <Card className="glass-card border-slate-700">
                <CardContent className="p-8 text-center">
                  <Scale className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">
                    {settlements.length > 0
                      ? 'No settlements match your current filters.'
                      : 'No open settlements found right now. Try scanning again later.'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filtered.map((s, idx) => {
                  const isExpanded = expandedIdx === idx;
                  const diff = DIFFICULTY_CONFIG[s.proof_difficulty] || DIFFICULTY_CONFIG.moderate;

                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <div className={`rounded-lg border overflow-hidden ${s.profile_match ? 'border-green-500/40 bg-green-500/5' : 'border-slate-700 bg-slate-800/30'}`}>
                        <button
                          onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/60 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xl flex-shrink-0">{CATEGORY_ICONS[s.category] || '📋'}</span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-white font-medium text-sm truncate">{s.settlement_name}</p>
                                {s.profile_match && (
                                  <Star className="w-3.5 h-3.5 text-green-400 flex-shrink-0" fill="currentColor" />
                                )}
                              </div>
                              <p className="text-gray-400 text-xs truncate">
                                {s.company} · {s.estimated_individual_payout || 'Payout TBD'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            <Badge className={`text-[10px] border ${diff.bg} ${diff.color} ${diff.border}`}>
                              {diff.label}
                            </Badge>
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
                              <div className="px-4 pb-4 border-t border-slate-700/50 pt-3 space-y-3">
                                {s.profile_match && s.match_reason && (
                                  <div className="p-2 rounded bg-green-500/10 border border-green-500/30 flex items-center gap-2">
                                    <Star className="w-4 h-4 text-green-400 flex-shrink-0" fill="currentColor" />
                                    <p className="text-xs text-green-300">{s.match_reason}</p>
                                  </div>
                                )}

                                <div className="grid grid-cols-2 gap-3 text-xs">
                                  {s.settlement_amount && (
                                    <div className="p-2 rounded bg-slate-900/50">
                                      <p className="text-gray-500">Settlement Fund</p>
                                      <p className="text-white flex items-center gap-1">
                                        <DollarSign className="w-3 h-3 text-green-400" />
                                        {s.settlement_amount}
                                      </p>
                                    </div>
                                  )}
                                  {s.estimated_individual_payout && (
                                    <div className="p-2 rounded bg-slate-900/50">
                                      <p className="text-gray-500">Est. Per Person</p>
                                      <p className="text-green-300">{s.estimated_individual_payout}</p>
                                    </div>
                                  )}
                                  {s.claim_deadline && (
                                    <div className="p-2 rounded bg-slate-900/50">
                                      <p className="text-gray-500">Claim Deadline</p>
                                      <p className="text-amber-300 flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> {s.claim_deadline}
                                      </p>
                                    </div>
                                  )}
                                  {s.filing_time_estimate && (
                                    <div className="p-2 rounded bg-slate-900/50">
                                      <p className="text-gray-500">Time to File</p>
                                      <p className="text-gray-300">{s.filing_time_estimate}</p>
                                    </div>
                                  )}
                                </div>

                                {s.proof_required && (
                                  <div className="p-2 rounded bg-slate-900/50">
                                    <p className="text-gray-500 text-xs">Proof Required</p>
                                    <p className="text-gray-300 text-xs">{s.proof_required}</p>
                                  </div>
                                )}

                                {s.eligibility && (
                                  <div className="p-2 rounded bg-slate-900/50">
                                    <p className="text-gray-500 text-xs">Who Qualifies</p>
                                    <p className="text-gray-300 text-xs">{s.eligibility}</p>
                                  </div>
                                )}

                                {s.court && (
                                  <p className="text-gray-500 text-xs">Court: {s.court}</p>
                                )}

                                <div className="flex gap-2 pt-1">
                                  {s.claim_url && (
                                    <a
                                      href={s.claim_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <Button size="sm" className="bg-green-600 hover:bg-green-700 h-8 text-xs">
                                        <FileCheck className="w-3 h-3 mr-1" />
                                        File Claim Now
                                      </Button>
                                    </a>
                                  )}
                                  {s.website && s.website !== s.claim_url && (
                                    <a
                                      href={s.website}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 py-1"
                                    >
                                      <ExternalLink className="w-3 h-3" /> Settlement Website
                                    </a>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Not scanned yet */}
      {!results && !scanning && (
        <Card className="glass-card border-green-500/20">
          <CardContent className="p-8 text-center">
            <DollarSign className="w-12 h-12 text-green-500/40 mx-auto mb-3" />
            <h3 className="text-white font-semibold mb-1">Find Money You're Owed</h3>
            <p className="text-gray-400 text-sm mb-4">
              Scan for open class action settlements where you can file a claim
              with little or no proof required.
            </p>
            <div className="flex flex-col items-center gap-2 text-xs text-gray-500">
              <p className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-400" /> Data breach settlements (T-Mobile, Equifax, etc.)</p>
              <p className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-400" /> Consumer product overcharge refunds</p>
              <p className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-400" /> Privacy violation payouts</p>
              <p className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-400" /> Robocall/spam text settlements (TCPA)</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
