import { useState } from 'react';
import { incognito } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bot, Shield, AlertTriangle, Search, Trash2, Brain, Mic, Image, FileText, Clock, CheckCircle, ShieldAlert, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CONTENT_TYPES = [
  { value: 'email', label: 'Email / Message', icon: FileText },
  { value: 'voice', label: 'Voice / Audio', icon: Mic },
  { value: 'image', label: 'Image / Video', icon: Image },
  { value: 'text', label: 'Text / Chat', icon: FileText },
  { value: 'call', label: 'Phone Call', icon: Mic },
];

const THREAT_TYPES = {
  deepfake: { label: 'Deepfake', color: 'bg-red-500', icon: Image },
  phishing: { label: 'AI Phishing', color: 'bg-orange-500', icon: FileText },
  voice_clone: { label: 'Voice Clone', color: 'bg-purple-500', icon: Mic },
  social_engineering: { label: 'Social Engineering', color: 'bg-yellow-500', icon: Brain },
  impersonation: { label: 'AI Impersonation', color: 'bg-pink-500', icon: Bot },
  safe: { label: 'No Threat', color: 'bg-green-500', icon: Shield },
};

export default function AIDefense() {
  const queryClient = useQueryClient();
  const [showAnalyze, setShowAnalyze] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({ content: '', content_type: 'email' });

  const activeProfileId = typeof window !== 'undefined' ? window.activeProfileId : null;

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['aiDefenseAlerts'],
    queryFn: () => incognito.entities.AIDefenseAlert.list('-created_date'),
  });

  const filtered = alerts
    .filter(a => !activeProfileId || a.profile_id === activeProfileId)
    .filter(a => activeTab === 'all' || a.threat_type === activeTab)
    .filter(a => !searchQuery || a.description?.toLowerCase().includes(searchQuery.toLowerCase()));

  const analyzeMutation = useMutation({
    mutationFn: (data) => incognito.functions.invoke('analyzeAIThreat', {
      content: data.content, contentType: data.content_type, profileId: activeProfileId,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['aiDefenseAlerts']);
      setShowAnalyze(false);
      setFormData({ content: '', content_type: 'email' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => incognito.entities.AIDefenseAlert.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['aiDefenseAlerts']),
  });

  const markReviewed = async (id) => {
    await incognito.entities.AIDefenseAlert.update(id, { status: 'reviewed' });
    queryClient.invalidateQueries(['aiDefenseAlerts']);
  };

  const threatInfo = (type) => THREAT_TYPES[type] || THREAT_TYPES.safe;

  const stats = {
    total: alerts.length,
    threats: alerts.filter(a => a.threat_type !== 'safe').length,
    deepfakes: alerts.filter(a => a.threat_type === 'deepfake').length,
    phishing: alerts.filter(a => a.threat_type === 'phishing').length,
    voiceClones: alerts.filter(a => a.threat_type === 'voice_clone').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Bot className="h-8 w-8 text-primary" />
            AI Defense
          </h1>
          <p className="text-muted-foreground mt-1">
            Detect deepfakes, AI-generated phishing, voice cloning, and AI-powered scams.
          </p>
        </div>
        <Dialog open={showAnalyze} onOpenChange={setShowAnalyze}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Zap className="h-4 w-4" /> Analyze Content</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Analyze for AI Threats</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Content Type</Label>
                <Select value={formData.content_type} onValueChange={(v) => setFormData(d => ({ ...d, content_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONTENT_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Content to Analyze</Label>
                <Textarea placeholder="Paste the suspicious email, message, or describe the audio/video/call..."
                  value={formData.content} className="min-h-[150px]"
                  onChange={(e) => setFormData(d => ({ ...d, content: e.target.value }))} />
              </div>
              <p className="text-xs text-muted-foreground">
                AI will analyze the content for deepfake indicators, AI-generated text patterns, voice cloning markers, and social engineering techniques.
              </p>
              <Button className="w-full" onClick={() => analyzeMutation.mutate(formData)}
                disabled={!formData.content || analyzeMutation.isPending}>
                {analyzeMutation.isPending ? 'Analyzing with AI...' : 'Analyze for Threats'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Analyzed', value: stats.total, icon: Brain, color: 'text-primary' },
          { label: 'Threats Found', value: stats.threats, icon: AlertTriangle, color: stats.threats > 0 ? 'text-red-500' : 'text-green-500' },
          { label: 'Deepfakes', value: stats.deepfakes, icon: Image, color: 'text-red-500' },
          { label: 'AI Phishing', value: stats.phishing, icon: FileText, color: 'text-orange-500' },
          { label: 'Voice Clones', value: stats.voiceClones, icon: Mic, color: 'text-purple-500' },
        ].map((s, i) => (
          <Card key={i} className="glass-card">
            <CardContent className="pt-4 pb-3 text-center">
              <s.icon className={`h-5 w-5 mx-auto mb-1 ${s.color}`} />
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Education Card */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="py-4">
          <h3 className="font-semibold flex items-center gap-2 mb-2">
            <ShieldAlert className="h-4 w-4 text-primary" /> AI Threat Awareness
          </h3>
          <div className="grid md:grid-cols-3 gap-3 text-sm">
            <div>
              <span className="font-medium text-red-500">Deepfakes:</span> AI-generated images/videos that impersonate real people. Look for: unnatural blinking, inconsistent lighting, blurred edges around face.
            </div>
            <div>
              <span className="font-medium text-purple-500">Voice Cloning:</span> AI can clone voices from short audio samples. Be suspicious of urgent requests from "family members" or "executives" by phone.
            </div>
            <div>
              <span className="font-medium text-orange-500">AI Phishing:</span> LLMs write hyper-personalized phishing emails. Look for: unusual urgency, requests for credentials, subtle URL differences.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs & Search */}
      <div className="flex gap-3">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="deepfake">Deepfake</TabsTrigger>
            <TabsTrigger value="phishing">Phishing</TabsTrigger>
            <TabsTrigger value="voice_clone">Voice Clone</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search alerts..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      {/* Alert List */}
      <div className="space-y-3">
        <AnimatePresence>
          {filtered.map((alert) => {
            const threat = threatInfo(alert.threat_type);
            const ThreatIcon = threat.icon;

            return (
              <motion.div key={alert.id} layout initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <Card>
                  <CardContent className="py-4 px-5">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full ${threat.color}/20 flex items-center justify-center`}>
                          <ThreatIcon className={`h-5 w-5 ${threat.color.replace('bg-', 'text-')}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge className={`${threat.color} text-white`}>{threat.label}</Badge>
                            <Badge variant="outline">{alert.content_type}</Badge>
                            <span className="text-sm font-medium">Confidence: {alert.confidence}%</span>
                          </div>
                          <p className="text-sm mt-1">{alert.description}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {alert.status === 'new' && (
                          <Button variant="ghost" size="sm" onClick={() => markReviewed(alert.id)}>
                            <CheckCircle className="h-3 w-3 mr-1" /> Reviewed
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                          onClick={() => deleteMutation.mutate(alert.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Indicators */}
                    {alert.indicators?.length > 0 && (
                      <div className="mt-2">
                        <span className="text-xs font-medium text-muted-foreground">Indicators:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {alert.indicators.map((ind, i) => (
                            <Badge key={i} variant="outline" className="text-[10px]">{ind}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recommended Action */}
                    {alert.recommended_action && (
                      <div className="mt-2 p-2 bg-muted rounded text-sm">
                        <span className="font-medium">Action: </span>{alert.recommended_action}
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                      <Clock className="h-3 w-3" />
                      {new Date(alert.created_date).toLocaleString()}
                      <Badge variant={alert.status === 'new' ? 'default' : 'secondary'} className="text-[10px]">{alert.status}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {alerts.length === 0 && !isLoading && (
        <Card className="p-12 text-center">
          <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold mb-2">No AI Defense Alerts</h3>
          <p className="text-muted-foreground mb-4">
            Submit suspicious emails, messages, or media for AI-powered threat analysis.
          </p>
          <Button onClick={() => setShowAnalyze(true)} className="gap-2">
            <Zap className="h-4 w-4" /> Analyze First Content
          </Button>
        </Card>
      )}
    </div>
  );
}
