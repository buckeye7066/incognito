import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ExternalLink, CheckCircle, XCircle, Clock, Flag, FileText, Scale, Loader2, Printer } from 'lucide-react';
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
                    Suspicious Profile Found
                    {getStatusIcon(finding.status)}
                  </CardTitle>
                  <p className="text-sm text-purple-400 capitalize">{finding.platform}</p>
                </div>
              </div>
              <Badge className={getSeverityColor(finding.severity)}>
                {finding.severity?.toUpperCase() || 'UNKNOWN'}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-4 space-y-4">
            {/* WHY THIS WAS FLAGGED */}
            <div className="p-4 rounded-lg bg-amber-900/30 border border-amber-500/40">
              <div className="flex items-start gap-2 mb-2">
                <Flag className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-amber-300 font-semibold">Why This Was Flagged</p>
                  <p className="text-sm text-amber-100 mt-1">{finding.evidence || 'Profile matches identifiers in your vault'}</p>
                </div>
              </div>
              {finding.similarity_score && (
                <p className="text-xs text-amber-200 mt-2">
                  Match confidence: <span className="font-bold">{finding.similarity_score}%</span>
                </p>
              )}
            </div>

            {/* THE SUSPICIOUS PROFILE DATA */}
            <div className="p-4 rounded-lg bg-red-900/20 border border-red-500/30">
              <p className="text-red-300 font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Suspicious Profile Content
              </p>
              
              <div className="space-y-3">
                {/* Username */}
                {finding.suspicious_username && (
                  <div className="flex items-start gap-2">
                    <span className="text-gray-400 text-sm w-24 flex-shrink-0">Username:</span>
                    <span className="text-white font-medium">@{finding.suspicious_username}</span>
                  </div>
                )}

                {/* Profile URL */}
                {finding.suspicious_profile_url && (
                  <div className="flex items-start gap-2">
                    <span className="text-gray-400 text-sm w-24 flex-shrink-0">Profile URL:</span>
                    <a 
                      href={finding.suspicious_profile_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 hover:underline break-all text-sm"
                    >
                      {finding.suspicious_profile_url}
                    </a>
                  </div>
                )}

                {/* Profile Photo */}
                {finding.suspicious_profile_photo && (
                  <div className="flex items-start gap-2">
                    <span className="text-gray-400 text-sm w-24 flex-shrink-0">Profile Photo:</span>
                    <a href={finding.suspicious_profile_photo} target="_blank" rel="noopener noreferrer">
                      <img 
                        src={finding.suspicious_profile_photo} 
                        alt="Suspicious profile" 
                        className="w-20 h-20 rounded object-cover border border-red-500/50 hover:border-red-400"
                      />
                    </a>
                  </div>
                )}

                {/* Detailed profile content from misused_data_details */}
                {finding.misused_data_details && (
                  <>
                    {finding.misused_data_details.full_name && (
                      <div className="flex items-start gap-2">
                        <span className="text-gray-400 text-sm w-24 flex-shrink-0">Name Used:</span>
                        <span className="text-white">"{finding.misused_data_details.full_name}"</span>
                      </div>
                    )}
                    
                    {finding.misused_data_details.bio && (
                      <div className="flex items-start gap-2">
                        <span className="text-gray-400 text-sm w-24 flex-shrink-0">Bio:</span>
                        <span className="text-white italic">"{finding.misused_data_details.bio}"</span>
                      </div>
                    )}
                    
                    {finding.misused_data_details.location && (
                      <div className="flex items-start gap-2">
                        <span className="text-gray-400 text-sm w-24 flex-shrink-0">Location:</span>
                        <span className="text-white">{finding.misused_data_details.location}</span>
                      </div>
                    )}
                    
                    {finding.misused_data_details.workplace && (
                      <div className="flex items-start gap-2">
                        <span className="text-gray-400 text-sm w-24 flex-shrink-0">Workplace:</span>
                        <span className="text-white">{finding.misused_data_details.workplace}</span>
                      </div>
                    )}
                    
                    {finding.misused_data_details.education && (
                      <div className="flex items-start gap-2">
                        <span className="text-gray-400 text-sm w-24 flex-shrink-0">Education:</span>
                        <span className="text-white">{finding.misused_data_details.education}</span>
                      </div>
                    )}

                    {finding.misused_data_details.photos && finding.misused_data_details.photos.length > 0 && (
                      <div className="flex items-start gap-2">
                        <span className="text-gray-400 text-sm w-24 flex-shrink-0">Photos:</span>
                        <div className="grid grid-cols-4 gap-2">
                          {finding.misused_data_details.photos.map((photoUrl, idx) => (
                            <a key={idx} href={photoUrl} target="_blank" rel="noopener noreferrer">
                              <img 
                                src={photoUrl} 
                                alt={`Photo ${idx + 1}`} 
                                className="w-16 h-16 object-cover rounded border border-red-500/50 hover:border-red-400"
                              />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {finding.misused_data_details.other && (
                      <div className="flex items-start gap-2">
                        <span className="text-gray-400 text-sm w-24 flex-shrink-0">Other Info:</span>
                        <span className="text-white">{finding.misused_data_details.other}</span>
                      </div>
                    )}
                  </>
                )}

                {/* Data types that were matched */}
                {finding.misused_data && finding.misused_data.length > 0 && (
                  <div className="flex items-start gap-2 mt-2 pt-2 border-t border-red-500/20">
                    <span className="text-gray-400 text-sm w-24 flex-shrink-0">Matched:</span>
                    <div className="flex flex-wrap gap-1">
                      {finding.misused_data.map((data, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs bg-red-500/20 text-red-200 border-red-500/40">
                          {data}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Common Friends - if any real connections found */}
            {finding.common_friends && finding.common_friends.length > 0 && finding.common_friends[0].name !== '[Friend\'s Name]' && (
              <div className="p-3 rounded bg-slate-700/50 border border-purple-500/30">
                <p className="text-sm font-semibold text-white mb-2">👥 Common Connections ({finding.common_friends.length})</p>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {finding.common_friends.map((friend, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded bg-slate-800/50">
                      <div>
                        <p className="text-sm text-white">{friend.name}</p>
                        {friend.username && <p className="text-xs text-purple-400">@{friend.username}</p>}
                      </div>
                      {friend.profile_url && (
                        <a href={friend.profile_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline">
                          View
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommended Actions */}
            {finding.ai_recommendations && finding.ai_recommendations.length > 0 && (
              <div className="p-3 rounded bg-slate-700/50">
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

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-3 border-t border-red-500/20">
              {finding.suspicious_profile_url && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(finding.suspicious_profile_url, '_blank')}
                  className="border-blue-500/50 text-blue-300"
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
                    className="border-amber-500/50 text-amber-300"
                  >
                    Mark Reported
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateStatusMutation.mutate({ id: finding.id, status: 'false_positive' })}
                    className="border-gray-500/50 text-gray-300"
                  >
                    Not Me
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

            <div className="flex items-center justify-between text-xs text-purple-400">
              <span>Type: {finding.finding_type?.replace(/_/g, ' ')}</span>
              <span>Detected: {new Date(finding.detected_date).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}