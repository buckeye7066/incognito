import React, { useState, useEffect } from 'react';
import { base44, migrateFromBase44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Edit, Trash2, Shield, Eye, Download, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ProfileModal from '../components/profiles/ProfileModal';
import ProfileDetailModal from '../components/profiles/ProfileDetailModal';

const colorClasses = {
  purple: 'from-purple-600 to-indigo-600',
  blue: 'from-blue-600 to-cyan-600',
  green: 'from-green-600 to-emerald-600',
  red: 'from-red-600 to-pink-600',
  pink: 'from-pink-600 to-rose-600',
  amber: 'from-amber-600 to-orange-600',
  cyan: 'from-cyan-600 to-teal-600',
  indigo: 'from-indigo-600 to-purple-600'
};

export default function Profiles() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);
  const [viewingProfile, setViewingProfile] = useState(null);
  const [recoveryStatus, setRecoveryStatus] = useState(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const [storageDump, setStorageDump] = useState(null);

  useEffect(() => {
    const appId = localStorage.getItem('base44_app_id');
    const token = localStorage.getItem('base44_access_token');
    const serverUrl = localStorage.getItem('base44_server_url') || 'https://base44.app';
    const migrationDone = localStorage.getItem('incognito_base44_migration_done');
    const localProfiles = localStorage.getItem('incognito_entity_Profile');
    const hasLocalProfiles = localProfiles && JSON.parse(localProfiles).length > 0;

    const dump = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const val = localStorage.getItem(key);
      dump[key] = val.length > 200 ? val.substring(0, 200) + '...' : val;
    }
    setStorageDump(dump);
    console.log('[Profiles] localStorage keys:', Object.keys(dump));
    console.log('[Profiles] Full dump:', dump);

    if (hasLocalProfiles) {
      setRecoveryStatus(null);
    } else if (migrationDone && !hasLocalProfiles) {
      setRecoveryStatus({ type: 'failed', appId, token: !!token, serverUrl });
    } else if (appId && token) {
      setRecoveryStatus({ type: 'ready', appId, serverUrl });
    } else {
      setRecoveryStatus({ type: 'no_creds', appId, token: !!token });
    }
  }, []);

  const handleRecoverData = async () => {
    setIsRecovering(true);
    localStorage.removeItem('incognito_base44_migration_done');
    try {
      await migrateFromBase44();
      queryClient.invalidateQueries(['profiles']);
      queryClient.invalidateQueries(['personalData']);
      queryClient.invalidateQueries(['scanResults']);
      const localProfiles = localStorage.getItem('incognito_entity_Profile');
      const count = localProfiles ? JSON.parse(localProfiles).length : 0;
      if (count > 0) {
        setRecoveryStatus({ type: 'success', count });
        window.location.reload();
      } else {
        setRecoveryStatus({ type: 'empty' });
      }
    } catch (err) {
      setRecoveryStatus({ type: 'error', message: err.message });
    }
    setIsRecovering(false);
  };

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => base44.entities.Profile.list()
  });

  const { data: personalData = [] } = useQuery({
    queryKey: ['personalData'],
    queryFn: () => base44.entities.PersonalData.list()
  });

  const { data: scanResults = [] } = useQuery({
    queryKey: ['scanResults'],
    queryFn: () => base44.entities.ScanResult.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Profile.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['profiles']);
      setShowModal(false);
      setEditingProfile(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Profile.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['profiles']);
      setShowModal(false);
      setEditingProfile(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Profile.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['profiles']);
    }
  });

  const handleSave = (formData) => {
    if (editingProfile) {
      updateMutation.mutate({ id: editingProfile.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (profile) => {
    setEditingProfile(profile);
    setShowModal(true);
  };

  const handleDelete = async (profile) => {
    const identifierCount = personalData.filter(d => d.profile_id === profile.id).length;
    const findingsCount = scanResults.filter(r => r.profile_id === profile.id).length;

    if (identifierCount > 0 || findingsCount > 0) {
      if (!window.confirm(
        `This profile has ${identifierCount} identifiers and ${findingsCount} findings. ` +
        `All associated data will be deleted. Continue?`
      )) {
        return;
      }
    }

    deleteMutation.mutate(profile.id);
  };

  const getInitials = (name) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getProfileStats = (profileId) => {
    const identifiers = personalData.filter(d => d.profile_id === profileId).length;
    const findings = scanResults.filter(r => r.profile_id === profileId).length;
    const highRisk = scanResults.filter(r => r.profile_id === profileId && r.risk_score >= 70).length;
    
    return { identifiers, findings, highRisk };
  };

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Profiles</h1>
          <p className="text-purple-300">Manage multiple monitoring profiles</p>
        </div>
        <Button
          onClick={() => {
            setEditingProfile(null);
            setShowModal(true);
          }}
          className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create Profile
        </Button>
      </div>

      {/* Recovery Banner */}
      {recoveryStatus && profiles.length === 0 && (
        <Card className="border-amber-500/50 bg-amber-950/30">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-200 mb-1">Data Recovery</h3>
                {recoveryStatus.type === 'ready' && (
                  <>
                    <p className="text-sm text-amber-300/80 mb-3">
                      Found Base44 credentials in your browser. Your profiles may still be on the server 
                      at <code className="text-amber-200">{recoveryStatus.serverUrl}</code> (App: {recoveryStatus.appId}).
                    </p>
                    <Button 
                      onClick={handleRecoverData} 
                      disabled={isRecovering}
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {isRecovering ? 'Recovering...' : 'Recover Data from Base44'}
                    </Button>
                  </>
                )}
                {(recoveryStatus.type === 'no_creds' || recoveryStatus.type === 'failed') && !recoveryStatus.manualToken && (
                  <div className="space-y-3">
                    <p className="text-sm text-amber-300/80">
                      Your 5 profiles are on the Base44 server (app ID: <code className="text-amber-200">6923711b7fa7ebe3276ec093</code>). 
                      To recover them, open your Base44 dashboard, click on the Incognito app, 
                      and copy the <code className="text-amber-200">access_token</code> from the URL bar. Paste it below.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Paste your Base44 access_token here (starts with eyJ...)"
                        className="flex-1 px-3 py-2 bg-slate-900/80 border border-amber-500/30 rounded text-white text-sm placeholder-amber-400/40"
                        id="recovery-token-input"
                      />
                      <Button
                        onClick={async () => {
                          const token = document.getElementById('recovery-token-input').value.trim();
                          if (!token) return;
                          setIsRecovering(true);
                          setRecoveryStatus(prev => ({ ...prev, manualToken: true }));
                          const appId = '6923711b7fa7ebe3276ec093';
                          const serverUrl = 'https://app.base44.com';
                          const entityNames = ['Profile','PersonalData','ScanResult','SocialMediaFinding','SocialMediaProfile','SocialMediaMention','ExposureFixLog','FinancialAccount','SuspiciousActivity','UserPreferences','SpamIncident','NotificationAlert','MonitoredAccount','DisposableCredential','DeletionRequest','DeletionEmailResponse','AIInsight','DigitalFootprintReport','SearchQueryFinding'];
                          let total = 0;
                          const log = [];
                          for (const name of entityNames) {
                            try {
                              const resp = await fetch(`${serverUrl}/api/apps/${appId}/entities/${name}`, {
                                headers: { 'Authorization': `Bearer ${token}`, 'X-App-Id': appId }
                              });
                              if (!resp.ok) { log.push(`${name}: HTTP ${resp.status}`); continue; }
                              const data = await resp.json();
                              const items = Array.isArray(data) ? data : (data?.results || data?.items || []);
                              if (items.length > 0) {
                                localStorage.setItem(`incognito_entity_${name}`, JSON.stringify(items));
                                total += items.length;
                                log.push(`${name}: ${items.length} recovered`);
                              }
                            } catch (err) { log.push(`${name}: ${err.message}`); }
                          }
                          console.log('[Recovery]', log.join(' | '));
                          if (total > 0) {
                            setRecoveryStatus({ type: 'success', count: total, log });
                            setTimeout(() => window.location.reload(), 1500);
                          } else {
                            setRecoveryStatus({ type: 'manual_failed', log });
                          }
                          setIsRecovering(false);
                        }}
                        disabled={isRecovering}
                        className="bg-amber-600 hover:bg-amber-700 text-white"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        {isRecovering ? 'Recovering...' : 'Recover'}
                      </Button>
                    </div>
                  </div>
                )}
                {recoveryStatus.type === 'manual_failed' && (
                  <div className="space-y-2">
                    <p className="text-sm text-red-300">Recovery returned 0 items. The token may be expired or for a different app.</p>
                    <details className="text-xs text-amber-400/60">
                      <summary>Details</summary>
                      <pre className="mt-1 whitespace-pre-wrap">{recoveryStatus.log?.join('\n')}</pre>
                    </details>
                  </div>
                )}
                {recoveryStatus.type === 'empty' && (
                  <p className="text-sm text-amber-300/80">
                    Connected to Base44 but the server returned 0 profiles. The data may have been deleted from the server, 
                    or the token may have expired.
                  </p>
                )}
                {recoveryStatus.type === 'error' && (
                  <p className="text-sm text-red-300">
                    Recovery error: {recoveryStatus.message}
                  </p>
                )}
                {recoveryStatus.type === 'success' && (
                  <p className="text-sm text-green-300">
                    Recovered {recoveryStatus.count} profiles! Reloading...
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* localStorage Diagnostic */}
      {storageDump && profiles.length === 0 && (
        <Card className="border-cyan-500/30 bg-cyan-950/20">
          <CardContent className="p-4">
            <h3 className="font-semibold text-cyan-200 mb-2 text-sm">localStorage Diagnostic ({Object.keys(storageDump).length} keys)</h3>
            <div className="max-h-48 overflow-y-auto text-xs font-mono">
              {Object.entries(storageDump).map(([key, val]) => (
                <div key={key} className="flex gap-2 py-0.5 border-b border-cyan-900/30">
                  <span className="text-cyan-400 min-w-[200px] shrink-0">{key}</span>
                  <span className="text-cyan-200/60 truncate">{val}</span>
                </div>
              ))}
              {Object.keys(storageDump).length === 0 && (
                <p className="text-cyan-300/50">localStorage is completely empty for this origin.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="glass-card border-purple-500/30">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-white mb-1">What are Profiles?</h3>
              <p className="text-sm text-purple-300">
                Profiles let you organize and monitor different identities separately. Create profiles for 
                family members, different online personas, or business identities. Each profile maintains 
                its own vault, scan results, and deletion requests.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profiles Grid */}
      <AnimatePresence mode="popLayout">
        {profiles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {profiles.map((profile) => {
              const stats = getProfileStats(profile.id);
              return (
                <motion.div
                  key={profile.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  layout
                >
                  <Card className="glass-card border-purple-500/20 hover:glow-border transition-all duration-300">
                    <CardHeader className="border-b border-purple-500/20">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorClasses[profile.avatar_color]} flex items-center justify-center text-white font-bold shadow-lg`}>
                            {getInitials(profile.name)}
                          </div>
                          <div>
                            <CardTitle className="text-white text-lg">
                              {profile.name}
                            </CardTitle>
                            {profile.is_default && (
                              <span className="text-xs text-purple-400">Default Profile</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      {profile.description && (
                        <p className="text-sm text-purple-300 mb-4">{profile.description}</p>
                      )}

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="text-center p-3 rounded-lg bg-slate-900/50">
                          <p className="text-2xl font-bold text-white">{stats.identifiers}</p>
                          <p className="text-xs text-purple-400">Identifiers</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-slate-900/50">
                          <p className="text-2xl font-bold text-white">{stats.findings}</p>
                          <p className="text-xs text-purple-400">Findings</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-slate-900/50">
                          <p className="text-2xl font-bold text-red-400">{stats.highRisk}</p>
                          <p className="text-xs text-purple-400">High Risk</p>
                        </div>
                      </div>

                      {profile.last_scan_date && (
                        <p className="text-xs text-purple-400 mb-4">
                          Last scan: {new Date(profile.last_scan_date).toLocaleDateString()}
                        </p>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewingProfile(profile)}
                          className="flex-1 border-purple-500/50 text-purple-300"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Open
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleEdit(profile)}
                          className="border-purple-500/50 text-purple-300"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleDelete(profile)}
                          className="border-red-500/50 text-red-300 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <Card className="glass-card border-purple-500/20">
            <CardContent className="p-16 text-center">
              <Shield className="w-16 h-16 text-purple-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No Profiles Yet</h3>
              <p className="text-purple-300 mb-4">
                Create your first profile to start monitoring your digital footprint
              </p>
              <Button
                onClick={() => {
                  setEditingProfile(null);
                  setShowModal(true);
                }}
                className="bg-gradient-to-r from-purple-600 to-indigo-600"
              >
                <Plus className="w-5 h-5 mr-2" />
                Create First Profile
              </Button>
            </CardContent>
          </Card>
        )}
      </AnimatePresence>

      {/* Profile Modal */}
      <ProfileModal
        open={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingProfile(null);
        }}
        onSave={handleSave}
        editProfile={editingProfile}
      />

      {/* Profile Detail Modal */}
      <ProfileDetailModal
        open={!!viewingProfile}
        onClose={() => setViewingProfile(null)}
        profile={viewingProfile}
        personalData={personalData}
      />
    </div>
  );
}