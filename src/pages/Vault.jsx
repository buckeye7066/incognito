import { useActiveProfile } from '@/hooks/useActiveProfile';
import React, { useState } from 'react';
import { incognito } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Lock, Eye, EyeOff, AlertTriangle, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import BreachCheckButton from '../components/vault/BreachCheckButton';
import { notify } from '@/lib/notify';

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
  { value: 'credit_card', label: 'Credit Card Number', icon: '💳' },
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

export default function Vault() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [showValues, setShowValues] = useState(false);
  const [formData, setFormData] = useState({
    data_type: '',
    value: '',
    label: '',
    monitoring_enabled: true,
    notes: ''
  });

  const { activeProfileId } = useActiveProfile();

  const { data: allPersonalData = [], isLoading } = useQuery({
    queryKey: ['personalData'],
    queryFn: () => incognito.entities.PersonalData.list()
  });

  const { data: allScanResults = [] } = useQuery({
    queryKey: ['scanResults'],
    queryFn: () => incognito.entities.ScanResult.list()
  });

  const { data: allSearchFindings = [] } = useQuery({
    queryKey: ['searchQueryFindings'],
    queryFn: () => incognito.entities.SearchQueryFinding.list()
  });

  const personalData = allPersonalData.filter(d => !activeProfileId || d.profile_id === activeProfileId);
  const profileScans = allScanResults.filter(r => !activeProfileId || r.profile_id === activeProfileId);
  const profileSearches = allSearchFindings.filter(r => !activeProfileId || r.profile_id === activeProfileId);

  const getIdentifierHits = (item) => {
    const breaches = profileScans.filter(s =>
      s.personal_data_id === item.id ||
      (item.data_type === 'email' && s.metadata?.email === item.value)
    );
    const searches = profileSearches.filter(s =>
      s.data_found?.some(d => d.toLowerCase().includes(item.data_type.replace('_', ' ')))
    );
    return { breaches: breaches.length, searches: searches.length, total: breaches.length + searches.length };
  };

  const createMutation = useMutation({
    mutationFn: (data) => incognito.entities.PersonalData.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personalData'] });
      setShowForm(false);
      setFormData({
        data_type: '',
        value: '',
        label: '',
        monitoring_enabled: true,
        notes: ''
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => incognito.entities.PersonalData.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personalData'] });
    }
  });

  const toggleMonitoringMutation = useMutation({
    mutationFn: ({ id, monitoring_enabled }) => 
      incognito.entities.PersonalData.update(id, { monitoring_enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personalData'] });
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!activeProfileId) {
      notify.warn('Please select or create a profile first');
      return;
    }
    if (!formData.data_type) {
      notify.warn('Please select a data type');
      return;
    }
    if (!formData.value || !formData.value.trim()) {
      notify.warn('Please enter a value');
      return;
    }
    createMutation.mutate({ ...formData, value: formData.value.trim(), profile_id: activeProfileId });
  };

  const groupedData = DATA_TYPES.reduce((acc, type) => {
    acc[type.value] = personalData.filter(d => d.data_type === type.value);
    return acc;
  }, {});

  const maskValue = (value, dataType) => {
    if (!value) return '';
    if (dataType === 'email') {
      return value.replace(/(.{2}).+(@.+)/, "$1***$2");
    }
    if (dataType === 'phone') {
      return value.replace(/\d(?=\d{4})/g, '*');
    }
    if (dataType === 'address') {
      return value.replace(/^\d+\s+/, "*** ");
    }
    if (dataType === 'credit_card') {
      const digits = value.replace(/\D/g, '');
      const last4 = digits.slice(-4);
      return `•••• •••• •••• ${last4}`;
    }
    if (dataType === 'ssn' || dataType === 'bank_account') {
      return '•••-••-' + value.slice(-4);
    }
    if (value.length <= 4) return '•'.repeat(value.length);
    return value.slice(0, 2) + '•'.repeat(value.length - 4) + value.slice(-2);
  };

  const formatCardInput = (raw) => {
    const digits = raw.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(.{4})/g, '$1 ').trim();
  };

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Secure Vault</h1>
          <p className="text-purple-300">Device-local storage for your personal identifiers</p>
        </div>
        <div className="flex gap-3">
          <BreachCheckButton personalData={personalData} profileId={activeProfileId} />
          <Button
            variant="outline"
            onClick={() => setShowValues(!showValues)}
            className="border-purple-500/50 text-purple-300 hover:text-white"
          >
            {showValues ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
            {showValues ? 'Hide' : 'Show'} Values
          </Button>
          <Button
            onClick={() => setShowForm(!showForm)}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Identifier
          </Button>
        </div>
      </div>

      {/* Add Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="glass-card border-purple-500/30 glow-border">
              <CardHeader className="border-b border-purple-500/20">
                <CardTitle className="text-white flex items-center gap-2">
                  <Lock className="w-5 h-5 text-purple-400" />
                  Add New Identifier
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-purple-200">Data Type</Label>
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
                      <Label className="text-purple-200">Label (Optional)</Label>
                      <Input
                        value={formData.label}
                        onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                        placeholder="e.g., Primary Email"
                        className="bg-slate-900/50 border-purple-500/30 text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-purple-200">
                      {formData.data_type === 'credit_card' ? 'Full Card Number' : 'Value'}
                    </Label>
                    <Input
                      value={formData.data_type === 'credit_card' ? formatCardInput(formData.value) : formData.value}
                      onChange={(e) => {
                        const raw = formData.data_type === 'credit_card'
                          ? e.target.value.replace(/\D/g, '').slice(0, 16)
                          : e.target.value;
                        setFormData({ ...formData, value: raw });
                      }}
                      placeholder={formData.data_type === 'credit_card'
                        ? '1234 5678 9012 3456'
                        : 'Enter the actual data'}
                      maxLength={formData.data_type === 'credit_card' ? 19 : undefined}
                      className="bg-slate-900/50 border-purple-500/30 text-white font-mono"
                      required
                    />
                    {formData.data_type === 'credit_card' && (
                      <p className="text-xs text-purple-400">
                        Enter full number. Only the last 4 digits will be displayed.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-purple-200">Notes (Optional)</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Private notes about this identifier"
                      className="bg-slate-900/50 border-purple-500/30 text-white"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={formData.monitoring_enabled}
                        onCheckedChange={(checked) => setFormData({ ...formData, monitoring_enabled: checked })}
                      />
                      <Label className="text-purple-200">Enable monitoring for this identifier</Label>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowForm(false)}
                        className="border-purple-500/50 text-purple-300"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createMutation.isPending}
                        className="bg-gradient-to-r from-purple-600 to-indigo-600"
                      >
                        {createMutation.isPending ? 'Adding...' : 'Add to Vault'}
                      </Button>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Data Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {DATA_TYPES.map((type) => {
          const items = groupedData[type.value] || [];
          if (items.length === 0) return null;

          return (
            <motion.div
              key={type.value}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Card className="glass-card border-purple-500/20 hover:glow-border transition-all duration-300">
                <CardHeader className="border-b border-purple-500/20 pb-3">
                  <CardTitle className="text-white text-lg flex items-center gap-2">
                    <span className="text-2xl">{type.icon}</span>
                    {type.label}
                    <span className="ml-auto text-sm font-normal text-purple-400">
                      {items.length}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {items.map((item) => {
                    const hits = getIdentifierHits(item);
                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-lg bg-slate-900/50 border transition-colors ${
                          hits.total > 0
                            ? 'border-red-500/30 hover:border-red-500/50'
                            : 'border-purple-500/10 hover:border-purple-500/30'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            {item.label && (
                              <p className="text-xs text-purple-400 mb-1">{item.label}</p>
                            )}
                            <p className="text-white font-mono text-sm truncate">
                              {showValues
                                ? (item.data_type === 'credit_card'
                                    ? formatCardInput(item.value)
                                    : item.value)
                                : maskValue(item.value, item.data_type)}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(item.id)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        {hits.total > 0 ? (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {hits.breaches > 0 && (
                              <Badge className="bg-red-600/20 text-red-300 border-red-600/40 text-[10px] px-1.5 py-0 gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                {hits.breaches} breach{hits.breaches !== 1 ? 'es' : ''}
                              </Badge>
                            )}
                            {hits.searches > 0 && (
                              <Badge className="bg-amber-600/20 text-amber-300 border-amber-600/40 text-[10px] px-1.5 py-0 gap-1">
                                {hits.searches} search exposure{hits.searches !== 1 ? 's' : ''}
                              </Badge>
                            )}
                          </div>
                        ) : item.monitoring_enabled ? (
                          <div className="flex items-center gap-1 mb-2">
                            <ShieldCheck className="w-3 h-3 text-green-400" />
                            <span className="text-[10px] text-green-400">No exposures found</span>
                          </div>
                        ) : null}
                        <div className="flex items-center justify-between">
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
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {personalData.length === 0 && !isLoading && (
        <div className="text-center py-16">
          <Lock className="w-16 h-16 text-purple-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Your Vault is Empty</h3>
          <p className="text-purple-300 mb-4">Add your first identifier to start monitoring</p>
          <Button
            onClick={() => setShowForm(true)}
            className="bg-gradient-to-r from-purple-600 to-indigo-600"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Identifier
          </Button>
        </div>
      )}
    </div>
  );
}