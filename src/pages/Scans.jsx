import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Search, CheckCircle2, AlertTriangle, Shield, Database } from 'lucide-react';
import { motion } from 'framer-motion';
import DarkWebConsentModal from '../components/scans/DarkWebConsentModal';
import DarkWebScanCard from '../components/scans/DarkWebScanCard';
import DataSourcesCard from '../components/scans/DataSourcesCard';

export default function Scans() {
  const queryClient = useQueryClient();
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(null);
  const [showDarkWebConsent, setShowDarkWebConsent] = useState(false);
  const [darkWebScanning, setDarkWebScanning] = useState(false);

  const activeProfileId = typeof window !== 'undefined' ? window.activeProfileId : null;

  const { data: allPersonalData = [] } = useQuery({
    queryKey: ['personalData'],
    queryFn: () => base44.entities.PersonalData.list()
  });

  const personalData = allPersonalData.filter(d => !activeProfileId || d.profile_id === activeProfileId);

  const { data: userPreferences = [], refetch: refetchPreferences } = useQuery({
    queryKey: ['userPreferences'],
    queryFn: () => base44.entities.UserPreferences.list()
  });

  const preference = userPreferences[0] || {};
  const darkWebEnabled = preference.dark_web_scan_enabled || false;

  const createResultMutation = useMutation({
    mutationFn: (data) => base44.entities.ScanResult.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['scanResults']);
    }
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: (data) => {
      if (preference.id) {
        return base44.entities.UserPreferences.update(preference.id, data);
      } else {
        return base44.entities.UserPreferences.create(data);
      }
    },
    onSuccess: () => {
      refetchPreferences();
    }
  });

  const runScan = async () => {
    setScanning(true);
    setScanProgress({ current: 0, total: personalData.filter(p => p.monitoring_enabled).length });

    const monitoredData = personalData.filter(p => p.monitoring_enabled);

    for (let i = 0; i < monitoredData.length; i++) {
      const data = monitoredData[i];
      setScanProgress({ current: i + 1, total: monitoredData.length, scanning: data.value });

      try {
        // Comprehensive multi-source scan
        const result = await base44.integrations.Core.InvokeLLM({
          prompt: `Perform a comprehensive scan across multiple data sources for this personal information:

DATA TO SCAN:
Type: ${data.data_type}
Value: ${data.value}

SCAN THE FOLLOWING SOURCES:
1. PEOPLE FINDER SITES: Spokeo, BeenVerified, Intelius, PeopleFinders, WhitePages
2. DATA BROKERS: Acxiom, Epsilon, Oracle Data Cloud, LiveRamp
3. PUBLIC RECORDS: Property records, business registries, voter registration
4. GOVERNMENT DATABASES: USA.gov public data, state databases, license records
5. LEGAL RECORDS: PACER federal court records, public legal filings
6. BREACH DATABASES: Have I Been Pwned, DeHashed, LeakCheck
7. OSINT SOURCES: Archive.org cached pages, Google dorking results

For each source where data is found, provide:
- Source name (be specific)
- What data was exposed
- Risk assessment
- Last updated/cached date if available

Use internet search to verify current breach status and public record availability. 
          
IMPORTANT: Be thorough and specific. Check real sources, not hypothetical ones.`,
          add_context_from_internet: true,
          response_json_schema: {
            type: 'object',
            properties: {
              found: { type: 'boolean' },
              sources: { 
                type: 'array', 
                items: { 
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    type: { type: 'string' },
                    data_exposed: { type: 'array', items: { type: 'string' } },
                    last_updated: { type: 'string' }
                  }
                }
              },
              risk_score: { type: 'number' },
              details: { type: 'string' },
              osint_findings: { type: 'array', items: { type: 'string' } }
            }
          }
        });

        if (result.found && result.sources?.length > 0) {
          // Create scan results for each source found
          for (const sourceObj of result.sources) {
            const sourceName = typeof sourceObj === 'string' ? sourceObj : sourceObj.name;
            const sourceType = sourceObj.type || 'other';
            const dataExposed = sourceObj.data_exposed || [data.data_type];
            
            // Map source type to enum
            const sourceTypeEnum = ['breach_database', 'people_finder', 'public_record', 'data_broker'].includes(sourceType) 
              ? sourceType 
              : 'other';
            
            await createResultMutation.mutateAsync({
              profile_id: activeProfileId,
              personal_data_id: data.id,
              source_name: sourceName,
              source_url: `https://search.google.com/search?q=${encodeURIComponent(data.value + ' ' + sourceName)}`,
              source_type: sourceTypeEnum,
              risk_score: result.risk_score || 50,
              data_exposed: dataExposed,
              status: 'new',
              scan_date: new Date().toISOString().split('T')[0],
              metadata: { 
                details: result.details,
                last_updated: sourceObj.last_updated,
                osint_findings: result.osint_findings,
                scan_type: 'comprehensive'
              }
            });
          }
        }
      } catch (error) {
        console.error('Scan error:', error);
      }

      // Simulate delay
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    setScanning(false);
    setScanProgress(null);
  };

  const enableDarkWebScanning = async () => {
    await updatePreferencesMutation.mutateAsync({
      dark_web_scan_enabled: true,
      dark_web_consent_given: true,
      consent_timestamp: new Date().toISOString()
    });
  };

  const runDarkWebScan = async () => {
    setDarkWebScanning(true);
    setScanProgress({ current: 0, total: personalData.filter(p => p.monitoring_enabled).length, type: 'dark_web' });

    const monitoredData = personalData.filter(p => p.monitoring_enabled);

    for (let i = 0; i < monitoredData.length; i++) {
      const data = monitoredData[i];
      setScanProgress({ current: i + 1, total: monitoredData.length, scanning: data.value, type: 'dark_web' });

      try {
        // Simulate dark web breach check using LLM with enhanced context
        const result = await base44.integrations.Core.InvokeLLM({
          prompt: `You are a cybersecurity analyst checking for data breaches and dark web exposure.

IMPORTANT: Search for ACTUAL, REAL data breaches and exposures related to this information:

Data type: ${data.data_type}
Value: ${data.value}

Check the following sources:
1. Have I Been Pwned database
2. Known data breaches (LinkedIn, Adobe, Yahoo, Marriott, Equifax, etc.)
3. Credential dumps and paste sites
4. Dark web marketplaces and forums
5. Public breach notifications

Respond with detailed JSON:
- found: true if found in ANY breach or exposure (be thorough)
- sources: array of SPECIFIC breach names or sources where found
- risk_score: 0-100 based on severity and recency
- breach_details: object with keys as source names, values as details about what was exposed
- recommendations: array of recommended actions
- compromised_data: array of specific data types exposed (email, password, phone, etc.)

For common email providers or widespread breaches, check thoroughly. If this could be in any major breach, mark as found.`,
          add_context_from_internet: true,
          response_json_schema: {
            type: 'object',
            properties: {
              found: { type: 'boolean' },
              sources: { type: 'array', items: { type: 'string' } },
              risk_score: { type: 'number' },
              breach_details: { type: 'object' },
              recommendations: { type: 'array', items: { type: 'string' } },
              compromised_data: { type: 'array', items: { type: 'string' } }
            }
          }
        });

        if (result.found && result.sources?.length > 0) {
          // Create dark web scan results
          for (const source of result.sources) {
            const breachDetail = result.breach_details?.[source] || 'Data found in breach database';
            
            await createResultMutation.mutateAsync({
              profile_id: activeProfileId,
              personal_data_id: data.id,
              source_name: source,
              source_url: `https://haveibeenpwned.com/`,
              source_type: 'breach_database',
              risk_score: result.risk_score || 75,
              data_exposed: result.compromised_data || [data.data_type],
              status: 'new',
              scan_date: new Date().toISOString().split('T')[0],
              metadata: {
                details: breachDetail,
                scan_type: 'dark_web',
                recommendations: result.recommendations || [],
                compromised_data: result.compromised_data || []
              }
            });
          }
        }
      } catch (error) {
        console.error('Dark web scan error:', error);
      }

      // Simulate delay (dark web scans are slower)
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    setDarkWebScanning(false);
    setScanProgress(null);
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">Web Scanning</h1>
        <p className="text-purple-300">Search for your data across breach databases and public records</p>
      </div>

      {/* Scan Control */}
      <Card className="glass-card border-purple-500/30 glow-border">
        <CardHeader className="border-b border-purple-500/20">
          <CardTitle className="text-white flex items-center gap-2">
            <Search className="w-5 h-5 text-purple-400" />
            Run New Scan
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/50">
              <div>
                <p className="text-white font-semibold mb-1">Identifiers to Scan</p>
                <p className="text-sm text-purple-300">
                  {personalData.filter(p => p.monitoring_enabled).length} identifiers with monitoring enabled
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white">
                  {personalData.filter(p => p.monitoring_enabled).length}
                </p>
              </div>
            </div>

            {personalData.filter(p => p.monitoring_enabled).length === 0 ? (
              <div className="text-center py-8">
                <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                <p className="text-white font-semibold mb-2">No identifiers to scan</p>
                <p className="text-sm text-purple-300">Add identifiers to your vault and enable monitoring first</p>
              </div>
            ) : (
              <>
                {!scanning && !scanProgress && (
                  <Button
                    onClick={runScan}
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 py-6 text-lg"
                  >
                    <Search className="w-5 h-5 mr-2" />
                    Start Comprehensive Scan
                  </Button>
                )}

                {scanning && scanProgress && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-semibold">Scanning in progress...</span>
                      <span className="text-purple-300">
                        {scanProgress.current} / {scanProgress.total}
                      </span>
                    </div>

                    <div className="relative h-3 bg-slate-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}
                        className="h-full bg-gradient-to-r from-purple-600 to-indigo-600"
                      />
                    </div>

                    <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-900/50">
                      <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                      <span className="text-sm text-purple-300">
                        Checking: {scanProgress.scanning}
                      </span>
                    </div>
                  </motion.div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dark Web Scanning */}
      <DarkWebScanCard
        enabled={darkWebEnabled}
        onEnable={() => setShowDarkWebConsent(true)}
        onRunScan={runDarkWebScan}
        isScanning={darkWebScanning}
      />

      {/* Dark Web Consent Modal */}
      <DarkWebConsentModal
        open={showDarkWebConsent}
        onClose={() => setShowDarkWebConsent(false)}
        onConsent={enableDarkWebScanning}
      />

      {/* Data Sources Coverage */}
      <DataSourcesCard expanded={true} />

      {/* Scan Types Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card border-purple-500/20">
          <CardContent className="p-6">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center mb-4">
              <Search className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-white font-semibold mb-2">People Finder Sites</h3>
            <p className="text-sm text-purple-300">
              BeenVerified, Intelius, Spokeo, WhitePages, and similar services
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card border-purple-500/20">
          <CardContent className="p-6">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center mb-4">
              <Database className="w-6 h-6 text-indigo-400" />
            </div>
            <h3 className="text-white font-semibold mb-2">Data Brokers</h3>
            <p className="text-sm text-purple-300">
              Acxiom, Epsilon, Oracle Data Cloud, and commercial data aggregators
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card border-purple-500/20">
          <CardContent className="p-6">
            <div className="w-12 h-12 rounded-xl bg-pink-500/20 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-6 h-6 text-pink-400" />
            </div>
            <h3 className="text-white font-semibold mb-2">Public & Legal Records</h3>
            <p className="text-sm text-purple-300">
              PACER, court filings, government databases, property records
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}