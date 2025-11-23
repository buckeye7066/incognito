import React from 'react';
import { Users, Shield, AlertTriangle } from 'lucide-react';
import SocialMediaMonitor from '../components/social/SocialMediaMonitor';
import ImpersonationFindings from '../components/social/ImpersonationFindings';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function SocialMediaHub() {
  const activeProfileId = typeof window !== 'undefined' ? window.activeProfileId : null;

  const { data: allFindings = [] } = useQuery({
    queryKey: ['socialMediaFindings'],
    queryFn: () => base44.entities.SocialMediaFinding.list()
  });

  const findings = allFindings.filter(f => !activeProfileId || f.profile_id === activeProfileId);

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <Users className="w-10 h-10 text-purple-400" />
          Social Media Hub
        </h1>
        <p className="text-purple-300">
          AI-powered monitoring for mentions, sentiment, impersonation, and privacy risks across all platforms
        </p>
      </div>

      {/* Info Card */}
      <div className="glass-card rounded-xl p-6 border-purple-500/30">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
            <Users className="w-8 h-8 text-purple-400 mb-3" />
            <h3 className="font-semibold text-white mb-2">Mention Detection</h3>
            <p className="text-sm text-purple-300">
              AI scans for direct mentions, tags, and indirect references across all major platforms
            </p>
          </div>
          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
            <Shield className="w-8 h-8 text-blue-400 mb-3" />
            <h3 className="font-semibold text-white mb-2">Sentiment Analysis</h3>
            <p className="text-sm text-purple-300">
              Advanced AI analyzes tone, context, and emotional sentiment of every mention
            </p>
          </div>
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
            <AlertTriangle className="w-8 h-8 text-red-400 mb-3" />
            <h3 className="font-semibold text-white mb-2">Privacy & Impersonation</h3>
            <p className="text-sm text-purple-300">
              Detects unauthorized use of your data, fake accounts, and privacy violations
            </p>
          </div>
        </div>
      </div>

      {/* Social Media Monitor */}
      <SocialMediaMonitor profileId={activeProfileId} />

      {/* Impersonation Findings */}
      {findings.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-red-400" />
            Impersonation Alerts
          </h2>
          <ImpersonationFindings findings={findings} profileId={activeProfileId} />
        </div>
      )}
    </div>
  );
}