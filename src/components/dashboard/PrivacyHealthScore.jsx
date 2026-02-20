import React from 'react';
import { Shield, CheckCircle, XCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';

export default function PrivacyHealthScore({ personalData = [], scanResults = [], deletionRequests = [], accounts = [] }) {
  const checks = [
    {
      id: 'vault_populated',
      label: 'Vault has identifiers',
      pass: personalData.length >= 3,
      tip: 'Add emails, phone, and address to the Vault',
      link: 'Vault',
    },
    {
      id: 'breach_monitored',
      label: 'Breach monitoring active',
      pass: personalData.some(d => d.data_type === 'email' && d.monitoring_enabled),
      tip: 'Add an email to the Vault with monitoring enabled',
      link: 'Vault',
    },
    {
      id: 'no_critical',
      label: 'No critical-risk exposures',
      pass: !scanResults.some(r => r.risk_score >= 90),
      tip: 'Address critical exposures in Findings',
      link: 'Findings',
    },
    {
      id: 'removal_active',
      label: 'Active removal requests',
      pass: deletionRequests.some(r => r.status === 'pending' || r.status === 'in_progress' || r.status === 'completed'),
      tip: 'Request removal from data broker sites',
      link: 'DeletionCenter',
    },
    {
      id: 'accounts_monitored',
      label: 'Financial accounts tracked',
      pass: accounts.some(a => a.monitoring_enabled),
      tip: 'Add a financial account to monitor',
      link: 'FinancialMonitor',
    },
  ];

  const passCount = checks.filter(c => c.pass).length;
  const score = Math.round((passCount / checks.length) * 100);

  const grade = score === 100 ? { label: 'A+', color: 'text-green-400' }
    : score >= 80 ? { label: 'B', color: 'text-yellow-400' }
    : score >= 60 ? { label: 'C', color: 'text-orange-400' }
    : { label: 'D', color: 'text-red-400' };

  return (
    <Card className="glass-card border-purple-500/20">
      <CardHeader className="pb-3 border-b border-purple-500/10">
        <CardTitle className="text-white flex items-center gap-2 text-base">
          <Shield className="w-4 h-4 text-purple-400" /> Privacy Health Score
          <span className={`ml-auto text-2xl font-bold ${grade.color}`}>{grade.label}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-2">
        {checks.map(check => (
          <div key={check.id} className="flex items-center gap-3">
            {check.pass
              ? <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
              : <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
            <span className={`text-sm flex-1 ${check.pass ? 'text-gray-300' : 'text-gray-500'}`}>
              {check.label}
            </span>
            {!check.pass && (
              <Link to={createPageUrl(check.link)} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                Fix <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>
        ))}
        <div className="pt-2 border-t border-slate-700 flex items-center justify-between">
          <span className="text-xs text-gray-500">{passCount}/{checks.length} checks passed</span>
          <span className={`text-xs font-semibold ${grade.color}`}>{score}% healthy</span>
        </div>
      </CardContent>
    </Card>
  );
}