import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Mail, Loader2, Copy, CheckCircle, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function QuickGenerateCard({ profileId, onGenerated }) {
  const [generating, setGenerating] = useState(false);
  const [generatedCard, setGeneratedCard] = useState(null);
  const [generatedEmail, setGeneratedEmail] = useState(null);
  const [copied, setCopied] = useState(null);

  const [cardForm, setCardForm] = useState({ purpose: '', website: '', spendLimit: 100 });
  const [emailForm, setEmailForm] = useState({ purpose: '', website: '' });

  const generateCard = async () => {
    if (!profileId) {
      alert('Please select a profile first');
      return;
    }

    setGenerating(true);
    try {
      const { base44 } = await import('@/api/base44Client');
      const response = await base44.functions.invoke('generateVirtualCard', {
        profileId,
        ...cardForm
      });

      setGeneratedCard(response.data.card);
      if (onGenerated) onGenerated();
    } catch (error) {
      alert('Failed to generate card: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const generateEmail = async () => {
    if (!profileId) {
      alert('Please select a profile first');
      return;
    }

    setGenerating(true);
    try {
      const { base44 } = await import('@/api/base44Client');
      const response = await base44.functions.invoke('generateEmailAlias', {
        profileId,
        ...emailForm
      });

      setGeneratedEmail(response.data.alias);
      if (onGenerated) onGenerated();
    } catch (error) {
      alert('Failed to generate email alias: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Card className="glass-card border-green-500/30">
      <CardHeader className="border-b border-green-500/20">
        <CardTitle className="text-white">Quick Generate</CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* Virtual Card Generator */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-green-400" />
            <h3 className="font-semibold text-white">Virtual Credit Card</h3>
            <Badge className="bg-green-500/20 text-green-300 border-green-500/40 ml-auto">
              Privacy.com
            </Badge>
          </div>

          {!generatedCard ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-purple-200 text-sm">Purpose</Label>
                <Input
                  value={cardForm.purpose}
                  onChange={(e) => setCardForm({...cardForm, purpose: e.target.value})}
                  placeholder="e.g., Online Shopping"
                  className="bg-slate-900/50 border-purple-500/30 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-purple-200 text-sm">Website</Label>
                <Input
                  value={cardForm.website}
                  onChange={(e) => setCardForm({...cardForm, website: e.target.value})}
                  placeholder="e.g., amazon.com"
                  className="bg-slate-900/50 border-purple-500/30 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-purple-200 text-sm">Spend Limit ($)</Label>
                <Input
                  type="number"
                  value={cardForm.spendLimit}
                  onChange={(e) => setCardForm({...cardForm, spendLimit: Number(e.target.value)})}
                  className="bg-slate-900/50 border-purple-500/30 text-white"
                />
              </div>
              <Button
                onClick={generateCard}
                disabled={generating}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 mr-2" />
                    Generate Card
                  </>
                )}
              </Button>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-green-300 font-semibold">Card Generated!</p>
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between p-2 rounded bg-slate-900/50">
                  <span className="text-xs text-purple-300">Card Number:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white font-mono">{generatedCard.pan}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(generatedCard.pan, 'pan')}>
                      {copied === 'pan' ? <CheckCircle className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-slate-900/50">
                  <span className="text-xs text-purple-300">CVV:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white font-mono">{generatedCard.cvv}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(generatedCard.cvv, 'cvv')}>
                      {copied === 'cvv' ? <CheckCircle className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-slate-900/50">
                  <span className="text-xs text-purple-300">Expiry:</span>
                  <span className="text-sm text-white">{generatedCard.exp_month}/{generatedCard.exp_year}</span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setGeneratedCard(null)}
                className="w-full border-green-500/50 text-green-300"
              >
                Generate Another
              </Button>
            </motion.div>
          )}
        </div>

        <div className="border-t border-purple-500/20 pt-6" />

        {/* Email Alias Generator */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-white">Email Alias</h3>
            <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40 ml-auto">
              SimpleLogin
            </Badge>
          </div>

          {!generatedEmail ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-purple-200 text-sm">Purpose</Label>
                <Input
                  value={emailForm.purpose}
                  onChange={(e) => setEmailForm({...emailForm, purpose: e.target.value})}
                  placeholder="e.g., Newsletter Signup"
                  className="bg-slate-900/50 border-purple-500/30 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-purple-200 text-sm">Website</Label>
                <Input
                  value={emailForm.website}
                  onChange={(e) => setEmailForm({...emailForm, website: e.target.value})}
                  placeholder="e.g., newsletter.com"
                  className="bg-slate-900/50 border-purple-500/30 text-white"
                />
              </div>
              <Button
                onClick={generateEmail}
                disabled={generating}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Generate Alias
                  </>
                )}
              </Button>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-blue-300 font-semibold">Alias Generated!</p>
                <CheckCircle className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-900/50">
                <span className="text-sm text-white font-mono break-all">{generatedEmail}</span>
                <Button size="icon" variant="ghost" className="h-6 w-6 flex-shrink-0" onClick={() => copyToClipboard(generatedEmail, 'email')}>
                  {copied === 'email' ? <CheckCircle className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setGeneratedEmail(null)}
                className="w-full border-blue-500/50 text-blue-300"
              >
                Generate Another
              </Button>
            </motion.div>
          )}
        </div>

        {/* Setup Links */}
        <div className="pt-4 border-t border-purple-500/20 space-y-2">
          <p className="text-xs text-purple-400">Setup Required:</p>
          <div className="flex flex-col gap-2">
            <a href="https://privacy.com" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-2 rounded bg-slate-900/50 hover:bg-slate-900/70 transition-colors">
              <span className="text-xs text-purple-300">Sign up for Privacy.com</span>
              <ExternalLink className="w-3 h-3 text-purple-400" />
            </a>
            <a href="https://simplelogin.io" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-2 rounded bg-slate-900/50 hover:bg-slate-900/70 transition-colors">
              <span className="text-xs text-purple-300">Sign up for SimpleLogin</span>
              <ExternalLink className="w-3 h-3 text-purple-400" />
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}