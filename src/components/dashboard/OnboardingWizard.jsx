import React, { useState } from 'react';
import { incognito } from '@/api/client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, User, Mail, Phone, MapPin, ArrowRight, CheckCircle, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useActiveProfile } from '@/hooks/useActiveProfile';

const STEPS = [
  { id: 'welcome', title: 'Welcome to Incognito', icon: Shield },
  { id: 'profile', title: 'Create Your Profile', icon: User },
  { id: 'data', title: 'Add Your Data', icon: Mail },
  { id: 'ready', title: 'Ready to Scan', icon: Sparkles },
];

export default function OnboardingWizard({ onComplete }) {
  const queryClient = useQueryClient();
  const { setActiveProfileId } = useActiveProfile();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({ full_name: '', color: '#ef4444' });
  const [dataForm, setDataForm] = useState({ email: '', phone: '', address: '' });
  const [createdProfileId, setCreatedProfileId] = useState(null);

  const handleCreateProfile = async () => {
    if (!profileForm.full_name.trim()) return;
    setSaving(true);
    try {
      const profile = await incognito.entities.Profile.create({
        full_name: profileForm.full_name.trim(),
        name: profileForm.full_name.trim(),
        color: profileForm.color,
        is_default: true,
      });
      setCreatedProfileId(profile.id);
      setActiveProfileId(profile.id);
      localStorage.setItem('activeProfileId', profile.id);
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      setStep(2);
    } finally {
      setSaving(false);
    }
  };

  const handleAddData = async () => {
    if (!createdProfileId) return;
    setSaving(true);
    try {
      const entries = [];
      if (dataForm.email.trim()) {
        entries.push({ profile_id: createdProfileId, data_type: 'email', value: dataForm.email.trim(), monitoring_enabled: true });
      }
      if (dataForm.phone.trim()) {
        entries.push({ profile_id: createdProfileId, data_type: 'phone', value: dataForm.phone.trim(), monitoring_enabled: true });
      }
      if (profileForm.full_name.trim()) {
        entries.push({ profile_id: createdProfileId, data_type: 'full_name', value: profileForm.full_name.trim(), monitoring_enabled: true });
      }
      for (const entry of entries) {
        await incognito.entities.PersonalData.create(entry);
      }
      queryClient.invalidateQueries({ queryKey: ['personalData'] });
      setStep(3);
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = () => {
    localStorage.setItem('incognito_onboarding_complete', 'true');
    onComplete();
  };

  const handleSkip = () => {
    localStorage.setItem('incognito_onboarding_complete', 'true');
    onComplete();
  };

  const currentStep = STEPS[step];

  return (
    <div className="max-w-2xl mx-auto py-12">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div
            key={s.id}
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              i === step ? 'bg-red-500 w-8' : i < step ? 'bg-green-500' : 'bg-slate-600'
            }`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {/* Step 0: Welcome */}
          {step === 0 && (
            <Card className="glass-card border-red-500/30">
              <CardContent className="p-10 text-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-600 to-gray-700 flex items-center justify-center mx-auto mb-6">
                  <Shield className="w-12 h-12 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-white mb-3">Welcome to Incognito</h1>
                <p className="text-gray-400 mb-2 max-w-md mx-auto">
                  Your private, local-first identity protection tool. Everything stays on your device — no cloud, no tracking.
                </p>
                <p className="text-gray-500 text-sm mb-8 max-w-md mx-auto">
                  In 3 quick steps, you'll set up your profile, add the data you want to protect, and run your first exposure scan.
                </p>
                <div className="flex justify-center gap-3">
                  <Button
                    onClick={() => setStep(1)}
                    className="bg-gradient-to-r from-red-600 to-gray-700 px-8"
                  >
                    Get Started <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  <Button variant="ghost" onClick={handleSkip} className="text-gray-500">
                    Skip Setup
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 1: Create Profile */}
          {step === 1 && (
            <Card className="glass-card border-purple-500/30">
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Create Your Profile</h2>
                    <p className="text-sm text-gray-400">This is the identity you want to protect</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Your Full Name</label>
                    <Input
                      placeholder="e.g. John Smith"
                      value={profileForm.full_name}
                      onChange={e => setProfileForm({ ...profileForm, full_name: e.target.value })}
                      className="bg-slate-800 border-slate-600 text-white h-11"
                    />
                    <p className="text-xs text-gray-500 mt-1">This is used to search for your data across the web</p>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      onClick={handleCreateProfile}
                      disabled={saving || !profileForm.full_name.trim()}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 flex-1"
                    >
                      {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                      Create Profile
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Add Data */}
          {step === 2 && (
            <Card className="glass-card border-blue-500/30">
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Add Data to Monitor</h2>
                    <p className="text-sm text-gray-400">We'll scan for these across breach databases and data brokers</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-1 flex items-center gap-1">
                      <Mail className="w-3 h-3" /> Email Address
                    </label>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={dataForm.email}
                      onChange={e => setDataForm({ ...dataForm, email: e.target.value })}
                      className="bg-slate-800 border-slate-600 text-white h-11"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Phone Number <span className="text-gray-600">(optional)</span>
                    </label>
                    <Input
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={dataForm.phone}
                      onChange={e => setDataForm({ ...dataForm, phone: e.target.value })}
                      className="bg-slate-800 border-slate-600 text-white h-11"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      onClick={handleAddData}
                      disabled={saving || !dataForm.email.trim()}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 flex-1"
                    >
                      {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                      Save & Continue
                    </Button>
                    <Button variant="ghost" onClick={() => setStep(3)} className="text-gray-500">
                      Skip
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Ready */}
          {step === 3 && (
            <Card className="glass-card border-green-500/30">
              <CardContent className="p-10 text-center">
                <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-12 h-12 text-green-400" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-3">You're All Set!</h2>
                <p className="text-gray-400 mb-8 max-w-md mx-auto">
                  Your profile is ready. Hit the scan button on the Dashboard to check for breaches, data broker listings, and public exposure.
                </p>
                <div className="flex flex-col items-center gap-3">
                  <Button
                    onClick={handleFinish}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 px-8"
                  >
                    <Sparkles className="w-4 h-4 mr-2" /> Go to Dashboard
                  </Button>
                  <p className="text-xs text-gray-600">
                    You can add more data types (addresses, SSN, etc.) in the Vault anytime
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
