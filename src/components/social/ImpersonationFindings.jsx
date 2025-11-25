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
            {/* Photo Comparison - Only show if there are actual photos */}
            {(finding.your_profile_photo || finding.suspicious_profile_photo || (finding.matching_photos && finding.matching_photos.length > 0)) && (
              <div className="p-3 rounded bg-slate-700/50 border border-amber-500/30">
                <p className="text-sm font-semibold text-white mb-3">📸 Photo Comparison</p>
                
                {(finding.your_profile_photo || finding.suspicious_profile_photo) && (
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    {finding.your_profile_photo && (
                      <div className="text-center">
                        <p className="text-xs text-green-400 mb-2 font-semibold">Your Photo</p>
                        <img 
                          src={finding.your_profile_photo} 
                          alt="Your profile" 
                          className="w-24 h-24 rounded-full mx-auto object-cover border-2 border-green-500"
                        />
                      </div>
                    )}
                    {finding.suspicious_profile_photo && (
                      <div className="text-center">
                        <p className="text-xs text-red-400 mb-2 font-semibold">Suspicious Profile</p>
                        <img 
                          src={finding.suspicious_profile_photo} 
                          alt="Suspicious profile" 
                          className="w-24 h-24 rounded-full mx-auto object-cover border-2 border-red-500"
                        />
                      </div>
                    )}
                  </div>
                )}

                {finding.photo_similarity_score !== undefined && finding.photo_similarity_score > 0 && (
                  <div className="text-center mb-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      finding.photo_similarity_score >= 80 ? 'bg-red-600/30 text-red-300' :
                      finding.photo_similarity_score >= 50 ? 'bg-amber-600/30 text-amber-300' :
                      'bg-green-600/30 text-green-300'
                    }`}>
                      {finding.photo_similarity_score}% Photo Match
                    </span>
                  </div>
                )}

                {finding.matching_photos && finding.matching_photos.length > 0 && (
                  <div>
                    <p className="text-xs text-amber-300 mb-2 font-semibold">Matching Photos Found ({finding.matching_photos.length})</p>
                    <div className="grid grid-cols-3 gap-2">
                      {finding.matching_photos.map((photoUrl, idx) => (
                        <a 
                          key={idx} 
                          href={photoUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <img 
                            src={photoUrl} 
                            alt={`Matching photo ${idx + 1}`} 
                            className="w-full h-20 object-cover rounded border border-amber-500/50 hover:border-amber-400 transition-colors"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Common Friends Section */}
            {finding.common_friends && finding.common_friends.length > 0 && (
              <div className="p-3 rounded bg-slate-700/50 border border-purple-500/30">
                <p className="text-sm font-semibold text-white mb-3">👥 Common Friends ({finding.common_friends.length})</p>
                <p className="text-xs text-purple-300 mb-2">These connections may help identify the impersonator</p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {finding.common_friends.map((friend, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded bg-slate-800/50">
                      <div>
                        <p className="text-sm text-white font-medium">{friend.name}</p>
                        {friend.username && (
                          <p className="text-xs text-purple-400">@{friend.username}</p>
                        )}
                      </div>
                      {friend.profile_url && (
                        <a 
                          href={friend.profile_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300 hover:underline"
                        >
                          View Profile
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                    <Badge key={idx} variant="outline" className="text-xs bg-red-500/20 text-red-200 border-red-500/40">
                      {data}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Profile URL for verification */}
            {finding.suspicious_profile_url && (
              <div className="p-3 rounded bg-slate-700/50 border border-slate-500/30">
                <p className="text-sm font-semibold text-white mb-1">🔗 Profile URL (for verification)</p>
                <a 
                  href={finding.suspicious_profile_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-blue-400 hover:text-blue-300 hover:underline break-all"
                >
                  {finding.suspicious_profile_url}
                </a>
                {finding.suspicious_username && (
                  <p className="text-xs text-gray-300 mt-1">
                    <strong>Username:</strong> @{finding.suspicious_username}
                  </p>
                )}
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