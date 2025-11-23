import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ExternalLink, CheckCircle, XCircle, Clock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const PLATFORM_ICONS = {
  facebook: '📘',
  twitter: '🐦',
  instagram: '📷',
  linkedin: '💼',
  tiktok: '🎵',
  snapchat: '👻',
  youtube: '📺',
  reddit: '🤖',
  pinterest: '📌',
  github: '💻',
  other: '🌐'
};

export default function ImpersonationFindings({ findings, profileId }) {
  const queryClient = useQueryClient();

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.SocialMediaFinding.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries(['socialMediaFindings']);
    }
  });

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/20 text-red-300 border-red-500/40';
      case 'high': return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
      case 'medium': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
      case 'low': return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      default: return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'resolved': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'false_positive': return <XCircle className="w-4 h-4 text-gray-400" />;
      case 'reported': return <Clock className="w-4 h-4 text-blue-400" />;
      default: return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    }
  };

  if (findings.length === 0) {
    return (
      <div className="text-center py-8 text-purple-300">
        <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
        <p className="font-semibold">No impersonation attempts detected</p>
        <p className="text-sm mt-1">Your identity appears safe on social media</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {findings.map((finding) => (
        <Card key={finding.id} className="border-red-500/30 bg-slate-800/50">
          <CardHeader className="border-b border-red-500/20 pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{PLATFORM_ICONS[finding.platform]}</span>
                <div>
                  <CardTitle className="text-white text-lg flex items-center gap-2">
                    @{finding.suspicious_username}
                    {getStatusIcon(finding.status)}
                  </CardTitle>
                  <p className="text-xs text-purple-400 capitalize">{finding.platform}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge className={getSeverityColor(finding.severity)}>
                  {finding.severity.toUpperCase()}
                </Badge>
                <span className="text-xs text-purple-400">
                  {finding.similarity_score}% match
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-white mb-1">Finding Type</p>
              <Badge className="bg-purple-500/20 text-purple-300">
                {finding.finding_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Badge>
            </div>

            <div>
              <p className="text-sm font-semibold text-white mb-1">Evidence</p>
              <p className="text-sm text-purple-300">{finding.evidence}</p>
            </div>

            {finding.misused_data && finding.misused_data.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-white mb-1">Misused Data</p>
                <div className="flex flex-wrap gap-1">
                  {finding.misused_data.map((data, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {data}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {finding.ai_recommendations && finding.ai_recommendations.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-white mb-2">Recommended Actions</p>
                <ul className="space-y-1">
                  {finding.ai_recommendations.map((rec, idx) => (
                    <li key={idx} className="text-xs text-purple-300 flex gap-2">
                      <span className="text-purple-400">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2 border-t border-purple-500/20">
              {finding.suspicious_profile_url && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(finding.suspicious_profile_url, '_blank')}
                  className="border-purple-500/50 text-purple-300"
                >
                  <ExternalLink className="w-3 h-3 mr-2" />
                  View Profile
                </Button>
              )}
              
              {finding.status === 'new' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateStatusMutation.mutate({ id: finding.id, status: 'reported' })}
                    className="border-blue-500/50 text-blue-300"
                  >
                    Mark Reported
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateStatusMutation.mutate({ id: finding.id, status: 'false_positive' })}
                    className="border-gray-500/50 text-gray-300"
                  >
                    False Positive
                  </Button>
                </>
              )}

              {finding.status === 'reported' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateStatusMutation.mutate({ id: finding.id, status: 'resolved' })}
                  className="border-green-500/50 text-green-300"
                >
                  Mark Resolved
                </Button>
              )}
            </div>

            <p className="text-xs text-purple-400">
              Detected: {new Date(finding.detected_date).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}