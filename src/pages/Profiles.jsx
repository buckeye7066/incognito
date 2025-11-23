import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Edit, Trash2, Shield, Eye } from 'lucide-react';
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