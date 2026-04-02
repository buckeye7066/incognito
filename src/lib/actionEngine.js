/**
 * Unified Action Engine — correlates data across all Incognito features
 * and generates prioritized action recommendations.
 */

export function generateActionRecommendations({
  scanResults = [],
  searchFindings = [],
  socialFindings = [],
  subscriptions = [],
  debtIssues = [],
  settlementCases = [],
  brokerTasks = [],
  deletionRequests = [],
  suspiciousActivities = [],
  personalData = [],
  creditDisputeItems = [],
}) {
  const actions = [];
  const now = new Date();

  const highRiskBreaches = scanResults.filter(r => r.risk_score >= 70 && r.status === 'new');
  if (highRiskBreaches.length > 0) {
    actions.push({
      id: 'freeze_credit',
      priority: 1,
      category: 'critical',
      title: 'Freeze your credit immediately',
      description: `${highRiskBreaches.length} high-risk breach${highRiskBreaches.length > 1 ? 'es' : ''} detected. Freeze credit at all three bureaus to prevent identity theft.`,
      link: '/IdentityRecovery',
      icon: 'shield',
    });
  }

  const ssnExposed = scanResults.some(r => (r.data_exposed || []).some(d => /ssn|social.security/i.test(d)));
  if (ssnExposed) {
    actions.push({
      id: 'ssn_alert',
      priority: 1,
      category: 'critical',
      title: 'SSN exposed in breach — take action now',
      description: 'Your Social Security Number was found in a data breach. File an identity theft report and place fraud alerts.',
      link: '/LegalSupport',
      icon: 'alert',
    });
  }

  const noProofCases = settlementCases.filter(c => c.no_proof && c.confidence === 'likely_eligible');
  const approachingDeadlines = noProofCases.filter(c => {
    if (!c.deadline || c.deadline === 'open' || c.deadline === 'closed') return false;
    const dl = new Date(c.deadline);
    const daysLeft = (dl - now) / (1000 * 60 * 60 * 24);
    return daysLeft > 0 && daysLeft <= 60;
  });
  if (approachingDeadlines.length > 0) {
    actions.push({
      id: 'settlement_deadline',
      priority: 2,
      category: 'money',
      title: `File ${approachingDeadlines.length} no-proof claim${approachingDeadlines.length > 1 ? 's' : ''} before deadline`,
      description: approachingDeadlines.map(c => `${c.case_name} (${c.payout || 'varies'})`).join(', '),
      link: '/LegalSupport',
      icon: 'gavel',
    });
  } else if (noProofCases.length > 0) {
    actions.push({
      id: 'no_proof_claims',
      priority: 3,
      category: 'money',
      title: `${noProofCases.length} no-proof settlement${noProofCases.length > 1 ? 's' : ''} available`,
      description: 'You may qualify for money without any proof of purchase. Review and file claims.',
      link: '/LegalSupport',
      icon: 'sparkles',
    });
  }

  const unresolved = searchFindings.filter(f => f.status === 'new');
  if (unresolved.length >= 5) {
    actions.push({
      id: 'broker_removal',
      priority: 3,
      category: 'privacy',
      title: `Remove your data from ${unresolved.length} data broker sites`,
      description: 'Launch a removal campaign to systematically opt out from all detected brokers.',
      link: '/DeletionCenter',
      icon: 'rocket',
    });
  }

  const reappeared = brokerTasks.filter(t => t.status === 'reappeared');
  if (reappeared.length > 0) {
    actions.push({
      id: 'reappeared_brokers',
      priority: 2,
      category: 'privacy',
      title: `${reappeared.length} broker${reappeared.length > 1 ? 's' : ''} re-listed your data`,
      description: 'Previously removed data has reappeared. Re-submit removal requests.',
      link: '/DeletionCenter',
      icon: 'alert',
    });
  }

  const exposedCards = personalData.filter(d => d.data_type === 'credit_card');
  const exposedCardBreaches = scanResults.filter(r =>
    (r.data_exposed || []).some(d => /credit|card|payment/i.test(d)) && r.status === 'new'
  );
  if (exposedCardBreaches.length > 0 && exposedCards.length > 0) {
    actions.push({
      id: 'replace_cards',
      priority: 2,
      category: 'financial',
      title: 'Replace credit cards exposed in breaches',
      description: `${exposedCardBreaches.length} breach${exposedCardBreaches.length > 1 ? 'es' : ''} exposed payment data. Replace affected cards and update subscriptions.`,
      link: '/FinancialMonitor',
      icon: 'credit_card',
    });
  }

  const activeSubs = subscriptions.filter(s => s.status === 'active');
  const highCostSubs = activeSubs.filter(s => (s.amount || 0) >= 20);
  if (highCostSubs.length >= 3) {
    const monthlyTotal = activeSubs.reduce((sum, s) => {
      let amt = s.amount || 0;
      if (s.frequency === 'yearly') amt /= 12;
      if (s.frequency === 'quarterly') amt /= 3;
      return sum + amt;
    }, 0);
    actions.push({
      id: 'sub_review',
      priority: 4,
      category: 'financial',
      title: `Review $${monthlyTotal.toFixed(0)}/mo in subscriptions`,
      description: `You have ${activeSubs.length} active subscriptions. Cancel unused ones to save money.`,
      link: '/FinancialMonitor',
      icon: 'dollar',
    });
  }

  const activeDebt = debtIssues.filter(i => i.status === 'active');
  if (activeDebt.length > 0) {
    const totalDebt = activeDebt.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    actions.push({
      id: 'debt_action',
      priority: 3,
      category: 'financial',
      title: `${activeDebt.length} debt issue${activeDebt.length > 1 ? 's' : ''} need attention ($${totalDebt.toLocaleString()})`,
      description: 'Generate dispute letters or negotiate settlements to resolve debt issues.',
      link: '/LegalSupport',
      icon: 'scale',
    });
  }

  const highConfDisputes = creditDisputeItems.filter(d => d.confidence >= 60 && d.status === 'identified');
  if (highConfDisputes.length > 0) {
    actions.push({
      id: 'credit_disputes',
      priority: 3,
      category: 'financial',
      title: `${highConfDisputes.length} high-confidence credit dispute${highConfDisputes.length > 1 ? 's' : ''} ready to file`,
      description: 'AI analysis found likely disputable items on your credit reports. Generate dispute kits and submit.',
      link: '/LegalSupport',
      icon: 'scale',
    });
  }

  const awaitingResponse = creditDisputeItems.filter(d => d.status === 'submitted_online' || d.status === 'mailed' || d.status === 'awaiting_response');
  if (awaitingResponse.length > 0) {
    actions.push({
      id: 'dispute_follow_up',
      priority: 4,
      category: 'financial',
      title: `Follow up on ${awaitingResponse.length} pending credit dispute${awaitingResponse.length > 1 ? 's' : ''}`,
      description: 'Check for bureau responses. Bureaus must respond within 30 days under FCRA.',
      link: '/LegalSupport',
      icon: 'mail',
    });
  }

  const impersonations = socialFindings.filter(f => f.match_type === 'impersonation' && f.status === 'new');
  if (impersonations.length > 0) {
    actions.push({
      id: 'impersonation',
      priority: 2,
      category: 'critical',
      title: `${impersonations.length} social media impersonation${impersonations.length > 1 ? 's' : ''} detected`,
      description: 'Report and take down fake accounts using your identity.',
      link: '/SocialMediaHub',
      icon: 'users',
    });
  }

  const openIncidents = suspiciousActivities.filter(a => a.status === 'new');
  if (openIncidents.length > 0) {
    actions.push({
      id: 'incidents',
      priority: 2,
      category: 'critical',
      title: `${openIncidents.length} suspicious financial incident${openIncidents.length > 1 ? 's' : ''} need review`,
      description: 'Investigate and report suspicious charges or account activity.',
      link: '/FinancialMonitor',
      icon: 'alert',
    });
  }

  const pendingDeletions = deletionRequests.filter(r => r.status === 'pending');
  if (pendingDeletions.length > 5) {
    actions.push({
      id: 'follow_up_deletions',
      priority: 4,
      category: 'privacy',
      title: `Follow up on ${pendingDeletions.length} pending deletion requests`,
      description: 'Some requests have been pending for a while. Check for responses and escalate if needed.',
      link: '/DeletionCenter',
      icon: 'mail',
    });
  }

  actions.sort((a, b) => a.priority - b.priority);

  return actions;
}

export function calculateRiskScore({
  scanResults = [],
  searchFindings = [],
  socialFindings = [],
  debtIssues = [],
  brokerTasks = [],
  subscriptions = [],
  suspiciousActivities = [],
}) {
  let score = 0;
  const factors = [];

  const highBreaches = scanResults.filter(r => r.risk_score >= 70).length;
  if (highBreaches > 0) {
    score += Math.min(30, highBreaches * 10);
    factors.push({ label: `${highBreaches} high-risk breaches`, impact: Math.min(30, highBreaches * 10), category: 'breach' });
  }

  const ssnExposed = scanResults.some(r => (r.data_exposed || []).some(d => /ssn|social.security/i.test(d)));
  if (ssnExposed) {
    score += 20;
    factors.push({ label: 'SSN exposed in breach', impact: 20, category: 'critical' });
  }

  const unresolvedBrokers = searchFindings.filter(f => f.status === 'new').length;
  if (unresolvedBrokers > 0) {
    score += Math.min(15, unresolvedBrokers * 2);
    factors.push({ label: `${unresolvedBrokers} unresolved broker exposures`, impact: Math.min(15, unresolvedBrokers * 2), category: 'privacy' });
  }

  const activeImpersonations = socialFindings.filter(f => f.match_type === 'impersonation' && f.status === 'new').length;
  if (activeImpersonations > 0) {
    score += Math.min(15, activeImpersonations * 8);
    factors.push({ label: `${activeImpersonations} active impersonations`, impact: Math.min(15, activeImpersonations * 8), category: 'social' });
  }

  const openIncidents = suspiciousActivities.filter(a => a.status === 'new').length;
  if (openIncidents > 0) {
    score += Math.min(10, openIncidents * 5);
    factors.push({ label: `${openIncidents} open financial incidents`, impact: Math.min(10, openIncidents * 5), category: 'financial' });
  }

  const activeDebt = debtIssues.filter(i => i.status === 'active').length;
  if (activeDebt > 0) {
    score += Math.min(10, activeDebt * 3);
    factors.push({ label: `${activeDebt} unresolved debt issues`, impact: Math.min(10, activeDebt * 3), category: 'debt' });
  }

  const reappeared = brokerTasks.filter(t => t.status === 'reappeared').length;
  if (reappeared > 0) {
    score += Math.min(10, reappeared * 3);
    factors.push({ label: `${reappeared} broker reappearances`, impact: Math.min(10, reappeared * 3), category: 'privacy' });
  }

  return {
    score: Math.min(100, score),
    factors: factors.sort((a, b) => b.impact - a.impact),
    level: score >= 70 ? 'critical' : score >= 40 ? 'high' : score > 10 ? 'moderate' : 'low',
  };
}

export function exportPackage(type, data) {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  let content = '';
  let filename = '';

  switch (type) {
    case 'settlement': {
      filename = `settlement-claim-packet-${Date.now()}.txt`;
      content = `SETTLEMENT CLAIM PREPARATION PACKET\nGenerated: ${today}\n${'═'.repeat(60)}\n\n`;
      for (const c of (data.cases || [])) {
        content += `CASE: ${c.case_name}\nCompany: ${c.company}\nDeadline: ${c.deadline || 'N/A'}\nPayout: ${c.payout || 'Varies'}\nNo-Proof: ${c.no_proof ? 'YES' : 'No'}\nEligibility: ${c.eligibility || 'See settlement website'}\nURL: ${c.url || 'N/A'}\n${'-'.repeat(40)}\n\n`;
      }
      break;
    }
    case 'debt_dispute': {
      filename = `debt-dispute-packet-${Date.now()}.txt`;
      content = `DEBT DISPUTE PACKET\nGenerated: ${today}\n${'═'.repeat(60)}\n\n`;
      for (const i of (data.issues || [])) {
        content += `ISSUE: ${i.creditor}\nType: ${i.issue_type}\nAmount: $${i.amount || 0}\nAccount: ${i.account_number || 'N/A'}\nStatus: ${i.status}\n${'-'.repeat(40)}\n\n`;
      }
      if (data.letters) content += '\nGENERATED LETTERS:\n' + data.letters.join('\n\n---\n\n');
      break;
    }
    case 'broker_removal': {
      filename = `broker-removal-packet-${Date.now()}.txt`;
      content = `BROKER REMOVAL PACKET\nGenerated: ${today}\n${'═'.repeat(60)}\n\n`;
      for (const t of (data.tasks || [])) {
        content += `BROKER: ${t.broker_name}\nStatus: ${t.status}\nMethod: ${t.method || 'N/A'}\nOpt-out: ${t.opt_out_url || 'N/A'}\n`;
        if (t.steps?.length) content += 'Steps:\n' + t.steps.map((s, i) => `  ${i + 1}. ${s}`).join('\n') + '\n';
        content += `${'-'.repeat(40)}\n\n`;
      }
      break;
    }
    case 'identity_recovery': {
      filename = `identity-recovery-packet-${Date.now()}.txt`;
      content = `IDENTITY RECOVERY PACKET\nGenerated: ${today}\n${'═'.repeat(60)}\n\nBREACHES DETECTED: ${(data.breaches || []).length}\nBROKER EXPOSURES: ${(data.brokerExposures || []).length}\nIMPERSONATIONS: ${(data.impersonations || []).length}\n\nIMMEDIATE STEPS:\n1. Freeze credit at Equifax, Experian, and TransUnion\n2. File identity theft report at IdentityTheft.gov\n3. Place fraud alerts\n4. File police report\n5. Review all financial accounts for unauthorized activity\n\n`;
      break;
    }
    default:
      filename = `incognito-export-${Date.now()}.txt`;
      content = JSON.stringify(data, null, 2);
  }

  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  a.click(); URL.revokeObjectURL(url);
}
