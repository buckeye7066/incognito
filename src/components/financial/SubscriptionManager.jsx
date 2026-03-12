import React, { useState } from 'react';
import { incognito } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CreditCard, Loader2, RefreshCw, Trash2, Pause, Play,
  ArrowRightLeft, AlertTriangle, DollarSign, Calendar, Store,
  ChevronDown, ChevronUp, Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SubscriptionManager({ profileId, onSwapCard }) {
  const queryClient = useQueryClient();
  const [selectedCardToken, setSelectedCardToken] = useState(null);
  const [expandedSub, setExpandedSub] = useState(null);
  const [manualLast4, setManualLast4] = useState('');

  const { data: cards = [], isLoading: cardsLoading, refetch: refetchCards } = useQuery({
    queryKey: ['privacyCards'],
    queryFn: async () => {
      const resp = await incognito.functions.invoke('listCards', {});
      return resp.data || resp || [];
    },
    retry: 1,
  });

  const selectedCard = selectedCardToken
    ? cards.find(c => c.token === selectedCardToken)
    : null;

  const { data: subscriptions = [], isLoading: subsLoading, refetch: refetchSubs } = useQuery({
    queryKey: ['cardSubscriptions', selectedCardToken],
    queryFn: async () => {
      const resp = await incognito.functions.invoke('listSubscriptions', {
        cardToken: selectedCardToken,
      });
      return resp.data || resp || [];
    },
    enabled: !!selectedCardToken,
    retry: 1,
  });

  const closeCardMutation = useMutation({
    mutationFn: async (cardToken) => {
      return incognito.functions.invoke('closeCard', { cardToken });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['privacyCards']);
      queryClient.invalidateQueries(['cardSubscriptions']);
    },
  });

  const pauseCardMutation = useMutation({
    mutationFn: async (cardToken) => {
      return incognito.functions.invoke('pauseCard', { cardToken });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['privacyCards']);
    },
  });

  const handleSelectCard = (token) => {
    setSelectedCardToken(token);
    setExpandedSub(null);
  };

  const handleFindByLast4 = () => {
    const match = cards.find(c => c.last_four === manualLast4);
    if (match) {
      handleSelectCard(match.token);
    }
  };

  const filteredCards = manualLast4
    ? cards.filter(c => c.last_four?.includes(manualLast4))
    : cards;

  const stateColors = {
    OPEN: 'bg-green-500/20 text-green-300 border-green-500/40',
    PAUSED: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
    CLOSED: 'bg-red-500/20 text-red-300 border-red-500/40',
  };

  return (
    <div className="space-y-6">
      {/* Card Loader */}
      <Card className="glass-card border-blue-500/30">
        <CardHeader className="border-b border-blue-500/20">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-400" />
              Your Cards
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchCards()}
              disabled={cardsLoading}
              className="border-blue-500/30 text-blue-300 hover:bg-blue-500/10"
            >
              {cardsLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          {/* Search by last 4 */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Search by last 4 digits..."
                value={manualLast4}
                onChange={(e) => setManualLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                maxLength={4}
                className="bg-slate-800 border-slate-600 text-white h-9 font-mono"
              />
            </div>
            {manualLast4.length === 4 && (
              <Button
                size="sm"
                onClick={handleFindByLast4}
                className="bg-blue-600 hover:bg-blue-700 h-9"
              >
                <Search className="w-4 h-4" />
              </Button>
            )}
          </div>

          {cardsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
              <span className="ml-2 text-gray-400">Loading cards from Privacy.com...</span>
            </div>
          ) : filteredCards.length === 0 ? (
            <div className="text-center py-6">
              <CreditCard className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">
                {manualLast4 ? 'No cards match those digits' : 'No cards found. Connect your Privacy.com account in Settings.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[280px] overflow-y-auto pr-1">
              {filteredCards.map((card) => (
                <button
                  key={card.token}
                  onClick={() => handleSelectCard(card.token)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    selectedCardToken === card.token
                      ? 'border-blue-400 bg-blue-500/10 ring-1 ring-blue-400/50'
                      : 'border-slate-700 bg-slate-800/50 hover:border-blue-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white font-mono text-sm">
                      •••• {card.last_four}
                    </span>
                    <Badge className={`text-[10px] border ${stateColors[card.state] || 'bg-gray-500/20 text-gray-300'}`}>
                      {card.state}
                    </Badge>
                  </div>
                  {card.memo && (
                    <p className="text-gray-400 text-xs truncate">{card.memo}</p>
                  )}
                  {card.spend_limit && (
                    <p className="text-gray-500 text-[10px] mt-1">
                      Limit: ${(card.spend_limit / 100).toFixed(2)} / {card.spend_limit_duration?.toLowerCase()}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subscriptions for selected card */}
      <AnimatePresence mode="wait">
        {selectedCardToken && (
          <motion.div
            key={selectedCardToken}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Card className="glass-card border-purple-500/30">
              <CardHeader className="border-b border-purple-500/20">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Store className="w-5 h-5 text-purple-400" />
                    Subscriptions on •••• {selectedCard?.last_four}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetchSubs()}
                      disabled={subsLoading}
                      className="border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
                    >
                      {subsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {subsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                    <span className="ml-2 text-gray-400">Analyzing transactions for recurring charges...</span>
                  </div>
                ) : subscriptions.length === 0 ? (
                  <div className="text-center py-6">
                    <Store className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">No recurring subscriptions detected on this card.</p>
                    <p className="text-gray-500 text-xs mt-1">Subscriptions are identified from 2+ charges to the same merchant.</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between pb-2">
                      <p className="text-sm text-purple-300">
                        {subscriptions.length} subscription{subscriptions.length !== 1 ? 's' : ''} detected
                      </p>
                      <p className="text-xs text-gray-400">
                        Total: ${(subscriptions.reduce((sum, s) => sum + (s.total || 0), 0) / 100).toFixed(2)}
                      </p>
                    </div>
                    {subscriptions.map((sub, idx) => {
                      const isExpanded = expandedSub === idx;
                      const intervalLabel = sub.estimated_interval_days
                        ? sub.estimated_interval_days <= 8 ? 'Weekly'
                          : sub.estimated_interval_days <= 16 ? 'Bi-weekly'
                          : sub.estimated_interval_days <= 35 ? 'Monthly'
                          : sub.estimated_interval_days <= 100 ? 'Quarterly'
                          : 'Annual'
                        : 'Unknown';

                      return (
                        <div
                          key={idx}
                          className="rounded-lg border border-slate-700 bg-slate-800/30 overflow-hidden"
                        >
                          <button
                            onClick={() => setExpandedSub(isExpanded ? null : idx)}
                            className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/60 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                                <Store className="w-4 h-4 text-purple-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-white font-medium text-sm truncate">{sub.merchant}</p>
                                <p className="text-gray-400 text-xs">
                                  {sub.count} charges · {intervalLabel}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <div className="text-right">
                                <p className="text-white font-mono text-sm">
                                  ${(sub.total / 100).toFixed(2)}
                                </p>
                                <p className="text-gray-500 text-[10px]">total spent</p>
                              </div>
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              )}
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
                                <div className="px-4 pb-4 space-y-3 border-t border-slate-700/50 pt-3">
                                  <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div className="p-2 rounded bg-slate-900/50">
                                      <p className="text-gray-500">First charge</p>
                                      <p className="text-gray-300">{sub.first_transaction ? new Date(sub.first_transaction).toLocaleDateString() : 'N/A'}</p>
                                    </div>
                                    <div className="p-2 rounded bg-slate-900/50">
                                      <p className="text-gray-500">Last charge</p>
                                      <p className="text-gray-300">{sub.last_transaction ? new Date(sub.last_transaction).toLocaleDateString() : 'N/A'}</p>
                                    </div>
                                    <div className="p-2 rounded bg-slate-900/50">
                                      <p className="text-gray-500">Avg per charge</p>
                                      <p className="text-gray-300">${(sub.total / sub.count / 100).toFixed(2)}</p>
                                    </div>
                                    <div className="p-2 rounded bg-slate-900/50">
                                      <p className="text-gray-500">Interval</p>
                                      <p className="text-gray-300">~{sub.estimated_interval_days?.toFixed(0) || '?'} days</p>
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap gap-2 pt-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => onSwapCard?.({
                                        merchant: sub.merchant,
                                        cardToken: sub.card_token,
                                        lastFour: selectedCard?.last_four,
                                      })}
                                      className="text-xs border-green-500/30 text-green-300 hover:bg-green-500/10 h-8"
                                    >
                                      <ArrowRightLeft className="w-3 h-3 mr-1" />
                                      Swap Card (AI)
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => pauseCardMutation.mutate(sub.card_token)}
                                      disabled={pauseCardMutation.isPending || selectedCard?.state === 'PAUSED'}
                                      className="text-xs border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/10 h-8"
                                    >
                                      <Pause className="w-3 h-3 mr-1" />
                                      Pause Card
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        if (confirm(`Close the card ending in ${selectedCard?.last_four}? This will block ALL merchants on this card permanently.`)) {
                                          closeCardMutation.mutate(sub.card_token);
                                        }
                                      }}
                                      disabled={closeCardMutation.isPending || selectedCard?.state === 'CLOSED'}
                                      className="text-xs border-red-500/30 text-red-300 hover:bg-red-500/10 h-8"
                                    >
                                      <Trash2 className="w-3 h-3 mr-1" />
                                      Kill Card
                                    </Button>
                                  </div>

                                  {selectedCard?.state === 'PAUSED' && (
                                    <div className="flex items-center gap-2 p-2 rounded bg-yellow-500/10 border border-yellow-500/20">
                                      <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                                      <p className="text-xs text-yellow-300">
                                        This card is paused. No new charges will go through.
                                      </p>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-xs text-yellow-300 hover:bg-yellow-500/10 h-6 ml-auto"
                                        onClick={() => {
                                          incognito.functions.invoke('pauseCard', { cardToken: sub.card_token }).then(() => {
                                            queryClient.invalidateQueries(['privacyCards']);
                                          });
                                        }}
                                      >
                                        <Play className="w-3 h-3 mr-1" /> Resume
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
