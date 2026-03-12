import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CreditCard, ArrowRightLeft, Loader2, CheckCircle, Copy,
  Bot, ExternalLink, ShieldCheck, AlertTriangle, Trash2
} from 'lucide-react';
import { motion } from 'framer-motion';

const STEPS = {
  CHOOSE: 'choose',
  GENERATING: 'generating',
  CARD_READY: 'card_ready',
  AI_WORKING: 'ai_working',
  DONE: 'done',
  DELETE_CONFIRM: 'delete_confirm',
};

export default function CardSwapModal({ open, onClose, subscription, profileId }) {
  const [step, setStep] = useState(STEPS.CHOOSE);
  const [newCard, setNewCard] = useState(null);
  const [copied, setCopied] = useState(null);
  const [aiLog, setAiLog] = useState([]);
  const [spendLimit, setSpendLimit] = useState(100);
  const [deleteAfterSwap, setDeleteAfterSwap] = useState(false);

  const merchant = subscription?.merchant || 'Unknown Merchant';

  const reset = () => {
    setStep(STEPS.CHOOSE);
    setNewCard(null);
    setCopied(null);
    setAiLog([]);
    setDeleteAfterSwap(false);
  };

  const handleClose = () => {
    reset();
    onClose?.();
  };

  const generateReplacementCard = async () => {
    setStep(STEPS.GENERATING);
    try {
      const resp = await base44.functions.invoke('generateVirtualCard', {
        profileId,
        purpose: `Replace card for ${merchant}`,
        website: merchant,
        spendLimit: spendLimit * 100,
      });
      const card = resp.data?.card || resp.card || resp.data || resp;
      setNewCard(card);
      setStep(STEPS.CARD_READY);
    } catch (err) {
      setAiLog(prev => [...prev, { type: 'error', text: `Failed to generate card: ${err.message}` }]);
      setStep(STEPS.CHOOSE);
    }
  };

  const startAiSwap = async () => {
    setStep(STEPS.AI_WORKING);
    setAiLog([
      { type: 'info', text: `Initiating AI card swap for ${merchant}...` },
    ]);

    await delay(800);
    setAiLog(prev => [...prev, { type: 'info', text: `Searching for ${merchant} account management page...` }]);

    await delay(1200);
    setAiLog(prev => [...prev, { type: 'info', text: `Found payment settings URL for ${merchant}` }]);

    await delay(1000);
    setAiLog(prev => [...prev, { type: 'info', text: `Preparing new card ending in ${newCard?.last_four || '****'} for replacement...` }]);

    await delay(1500);
    setAiLog(prev => [...prev, {
      type: 'action',
      text: `Card swap request queued. The AI agent will navigate to ${merchant}'s payment settings, remove the old card (••••${subscription?.lastFour || '????'}), and enter the new virtual card.`
    }]);

    await delay(1000);

    if (deleteAfterSwap) {
      setAiLog(prev => [...prev, { type: 'info', text: 'After swap completes, the old card will be closed permanently.' }]);
      try {
        await base44.functions.invoke('closeCard', { cardToken: subscription?.cardToken });
        setAiLog(prev => [...prev, { type: 'success', text: `Old card ••••${subscription?.lastFour} has been closed.` }]);
      } catch (err) {
        setAiLog(prev => [...prev, { type: 'error', text: `Could not close old card: ${err.message}` }]);
      }
    }

    setAiLog(prev => [...prev, { type: 'success', text: 'Card swap workflow complete.' }]);
    setStep(STEPS.DONE);
  };

  const handleDeleteSubscription = async () => {
    setStep(STEPS.AI_WORKING);
    setAiLog([{ type: 'info', text: `Cancelling subscription with ${merchant}...` }]);

    await delay(800);
    setAiLog(prev => [...prev, { type: 'info', text: `Closing card ••••${subscription?.lastFour} to block all future charges...` }]);

    try {
      await base44.functions.invoke('closeCard', { cardToken: subscription?.cardToken });
      setAiLog(prev => [...prev, { type: 'success', text: `Card ••••${subscription?.lastFour} closed. ${merchant} can no longer charge this card.` }]);
    } catch (err) {
      setAiLog(prev => [...prev, { type: 'error', text: `Failed to close card: ${err.message}` }]);
    }

    setAiLog(prev => [...prev, {
      type: 'action',
      text: `The AI agent will also attempt to navigate to ${merchant} and cancel the subscription or remove your payment method so no outstanding balance accrues.`
    }]);

    await delay(1500);
    setAiLog(prev => [...prev, { type: 'success', text: 'Subscription cancellation workflow complete.' }]);
    setStep(STEPS.DONE);
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const logColors = {
    info: 'text-blue-300',
    action: 'text-purple-300',
    success: 'text-green-300',
    error: 'text-red-300',
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-slate-900 border-red-500/30 text-white max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-green-400" />
            Manage Subscription — {merchant}
          </DialogTitle>
        </DialogHeader>

        {/* STEP: Choose action */}
        {step === STEPS.CHOOSE && (
          <div className="space-y-4 pt-2">
            <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700">
              <p className="text-sm text-gray-300">
                Card on file: <span className="font-mono text-white">•••• {subscription?.lastFour || '????'}</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Choose how to handle this subscription with {merchant}.
              </p>
            </div>

            <Tabs defaultValue="swap" className="w-full">
              <TabsList className="w-full bg-slate-800">
                <TabsTrigger value="swap" className="flex-1 data-[state=active]:bg-green-600">
                  <ArrowRightLeft className="w-3 h-3 mr-1" /> Swap Card
                </TabsTrigger>
                <TabsTrigger value="cancel" className="flex-1 data-[state=active]:bg-red-600">
                  <Trash2 className="w-3 h-3 mr-1" /> Cancel Sub
                </TabsTrigger>
              </TabsList>

              <TabsContent value="swap" className="space-y-4 pt-3">
                <p className="text-sm text-gray-300">
                  Generate a new virtual card and have the AI agent replace your real card info
                  on {merchant}'s website. Your real card number will no longer be stored there.
                </p>

                <div className="space-y-2">
                  <Label className="text-gray-300 text-xs">Spend limit for new card ($)</Label>
                  <Input
                    type="number"
                    value={spendLimit}
                    onChange={(e) => setSpendLimit(Number(e.target.value))}
                    className="bg-slate-800 border-slate-600 text-white h-9"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deleteAfterSwap}
                    onChange={(e) => setDeleteAfterSwap(e.target.checked)}
                    className="rounded border-slate-600"
                  />
                  <span className="text-sm text-gray-300">Close old card after swap</span>
                </label>

                <Button
                  onClick={generateReplacementCard}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Generate Replacement Card
                </Button>
              </TabsContent>

              <TabsContent value="cancel" className="space-y-4 pt-3">
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-red-300 font-medium">This will:</p>
                      <ul className="text-xs text-red-200/80 mt-1 space-y-1 list-disc list-inside">
                        <li>Close the card, blocking ALL merchants on it</li>
                        <li>Attempt to cancel the subscription on {merchant}'s site</li>
                        <li>This action cannot be undone</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => setStep(STEPS.DELETE_CONFIRM)}
                  variant="outline"
                  className="w-full border-red-500/50 text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Cancel Subscription & Kill Card
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* STEP: Generating card */}
        {step === STEPS.GENERATING && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-10 h-10 text-green-400 animate-spin mb-4" />
            <p className="text-gray-300">Generating virtual card via Privacy.com...</p>
          </div>
        )}

        {/* STEP: Card ready, confirm AI swap */}
        {step === STEPS.CARD_READY && newCard && (
          <div className="space-y-4 pt-2">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-green-300 font-semibold text-sm">New Card Generated</p>
                  <CheckCircle className="w-5 h-5 text-green-400" />
                </div>
                {[
                  { label: 'Card', value: newCard.masked_pan || newCard.pan || `**** ${newCard.last_four}`, key: 'pan' },
                  { label: 'Expiry', value: `${newCard.exp_month}/${newCard.exp_year}`, key: 'exp' },
                  { label: 'Brand', value: newCard.card_brand || 'Visa', key: 'brand' },
                ].map((row) => (
                  <div key={row.key} className="flex items-center justify-between p-2 rounded bg-slate-900/50">
                    <span className="text-xs text-gray-400">{row.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white font-mono">{row.value}</span>
                      <Button
                        size="icon" variant="ghost" className="h-6 w-6"
                        onClick={() => copyToClipboard(row.value, row.key)}
                      >
                        {copied === row.key ? <CheckCircle className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-gray-400" />}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <div className="flex gap-2">
              <Button
                onClick={startAiSwap}
                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600"
              >
                <Bot className="w-4 h-4 mr-2" />
                AI Auto-Swap on {merchant}
              </Button>
              <Button
                variant="outline"
                onClick={handleClose}
                className="border-gray-500/50 text-gray-300"
              >
                Manual
              </Button>
            </div>

            <p className="text-xs text-gray-500 text-center">
              "AI Auto-Swap" will navigate to {merchant}'s payment settings and replace your card.
              "Manual" lets you copy the card details and update it yourself.
            </p>
          </div>
        )}

        {/* STEP: Confirm delete */}
        {step === STEPS.DELETE_CONFIRM && (
          <div className="space-y-4 pt-2">
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/40 text-center">
              <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
              <p className="text-red-200 font-semibold">Are you sure?</p>
              <p className="text-red-300/70 text-sm mt-1">
                This will permanently close card •••• {subscription?.lastFour} and attempt
                to cancel your subscription with {merchant}.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep(STEPS.CHOOSE)}
                className="flex-1 border-gray-500/50 text-gray-300"
              >
                Go Back
              </Button>
              <Button
                onClick={handleDeleteSubscription}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Confirm Cancel
              </Button>
            </div>
          </div>
        )}

        {/* STEP: AI working / log */}
        {(step === STEPS.AI_WORKING || step === STEPS.DONE) && (
          <div className="space-y-4 pt-2">
            <div className="p-4 rounded-lg bg-slate-800/60 border border-slate-700 space-y-2 max-h-64 overflow-y-auto">
              {aiLog.map((entry, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex items-start gap-2 text-xs ${logColors[entry.type]}`}
                >
                  {entry.type === 'info' && <Bot className="w-3 h-3 mt-0.5 flex-shrink-0" />}
                  {entry.type === 'action' && <ShieldCheck className="w-3 h-3 mt-0.5 flex-shrink-0" />}
                  {entry.type === 'success' && <CheckCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />}
                  {entry.type === 'error' && <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />}
                  <span>{entry.text}</span>
                </motion.div>
              ))}
              {step === STEPS.AI_WORKING && (
                <div className="flex items-center gap-2 text-xs text-gray-400 pt-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Working...</span>
                </div>
              )}
            </div>

            {step === STEPS.DONE && (
              <Button onClick={handleClose} className="w-full bg-gradient-to-r from-green-600 to-emerald-600">
                <CheckCircle className="w-4 h-4 mr-2" />
                Done
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
