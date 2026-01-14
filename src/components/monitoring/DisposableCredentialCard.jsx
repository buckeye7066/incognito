import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, Plus, ExternalLink, Shield, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function DisposableCredentialCard({ credentials, onCreate, profileId, onRevoked }) {
  const [showForm, setShowForm] = useState(false);
  const [revokingId, setRevokingId] = useState(null);
  const [formData, setFormData] = useState({
    credential_type: 'email',
    service_provider: 'Guerrilla Mail',
    purpose: '',
    created_for_website: ''
  });

  const services = {
    email: [
      { name: 'Guerrilla Mail', url: 'https://www.guerrillamail.com' },
      { name: '10 Minute Mail', url: 'https://10minutemail.com' },
      { name: 'Temp Mail', url: 'https://temp-mail.org' },
      { name: 'SimpleLogin', url: 'https://simplelogin.io' }
    ],
    phone: [
      { name: 'Burner', url: 'https://www.burnerapp.com' },
      { name: 'Google Voice', url: 'https://voice.google.com' },
      { name: 'Hushed', url: 'https://hushed.com' }
    ]
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreate(formData);
    setShowForm(false);
    setFormData({
      credential_type: 'email',
      service_provider: 'Guerrilla Mail',
      purpose: '',
      created_for_website: ''
    });
  };

  const revokeAlias = async (cred) => {
    if (!profileId) {
      alert('Please select a profile first');
      return;
    }
    setRevokingId(cred.id);
    try {
      const { base44 } = await import('@/api/base44Client');
      // Soft-revoke for auditability (server sets revoked flags, keeps record)
      await base44.functions.invoke('deleteEmailAlias', { aliasId: cred.id, profileId });
      if (onRevoked) onRevoked();
    } catch (error) {
      alert('Failed to revoke alias: ' + error.message);
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <Card className="glass-card border-purple-500/30">
      <CardHeader className="border-b border-purple-500/20">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-400" />
            Disposable Credentials
          </CardTitle>
          <Button
            onClick={() => setShowForm(!showForm)}
            size="sm"
            className="bg-gradient-to-r from-green-600 to-emerald-600"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
          <p className="text-sm text-green-300 mb-2">
            <strong>Why Use Disposable Credentials?</strong>
          </p>
          <p className="text-xs text-purple-300">
            Use temporary emails/phones for signups to prevent your real info from being sold to data brokers. 
            If spam increases, you know exactly which service leaked your data!
          </p>
        </div>

        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <form onSubmit={handleSubmit} className="space-y-3 p-4 rounded-lg bg-slate-900/50 border border-purple-500/30">
                <Select value={formData.credential_type} onValueChange={(v) => setFormData({...formData, credential_type: v})}>
                  <SelectTrigger className="bg-slate-900/50 border-purple-500/30 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Disposable Email</SelectItem>
                    <SelectItem value="phone">Temporary Phone</SelectItem>
                  </SelectContent>
                </Select>

                <Select 
                  value={formData.service_provider} 
                  onValueChange={(v) => setFormData({...formData, service_provider: v})}
                >
                  <SelectTrigger className="bg-slate-900/50 border-purple-500/30 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {services[formData.credential_type].map(s => (
                      <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  placeholder="What's this for? (e.g., Newsletter signup)"
                  value={formData.purpose}
                  onChange={(e) => setFormData({...formData, purpose: e.target.value})}
                  className="bg-slate-900/50 border-purple-500/30 text-white"
                  required
                />

                <Input
                  placeholder="Website/service (e.g., shopify.com)"
                  value={formData.created_for_website}
                  onChange={(e) => setFormData({...formData, created_for_website: e.target.value})}
                  className="bg-slate-900/50 border-purple-500/30 text-white"
                />

                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)} size="sm" className="border-purple-500/50 text-purple-300">
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="bg-gradient-to-r from-green-600 to-emerald-600">
                    Track Credential
                  </Button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recommended Services */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="w-4 h-4 text-purple-400" />
              <h4 className="font-semibold text-white text-sm">Email Services</h4>
            </div>
            <div className="space-y-1">
              {services.email.map(s => (
                <a
                  key={s.name}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between text-xs text-purple-300 hover:text-purple-100 transition-colors"
                >
                  <span>{s.name}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
            <div className="flex items-center gap-2 mb-2">
              <Phone className="w-4 h-4 text-blue-400" />
              <h4 className="font-semibold text-white text-sm">Phone Services</h4>
            </div>
            <div className="space-y-1">
              {services.phone.map(s => (
                <a
                  key={s.name}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between text-xs text-purple-300 hover:text-purple-100 transition-colors"
                >
                  <span>{s.name}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Tracked Credentials */}
        {credentials && credentials.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-white">Your Disposable Credentials</h4>
            {credentials.map(cred => (
              <div key={cred.id} className="p-3 rounded-lg bg-slate-900/50 border border-purple-500/30">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2">
                    {cred.credential_type === 'email' ? (
                      <Mail className="w-4 h-4 text-purple-400 mt-0.5" />
                    ) : (
                      <Phone className="w-4 h-4 text-blue-400 mt-0.5" />
                    )}
                    <div>
                      <p className="text-sm text-white font-medium">{cred.purpose}</p>
                      <p className="text-xs text-purple-400">{cred.created_for_website || 'No website specified'}</p>
                      <p className="text-xs text-purple-500 mt-1">via {cred.service_provider}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {cred.credential_type === 'email' && cred.is_active !== false && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={revokingId === cred.id}
                        onClick={() => revokeAlias(cred)}
                        className="border-red-500/50 text-red-300 hover:text-red-200"
                      >
                        {revokingId === cred.id ? 'Revoking…' : 'Revoke'}
                      </Button>
                    )}
                    {cred.is_active === false && (
                      <Badge className="bg-gray-500/20 text-gray-300 border-gray-500/40">
                        Revoked
                      </Badge>
                    )}
                    {cred.spam_received > 0 && (
                      <Badge className="bg-red-500/20 text-red-300 border-red-500/40 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {cred.spam_received} spam
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}