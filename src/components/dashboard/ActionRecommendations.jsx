import React from 'react';
import { incognito } from '@/api/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import {
  Zap, Shield, AlertTriangle, DollarSign, Gavel, Rocket,
  CreditCard, Users, Mail, Sparkles, Scale, ChevronRight,
} from 'lucide-react';
import { generateActionRecommendations, calculateRiskScore } from '@/lib/actionEngine';

const ICON_MAP = {
  shield: Shield, alert: AlertTriangle, dollar: DollarSign, gavel: Gavel,
  rocket: Rocket, credit_card: CreditCard, users: Users, mail: Mail,
  sparkles: Sparkles, scale: Scale,
};

const CATEGORY_COLORS = {
  critical: 'border-red-500/40 bg-red-500/5',
  money: 'border-green-500/30 bg-green-500/5',
  privacy: 'border-purple-500/30 bg-purple-500/5',
  financial: 'border-amber-500/30 bg-amber-500/5',
};

export default function ActionRecommendations({ profileId, maxItems = 5 }) {
  const { data: scanResults = [] } = useQuery({ queryKey: ['scanResults'], queryFn: () => incognito.entities.ScanResult.list() });
  const { data: searchFindings = [] } = useQuery({ queryKey: ['searchQueryFindings'], queryFn: () => incognito.entities.SearchQueryFinding.list() });
  const { data: socialFindings = [] } = useQuery({ queryKey: ['socialMediaFindings'], queryFn: () => incognito.entities.SocialMediaFinding.list() });
  const { data: subscriptions = [] } = useQuery({ queryKey: ['subscriptions'], queryFn: () => incognito.entities.Subscription.list() });
  const { data: debtIssues = [] } = useQuery({ queryKey: ['debtIssues'], queryFn: () => incognito.entities.DebtIssue.list() });
  const { data: settlementCases = [] } = useQuery({ queryKey: ['settlementCases'], queryFn: () => incognito.entities.SettlementCase.list() });
  const { data: brokerTasks = [] } = useQuery({ queryKey: ['brokerTasks'], queryFn: () => incognito.entities.BrokerRemovalTask.list() });
  const { data: deletionRequests = [] } = useQuery({ queryKey: ['deletionRequests'], queryFn: () => incognito.entities.DeletionRequest.list() });
  const { data: activities = [] } = useQuery({ queryKey: ['suspiciousActivities'], queryFn: () => incognito.entities.SuspiciousActivity.list() });
  const { data: personalData = [] } = useQuery({ queryKey: ['personalData'], queryFn: () => incognito.entities.PersonalData.list() });
  const { data: creditDisputeItems = [] } = useQuery({ queryKey: ['creditDisputeItems'], queryFn: () => incognito.entities.CreditDisputeItem.list() });

  const pf = (arr) => arr.filter(i => !profileId || i.profile_id === profileId);

  const actions = generateActionRecommendations({
    scanResults: pf(scanResults),
    searchFindings: pf(searchFindings),
    socialFindings: pf(socialFindings),
    subscriptions: pf(subscriptions),
    debtIssues: pf(debtIssues),
    settlementCases: pf(settlementCases),
    brokerTasks: pf(brokerTasks),
    deletionRequests: pf(deletionRequests),
    suspiciousActivities: pf(activities),
    personalData: pf(personalData),
    creditDisputeItems: pf(creditDisputeItems),
  });

  if (actions.length === 0) return null;

  return (
    <Card className="glass-card border-amber-500/30">
      <CardHeader className="border-b border-amber-500/20">
        <CardTitle className="text-white flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" />
          Priority Actions ({actions.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {actions.slice(0, maxItems).map(action => {
          const Icon = ICON_MAP[action.icon] || Zap;
          const catColor = CATEGORY_COLORS[action.category] || CATEGORY_COLORS.privacy;
          return (
            <Link key={action.id} to={createPageUrl(action.link?.replace('/', ''))} className="block">
              <div className={`p-4 rounded-lg border ${catColor} hover:bg-slate-800/40 transition-colors cursor-pointer`}>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${action.category === 'critical' ? 'bg-red-500/20' : action.category === 'money' ? 'bg-green-500/20' : 'bg-purple-500/20'}`}>
                    <Icon className={`w-5 h-5 ${action.category === 'critical' ? 'text-red-400' : action.category === 'money' ? 'text-green-400' : 'text-purple-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-white font-medium text-sm">{action.title}</p>
                      {action.priority <= 2 && <Badge className="text-[10px] border-0 bg-red-500/20 text-red-300">Urgent</Badge>}
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-2">{action.description}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500 shrink-0 mt-1" />
                </div>
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
