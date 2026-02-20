import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, AlertTriangle, CheckCircle, Shield, Trash2, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { formatDistanceToNow } from 'date-fns';

export default function RecentActivityFeed({ activeProfileId }) {
  const { data: allScanResults = [] } = useQuery({
    queryKey: ['scanResults'],
    queryFn: () => base44.entities.ScanResult.list('-created_date', 20)
  });

  const { data: allDeletionRequests = [] } = useQuery({
    queryKey: ['deletionRequests'],
    queryFn: () => base44.entities.DeletionRequest.list('-created_date', 20)
  });

  const { data: allAlerts = [] } = useQuery({
    queryKey: ['notificationAlerts'],
    queryFn: () => base44.entities.NotificationAlert.list('-created_date', 20)
  });

  const scanResults = allScanResults.filter(r => !activeProfileId || r.profile_id === activeProfileId);
  const deletionRequests = allDeletionRequests.filter(r => !activeProfileId || r.profile_id === activeProfileId);
  const alerts = allAlerts.filter(a => !activeProfileId || a.profile_id === activeProfileId);

  const events = [
    ...scanResults.map(r => ({
      id: r.id,
      type: 'breach',
      label: `Breach found: ${r.source_name}`,
      date: r.created_date,
      risk: r.risk_score >= 70 ? 'critical' : r.risk_score >= 40 ? 'high' : 'medium',
      link: 'Findings',
      icon: AlertTriangle,
      color: 'text-red-400',
    })),
    ...deletionRequests.map(r => ({
      id: r.id,
      type: 'deletion',
      label: `Removal request: ${r.status.replace(/_/g, ' ')}`,
      date: r.created_date,
      risk: r.status === 'completed' ? 'low' : 'medium',
      link: 'DeletionCenter',
      icon: r.status === 'completed' ? CheckCircle : Trash2,
      color: r.status === 'completed' ? 'text-green-400' : 'text-orange-400',
    })),
    ...alerts.map(a => ({
      id: a.id,
      type: 'alert',
      label: a.title,
      date: a.created_date,
      risk: a.severity,
      link: 'Notifications',
      icon: Bell,
      color: a.severity === 'critical' ? 'text-red-400' : 'text-yellow-400',
    })),
  ]
    .filter(e => e.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 8);

  return (
    <Card className="glass-card border-purple-500/20">
      <CardHeader className="pb-3 border-b border-purple-500/10">
        <CardTitle className="text-white flex items-center gap-2 text-base">
          <Activity className="w-4 h-4 text-purple-400" /> Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {events.length === 0 ? (
          <div className="text-center py-6">
            <Shield className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map(event => {
              const Icon = event.icon;
              return (
                <Link key={event.id} to={createPageUrl(event.link)}>
                  <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/50 transition-colors cursor-pointer">
                    <Icon className={`w-4 h-4 shrink-0 ${event.color}`} />
                    <p className="text-sm text-gray-300 flex-1 truncate">{event.label}</p>
                    <span className="text-xs text-gray-500 shrink-0">
                      {formatDistanceToNow(new Date(event.date), { addSuffix: true })}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}