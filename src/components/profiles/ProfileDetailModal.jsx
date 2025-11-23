import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, Eye, EyeOff, Shield, Users } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';

const DATA_TYPES = [
  { value: 'full_name', label: 'Full Name', icon: '👤' },
  { value: 'email', label: 'Email Address', icon: '📧' },
  { value: 'phone', label: 'Phone Number', icon: '📱' },
  { value: 'address', label: 'Physical Address', icon: '🏠' },
  { value: 'dob', label: 'Date of Birth', icon: '🎂' },
  { value: 'ssn', label: 'Social Security Number', icon: '🔒' },
  { value: 'drivers_license', label: 'Driver\'s License', icon: '🪪' },
  { value: 'passport', label: 'Passport Number', icon: '🛂' },
  { value: 'green_card', label: 'Green Card Number', icon: '💳' },
  { value: 'credit_card', label: 'Credit Card (Last 4)', icon: '💳' },
  { value: 'bank_account', label: 'Bank Account Number', icon: '🏦' },
  { value: 'tax_id', label: 'Tax ID / EIN', icon: '📄' },
  { value: 'medical_id', label: 'Medical/Insurance ID', icon: '🏥' },
  { value: 'student_id', label: 'Student ID', icon: '🎓' },
  { value: 'vehicle_vin', label: 'Vehicle VIN', icon: '🚗' },
  { value: 'property_deed', label: 'Property/Deed Info', icon: '🏡' },
  { value: 'username', label: 'Username', icon: '🔑' },
  { value: 'employer', label: 'Employer', icon: '💼' },
  { value: 'relative', label: 'Relative', icon: '👨‍👩‍👧' },
  { value: 'alias', label: 'Alias', icon: '🎭' }
];

const SOCIAL_PLATFORMS = [
  { value: 'facebook', label: 'Facebook', icon: '📘' },
  { value: 'twitter', label: 'Twitter/X', icon: '🐦' },
  { value: 'instagram', label: 'Instagram', icon: '📷' },
  { value: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { value: 'tiktok', label: 'TikTok', icon: '🎵' },
  { value: 'snapchat', label: 'Snapchat', icon: '👻' },
  { value: 'youtube', label: 'YouTube', icon: '📺' },
  { value: 'reddit', label: 'Reddit', icon: '🤖' },
  { value: 'pinterest', label: 'Pinterest', icon: '📌' },
  { value: 'github', label: 'GitHub', icon: '💻' },
  { value: 'other', label: 'Other', icon: '🌐' }
];

export default function ProfileDetailModal({ open, onClose, profile, personalData }) {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAddSocialForm, setShowAddSocialForm] = useState(false);
  const [showValues, setShowValues] = useState(false);
  const [formData, setFormData] = useState({
    data_type: '',
    value: '',
    label: '',
    monitoring_enabled: true,
    notes: ''
  });
  const [socialFormData, setSocialFormData] = useState({
    platform: '',
    username: '',
    profile_url: '',
    is_verified: true,
    notes: ''
  });

  const profileData = personalData.filter(d => d.profile_id === profile?.id);

  const { data: allSocialProfiles = [] } = useQuery({
    queryKey: ['socialMediaProfiles'],
    queryFn: () => base44.entities.SocialMediaProfile.list(),
    enabled: !!profile
  });

  const socialProfiles = allSocialProfiles.filter(s => s.profile_id === profile?.id);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PersonalData.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['personalData']);
      setShowAddForm(false);
      setFormData({
        data_type: '',
        value: '',
        label: '',
        monitoring_enabled: true,
        notes: ''
      });
    }
  });

  const createSocialMutation = useMutation({
    mutationFn: (data) => base44.entities.SocialMediaProfile.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['socialMediaProfiles']);
      setShowAddSocialForm(false);
      setSocialFormData({
        platform: '',
        username: '',
        profile_url: '',
        is_verified: true,
        notes: ''
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PersonalData.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['personalData']);
    }
  });

  const deleteSocialMutation = useMutation({
    mutationFn: (id) => base44.entities.SocialMediaProfile.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['socialMediaProfiles']);
    }
  });

  const toggleMonitoringMutation = useMutation({
    mutationFn: ({ id, monitoring_enabled }) => 
      base44.entities.PersonalData.update(id, { monitoring_enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries(['personalData']);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({ ...formData, profile_id: profile.id });
  };

  const handleSocialSubmit = (e) => {
    e.preventDefault();
    createSocialMutation.mutate({ ...socialFormData, profile_id: profile.id });
  };

  const maskValue = (value) => {
    if (!value) return '';
    if (value.length <= 4) return '•'.repeat(value.length);
    return value.slice(0, 2) + '•'.repeat(value.length - 4) + value.slice(-2);
  };

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

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '';
  };

  if (!profile) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-purple-500/50 text-white max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorClasses[profile.avatar_color]} flex items-center justify-center text-white font-bold shadow-lg`}>
              {getInitials(profile.name)}
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold">{profile.name}</DialogTitle>
              {profile.description && (
                <p className="text-purple-300 text-sm">{profile.description}</p>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <Tabs defaultValue="identity" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-slate-800/50">
              <TabsTrigger value="identity">
                <Shield className="w-4 h-4 mr-2" />
                Identity Data ({profileData.length})
              </TabsTrigger>
              <TabsTrigger value="social">
                <Users className="w-4 h-4 mr-2" />
                Social Media ({socialProfiles.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="identity" className="space-y-6 mt-6">
              {/* Identity Data Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-purple-300">
                  High-risk identity data for monitoring
                </h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowValues(!showValues)}
                    className="border-purple-500/50 text-purple-300"
                  >
                    {showValues ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                    {showValues ? 'Hide' : 'Show'}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Data
                  </Button>
                </div>
              </div>

              {/* Add Identity Data Form */}
              {showAddForm && (
            <Card className="border-purple-500/30 bg-slate-800/50">
              <CardContent className="p-4">
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-purple-200 text-sm">Data Type</Label>
                      <Select
                        value={formData.data_type}
                        onValueChange={(value) => setFormData({ ...formData, data_type: value })}
                      >
                        <SelectTrigger className="bg-slate-900/50 border-purple-500/30 text-white">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {DATA_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.icon} {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-purple-200 text-sm">Label (Optional)</Label>
                      <Input
                        value={formData.label}
                        onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                        placeholder="e.g., Primary Email"
                        className="bg-slate-900/50 border-purple-500/30 text-white"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-purple-200 text-sm">Value</Label>
                    <Input
                      value={formData.value}
                      onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                      placeholder="Enter the actual data"
                      className="bg-slate-900/50 border-purple-500/30 text-white"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-purple-200 text-sm">Notes (Optional)</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Private notes"
                      className="bg-slate-900/50 border-purple-500/30 text-white h-20"
                    />
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={formData.monitoring_enabled}
                        onCheckedChange={(checked) => setFormData({ ...formData, monitoring_enabled: checked })}
                      />
                      <Label className="text-purple-200 text-sm">Enable monitoring</Label>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddForm(false)}
                        className="border-purple-500/50 text-purple-300"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={createMutation.isPending}
                        className="bg-gradient-to-r from-purple-600 to-indigo-600"
                      >
                        {createMutation.isPending ? 'Adding...' : 'Add'}
                      </Button>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>
              )}

              {/* Identity Data List */}
              <div className="space-y-3">
                {profileData.length > 0 ? (
                  profileData.map((item) => {
                    const typeInfo = DATA_TYPES.find(t => t.value === item.data_type);
                    return (
                      <Card key={item.id} className="border-purple-500/20 bg-slate-800/30">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xl">{typeInfo?.icon}</span>
                                <span className="text-sm font-semibold text-white">{typeInfo?.label}</span>
                                {item.label && (
                                  <span className="text-xs text-purple-400">({item.label})</span>
                                )}
                              </div>
                              <p className="text-white font-mono text-sm mb-2">
                                {showValues ? item.value : maskValue(item.value)}
                              </p>
                              {item.notes && (
                                <p className="text-xs text-purple-300">{item.notes}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex flex-col items-end gap-1">
                                <Switch
                                  checked={item.monitoring_enabled}
                                  onCheckedChange={(checked) =>
                                    toggleMonitoringMutation.mutate({ id: item.id, monitoring_enabled: checked })
                                  }
                                />
                                <span className="text-xs text-purple-400">
                                  {item.monitoring_enabled ? 'Monitoring' : 'Paused'}
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteMutation.mutate(item.id)}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-purple-300">
                    <p>No identity data added yet</p>
                    <p className="text-sm mt-1">Click "Add Data" to get started</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="social" className="space-y-6 mt-6">
              {/* Social Media Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-purple-300">
                  Your legitimate social media accounts
                </h3>
                <Button
                  size="sm"
                  onClick={() => setShowAddSocialForm(!showAddSocialForm)}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Profile
                </Button>
              </div>

              {/* Add Social Media Form */}
              {showAddSocialForm && (
                <Card className="border-blue-500/30 bg-slate-800/50">
                  <CardContent className="p-4">
                    <form onSubmit={handleSocialSubmit} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-purple-200 text-sm">Platform</Label>
                          <Select
                            value={socialFormData.platform}
                            onValueChange={(value) => setSocialFormData({ ...socialFormData, platform: value })}
                          >
                            <SelectTrigger className="bg-slate-900/50 border-purple-500/30 text-white">
                              <SelectValue placeholder="Select platform" />
                            </SelectTrigger>
                            <SelectContent>
                              {SOCIAL_PLATFORMS.map((platform) => (
                                <SelectItem key={platform.value} value={platform.value}>
                                  {platform.icon} {platform.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-purple-200 text-sm">Username</Label>
                          <Input
                            value={socialFormData.username}
                            onChange={(e) => setSocialFormData({ ...socialFormData, username: e.target.value })}
                            placeholder="@username"
                            className="bg-slate-900/50 border-purple-500/30 text-white"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-purple-200 text-sm">Profile URL (Optional)</Label>
                        <Input
                          value={socialFormData.profile_url}
                          onChange={(e) => setSocialFormData({ ...socialFormData, profile_url: e.target.value })}
                          placeholder="https://..."
                          className="bg-slate-900/50 border-purple-500/30 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-purple-200 text-sm">Notes (Optional)</Label>
                        <Textarea
                          value={socialFormData.notes}
                          onChange={(e) => setSocialFormData({ ...socialFormData, notes: e.target.value })}
                          placeholder="Additional notes"
                          className="bg-slate-900/50 border-purple-500/30 text-white h-20"
                        />
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={socialFormData.is_verified}
                            onCheckedChange={(checked) => setSocialFormData({ ...socialFormData, is_verified: checked })}
                          />
                          <Label className="text-purple-200 text-sm">This is my legitimate account</Label>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowAddSocialForm(false)}
                            className="border-purple-500/50 text-purple-300"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            size="sm"
                            disabled={createSocialMutation.isPending}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600"
                          >
                            {createSocialMutation.isPending ? 'Adding...' : 'Add'}
                          </Button>
                        </div>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              {/* Social Media List */}
              <div className="space-y-3">
                {socialProfiles.length > 0 ? (
                  socialProfiles.map((social) => {
                    const platformInfo = SOCIAL_PLATFORMS.find(p => p.value === social.platform);
                    return (
                      <Card key={social.id} className="border-blue-500/20 bg-slate-800/30">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xl">{platformInfo?.icon}</span>
                                <span className="text-sm font-semibold text-white">{platformInfo?.label}</span>
                                {social.is_verified && (
                                  <span className="px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-300 border border-green-500/30">
                                    ✓ Verified
                                  </span>
                                )}
                              </div>
                              <p className="text-white text-sm mb-1">@{social.username}</p>
                              {social.profile_url && (
                                <a 
                                  href={social.profile_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-400 hover:text-blue-300 underline"
                                >
                                  View Profile
                                </a>
                              )}
                              {social.notes && (
                                <p className="text-xs text-purple-300 mt-2">{social.notes}</p>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteSocialMutation.mutate(social.id)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-purple-300">
                    <p>No social media profiles added yet</p>
                    <p className="text-sm mt-1">Add your legitimate accounts to detect unauthorized profiles</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}