import React, { useState, useMemo } from 'react';
import { incognito } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Rocket, Loader2, CheckCircle, Clock, AlertTriangle, ExternalLink,
  Play, RotateCw, Eye, EyeOff, Copy, Mail, Globe, ChevronDown,
  ChevronUp, Bot, Download, Shield, ShieldCheck, Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const STATUS_META = {
  not_started: { label: 'Not Started', color: 'bg-gray-500/20 text-gray-300', icon: Clock },
  template_ready: { label: 'Template Ready', color: 'bg-blue-500/20 text-blue-300', icon: Mail },
  submitted: { label: 'Submitted', color: 'bg-amber-500/20 text-amber-300', icon: Rocket },
  awaiting_response: { label: 'Awaiting Response', color: 'bg-purple-500/20 text-purple-300', icon: Clock },
  verified_removed: { label: 'Verified Removed', color: 'bg-green-500/20 text-green-300', icon: CheckCircle },
  reappeared: { label: 'Reappeared!', color: 'bg-red-500/20 text-red-300', icon: AlertTriangle },
};

export default function BrokerCampaignEngine({ profileId }) {
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [expandedCampaign, setExpandedCampaign] = useState(null);
  const [expandedTask, setExpandedTask] = useState(null);
  const [taskDetail, setTaskDetail] = useState(null);
  const [copied, setCopied] = useState(null);

  const { data: campaigns = [] } = useQuery({
    queryKey: ['brokerCampaigns'],
    queryFn: () => incognito.entities.BrokerRemovalCampaign.list(),
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ['brokerTasks'],
    queryFn: () => incognito.entities.BrokerRemovalTask.list(),
  });
  const { data: personalData = [] } = useQuery({
    queryKey: ['personalData'],
    queryFn: () => incognito.entities.PersonalData.list(),
  });
  const { data: searchFindings = [] } = useQuery({
    queryKey: ['searchQueryFindings'],
    queryFn: () => incognito.entities.SearchQueryFinding.list(),
  });

  const myCampaigns = campaigns.filter(c => !profileId || c.profile_id === profileId);
  const myTasks = tasks.filter(t => !profileId || t.profile_id === profileId);
  const myData = personalData.filter(d => !profileId || d.profile_id === profileId);
  const myFindings = searchFindings.filter(f => !profileId || f.profile_id === profileId);

  const activeCampaign = myCampaigns.length > 0 ? myCampaigns[myCampaigns.length - 1] : null;
  const campaignTasks = activeCampaign ? myTasks.filter(t => t.campaign_id === activeCampaign.id) : [];

  const completedCount = campaignTasks.filter(t => t.status === 'verified_removed').length;
  const totalCount = campaignTasks.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const reappearedCount = campaignTasks.filter(t => t.status === 'reappeared').length;

  const createCampaign = useMutation({
    mutationFn: async () => {
      setGenerating(true);
      try {
        const result = await incognito.functions.invoke('generateBrokerCampaign', {
          profileData: myData, brokers: myFindings,
        });
        const data = result.data || result;
        const campaign = await incognito.entities.BrokerRemovalCampaign.create({
          profile_id: profileId, name: data.campaign_name || `Campaign ${new Date().toLocaleDateString()}`,
          total_brokers: data.tasks?.length || 0, status: 'active', created_date: new Date().toISOString(),
        });
        for (const task of (data.tasks || [])) {
          await incognito.entities.BrokerRemovalTask.create({
            profile_id: profileId, campaign_id: campaign.id,
            broker_name: task.broker_name, opt_out_url: task.opt_out_url,
            method: task.method, steps: task.steps, email_template: task.email_template,
            estimated_time: task.estimated_time, difficulty: task.difficulty,
            recheck_days: task.recheck_days || 30, status: 'not_started',
            created_date: new Date().toISOString(),
          });
        }
        return campaign;
      } finally {
        setGenerating(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['brokerCampaigns']);
      queryClient.invalidateQueries(['brokerTasks']);
    },
  });

  const updateTask = useMutation({
    mutationFn: ({ id, data }) => incognito.entities.BrokerRemovalTask.update(id, data),
    onSuccess: () => queryClient.invalidateQueries(['brokerTasks']),
  });

  const copyText = (key, text) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const exportCampaign = () => {
    const lines = [`BROKER REMOVAL CAMPAIGN — ${activeCampaign?.name || 'Campaign'}`, `Generated: ${new Date().toLocaleDateString()}`, `Progress: ${completedCount}/${totalCount} brokers removed`, '', ''];
    for (const task of campaignTasks) {
      lines.push(`═══ ${task.broker_name} ═══`);
      lines.push(`Status: ${STATUS_META[task.status]?.label || task.status}`);
      lines.push(`Method: ${task.method || 'N/A'}`);
      if (task.opt_out_url) lines.push(`Opt-out URL: ${task.opt_out_url}`);
      if (task.steps?.length) { lines.push('Steps:'); task.steps.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`)); }
      if (task.email_template) { lines.push('', 'Email Template:', task.email_template); }
      lines.push('');
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `broker-removal-campaign-${Date.now()}.txt`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Campaigns', value: myCampaigns.length, icon: Rocket, color: 'text-purple-400' },
          { label: 'Brokers Targeted', value: totalCount, icon: Globe, color: 'text-blue-400' },
          { label: 'Verified Removed', value: completedCount, icon: ShieldCheck, color: 'text-green-400' },
          { label: 'Reappeared', value: reappearedCount, icon: AlertTriangle, color: reappearedCount > 0 ? 'text-red-400' : 'text-gray-400' },
        ].map(s => (
          <Card key={s.label} className="glass-card border-purple-500/10">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`w-7 h-7 ${s.color}`} />
              <div>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-gray-400 text-xs">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Progress */}
      {activeCampaign && totalCount > 0 && (
        <Card className="glass-card border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-white font-semibold text-sm">{activeCampaign.name}</p>
              <p className="text-green-400 text-sm font-mono">{completedCount}/{totalCount}</p>
            </div>
            <Progress value={progress} className="h-3 bg-slate-700" />
            <p className="text-xs text-gray-400 mt-1">{progress}% complete</p>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => createCampaign.mutate()} disabled={generating || myData.length === 0} className="bg-gradient-to-r from-purple-600 to-indigo-600">
          {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating Campaign...</> : <><Rocket className="w-4 h-4 mr-2" /> New Campaign</>}
        </Button>
        {activeCampaign && (
          <Button onClick={exportCampaign} variant="outline" className="border-green-500/40 text-green-300">
            <Download className="w-4 h-4 mr-1" /> Export Package
          </Button>
        )}
      </div>

      {myData.length === 0 && (
        <Card className="bg-amber-500/5 border-amber-500/20"><CardContent className="p-3">
          <p className="text-xs text-amber-200">Add personal data to your Vault first so the campaign knows what to remove.</p>
        </CardContent></Card>
      )}

      {/* Task List */}
      {campaignTasks.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-white font-semibold">Broker Tasks</h3>
          {campaignTasks.map(task => {
            const meta = STATUS_META[task.status] || STATUS_META.not_started;
            const StatusIcon = meta.icon;
            const isExpanded = expandedTask === task.id;

            return (
              <Card key={task.id} className={`glass-card overflow-hidden ${task.status === 'reappeared' ? 'border-red-500/30' : task.status === 'verified_removed' ? 'border-green-500/20 opacity-60' : 'border-slate-700'}`}>
                <button onClick={() => setExpandedTask(isExpanded ? null : task.id)} className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/40">
                  <div className="flex items-center gap-3 min-w-0">
                    <StatusIcon className={`w-5 h-5 shrink-0 ${meta.color.split(' ')[1]}`} />
                    <div className="min-w-0">
                      <p className="text-white font-medium text-sm truncate">{task.broker_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge className={`text-[10px] border-0 ${meta.color}`}>{meta.label}</Badge>
                        {task.difficulty && <Badge className="text-[10px] border-0 bg-slate-700 text-gray-300">{task.difficulty}</Badge>}
                      </div>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="px-4 pb-4 border-t border-slate-700/50 pt-3 space-y-3">
                        {task.steps?.length > 0 && (
                          <ol className="space-y-1 list-decimal list-inside">
                            {task.steps.map((s, i) => <li key={i} className="text-xs text-gray-300">{s}</li>)}
                          </ol>
                        )}
                        {task.email_template && (
                          <div className="rounded bg-slate-800/50 p-3">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-xs text-gray-500">Email Template</p>
                              <Button size="sm" variant="ghost" onClick={() => copyText(task.id, task.email_template)} className="h-6 text-xs text-purple-300">
                                {copied === task.id ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              </Button>
                            </div>
                            <pre className="text-[11px] text-gray-400 whitespace-pre-wrap font-sans max-h-[150px] overflow-y-auto">{task.email_template}</pre>
                          </div>
                        )}
                        {task.estimated_time && <p className="text-xs text-gray-500">Estimated time: {task.estimated_time}</p>}

                        <div className="flex flex-wrap gap-2 pt-1">
                          {task.opt_out_url && (
                            <a href={task.opt_out_url} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="outline" className="text-xs border-blue-500/40 text-blue-300 h-8"><ExternalLink className="w-3 h-3 mr-1" /> Opt-Out Page</Button>
                            </a>
                          )}
                          {task.status === 'not_started' && <Button size="sm" onClick={() => updateTask.mutate({ id: task.id, data: { status: 'submitted', submitted_date: new Date().toISOString() } })} className="text-xs bg-amber-600 hover:bg-amber-700 h-8"><Rocket className="w-3 h-3 mr-1" /> Mark Submitted</Button>}
                          {(task.status === 'submitted' || task.status === 'awaiting_response') && <Button size="sm" onClick={() => updateTask.mutate({ id: task.id, data: { status: 'verified_removed', completed_date: new Date().toISOString() } })} className="text-xs bg-green-600 hover:bg-green-700 h-8"><CheckCircle className="w-3 h-3 mr-1" /> Verified Removed</Button>}
                          {task.status === 'verified_removed' && <Button size="sm" variant="outline" onClick={() => updateTask.mutate({ id: task.id, data: { status: 'reappeared' } })} className="text-xs border-red-500/40 text-red-300 h-8"><AlertTriangle className="w-3 h-3 mr-1" /> Reappeared</Button>}
                          {task.status === 'reappeared' && <Button size="sm" onClick={() => updateTask.mutate({ id: task.id, data: { status: 'submitted', submitted_date: new Date().toISOString() } })} className="text-xs bg-amber-600 hover:bg-amber-700 h-8"><RotateCw className="w-3 h-3 mr-1" /> Re-submit</Button>}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            );
          })}
        </div>
      )}

      {campaignTasks.length === 0 && myCampaigns.length === 0 && (
        <Card className="glass-card border-slate-700"><CardContent className="p-10 text-center">
          <Rocket className="w-14 h-14 text-purple-500 mx-auto mb-4 opacity-50" />
          <p className="text-gray-300 text-lg">No removal campaigns yet</p>
          <p className="text-gray-500 text-sm mt-1">Launch a campaign to systematically remove your data from all known brokers</p>
        </CardContent></Card>
      )}
    </div>
  );
}
