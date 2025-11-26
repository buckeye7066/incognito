import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Database, Users, Eye, Calendar } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts';

export default function ThreatTimelineChart({ scanResults, socialFindings, searchFindings }) {
  // Build timeline data
  const buildTimelineData = () => {
    const last30Days = [];
    const today = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      last30Days.push({
        date: dateStr,
        displayDate: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        breaches: 0,
        impersonations: 0,
        exposures: 0,
        total: 0
      });
    }

    // Count findings per day
    scanResults.forEach(r => {
      const date = r.scan_date || r.created_date?.split('T')[0];
      const entry = last30Days.find(d => d.date === date);
      if (entry) {
        entry.breaches++;
        entry.total++;
      }
    });

    socialFindings.forEach(f => {
      const date = f.detected_date || f.created_date?.split('T')[0];
      const entry = last30Days.find(d => d.date === date);
      if (entry) {
        entry.impersonations++;
        entry.total++;
      }
    });

    searchFindings.forEach(f => {
      const date = f.detected_date?.split('T')[0] || f.created_date?.split('T')[0];
      const entry = last30Days.find(d => d.date === date);
      if (entry) {
        entry.exposures++;
        entry.total++;
      }
    });

    return last30Days;
  };

  const timelineData = buildTimelineData();

  // Build all-time events
  const buildAllEvents = () => {
    const events = [];

    scanResults.forEach(r => {
      events.push({
        date: r.scan_date || r.created_date,
        type: 'breach',
        title: r.source_name,
        severity: r.risk_score >= 70 ? 'critical' : r.risk_score >= 40 ? 'high' : 'medium',
        icon: <Database className="w-4 h-4" />,
        color: 'red'
      });
    });

    socialFindings.forEach(f => {
      events.push({
        date: f.detected_date || f.created_date,
        type: 'impersonation',
        title: `@${f.suspicious_username} on ${f.platform}`,
        severity: f.severity,
        icon: <Users className="w-4 h-4" />,
        color: 'orange'
      });
    });

    searchFindings.forEach(f => {
      events.push({
        date: f.detected_date || f.created_date,
        type: 'exposure',
        title: `${f.search_platform}`,
        severity: f.risk_level,
        icon: <Eye className="w-4 h-4" />,
        color: 'yellow'
      });
    });

    return events.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
  };

  const recentEvents = buildAllEvents();

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/20 text-red-300 border-red-500/40';
      case 'high': return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
      case 'medium': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
      case 'low': return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      default: return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
    }
  };

  const getEventBorderColor = (color) => {
    switch (color) {
      case 'red': return 'border-l-red-500';
      case 'orange': return 'border-l-orange-500';
      case 'yellow': return 'border-l-yellow-500';
      default: return 'border-l-purple-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Trend Chart */}
      <Card className="glass-card border-purple-500/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            30-Day Threat Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData}>
                <defs>
                  <linearGradient id="colorBreaches" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorImpersonations" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExposures" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#eab308" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="displayDate" 
                  stroke="#9ca3af" 
                  fontSize={10}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e1b2e',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="breaches" 
                  stroke="#ef4444" 
                  fillOpacity={1}
                  fill="url(#colorBreaches)"
                  name="Breaches"
                />
                <Area 
                  type="monotone" 
                  dataKey="impersonations" 
                  stroke="#f97316" 
                  fillOpacity={1}
                  fill="url(#colorImpersonations)"
                  name="Impersonations"
                />
                <Area 
                  type="monotone" 
                  dataKey="exposures" 
                  stroke="#eab308" 
                  fillOpacity={1}
                  fill="url(#colorExposures)"
                  name="Exposures"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Recent Events Timeline */}
      <Card className="glass-card border-purple-500/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-400" />
            Recent Threat Events
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentEvents.length > 0 ? (
            <div className="space-y-3">
              {recentEvents.map((event, idx) => (
                <div 
                  key={idx}
                  className={`p-3 rounded-lg bg-slate-800/50 border-l-4 ${getEventBorderColor(event.color)}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-${event.color}-500/20`}>
                        {event.icon}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{event.title}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(event.date).toLocaleDateString()} • {event.type}
                        </p>
                      </div>
                    </div>
                    <Badge className={getSeverityColor(event.severity)}>
                      {event.severity?.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-purple-500 mx-auto mb-3 opacity-50" />
              <p className="text-purple-300">No threat events recorded</p>
              <p className="text-sm text-purple-400">Run scans to detect threats</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}