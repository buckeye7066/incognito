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

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Shield, Database, Scan, FileText, Trash2, Settings, Eye, Users, Brain, Smartphone, Radar } from 'lucide-react';
import ProfileSelector from './components/profiles/ProfileSelector';
import ProfileModal from './components/profiles/ProfileModal';
import NotificationBell from './components/notifications/NotificationBell';

export default function Layout({ children, currentPageName }) {
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [activeProfile, setActiveProfile] = useState(null);

  const navigation = [
    { name: 'Dashboard', path: 'Dashboard', icon: Shield },
    { name: 'Threat Intel', path: 'ThreatIntelligence', icon: Radar },
    { name: 'AI Insights', path: 'AIInsights', icon: Brain },
    { name: 'Vault', path: 'Vault', icon: Database },
    { name: 'Scans', path: 'Scans', icon: Scan },
    { name: 'Identity Scan', path: 'IdentityScan', icon: Shield },
    { name: 'Findings', path: 'Findings', icon: Eye },
    { name: 'Social Media', path: 'SocialMediaHub', icon: Users },
    { name: 'Deletion Center', path: 'DeletionCenter', icon: Trash2 },
    { name: 'Spam Tracker', path: 'SpamTracker', icon: Shield },
    { name: 'Monitoring Hub', path: 'MonitoringHub', icon: Smartphone },
    { name: 'Profiles', path: 'Profiles', icon: Users },
    { name: 'Settings', path: 'Settings', icon: Settings }
  ];

  const { data: profiles = [], refetch: refetchProfiles } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => base44.entities.Profile.list()
  });

  // Set active profile to default or first profile
  useEffect(() => {
    if (profiles.length > 0 && !activeProfile) {
      const defaultProfile = profiles.find(p => p.is_default) || profiles[0];
      setActiveProfile(defaultProfile);
      localStorage.setItem('activeProfileId', defaultProfile.id);
    }
  }, [profiles, activeProfile]);

  // Load active profile from localStorage
  useEffect(() => {
    const savedProfileId = localStorage.getItem('activeProfileId');
    if (savedProfileId && profiles.length > 0) {
      const savedProfile = profiles.find(p => p.id === savedProfileId);
      if (savedProfile) {
        setActiveProfile(savedProfile);
      }
    }
  }, [profiles]);

  const handleProfileChange = (profile) => {
    setActiveProfile(profile);
    localStorage.setItem('activeProfileId', profile.id);
    // Force refresh of all queries to load new profile data
    window.location.reload();
  };

  const handleCreateProfile = async (formData) => {
    await base44.entities.Profile.create(formData);
    refetchProfiles();
    setShowProfileModal(false);
  };

  // Store active profile in window for access by other components
  if (typeof window !== 'undefined') {
    window.activeProfileId = activeProfile?.id;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-red-950 to-slate-900">
      <style>{`
        :root {
          --primary: 187 0 0;
          --primary-dark: 139 0 0;
          --accent: 102 102 102;
          --danger: 187 0 0;
          --warning: 251 191 36;
          --success: 34 197 94;
          --bg-dark: 15 23 42;
          --bg-darker: 2 6 23;
        }

        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .glass-card {
          background: rgba(30, 27, 35, 0.6);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(187, 0, 0, 0.3);
        }

        .glow-border {
          box-shadow: 0 0 20px rgba(187, 0, 0, 0.4);
        }
      `}</style>

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

          <nav className="flex-1 p-4 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = currentPageName === item.path;
              return (
                <Link
                  key={item.name}
                  to={createPageUrl(item.path)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-red-600 to-gray-700 text-white glow-border'
                      : 'text-gray-300 hover:bg-red-900/30 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.name}</span>
                </Link>
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
  );
}