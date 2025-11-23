import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Loader2, MessageCircle, AlertTriangle, TrendingUp, Shield, ExternalLink } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';

const PLATFORM_ICONS = {
  facebook: '📘', twitter: '🐦', instagram: '📷', linkedin: '💼',
  tiktok: '🎵', snapchat: '👻', youtube: '📺', reddit: '🤖',
  pinterest: '📌', github: '💻', telegram: '✈️', discord: '💬',
  whatsapp: '💬', other: '🌐'
};

export default function SocialMediaMonitor({ profileId }) {
  const queryClient = useQueryClient();
  const [monitoring, setMonitoring] = useState(false);

  const { data: allMentions = [] } = useQuery({
    queryKey: ['socialMediaMentions'],
    queryFn: () => base44.entities.SocialMediaMention.list(),
    enabled: !!profileId
  });

  const mentions = allMentions.filter(m => m.profile_id === profileId);

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.SocialMediaMention.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries(['socialMediaMentions']);
    }
  });

  const handleMonitor = async () => {
    setMonitoring(true);
    try {
      const response = await base44.functions.invoke('monitorSocialMedia', { profileId });
      queryClient.invalidateQueries(['socialMediaMentions']);
      queryClient.invalidateQueries(['socialMediaFindings']);
      queryClient.invalidateQueries(['notificationAlerts']);
      queryClient.invalidateQueries(['aiInsights']);
      alert(response.data.message);
    } catch (error) {
      alert('Monitoring failed: ' + error.message);
    } finally {
      setMonitoring(false);
    }
  };

  const getSentimentColor = (sentiment) => {
    switch (sentiment) {
      case 'positive': return 'bg-green-500/20 text-green-300 border-green-500/40';
      case 'neutral': return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'negative': return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
      case 'concerning': return 'bg-red-500/20 text-red-300 border-red-500/40';
      default: return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
    }
  };

  const getRiskColor = (level) => {
    switch (level) {
      case 'critical': return 'bg-red-500/20 text-red-300 border-red-500/40';
      case 'high': return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
      case 'medium': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
      case 'low': return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      default: return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
    }
  };

  const positiveMentions = mentions.filter(m => m.sentiment === 'positive');
  const negativeMentions = mentions.filter(m => m.sentiment === 'negative' || m.sentiment === 'concerning');
  const highRiskMentions = mentions.filter(m => m.privacy_risk_level === 'high' || m.privacy_risk_level === 'critical');

  return (
    <Card className="glass-card border-purple-500/30">
      <CardHeader className="border-b border-purple-500/20">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            Social Media Monitor
          </CardTitle>
          <Button
            onClick={handleMonitor}
            disabled={monitoring}
            className="bg-gradient-to-r from-purple-600 to-indigo-600"
          >
            {monitoring ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Monitoring...
              </>
            ) : (
              <>
                <Users className="w-4 h-4 mr-2" />
                Scan All Platforms
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30 text-center">
            <p className="text-2xl font-bold text-white">{mentions.length}</p>
            <p className="text-xs text-purple-300">Total Mentions</p>
          </div>
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-center">
            <p className="text-2xl font-bold text-white">{positiveMentions.length}</p>
            <p className="text-xs text-green-300">Positive</p>
          </div>
          <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30 text-center">
            <p className="text-2xl font-bold text-white">{negativeMentions.length}</p>
            <p className="text-xs text-orange-300">Negative</p>
          </div>
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-center">
            <p className="text-2xl font-bold text-white">{highRiskMentions.length}</p>
            <p className="text-xs text-red-300">High Risk</p>
          </div>
        </div>

        {/* Mentions List */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-slate-800/50">
            <TabsTrigger value="all">All ({mentions.length})</TabsTrigger>
            <TabsTrigger value="positive">Positive ({positiveMentions.length})</TabsTrigger>
            <TabsTrigger value="negative">Negative ({negativeMentions.length})</TabsTrigger>
            <TabsTrigger value="risks">High Risk ({highRiskMentions.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4 space-y-3">
            {mentions.length > 0 ? (
              mentions.map((mention) => (
                <MentionCard 
                  key={mention.id} 
                  mention={mention}
                  getSentimentColor={getSentimentColor}
                  getRiskColor={getRiskColor}
                  onStatusUpdate={updateStatusMutation.mutate}
                />
              ))
            ) : (
              <EmptyState />
            )}
          </TabsContent>

          <TabsContent value="positive" className="mt-4 space-y-3">
            {positiveMentions.map((mention) => (
              <MentionCard 
                key={mention.id} 
                mention={mention}
                getSentimentColor={getSentimentColor}
                getRiskColor={getRiskColor}
                onStatusUpdate={updateStatusMutation.mutate}
              />
            ))}
          </TabsContent>

          <TabsContent value="negative" className="mt-4 space-y-3">
            {negativeMentions.map((mention) => (
              <MentionCard 
                key={mention.id} 
                mention={mention}
                getSentimentColor={getSentimentColor}
                getRiskColor={getRiskColor}
                onStatusUpdate={updateStatusMutation.mutate}
              />
            ))}
          </TabsContent>

          <TabsContent value="risks" className="mt-4 space-y-3">
            {highRiskMentions.map((mention) => (
              <MentionCard 
                key={mention.id} 
                mention={mention}
                getSentimentColor={getSentimentColor}
                getRiskColor={getRiskColor}
                onStatusUpdate={updateStatusMutation.mutate}
              />
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function MentionCard({ mention, getSentimentColor, getRiskColor, onStatusUpdate }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-lg bg-slate-800/50 border border-purple-500/20"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{PLATFORM_ICONS[mention.platform] || '🌐'}</span>
          <div>
            <p className="text-sm font-semibold text-white capitalize">
              {mention.platform} • {mention.mention_type.replace(/_/g, ' ')}
            </p>
            <p className="text-xs text-purple-400">
              by @{mention.author_username} • {new Date(mention.published_date).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge className={getSentimentColor(mention.sentiment)}>
            {mention.sentiment}
          </Badge>
          {mention.privacy_risk_level !== 'none' && (
            <Badge className={getRiskColor(mention.privacy_risk_level)}>
              {mention.privacy_risk_level} risk
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="p-3 rounded bg-slate-900/50 border border-purple-500/10">
          <p className="text-sm text-purple-200">{mention.content}</p>
        </div>

        {mention.sentiment_score !== 0 && (
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-purple-300">
              Sentiment Score: {mention.sentiment_score > 0 ? '+' : ''}{mention.sentiment_score}
            </span>
          </div>
        )}

        {mention.exposed_data && mention.exposed_data.length > 0 && (
          <div>
            <p className="text-xs text-red-400 mb-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Exposed Data:
            </p>
            <div className="flex flex-wrap gap-1">
              {mention.exposed_data.map((data, idx) => (
                <Badge key={idx} variant="outline" className="text-xs text-red-300 border-red-500/40">
                  {data}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {mention.reach_estimate > 0 && (
          <div className="flex items-center gap-4 text-xs text-purple-300">
            <span>Reach: ~{mention.reach_estimate.toLocaleString()}</span>
            <span>Engagement: {mention.engagement_count}</span>
          </div>
        )}

        <div className="p-3 rounded bg-purple-500/10 border border-purple-500/20">
          <p className="text-xs text-purple-400 mb-1">AI Analysis:</p>
          <p className="text-sm text-purple-200">{mention.ai_analysis}</p>
        </div>

        {mention.recommended_actions && mention.recommended_actions.length > 0 && (
          <div className="p-3 rounded bg-amber-500/10 border border-amber-500/20">
            <p className="text-xs text-amber-400 mb-1 flex items-center gap-1">
              <Shield className="w-3 h-3" />
              Recommended Actions:
            </p>
            <ul className="text-xs text-amber-200 space-y-1 ml-4">
              {mention.recommended_actions.map((action, idx) => (
                <li key={idx} className="list-disc">{action}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t border-purple-500/20">
          {mention.post_url && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(mention.post_url, '_blank')}
              className="border-purple-500/50 text-purple-300"
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              View Post
            </Button>
          )}
          {mention.status === 'new' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onStatusUpdate({ id: mention.id, status: 'reviewed' })}
              className="border-green-500/50 text-green-300"
            >
              Mark Reviewed
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => onStatusUpdate({ id: mention.id, status: 'dismissed' })}
            className="border-gray-500/50 text-gray-300"
          >
            Dismiss
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-8">
      <MessageCircle className="w-12 h-12 text-purple-500 mx-auto mb-3 opacity-50" />
      <p className="text-purple-300 mb-2">No mentions detected yet</p>
      <p className="text-sm text-purple-400">Click "Scan All Platforms" to start monitoring</p>
    </div>
  );
}