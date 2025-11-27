import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Scan, Shield, AlertTriangle, Users, Database, Globe, 
  FileText, Mail, Phone, MapPin, User, Loader2, ExternalLink,
  Eye, Lock, Gavel, MessageSquare, ChevronDown, ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CATEGORY_CONFIG = {
  impersonation: {
    icon: Users,
    label: 'Impersonation',
    color: 'bg-red-500/20 text-red-300 border-red-500/40',
    description: 'Accounts potentially using your identity'
  },
  brokers: {
    icon: Database,
    label: 'Data Brokers',
    color: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    description: 'People search sites listing your info'
  },
  breaches: {
    icon: Lock,
    label: 'Breaches',
    color: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    description: 'Data exposed in security breaches'
  },
  social: {
    icon: MessageSquare,
    label: 'Social Media',
    color: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    description: 'Mentions on social platforms'
  },
  osint: {
    icon: Globe,
    label: 'Web Mentions',
    color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    description: 'Public web appearances'
  },
  court: {
    icon: Gavel,
    label: 'Court Records',
    color: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    description: 'Public legal records'
  }
};

const FIELD_ICONS = {
  email: Mail,
  phone: Phone,
  address: MapPin,
  name: User,
  username: User,
  dob: FileText,
  ssn: Lock,
  employer: FileText
};

function MatchCard({ match, expanded, onToggle }) {
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-600/20 text-red-300 border-red-600/40';
      case 'high': return 'bg-orange-600/20 text-orange-300 border-orange-600/40';
      case 'medium': return 'bg-yellow-600/20 text-yellow-300 border-yellow-600/40';
      case 'low': return 'bg-green-600/20 text-green-300 border-green-600/40';
      default: return 'bg-gray-600/20 text-gray-300 border-gray-600/40';
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-purple-500/20 bg-slate-800/50 overflow-hidden"
    >
      <div 
        className="p-4 cursor-pointer hover:bg-slate-700/30 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge className={getSeverityColor(match.severity)}>
                {match.severity?.toUpperCase()}
              </Badge>
              <span className="text-white font-semibold">{match.source}</span>
              {match.is_impersonation && (
                <Badge className="bg-red-500/30 text-red-200 border-red-500/50">
                  ⚠️ Possible Impersonation
                </Badge>
              )}
            </div>
            
            <div className="flex flex-wrap gap-2 mb-2">
              {match.matched_fields?.map((field, idx) => {
                const IconComponent = FIELD_ICONS[field.toLowerCase()] || FileText;
                return (
                  <span 
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-purple-500/20 text-purple-300 text-xs"
                  >
                    <IconComponent className="w-3 h-3" />
                    {field}
                  </span>
                );
              })}
            </div>
            
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span>Confidence: {match.confidence}%</span>
              <span>Match Score: {match.match_score}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {match.url && (
              <a
                href={match.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-2 rounded-lg hover:bg-purple-500/20 transition-colors"
              >
                <ExternalLink className="w-4 h-4 text-purple-400" />
              </a>
            )}
            {expanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>
      </div>
      
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-purple-500/20"
          >
            <div className="p-4 space-y-3">
              <div>
                <p className="text-xs text-purple-400 mb-1">AI Analysis</p>
                <p className="text-sm text-gray-300">{match.explanation || 'No additional analysis available.'}</p>
              </div>
              
              {match.url && (
                <div>
                  <p className="text-xs text-purple-400 mb-1">Source URL</p>
                  <a 
                    href={match.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-400 hover:underline break-all"
                  >
                    {match.url}
                  </a>
                </div>
              )}
              
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="border-purple-500/50 text-purple-300">
                  <Eye className="w-3 h-3 mr-1" />
                  Mark Reviewed
                </Button>
                <Button size="sm" className="bg-red-600 hover:bg-red-700">
                  Request Removal
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function IdentityScan() {
  const queryClient = useQueryClient();
  const [scanning, setScanning] = useState(false);
  const [scanResults, setScanResults] = useState(null);
  const [expandedCards, setExpandedCards] = useState({});
  const [activeTab, setActiveTab] = useState('all');

  const activeProfileId = typeof window !== 'undefined' ? window.activeProfileId : null;

  const { data: allPersonalData = [] } = useQuery({
    queryKey: ['personalData'],
    queryFn: () => base44.entities.PersonalData.list()
  });

  const personalData = allPersonalData.filter(d => !activeProfileId || d.profile_id === activeProfileId);
  const monitoredCount = personalData.filter(p => p.monitoring_enabled).length;

  const runIdentityScan = async () => {
    if (!activeProfileId) {
      alert('Please select a profile first');
      return;
    }

    setScanning(true);
    try {
      const response = await base44.functions.invoke('runIdentityScan', { profileId: activeProfileId });
      
      // Get correlation data
      const correlationResponse = await base44.functions.invoke('correlateProfileData', { 
        profileId: activeProfileId 
      });
      
      setScanResults({
        ...response.data,
        correlation: correlationResponse.data
      });
      
      queryClient.invalidateQueries(['scanResults']);
      queryClient.invalidateQueries(['notificationAlerts']);
    } catch (error) {
      alert('Scan failed: ' + error.message);
    } finally {
      setScanning(false);
    }
  };

  const toggleCard = (id) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getCategoryMatches = (category) => {
    if (!scanResults?.correlation) return [];
    
    switch (category) {
      case 'impersonation': return scanResults.correlation.impersonationAlerts || [];
      case 'brokers': return scanResults.correlation.brokerFindings || [];
      case 'breaches': return scanResults.correlation.breachFindings || [];
      case 'social': return scanResults.correlation.socialFindings || [];
      case 'osint': return scanResults.correlation.osintFindings || [];
      case 'court': return scanResults.correlation.courtFindings || [];
      default: return scanResults.correlation.matches || [];
    }
  };

  const allMatches = scanResults?.correlation?.matches || [];

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">Identity Scan</h1>
        <p className="text-purple-300">Comprehensive search across web, breaches, brokers & social media</p>
      </div>

      {/* Scan Control */}
      <Card className="glass-card border-purple-500/30 glow-border">
        <CardHeader className="border-b border-purple-500/20">
          <CardTitle className="text-white flex items-center gap-2">
            <Scan className="w-5 h-5 text-purple-400" />
            Run Identity Scan
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-white font-semibold mb-1">Protected Identifiers</p>
              <p className="text-sm text-purple-300">
                {monitoredCount} identifiers will be searched across public sources
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-white">{monitoredCount}</p>
              <p className="text-xs text-purple-400">monitored</p>
            </div>
          </div>

          <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 mb-6">
            <p className="text-sm text-purple-200">
              <strong>How matching works:</strong> Single data points (email, phone, username, SSN fragment, DOB, address) 
              are always flagged. Name-only matches are ignored unless 2+ other identifiers also match.
            </p>
          </div>

          {monitoredCount === 0 ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
              <p className="text-white font-semibold mb-2">No identifiers to scan</p>
              <p className="text-sm text-purple-300">Add identifiers to your vault first</p>
            </div>
          ) : (
            <Button
              onClick={runIdentityScan}
              disabled={scanning}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 py-6 text-lg"
            >
              {scanning ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Scanning Web, Breaches, Brokers & Social Media...
                </>
              ) : (
                <>
                  <Scan className="w-5 h-5 mr-2" />
                  Start Identity Scan
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {scanResults && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Risk Summary */}
          <Card className="glass-card border-purple-500/30">
            <CardContent className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 rounded-lg bg-slate-800/50">
                  <p className={`text-4xl font-bold ${
                    scanResults.risk_score >= 70 ? 'text-red-400' :
                    scanResults.risk_score >= 40 ? 'text-orange-400' : 'text-green-400'
                  }`}>
                    {scanResults.risk_score}
                  </p>
                  <p className="text-xs text-purple-400">Risk Score</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-slate-800/50">
                  <p className="text-4xl font-bold text-white">{allMatches.length}</p>
                  <p className="text-xs text-purple-400">Total Matches</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-slate-800/50">
                  <p className="text-4xl font-bold text-red-400">
                    {scanResults.correlation?.impersonationAlerts?.length || 0}
                  </p>
                  <p className="text-xs text-purple-400">Impersonations</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-slate-800/50">
                  <p className="text-4xl font-bold text-orange-400">
                    {(scanResults.correlation?.breachFindings?.length || 0) + 
                     (scanResults.correlation?.brokerFindings?.length || 0)}
                  </p>
                  <p className="text-xs text-purple-400">Exposures</p>
                </div>
              </div>

              {scanResults.correlation?.analysis && (
                <div className="mt-6 p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
                  <p className="text-sm text-purple-200 mb-3">
                    {scanResults.correlation.analysis.executive_summary}
                  </p>
                  {scanResults.correlation.analysis.recommended_actions?.length > 0 && (
                    <div>
                      <p className="text-xs text-purple-400 mb-2">Recommended Actions:</p>
                      <ul className="text-sm text-purple-300 space-y-1">
                        {scanResults.correlation.analysis.recommended_actions.slice(0, 3).map((action, idx) => (
                          <li key={idx} className="flex gap-2">
                            <span className="text-purple-400">•</span>
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Category Tabs */}
          <Card className="glass-card border-purple-500/30">
            <CardContent className="p-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-slate-900/50 mb-6 flex-wrap h-auto gap-1">
                  <TabsTrigger value="all">
                    All ({allMatches.length})
                  </TabsTrigger>
                  {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
                    const count = getCategoryMatches(key).length;
                    if (count === 0) return null;
                    return (
                      <TabsTrigger key={key} value={key}>
                        <config.icon className="w-4 h-4 mr-1" />
                        {config.label} ({count})
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                <TabsContent value="all" className="space-y-3">
                  {allMatches.length > 0 ? (
                    allMatches.map((match, idx) => (
                      <MatchCard 
                        key={idx}
                        match={match}
                        expanded={expandedCards[`all-${idx}`]}
                        onToggle={() => toggleCard(`all-${idx}`)}
                      />
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <Shield className="w-12 h-12 text-green-400 mx-auto mb-3" />
                      <p className="text-white font-semibold">No exposures found</p>
                      <p className="text-sm text-purple-300">Your identity appears clean across searched sources</p>
                    </div>
                  )}
                </TabsContent>

                {Object.keys(CATEGORY_CONFIG).map(category => (
                  <TabsContent key={category} value={category} className="space-y-3">
                    {getCategoryMatches(category).length > 0 ? (
                      getCategoryMatches(category).map((match, idx) => (
                        <MatchCard 
                          key={idx}
                          match={match}
                          expanded={expandedCards[`${category}-${idx}`]}
                          onToggle={() => toggleCard(`${category}-${idx}`)}
                        />
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <Shield className="w-10 h-10 text-green-400 mx-auto mb-2" />
                        <p className="text-purple-300">No {CATEGORY_CONFIG[category].label.toLowerCase()} found</p>
                      </div>
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(CATEGORY_CONFIG).slice(0, 3).map(([key, config]) => (
          <Card key={key} className="glass-card border-purple-500/20">
            <CardContent className="p-6">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center mb-4">
                <config.icon className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-white font-semibold mb-2">{config.label}</h3>
              <p className="text-sm text-purple-300">{config.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}