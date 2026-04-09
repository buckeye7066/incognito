/*
 * =============================================================================
 * AI DIRECTIVE - READ THIS EVERY SESSION
 * =============================================================================
 *
 * SYSTEM DIRECTIVE - MANDATORY COMPLIANCE
 *
 * Before responding to ANY request:
 *
 * 1. READ THE ACTUAL REQUEST - What did the user literally ask for? Do exactly
 *    that. Nothing more, nothing less.
 *
 * 2. NO EXCUSES - Don't explain why something can't be done. Find a way or ask
 *    a clarifying question.
 *
 * 3. NO SUGGESTIONS INSTEAD OF ACTION - If asked to do X, do X. Don't suggest
 *    alternatives unless X is truly impossible.
 *
 * 4. READ YOUR OWN CODE - Before claiming something works, trace through the
 *    logic. Find bugs yourself.
 *
 * 5. ONE RESPONSE, COMPLETE - Don't make the user ask twice. Get it done the
 *    first time.
 *
 * 6. NO FILLER - Skip the "Great question!" and "I'd be happy to help!" Just
 *    do the work.
 *
 * 7. VERIFY BEFORE RESPONDING - Did you actually do what was asked? Re-read
 *    the request before hitting send.
 *
 * VIOLATION = FAILURE
 *
 * =============================================================================
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { incognito } from '@/api/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, Database, Scan, FileText, Trash2, Settings, Eye, Users, Brain, Smartphone, Radar, Activity, Lock, Bell, CreditCard, Gift, HeartPulse, Fingerprint, Key, Mail, Phone, Share2, Globe, ShieldAlert, Bot } from 'lucide-react';
import ProfileSelector from './components/profiles/ProfileSelector';
import ProfileModal from './components/profiles/ProfileModal';
import NotificationBell from './components/notifications/NotificationBell';
import ErrorBoundary from './components/common/ErrorBoundary';
import { useActiveProfile } from '@/hooks/useActiveProfile';
import { useAuth } from '@/lib/AuthContext';

const navigation = [
  // Core
  { name: 'Dashboard', path: 'Dashboard', icon: Shield },
  // Cloaked Identity Suite
  { name: 'Cloaked Identities', path: 'CloakedIdentities', icon: Fingerprint, section: 'Identity' },
  { name: 'Password Manager', path: 'PasswordManager', icon: Key },
  { name: 'Authenticator', path: 'TOTPAuthenticator', icon: Shield },
  { name: 'Email Aliases', path: 'EmailAliases', icon: Mail },
  { name: 'Phone Aliases', path: 'PhoneAliases', icon: Phone },
  { name: 'Cloaked Pay', path: 'CloakedPay', icon: CreditCard },
  { name: 'Identity Sharing', path: 'IdentitySharing', icon: Share2 },
  // Privacy & Security
  { name: 'VPN Manager', path: 'VPNManager', icon: Globe, section: 'Privacy' },
  { name: 'Call Guard', path: 'CallGuard', icon: ShieldAlert },
  { name: 'SSN Monitor', path: 'SSNMonitor', icon: Fingerprint },
  { name: 'AI Defense', path: 'AIDefense', icon: Bot },
  // Scanning & Monitoring
  { name: 'Identity Scan', path: 'IdentityScan', icon: Scan, section: 'Monitor' },
  { name: 'Scans & Breaches', path: 'Scans', icon: Eye },
  { name: 'Findings', path: 'Findings', icon: Radar },
  { name: 'Threat Intel', path: 'ThreatIntelligence', icon: Radar },
  { name: 'Monitoring Hub', path: 'MonitoringHub', icon: Smartphone },
  { name: 'Password Checker', path: 'PasswordChecker', icon: Lock },
  // Protection & Cleanup
  { name: 'Deletion Center', path: 'DeletionCenter', icon: Trash2, section: 'Protect' },
  { name: 'Broker Directory', path: 'DataBrokerDirectory', icon: Database },
  { name: 'Social Media', path: 'SocialMediaHub', icon: Users },
  { name: 'Financial Monitor', path: 'FinancialMonitor', icon: CreditCard },
  { name: 'Legal Support', path: 'LegalSupport', icon: FileText },
  { name: 'Identity Recovery', path: 'IdentityRecovery', icon: Activity },
  { name: 'Spam Tracker', path: 'SpamTracker', icon: Shield },
  // Data & Intelligence
  { name: 'Vault', path: 'Vault', icon: Database, section: 'Data' },
  { name: 'AI Insights', path: 'AIInsights', icon: Brain },
  { name: 'Free Perks', path: 'FreePerks', icon: Gift },
  // System
  { name: 'Notifications', path: 'Notifications', icon: Bell, section: 'System' },
  { name: 'Profiles', path: 'Profiles', icon: Users },
  { name: 'Settings', path: 'Settings', icon: Settings },
  { name: 'System Check', path: 'SystemSelfCheck', icon: HeartPulse, adminOnly: true },
];

export default function Layout({ children, currentPageName }) {
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [activeProfile, setActiveProfile] = useState(null);
  const { setActiveProfileId } = useActiveProfile();
  const queryClient = useQueryClient();

  const { user: currentUser } = useAuth();

  const { data: profiles = [], refetch: refetchProfiles } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => incognito.entities.Profile.list(),
    staleTime: 5000,
  });

  // Load active profile: prefer saved, fall back to default/first
  useEffect(() => {
    if (profiles.length === 0) return;
    const savedProfileId = localStorage.getItem('activeProfileId');
    const saved = savedProfileId ? profiles.find(p => p.id === savedProfileId) : null;
    const resolved = saved || profiles.find(p => p.is_default) || profiles[0];
    setActiveProfile(resolved);
    setActiveProfileId(resolved.id);
  }, [profiles, setActiveProfileId]);

  const handleProfileChange = useCallback((profile) => {
    setActiveProfile(profile);
    setActiveProfileId(profile.id);
    queryClient.invalidateQueries({ queryKey: ['scanResults'] });
    queryClient.invalidateQueries({ queryKey: ['personalData'] });
    queryClient.invalidateQueries({ queryKey: ['searchQueryFindings'] });
    queryClient.invalidateQueries({ queryKey: ['deletionRequests'] });
    queryClient.invalidateQueries({ queryKey: ['socialMediaFindings'] });
    queryClient.invalidateQueries({ queryKey: ['financialAccounts'] });
    queryClient.invalidateQueries({ queryKey: ['suspiciousActivities'] });
  }, [setActiveProfileId, queryClient]);

  const handleCreateProfile = useCallback(async (formData) => {
    await incognito.entities.Profile.create(formData);
    refetchProfiles();
    setShowProfileModal(false);
  }, [refetchProfiles]);

  return (
    <ErrorBoundary>
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-red-950 to-slate-900">
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 glass-card border-r border-red-600/30 flex flex-col">
          <div className="p-6 border-b border-red-600/30">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-gray-700 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Incognito</h1>
                  <p className="text-xs text-gray-400">Privacy Guardian</p>
                </div>
              </div>
              <NotificationBell activeProfileId={activeProfile?.id} />
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-0.5 overflow-y-auto">
            {navigation.filter(item => !item.adminOnly || currentUser?.role === 'admin').map((item, idx) => {
              const Icon = item.icon;
              const isActive = currentPageName === item.path;
              return (
                <React.Fragment key={item.name}>
                  {item.section && (
                    <div className={`text-[10px] font-bold uppercase tracking-wider text-gray-500 px-4 pt-4 pb-1 ${idx > 0 ? 'mt-2 border-t border-red-900/20' : ''}`}>
                      {item.section}
                    </div>
                  )}
                  <Link
                    to={createPageUrl(item.path)}
                    className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all duration-200 text-sm ${
                      isActive
                        ? 'bg-gradient-to-r from-red-600 to-gray-700 text-white glow-border'
                        : 'text-gray-300 hover:bg-red-900/30 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="font-medium">{item.name}</span>
                  </Link>
                </React.Fragment>
              );
            })}
          </nav>

          <div className="p-4 border-t border-red-600/30">
            <ProfileSelector
              activeProfile={activeProfile}
              onProfileChange={handleProfileChange}
              onCreateNew={() => setShowProfileModal(true)}
            />
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-8">
            {children}
          </div>
        </main>
      </div>

      {/* Profile Modal */}
      <ProfileModal
        open={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onSave={handleCreateProfile}
      />
      </div>
      </ErrorBoundary>
      );
      }
