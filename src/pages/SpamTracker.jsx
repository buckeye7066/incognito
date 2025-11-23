import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Phone, Mail, MessageSquare, AlertTriangle, TrendingDown, Shield, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const incidentIcons = {
  phone_call: Phone,
  sms: MessageSquare,
  email: Mail,
  mail: Mail,
  robocall: Phone
};

const categoryColors = {
  telemarketing: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  scam: 'bg-red-500/20 text-red-300 border-red-500/40',
  phishing: 'bg-red-500/20 text-red-300 border-red-500/40',
  debt_collection: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  political: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  survey: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  other: 'bg-gray-500/20 text-gray-300 border-gray-500/40'
};

export default function SpamTracker() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    incident_type: 'phone_call',
    category: 'telemarketing',
    source_identifier: '',
    content_summary: '',
    suspected_data_source: '',
    date_received: new Date().toISOString().split('T')[0]
  });

  const activeProfileId = typeof window !== 'undefined' ? window.activeProfileId : null;

  const { data: allIncidents = [] } = useQuery({
    queryKey: ['spamIncidents'],
    queryFn: () => base44.entities.SpamIncident.list()
  });

  const { data: scanResults = [] } = useQuery({
    queryKey: ['scanResults'],
    queryFn: () => base44.entities.ScanResult.list()
  });

  const incidents = allIncidents.filter(i => !activeProfileId || i.profile_id === activeProfileId);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.SpamIncident.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['spamIncidents']);
      setShowForm(false);
      setFormData({
        incident_type: 'phone_call',
        category: 'telemarketing',
        source_identifier: '',
        content_summary: '',
        suspected_data_source: '',
        date_received: new Date().toISOString().split('T')[0]
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SpamIncident.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['spamIncidents']);
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!activeProfileId) {
      alert('Please select a profile first');
      return;
    }

    await createMutation.mutateAsync({
      ...formData,
      profile_id: activeProfileId
    });
  };

  // Calculate metrics
  const last30Days = incidents.filter(i => {
    const date = new Date(i.date_received);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return date >= thirtyDaysAgo;
  });

  const previous30Days = incidents.filter(i => {
    const date = new Date(i.date_received);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return date >= sixtyDaysAgo && date < thirtyDaysAgo;
  });

  const changePercent = previous30Days.length > 0
    ? ((last30Days.length - previous30Days.length) / previous30Days.length) * 100
    : 0;

  // Chart data - last 7 days
  const chartData = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const count = incidents.filter(inc => inc.date_received === dateStr).length;
    chartData.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      count
    });
  }

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <Shield className="w-10 h-10 text-purple-400" />
            Spam Tracker
          </h1>
          <p className="text-purple-300">Monitor and reduce unwanted communications</p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="bg-gradient-to-r from-purple-600 to-indigo-600"
        >
          <Plus className="w-5 h-5 mr-2" />
          Log Spam Incident
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-card border-purple-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle className="w-8 h-8 text-red-400" />
              <span className="text-3xl font-bold text-white">{last30Days.length}</span>
            </div>
            <p className="text-sm text-purple-300">Last 30 Days</p>
            {changePercent !== 0 && (
              <Badge className={`mt-2 ${changePercent < 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                {changePercent > 0 ? '+' : ''}{changePercent.toFixed(0)}%
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card border-purple-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Phone className="w-8 h-8 text-orange-400" />
              <span className="text-3xl font-bold text-white">
                {incidents.filter(i => i.incident_type === 'phone_call' || i.incident_type === 'robocall').length}
              </span>
            </div>
            <p className="text-sm text-purple-300">Total Calls</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-purple-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Mail className="w-8 h-8 text-blue-400" />
              <span className="text-3xl font-bold text-white">
                {incidents.filter(i => i.incident_type === 'email').length}
              </span>
            </div>
            <p className="text-sm text-purple-300">Total Emails</p>
          </CardContent>
        </Card>

        <Card className="glass-card border-purple-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <TrendingDown className="w-8 h-8 text-green-400" />
              <span className="text-3xl font-bold text-white">
                {scanResults.filter(r => r.status === 'removed').length}
              </span>
            </div>
            <p className="text-sm text-purple-300">Removals Complete</p>
          </CardContent>
        </Card>
      </div>

      {/* Trend Chart */}
      <Card className="glass-card border-purple-500/30">
        <CardHeader className="border-b border-purple-500/20">
          <CardTitle className="text-white">7-Day Spam Trend</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#6b21a8" opacity={0.2} />
              <XAxis dataKey="date" stroke="#a78bfa" />
              <YAxis stroke="#a78bfa" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e1b4b', border: '1px solid #6b21a8' }}
                labelStyle={{ color: '#a78bfa' }}
              />
              <Line type="monotone" dataKey="count" stroke="#a855f7" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Log Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="glass-card border-purple-500/30">
              <CardHeader className="border-b border-purple-500/20">
                <CardTitle className="text-white">Log Spam Incident</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-purple-200">Incident Type</label>
                      <Select value={formData.incident_type} onValueChange={(v) => setFormData({...formData, incident_type: v})}>
                        <SelectTrigger className="bg-slate-900/50 border-purple-500/30 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="phone_call">Phone Call</SelectItem>
                          <SelectItem value="robocall">Robocall</SelectItem>
                          <SelectItem value="sms">SMS/Text</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="mail">Physical Mail</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-purple-200">Category</label>
                      <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
                        <SelectTrigger className="bg-slate-900/50 border-purple-500/30 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="telemarketing">Telemarketing</SelectItem>
                          <SelectItem value="scam">Scam</SelectItem>
                          <SelectItem value="phishing">Phishing</SelectItem>
                          <SelectItem value="debt_collection">Debt Collection</SelectItem>
                          <SelectItem value="political">Political</SelectItem>
                          <SelectItem value="survey">Survey</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-purple-200">Source (Phone/Email/Sender)</label>
                    <Input
                      value={formData.source_identifier}
                      onChange={(e) => setFormData({...formData, source_identifier: e.target.value})}
                      placeholder="e.g., +1-555-0123 or spam@example.com"
                      className="bg-slate-900/50 border-purple-500/30 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-purple-200">Suspected Data Source</label>
                    <Input
                      value={formData.suspected_data_source}
                      onChange={(e) => setFormData({...formData, suspected_data_source: e.target.value})}
                      placeholder="e.g., WhitePages, BeenVerified"
                      className="bg-slate-900/50 border-purple-500/30 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-purple-200">Summary</label>
                    <Textarea
                      value={formData.content_summary}
                      onChange={(e) => setFormData({...formData, content_summary: e.target.value})}
                      placeholder="Brief description of the spam..."
                      className="bg-slate-900/50 border-purple-500/30 text-white"
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="border-purple-500/50 text-purple-300">
                      Cancel
                    </Button>
                    <Button type="submit" className="bg-gradient-to-r from-purple-600 to-indigo-600">
                      Log Incident
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Incidents List */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-white">Recent Incidents</h2>
        {incidents.length > 0 ? (
          incidents.slice(0, 20).map((incident) => {
            const Icon = incidentIcons[incident.incident_type] || AlertTriangle;
            return (
              <motion.div key={incident.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="glass-card border-purple-500/20 hover:glow-border transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-semibold text-white capitalize">
                              {incident.incident_type.replace(/_/g, ' ')}
                            </h3>
                            <p className="text-xs text-purple-400">{incident.source_identifier}</p>
                          </div>
                          <Badge className={`${categoryColors[incident.category]} border`}>
                            {incident.category.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                        <p className="text-sm text-purple-300 mb-2">{incident.content_summary}</p>
                        {incident.suspected_data_source && (
                          <p className="text-xs text-amber-400">Suspected source: {incident.suspected_data_source}</p>
                        )}
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-purple-500/20">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateMutation.mutate({ id: incident.id, data: { blocked: !incident.blocked } })}
                            className="border-purple-500/50 text-purple-300"
                          >
                            {incident.blocked ? 'Unblock' : 'Mark Blocked'}
                          </Button>
                          <span className="ml-auto text-xs text-purple-400">
                            {new Date(incident.date_received).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })
        ) : (
          <Card className="glass-card border-purple-500/20">
            <CardContent className="p-16 text-center">
              <Shield className="w-16 h-16 text-purple-500 mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-semibold text-white mb-2">No Spam Logged Yet</h3>
              <p className="text-purple-300">Start tracking spam incidents to monitor your reduction progress</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}