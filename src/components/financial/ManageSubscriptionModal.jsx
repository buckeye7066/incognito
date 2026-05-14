import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Loader2, Copy, CheckCircle, ExternalLink, Bot, UserX, AlertTriangle, Phone, Mail,
  Play, ArrowRight, Send, Shield, Zap, ChevronDown, ChevronUp,
} from 'lucide-react';
import { incognito } from '@/api/client';
import { motion, AnimatePresence } from 'framer-motion';

const STEPS = [
  { id: 'prepare', label: 'Prepare', icon: Bot, description: 'Generate cancellation materials' },
  { id: 'fake_info', label: 'Replace Info', icon: UserX, description: 'Swap real data for fake' },
  { id: 'send_email', label: 'Send Email', icon: Send, description: 'Fire cancellation demand' },
  { id: 'open_cancel', label: 'Cancel Page', icon: ExternalLink, description: 'Open & complete cancellation' },
  { id: 'confirm', label: 'Confirm', icon: CheckCircle, description: 'Mark as cancelled' },
];

export default function ManageSubscriptionModal({ open, onClose, subscription, onUpdate }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [cancelData, setCancelData] = useState(null);
  const [emailData, setEmailData] = useState(null);
  const [fakeData, setFakeData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState('');
  const [copied, setCopied] = useState(null);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (open) {
      setCurrentStep(0);
      setCancelData(null);
      setEmailData(null);
      setFakeData(null);
      setCompletedSteps(new Set());
      setShowDetails(false);
    }
  }, [open, subscription?.id]);

  const markStep = (stepId) => {
    setCompletedSteps(prev => new Set([...prev, stepId]));
  };

  const copyField = (key, value) => {
    navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const handlePrepare = async () => {
    setLoading(true);
    try {
      setLoadingPhase('Generating cancellation instructions...');
      const cancelResult = await incognito.functions.invoke('generateCancelInstructions', {
        serviceName: subscription?.service_name,
        serviceUrl: subscription?.service_url,
      });
      setCancelData(cancelResult.data || cancelResult);

      setLoadingPhase('Composing cancellation email...');
      const emailResult = await incognito.functions.invoke('generateCancellationEmail', {
        serviceName: subscription?.service_name,
        serviceUrl: subscription?.service_url,
        accountInfo: subscription?.card_last4 ? `Card ending ${subscription.card_last4}` : '',
      });
      setEmailData(emailResult.data || emailResult);

      setLoadingPhase('Generating fake identity...');
      const fakeResult = await incognito.functions.invoke('generateFakeIdentity', {});
      setFakeData(fakeResult.data || fakeResult);

      markStep('prepare');
      setCurrentStep(1);
    } catch (e) {
      setCancelData({
        steps: ['Visit the service website.', 'Navigate to Account Settings.', 'Cancel subscription.'],
        cancel_url: subscription?.service_url,
        support_email: `support@${(subscription?.service_name || 'service').toLowerCase().replace(/\s+/g, '')}.com`,
      });
      markStep('prepare');
      setCurrentStep(1);
    } finally {
      setLoading(false);
      setLoadingPhase('');
    }
  };

  const handleSendEmail = () => {
    if (emailData?.mailto_url) {
      window.open(emailData.mailto_url, '_blank');
    } else {
      const name = subscription?.service_name || 'service';
      const to = cancelData?.support_email || `support@${name.toLowerCase().replace(/\s+/g, '')}.com`;
      const subject = `Cancellation Request — ${name}`;
      const body = `I am requesting immediate cancellation of my subscription with ${name}. Please confirm in writing.`;
      window.open(`mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
    }
    markStep('send_email');
  };

  const handleOpenCancelPage = () => {
    const url = cancelData?.cancel_url || subscription?.service_url;
    if (url) window.open(url, '_blank');

    if (cancelData?.steps) {
      const script = cancelData.steps.join('\n');
      navigator.clipboard.writeText(script);
      setCopied('script');
      setTimeout(() => setCopied(null), 2000);
    }

    markStep('open_cancel');
  };

  const handleConfirm = () => {
    markStep('confirm');
    onUpdate?.({ status: 'cancelled' });
    setTimeout(() => onClose(), 500);
  };

  const progress = (completedSteps.size / STEPS.length) * 100;

  if (!subscription) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border-red-500/30">
        <DialogHeader>
          <DialogTitle className="text-xl text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            Cancel: {subscription.service_name}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {subscription.amount ? `$${subscription.amount}/${subscription.frequency || 'mo'}` : 'Subscription'} · Card ending {subscription.card_last4 || '••••'}
          </DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Cancellation Progress</span>
            <span>{completedSteps.size}/{STEPS.length} steps</span>
          </div>
          <Progress value={progress} className="h-2 bg-slate-700" />
          <div className="flex justify-between">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              const done = completedSteps.has(step.id);
              const active = i === currentStep;
              return (
                <button
                  key={step.id}
                  onClick={() => setCurrentStep(i)}
                  className={`flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all ${active ? 'bg-slate-800' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${done ? 'bg-green-500/20' : active ? 'bg-amber-500/20' : 'bg-slate-800'}`}>
                    {done ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Icon className={`w-4 h-4 ${active ? 'text-amber-400' : 'text-gray-500'}`} />}
                  </div>
                  <span className={`text-[10px] ${done ? 'text-green-400' : active ? 'text-white' : 'text-gray-500'}`}>{step.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* STEP 0: PREPARE */}
          {currentStep === 0 && (
            <motion.div key="prepare" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              {!completedSteps.has('prepare') ? (
                <div className="text-center py-6">
                  {loading ? (
                    <>
                      <Loader2 className="w-12 h-12 text-amber-400 mx-auto mb-4 animate-spin" />
                      <p className="text-gray-300">{loadingPhase}</p>
                      <p className="text-gray-500 text-xs mt-1">Generating all cancellation materials in one shot...</p>
                    </>
                  ) : (
                    <>
                      <Zap className="w-14 h-14 text-amber-400 mx-auto mb-4" />
                      <p className="text-white font-semibold text-lg mb-1">Ready to automate cancellation</p>
                      <p className="text-gray-400 text-sm mb-6">This will generate your cancellation email, fake replacement identity, and step-by-step guide — all at once.</p>
                      <Button onClick={handlePrepare} size="lg" className="bg-gradient-to-r from-red-600 to-amber-600 px-8">
                        <Play className="w-5 h-5 mr-2" /> Start Cancellation
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
                  <p className="text-green-300 font-semibold">All materials generated</p>
                  <Button onClick={() => setCurrentStep(1)} className="mt-3 bg-amber-600 hover:bg-amber-700">
                    Next: Replace Info <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              )}
            </motion.div>
          )}

          {/* STEP 1: FAKE INFO */}
          {currentStep === 1 && (
            <motion.div key="fake" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <Card className="bg-amber-500/10 border-amber-500/30">
                <CardContent className="p-3">
                  <p className="text-xs text-amber-200"><strong>Why first:</strong> Replace your real name, email, and payment info on {subscription.service_name} BEFORE cancelling. This prevents re-billing, retention emails, and data retention tied to your real identity.</p>
                </CardContent>
              </Card>

              {fakeData ? (
                <div className="space-y-2">
                  {[
                    { key: 'full_name', label: 'Name' },
                    { key: 'email', label: 'Email' },
                    { key: 'phone', label: 'Phone' },
                    { key: 'address', label: 'Address' },
                    { key: 'city', label: 'City' },
                    { key: 'state', label: 'State' },
                    { key: 'zip', label: 'ZIP' },
                  ].filter(f => fakeData[f.key]).map(field => (
                    <div key={field.key} className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/50 border border-slate-700">
                      <span className="text-[10px] text-gray-500 w-14 shrink-0">{field.label}</span>
                      <span className="text-white text-sm font-mono flex-1">{fakeData[field.key]}</span>
                      <Button size="sm" variant="ghost" onClick={() => copyField(field.key, fakeData[field.key])} className="h-6 w-6 p-0 shrink-0">
                        {copied === field.key ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                      </Button>
                    </div>
                  ))}

                  <div className="flex gap-2 pt-2">
                    {(cancelData?.cancel_url || subscription?.service_url) && (
                      <Button onClick={() => window.open(cancelData?.cancel_url || subscription?.service_url, '_blank')} variant="outline" className="flex-1 border-blue-500/40 text-blue-300 text-xs">
                        <ExternalLink className="w-3 h-3 mr-1" /> Open Account Settings
                      </Button>
                    )}
                    <Button onClick={() => {
                      const allFields = Object.entries(fakeData).filter(([k]) => k !== 'dob').map(([k, v]) => `${k}: ${v}`).join('\n');
                      copyField('all_fake', allFields);
                    }} variant="outline" className="border-purple-500/40 text-purple-300 text-xs">
                      <Copy className="w-3 h-3 mr-1" /> {copied === 'all_fake' ? 'Copied!' : 'Copy All'}
                    </Button>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button onClick={() => { markStep('fake_info'); setCurrentStep(2); }} className="flex-1 bg-amber-600 hover:bg-amber-700">
                      Done — Next: Send Email <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                    <Button onClick={() => setCurrentStep(2)} variant="ghost" className="text-gray-500 text-xs">Skip</Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-400 mb-3">No fake identity generated yet.</p>
                  <Button onClick={() => setCurrentStep(0)} variant="outline" className="border-slate-600 text-gray-300">Go back to Prepare</Button>
                </div>
              )}
            </motion.div>
          )}

          {/* STEP 2: SEND EMAIL */}
          {currentStep === 2 && (
            <motion.div key="email" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <Card className="bg-blue-500/10 border-blue-500/30">
                <CardContent className="p-3">
                  <p className="text-xs text-blue-200"><strong>One-click send:</strong> This opens your email client with a pre-written cancellation demand citing FTC rules. Just hit Send.</p>
                </CardContent>
              </Card>

              {emailData ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-[10px] text-gray-500">To: <span className="text-gray-300">{emailData.to}</span></p>
                        <p className="text-[10px] text-gray-500">Subject: <span className="text-gray-300">{emailData.subject}</span></p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => copyField('email_body', emailData.body)} className="h-6 text-xs text-gray-400">
                        {copied === 'email_body' ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </Button>
                    </div>
                    <pre className="text-[11px] text-gray-400 whitespace-pre-wrap font-sans max-h-[180px] overflow-y-auto">{emailData.body}</pre>
                  </div>

                  <Button onClick={handleSendEmail} size="lg" className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 py-5">
                    <Send className="w-5 h-5 mr-2" /> Open Email Client & Send
                  </Button>

                  <div className="flex gap-2">
                    <Button onClick={() => { markStep('send_email'); setCurrentStep(3); }} className="flex-1 bg-amber-600 hover:bg-amber-700">
                      Email Sent — Next <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                    <Button onClick={() => setCurrentStep(3)} variant="ghost" className="text-gray-500 text-xs">Skip</Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-400 mb-3">Email not generated yet.</p>
                  <Button onClick={() => setCurrentStep(0)} variant="outline" className="border-slate-600 text-gray-300">Go back to Prepare</Button>
                </div>
              )}
            </motion.div>
          )}

          {/* STEP 3: OPEN CANCEL PAGE */}
          {currentStep === 3 && (
            <motion.div key="cancel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <Card className="bg-red-500/10 border-red-500/30">
                <CardContent className="p-3">
                  <p className="text-xs text-red-200"><strong>One-click action:</strong> Opens the cancellation page AND copies the step-by-step instructions to your clipboard.</p>
                </CardContent>
              </Card>

              <Button onClick={handleOpenCancelPage} size="lg" className="w-full bg-gradient-to-r from-red-600 to-orange-600 py-5">
                <ExternalLink className="w-5 h-5 mr-2" /> Open Cancel Page + Copy Steps
              </Button>
              {copied === 'script' && <p className="text-xs text-green-400 text-center">Steps copied to clipboard — paste into a note while you work through them</p>}

              {cancelData?.steps && (
                <div>
                  <button onClick={() => setShowDetails(!showDetails)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300">
                    {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} {showDetails ? 'Hide' : 'Show'} instructions
                  </button>
                  <AnimatePresence>
                    {showDetails && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                        <ol className="list-decimal list-inside space-y-1 mt-2 text-xs text-gray-400">
                          {cancelData.steps.map((s, i) => <li key={i}>{s}</li>)}
                        </ol>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Contact fallbacks */}
              <div className="flex flex-wrap gap-2">
                {cancelData?.support_email && (
                  <a href={`mailto:${cancelData.support_email}`}>
                    <Button size="sm" variant="outline" className="border-blue-500/30 text-blue-300 text-xs h-7"><Mail className="w-3 h-3 mr-1" />{cancelData.support_email}</Button>
                  </a>
                )}
                {cancelData?.support_phone && (
                  <a href={`tel:${cancelData.support_phone}`}>
                    <Button size="sm" variant="outline" className="border-green-500/30 text-green-300 text-xs h-7"><Phone className="w-3 h-3 mr-1" />{cancelData.support_phone}</Button>
                  </a>
                )}
              </div>

              {/* Warnings */}
              {cancelData?.dark_patterns?.length > 0 && (
                <Card className="bg-amber-500/10 border-amber-500/30">
                  <CardContent className="p-3">
                    <p className="text-amber-300 font-semibold text-xs flex items-center gap-1 mb-1"><AlertTriangle className="w-3 h-3" /> Dark Patterns</p>
                    {cancelData.dark_patterns.map((d, i) => <p key={i} className="text-[11px] text-amber-200">• {d}</p>)}
                  </CardContent>
                </Card>
              )}

              <div className="flex gap-2">
                <Button onClick={() => { markStep('open_cancel'); setCurrentStep(4); }} className="flex-1 bg-amber-600 hover:bg-amber-700">
                  Done — Final Step <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
                <Button onClick={() => setCurrentStep(4)} variant="ghost" className="text-gray-500 text-xs">Skip</Button>
              </div>
            </motion.div>
          )}

          {/* STEP 4: CONFIRM */}
          {currentStep === 4 && (
            <motion.div key="confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="text-center py-4">
                <Shield className="w-14 h-14 text-green-400 mx-auto mb-4" />
                <p className="text-white font-semibold text-lg mb-1">Confirm Cancellation</p>
                <p className="text-gray-400 text-sm mb-2">Is {subscription.service_name} cancelled?</p>

                <div className="bg-slate-800/50 rounded-lg p-4 mb-4 text-left space-y-1.5">
                  {[
                    { done: completedSteps.has('fake_info'), text: 'Replaced real info with fake identity' },
                    { done: completedSteps.has('send_email'), text: 'Sent cancellation demand email' },
                    { done: completedSteps.has('open_cancel'), text: 'Completed online cancellation flow' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      {item.done ? <CheckCircle className="w-4 h-4 text-green-400 shrink-0" /> : <div className="w-4 h-4 rounded-full border border-slate-600 shrink-0" />}
                      <span className={item.done ? 'text-green-300' : 'text-gray-500'}>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={handleConfirm} size="lg" className="w-full bg-green-600 hover:bg-green-700 py-5">
                <CheckCircle className="w-5 h-5 mr-2" /> Confirmed — Mark as Cancelled
              </Button>

              <Button onClick={onClose} variant="ghost" className="w-full text-gray-500 text-xs">
                Not yet — I'll come back later
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
