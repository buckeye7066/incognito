import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, Loader2, CheckCircle, AlertTriangle, FileText, 
  Gavel, User, ExternalLink, Printer, Scale, Clock, ArrowLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { motion } from 'framer-motion';

export default function FixExposure() {
  const queryClient = useQueryClient();
  const [exposure, setExposure] = useState(null);
  const [fixStatus, setFixStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});

  // Parse exposure ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const exposureId = urlParams.get('exposure_id');
  const exposureType = urlParams.get('type') || 'unknown';

  const activeProfileId = typeof window !== 'undefined' ? window.activeProfileId : null;

  // Fetch exposure data
  const { data: scanResults = [] } = useQuery({
    queryKey: ['scanResults'],
    queryFn: () => base44.entities.ScanResult.list()
  });

  const { data: socialFindings = [] } = useQuery({
    queryKey: ['socialMediaFindings'],
    queryFn: () => base44.entities.SocialMediaFinding.list()
  });

  const { data: fixLogs = [], refetch: refetchLogs } = useQuery({
    queryKey: ['exposureFixLogs'],
    queryFn: () => base44.entities.ExposureFixLog.list()
  });

  useEffect(() => {
    if (exposureId) {
      // Try to find in scan results first
      let found = scanResults.find(r => r.id === exposureId);
      if (found) {
        setExposure({ ...found, type: 'scan_result' });
      } else {
        // Try social findings
        found = socialFindings.find(f => f.id === exposureId);
        if (found) {
          setExposure({ ...found, type: 'social_finding' });
        }
      }
      setLoading(false);
    }
  }, [exposureId, scanResults, socialFindings]);

  const relatedLogs = fixLogs.filter(l => l.exposure_id === exposureId);

  const runFix = async (actionType) => {
    setActionLoading(prev => ({ ...prev, [actionType]: true }));
    try {
      const exposureData = exposure.type === 'scan_result' 
        ? {
            source_name: exposure.source_name,
            source_url: exposure.source_url,
            source_type: exposure.source_type,
            data_exposed: exposure.data_exposed,
            risk_score: exposure.risk_score
          }
        : {
            platform: exposure.platform,
            suspicious_username: exposure.suspicious_username,
            suspicious_profile_url: exposure.suspicious_profile_url,
            misused_data_details: exposure.misused_data_details
          };

      const result = await base44.functions.invoke('fixExposure', {
        exposureId,
        exposureType: actionType,
        profileId: activeProfileId,
        exposureData
      });

      setFixStatus(result.data);
      refetchLogs();
      queryClient.invalidateQueries(['notificationAlerts']);
    } catch (error) {
      alert('Failed to process: ' + error.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [actionType]: false }));
    }
  };

  const generateEvidencePacket = async () => {
    setActionLoading(prev => ({ ...prev, evidence: true }));
    try {
      const result = await base44.functions.invoke('generateEvidencePacket', {
        findingId: exposureId,
        profileId: activeProfileId
      });
      
      // Open print window with packet
      if (result.data?.lawEnforcementPacket) {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`<pre style="font-family: monospace; white-space: pre-wrap;">${result.data.lawEnforcementPacket}</pre>`);
        printWindow.document.close();
      }
    } catch (error) {
      alert('Failed to generate packet: ' + error.message);
    } finally {
      setActionLoading(prev => ({ ...prev, evidence: false }));
    }
  };

  const checkClassActions = async () => {
    setActionLoading(prev => ({ ...prev, classAction: true }));
    try {
      const companyName = exposure.source_name || exposure.platform;
      const result = await base44.functions.invoke('checkClassActions', {
        companyName,
        breachName: companyName
      });
      
      if (result.data?.litigation?.length > 0) {
        alert(`Found ${result.data.litigation.length} class action(s). Check Legal Support page for details.`);
      } else {
        alert('No active class actions found for this company.');
      }
    } catch (error) {
      alert('Failed to check: ' + error.message);
    } finally {
      setActionLoading(prev => ({ ...prev, classAction: false }));
    }
  };

  const findAttorneys = async () => {
    setActionLoading(prev => ({ ...prev, attorney: true }));
    try {
      const result = await base44.functions.invoke('findAttorneys', {
        exposureType: exposure.type === 'social_finding' ? 'impersonation' : 'data_broker'
      });
      
      if (result.data?.attorneys?.length > 0) {
        alert(`Found ${result.data.attorneys.length} attorney(s). Check Legal Support page for details.`);
      } else {
        alert('No attorneys found. Try the Legal Support page for more options.');
      }
    } catch (error) {
      alert('Failed to search: ' + error.message);
    } finally {
      setActionLoading(prev => ({ ...prev, attorney: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  if (!exposure) {
    return (
      <div className="text-center py-16">
        <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Exposure Not Found</h2>
        <p className="text-purple-300 mb-6">The requested exposure could not be found.</p>
        <Link to={createPageUrl('IdentityScan')}>
          <Button className="bg-purple-600 hover:bg-purple-700">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Identity Scan
          </Button>
        </Link>
      </div>
    );
  }

  const isImpersonation = exposure.type === 'social_finding';
  const exposureName = isImpersonation 
    ? `@${exposure.suspicious_username} on ${exposure.platform}`
    : exposure.source_name;

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={createPageUrl('IdentityScan')}>
          <Button variant="ghost" size="icon" className="text-purple-400">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-white">Fix My Exposure</h1>
          <p className="text-purple-300">Remediation workflow for: {exposureName}</p>
        </div>
      </div>

      {/* Exposure Summary */}
      <Card className="glass-card border-red-500/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            Exposure Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-purple-400">Source</p>
              <p className="text-white font-semibold">{exposureName}</p>
            </div>
            <div>
              <p className="text-xs text-purple-400">Type</p>
              <Badge className="bg-red-500/20 text-red-300">
                {isImpersonation ? 'Impersonation' : exposure.source_type?.replace(/_/g, ' ')}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-purple-400">Risk Score</p>
              <p className="text-white font-semibold">
                {isImpersonation ? exposure.similarity_score : exposure.risk_score}/100
              </p>
            </div>
            <div>
              <p className="text-xs text-purple-400">Detected</p>
              <p className="text-white font-semibold">
                {new Date(exposure.detected_date || exposure.scan_date || exposure.created_date).toLocaleDateString()}
              </p>
            </div>
          </div>

          {exposure.source_url && (
            <div>
              <p className="text-xs text-purple-400 mb-1">URL</p>
              <a 
                href={exposure.source_url || exposure.suspicious_profile_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline text-sm flex items-center gap-1"
              >
                {exposure.source_url || exposure.suspicious_profile_url}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Card className="glass-card border-purple-500/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-400" />
            Available Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isImpersonation ? (
              <Button
                onClick={() => runFix('impersonation')}
                disabled={actionLoading.impersonation}
                className="h-auto py-4 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700"
              >
                {actionLoading.impersonation ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <User className="w-5 h-5 mr-2" />
                )}
                <div className="text-left">
                  <p className="font-semibold">File Takedown Request</p>
                  <p className="text-xs opacity-80">Report impersonation to platform</p>
                </div>
              </Button>
            ) : (
              <Button
                onClick={() => runFix('data_broker')}
                disabled={actionLoading.data_broker}
                className="h-auto py-4 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700"
              >
                {actionLoading.data_broker ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <FileText className="w-5 h-5 mr-2" />
                )}
                <div className="text-left">
                  <p className="font-semibold">Request Data Deletion</p>
                  <p className="text-xs opacity-80">Send GDPR/CCPA removal request</p>
                </div>
              </Button>
            )}

            <Button
              onClick={generateEvidencePacket}
              disabled={actionLoading.evidence}
              className="h-auto py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              {actionLoading.evidence ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Printer className="w-5 h-5 mr-2" />
              )}
              <div className="text-left">
                <p className="font-semibold">Generate Evidence Packet</p>
                <p className="text-xs opacity-80">For law enforcement or attorney</p>
              </div>
            </Button>

            <Button
              onClick={() => runFix('identity_theft_suspected')}
              disabled={actionLoading.identity_theft_suspected}
              className="h-auto py-4 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700"
            >
              {actionLoading.identity_theft_suspected ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <AlertTriangle className="w-5 h-5 mr-2" />
              )}
              <div className="text-left">
                <p className="font-semibold">Report Identity Theft</p>
                <p className="text-xs opacity-80">Start FTC complaint process</p>
              </div>
            </Button>

            <Button
              onClick={checkClassActions}
              disabled={actionLoading.classAction}
              className="h-auto py-4 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700"
            >
              {actionLoading.classAction ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Scale className="w-5 h-5 mr-2" />
              )}
              <div className="text-left">
                <p className="font-semibold">Check Class Actions</p>
                <p className="text-xs opacity-80">Find related lawsuits</p>
              </div>
            </Button>

            <Button
              onClick={findAttorneys}
              disabled={actionLoading.attorney}
              className="h-auto py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              {actionLoading.attorney ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Gavel className="w-5 h-5 mr-2" />
              )}
              <div className="text-left">
                <p className="font-semibold">Find Attorney</p>
                <p className="text-xs opacity-80">Privacy/identity theft lawyers</p>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Fix Status */}
      {fixStatus && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="glass-card border-green-500/30">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                Action Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-green-400 mb-2">Actions Started</p>
                <div className="flex flex-wrap gap-2">
                  {fixStatus.actions_started?.map((action, idx) => (
                    <Badge key={idx} className="bg-green-500/20 text-green-300">
                      {action.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs text-amber-400 mb-2">Next Steps</p>
                <ul className="space-y-2">
                  {fixStatus.next_steps?.map((step, idx) => (
                    <li key={idx} className="text-sm text-gray-300 flex gap-2">
                      <span className="text-amber-400">{idx + 1}.</span>
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Action History */}
      {relatedLogs.length > 0 && (
        <Card className="glass-card border-purple-500/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-400" />
              Action History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {relatedLogs.map((log, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
                  <div>
                    <p className="text-white font-medium">
                      {log.action_type?.replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs text-gray-400">
                      {log.provider} • {new Date(log.created_date).toLocaleString()}
                    </p>
                  </div>
                  <Badge className={
                    log.status === 'completed' ? 'bg-green-500/20 text-green-300' :
                    log.status === 'in_progress' ? 'bg-blue-500/20 text-blue-300' :
                    log.status === 'failed' ? 'bg-red-500/20 text-red-300' :
                    'bg-amber-500/20 text-amber-300'
                  }>
                    {log.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Links */}
      <div className="flex gap-4">
        <Link to={createPageUrl('LegalSupport')}>
          <Button variant="outline" className="border-purple-500/50 text-purple-300">
            <Scale className="w-4 h-4 mr-2" />
            Legal Support Center
          </Button>
        </Link>
        <Link to={createPageUrl('DeletionCenter')}>
          <Button variant="outline" className="border-purple-500/50 text-purple-300">
            <FileText className="w-4 h-4 mr-2" />
            Deletion Center
          </Button>
        </Link>
      </div>
    </div>
  );
}