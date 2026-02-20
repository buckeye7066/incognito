import React, { useState } from 'react';
import { Shield, CheckCircle, Circle, ChevronDown, ChevronRight, Phone, ExternalLink, AlertTriangle, FileText, CreditCard, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'framer-motion';

const RECOVERY_PLAN = [
  {
    id: 'immediate',
    phase: 'Phase 1 — Immediate (First 24 hours)',
    color: 'red',
    steps: [
      {
        id: 'ftc_report',
        title: 'File an FTC Identity Theft Report',
        description: 'Go to IdentityTheft.gov and complete a report. This is your legal declaration and needed for most recovery steps.',
        action_url: 'https://www.identitytheft.gov/',
        action_label: 'File at IdentityTheft.gov',
        time_estimate: '20 min',
        critical: true,
        notes: 'Save your reference number and print the recovery plan they generate.'
      },
      {
        id: 'police_report',
        title: 'File a Police Report',
        description: 'Call your local police non-emergency line or go in person. Bring your FTC report. Many creditors require a police report number.',
        time_estimate: '1-2 hours',
        critical: true,
        notes: 'Get the case number and officer name. Request a copy of the report.'
      },
      {
        id: 'credit_freeze',
        title: 'Place a Credit Freeze at All 3 Bureaus',
        description: 'Immediately freeze your credit to prevent any new accounts from being opened in your name.',
        links: [
          { label: 'Equifax Freeze', url: 'https://www.equifax.com/personal/credit-report-services/credit-freeze/' },
          { label: 'Experian Freeze', url: 'https://www.experian.com/freeze/center.html' },
          { label: 'TransUnion Freeze', url: 'https://www.transunion.com/credit-freeze' },
        ],
        time_estimate: '30 min',
        critical: true,
        phone: '1-877-322-8228 (Annual Credit Report)'
      },
      {
        id: 'change_passwords',
        title: 'Change Passwords on Compromised Accounts',
        description: 'Immediately change passwords for email, banking, and any accounts using the same credentials. Enable 2FA everywhere.',
        time_estimate: '1 hour',
        critical: true
      },
      {
        id: 'notify_banks',
        title: 'Call Your Banks and Credit Card Companies',
        description: 'Report fraud on any compromised accounts. Ask them to flag your accounts and issue new card numbers.',
        time_estimate: '1-2 hours',
        phone: 'Number on back of each card'
      }
    ]
  },
  {
    id: 'short_term',
    phase: 'Phase 2 — Short Term (First Week)',
    color: 'orange',
    steps: [
      {
        id: 'fraud_alert',
        title: 'Place a Fraud Alert (if not freezing)',
        description: 'A fraud alert requires creditors to verify your identity before extending credit. Free and lasts 1 year.',
        action_url: 'https://www.annualcreditreport.com/',
        action_label: 'Annual Credit Report',
        time_estimate: '15 min',
        phone: '1-888-766-0008 (Equifax)'
      },
      {
        id: 'credit_reports',
        title: 'Pull All 3 Credit Reports',
        description: 'Review for any unauthorized accounts, inquiries, or address changes. You can get them free at AnnualCreditReport.com.',
        action_url: 'https://www.annualcreditreport.com/',
        action_label: 'Get Free Reports',
        time_estimate: '45 min'
      },
      {
        id: 'dispute_accounts',
        title: 'Dispute Fraudulent Accounts in Writing',
        description: 'Send dispute letters to each credit bureau and creditor for any unauthorized accounts. Include your FTC report.',
        action_url: 'https://consumer.ftc.gov/articles/sample-letter-disputing-errors-your-credit-report',
        action_label: 'Sample Dispute Letter',
        time_estimate: '1-2 hours'
      },
      {
        id: 'ssa_notify',
        title: 'Contact Social Security Administration',
        description: 'If your SSN was compromised, contact SSA to review your earnings record and consider requesting a new SSN in severe cases.',
        action_url: 'https://www.ssa.gov/myaccount/',
        action_label: 'My Social Security',
        time_estimate: '30 min',
        phone: '1-800-772-1213'
      },
      {
        id: 'usps_mail',
        title: 'Check for Mail Forwarding Fraud',
        description: 'Contact USPS to check if your mail is being forwarded to another address without your knowledge.',
        action_url: 'https://moversguide.usps.com/',
        time_estimate: '15 min',
        phone: '1-800-275-8777'
      }
    ]
  },
  {
    id: 'medium_term',
    phase: 'Phase 3 — Follow Up (First Month)',
    color: 'yellow',
    steps: [
      {
        id: 'irs_ip_pin',
        title: 'Get an IRS Identity Protection PIN',
        description: 'Prevents someone from filing a tax return using your SSN. You get a new 6-digit PIN every year.',
        action_url: 'https://www.irs.gov/identity-theft-fraud-scams/get-an-identity-protection-pin',
        action_label: 'Get IP PIN',
        time_estimate: '20 min'
      },
      {
        id: 'dmv_license',
        title: "Notify Your State DMV if Driver's License was Stolen",
        description: "Request a new driver's license number. Bring your police report and FTC report.",
        time_estimate: '2-3 hours',
        notes: 'Some states allow online replacement requests.'
      },
      {
        id: 'medical_providers',
        title: 'Review Your Medical Records for Fraud',
        description: "Request your medical records from your providers and health insurer. Look for procedures you didn't receive.",
        action_url: 'https://www.hhs.gov/hipaa/filing-a-complaint/index.html',
        action_label: 'HIPAA Complaint',
        time_estimate: '1-2 hours'
      },
      {
        id: 'attorney',
        title: 'Consider Consulting an Identity Theft Attorney',
        description: 'An attorney can help you pursue damages, negotiate with creditors, and handle complex cases like employment fraud.',
        action_url: 'https://www.naca.net/',
        action_label: 'Find an Attorney (NACA)',
        time_estimate: '1 hour'
      },
      {
        id: 'monitor_ongoing',
        title: 'Set Up Ongoing Credit Monitoring',
        description: 'Enroll in a credit monitoring service to get real-time alerts on changes to your credit file.',
        time_estimate: '15 min',
        notes: 'Many breach settlement class actions include free credit monitoring.'
      }
    ]
  },
  {
    id: 'long_term',
    phase: 'Phase 4 — Long Term (Ongoing)',
    color: 'green',
    steps: [
      {
        id: 'annual_credit_review',
        title: 'Review Credit Reports Annually',
        description: 'Check all 3 bureau reports every year for lingering fraudulent accounts.',
        time_estimate: '30 min/year'
      },
      {
        id: 'monitor_ssn',
        title: 'Monitor SSN Usage',
        description: 'Regularly check your Social Security earnings statement for employment fraud.',
        action_url: 'https://www.ssa.gov/myaccount/',
        time_estimate: '10 min/year'
      },
      {
        id: 'secure_mail',
        title: 'Use a PO Box or Mail Lock',
        description: 'Reduce mail theft risk by using a PO box for sensitive documents or installing a locking mailbox.',
        time_estimate: 'One-time setup'
      },
      {
        id: 'document_storage',
        title: 'Secure Physical Documents',
        description: 'Shred all documents with personal info. Store sensitive documents (SSN card, passport) in a locked safe.',
        time_estimate: 'Ongoing'
      }
    ]
  }
];

const COLOR_MAP = {
  red: { border: 'border-red-500/30', badge: 'bg-red-500/10 text-red-300', header: 'text-red-300', check: 'text-red-400' },
  orange: { border: 'border-orange-500/30', badge: 'bg-orange-500/10 text-orange-300', header: 'text-orange-300', check: 'text-orange-400' },
  yellow: { border: 'border-yellow-500/30', badge: 'bg-yellow-500/10 text-yellow-300', header: 'text-yellow-300', check: 'text-yellow-400' },
  green: { border: 'border-green-500/30', badge: 'bg-green-500/10 text-green-300', header: 'text-green-300', check: 'text-green-400' },
};

export default function IdentityRecovery() {
  const [completed, setCompleted] = useState(() => {
    try { return JSON.parse(localStorage.getItem('identity_recovery_steps') || '{}'); } catch { return {}; }
  });
  const [expanded, setExpanded] = useState({ immediate: true });

  const toggle = (stepId) => {
    const updated = { ...completed, [stepId]: !completed[stepId] };
    setCompleted(updated);
    localStorage.setItem('identity_recovery_steps', JSON.stringify(updated));
  };

  const totalSteps = RECOVERY_PLAN.reduce((s, p) => s + p.steps.length, 0);
  const completedSteps = Object.values(completed).filter(Boolean).length;
  const pct = Math.round((completedSteps / totalSteps) * 100);

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">Identity Theft Recovery Plan</h1>
        <p className="text-gray-400">Step-by-step guided recovery — based on LifeLock's Identity Restoration methodology</p>
      </div>

      {/* Progress */}
      <Card className="glass-card border-purple-500/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-white font-semibold">Recovery Progress</p>
              <p className="text-gray-400 text-sm">{completedSteps} of {totalSteps} steps completed</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-white">{pct}%</p>
              <Badge className={pct === 100 ? 'bg-green-500/10 text-green-400' : pct > 50 ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'}>
                {pct === 100 ? 'Complete' : pct > 50 ? 'In Progress' : 'Just Started'}
              </Badge>
            </div>
          </div>
          <Progress value={pct} className="h-3 bg-slate-700" />
        </CardContent>
      </Card>

      {/* Emergency contacts bar */}
      <Card className="glass-card border-red-500/20 bg-red-500/5">
        <CardContent className="p-4">
          <p className="text-red-300 font-semibold text-sm mb-3 flex items-center gap-2">
            <Phone className="w-4 h-4" /> Emergency Contacts
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {[
              { label: 'FTC Hotline', number: '1-877-438-4338' },
              { label: 'SSA Fraud', number: '1-800-269-0271' },
              { label: 'IRS ID Theft', number: '1-800-908-4490' },
              { label: 'FBI IC3', number: 'ic3.gov' },
            ].map(c => (
              <div key={c.label} className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-gray-400">{c.label}</p>
                <p className="text-white font-mono">{c.number}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recovery Phases */}
      {RECOVERY_PLAN.map((phase) => {
        const colors = COLOR_MAP[phase.color];
        const phaseCompleted = phase.steps.filter(s => completed[s.id]).length;
        const isExpanded = expanded[phase.id];

        return (
          <Card key={phase.id} className={`glass-card ${colors.border}`}>
            <CardHeader
              className="cursor-pointer pb-3"
              onClick={() => setExpanded(e => ({ ...e, [phase.id]: !e[phase.id] }))}
            >
              <div className="flex items-center justify-between">
                <CardTitle className={`${colors.header} flex items-center gap-2 text-base`}>
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  {phase.phase}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge className={colors.badge}>{phaseCompleted}/{phase.steps.length}</Badge>
                  {phaseCompleted === phase.steps.length && <CheckCircle className="w-4 h-4 text-green-400" />}
                </div>
              </div>
            </CardHeader>

            <AnimatePresence>
              {isExpanded && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <CardContent className="pt-0 space-y-3">
                    {phase.steps.map((step) => {
                      const done = completed[step.id];
                      return (
                        <div
                          key={step.id}
                          className={`p-4 rounded-xl border transition-all ${done ? 'border-green-500/20 bg-green-500/5 opacity-70' : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'}`}
                        >
                          <div className="flex items-start gap-3">
                            <button onClick={() => toggle(step.id)} className="mt-0.5 shrink-0">
                              {done
                                ? <CheckCircle className="w-5 h-5 text-green-400" />
                                : <Circle className={`w-5 h-5 ${colors.check}`} />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <p className={`font-medium text-sm ${done ? 'text-gray-400 line-through' : 'text-white'}`}>{step.title}</p>
                                {step.critical && <Badge className="bg-red-500/20 text-red-300 border-0 text-xs">Critical</Badge>}
                                {step.time_estimate && <span className="text-xs text-gray-500">{step.time_estimate}</span>}
                              </div>
                              <p className="text-gray-400 text-xs mb-2">{step.description}</p>
                              {step.notes && (
                                <p className="text-xs text-yellow-300 bg-yellow-500/10 rounded px-2 py-1 mb-2">💡 {step.notes}</p>
                              )}
                              <div className="flex flex-wrap gap-2">
                                {step.action_url && (
                                  <a href={step.action_url} target="_blank" rel="noopener noreferrer">
                                    <Button size="sm" variant="outline" className="h-7 text-xs border-purple-500/40 text-purple-300 hover:bg-purple-500/10">
                                      <ExternalLink className="w-3 h-3 mr-1" /> {step.action_label || 'Take Action'}
                                    </Button>
                                  </a>
                                )}
                                {step.links?.map(link => (
                                  <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">
                                    <Button size="sm" variant="outline" className="h-7 text-xs border-blue-500/40 text-blue-300 hover:bg-blue-500/10">
                                      <ExternalLink className="w-3 h-3 mr-1" /> {link.label}
                                    </Button>
                                  </a>
                                ))}
                                {step.phone && (
                                  <span className="text-xs text-gray-400 flex items-center gap-1 px-2 py-1 bg-slate-700/50 rounded">
                                    <Phone className="w-3 h-3" /> {step.phone}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        );
      })}

      <p className="text-center text-xs text-gray-600 pb-4">
        Progress saved locally on this device. This guide is for informational purposes — consult an attorney for legal advice.
      </p>
    </div>
  );
}