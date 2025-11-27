import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Scale, Gavel, FileText, Shield, AlertTriangle, ExternalLink, 
  Loader2, User, Phone, Mail, Globe, CheckCircle, Clock, Printer
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function LegalSupport() {
  const [searchingClassActions, setSearchingClassActions] = useState(false);
  const [searchingAttorneys, setSearchingAttorneys] = useState(false);
  const [classActions, setClassActions] = useState([]);
  const [attorneys, setAttorneys] = useState([]);
  const [generatingPacket, setGeneratingPacket] = useState(null);

  const activeProfileId = typeof window !== 'undefined' ? window.activeProfileId : null;

  const { data: scanResults = [] } = useQuery({
    queryKey: ['scanResults'],
    queryFn: () => base44.entities.ScanResult.list()
  });

  const { data: socialFindings = [] } = useQuery({
    queryKey: ['socialMediaFindings'],
    queryFn: () => base44.entities.SocialMediaFinding.list()
  });

  const { data: fixLogs = [] } = useQuery({
    queryKey: ['exposureFixLogs'],
    queryFn: () => base44.entities.ExposureFixLog.list()
  });

  const profileScanResults = scanResults.filter(r => !activeProfileId || r.profile_id === activeProfileId);
  const profileSocialFindings = socialFindings.filter(f => !activeProfileId || f.profile_id === activeProfileId);
  const profileFixLogs = fixLogs.filter(l => !activeProfileId || l.profile_id === activeProfileId);

  // Get unique companies from findings
  const companies = [...new Set([
    ...profileScanResults.map(r => r.source_name),
    ...profileSocialFindings.map(f => f.platform)
  ])].filter(Boolean);

  const searchAllClassActions = async () => {
    setSearchingClassActions(true);
    setClassActions([]);
    
    try {
      const allResults = [];
      for (const company of companies.slice(0, 5)) { // Limit to 5 to avoid rate limits
        try {
          const result = await base44.functions.invoke('checkClassActions', {
            companyName: company
          });
          if (result.data?.litigation?.length > 0) {
            allResults.push(...result.data.litigation);
          }
        } catch (e) {
          // Continue with next company
        }
      }
      setClassActions(allResults);
    } catch (error) {
      alert('Search failed: ' + error.message);
    } finally {
      setSearchingClassActions(false);
    }
  };

  const searchAttorneys = async () => {
    setSearchingAttorneys(true);
    try {
      const result = await base44.functions.invoke('findAttorneys', {
        exposureType: 'identity_theft'
      });
      setAttorneys(result.data?.attorneys || []);
    } catch (error) {
      alert('Search failed: ' + error.message);
    } finally {
      setSearchingAttorneys(false);
    }
  };

  const generateEvidencePacket = async (finding, type) => {
    setGeneratingPacket(finding.id);
    try {
      const result = await base44.functions.invoke('generateEvidencePacket', {
        findingId: finding.id,
        profileId: activeProfileId
      });
      
      const packet = type === 'law_enforcement' 
        ? result.data?.lawEnforcementPacket 
        : result.data?.attorneyPacket;
      
      if (packet) {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
          <html>
          <head>
            <title>Evidence Packet - ${type === 'law_enforcement' ? 'Law Enforcement' : 'Attorney'}</title>
            <style>
              body { font-family: 'Courier New', monospace; padding: 20px; }
              pre { white-space: pre-wrap; font-size: 12px; }
            </style>
          </head>
          <body>
            <pre>${packet}</pre>
          </body>
          </html>
        `);
        printWindow.document.close();
      }
    } catch (error) {
      alert('Failed to generate: ' + error.message);
    } finally {
      setGeneratingPacket(null);
    }
  };

  const victimRights = [
    { title: 'Right to Data Deletion (GDPR Art. 17, CCPA 1798.105)', description: 'Request removal of your personal data from any company.' },
    { title: 'Right to Know (CCPA 1798.100)', description: 'Know what personal data companies have collected about you.' },
    { title: 'Right to Opt-Out (CCPA 1798.120)', description: 'Stop companies from selling your personal information.' },
    { title: 'Right to Correction (GDPR Art. 16)', description: 'Correct inaccurate personal data held by companies.' },
    { title: 'Right to File FTC Complaint', description: 'Report identity theft and unfair practices to the FTC.' },
    { title: 'Right to Credit Freeze', description: 'Freeze your credit reports at all three bureaus for free.' }
  ];

  const legalNextSteps = [
    { step: 1, title: 'Document Everything', description: 'Save screenshots, URLs, and dates of all exposures.' },
    { step: 2, title: 'File Identity Theft Report', description: 'Submit report at IdentityTheft.gov to get recovery plan.' },
    { step: 3, title: 'Place Fraud Alerts', description: 'Contact Equifax, Experian, and TransUnion to place alerts.' },
    { step: 4, title: 'Request Credit Reports', description: 'Get free reports from all three bureaus at AnnualCreditReport.com.' },
    { step: 5, title: 'File Police Report', description: 'File a report with local law enforcement for documentation.' },
    { step: 6, title: 'Consult Attorney', description: 'Consider legal action for damages and injunctive relief.' }
  ];

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <Scale className="w-10 h-10 text-purple-400" />
          Legal Support Center
        </h1>
        <p className="text-purple-300">Class actions, attorneys, evidence packets, and victim rights</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card border-purple-500/30">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-white">{profileScanResults.length + profileSocialFindings.length}</p>
            <p className="text-xs text-purple-400">Total Exposures</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-red-500/30">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-red-400">{profileSocialFindings.length}</p>
            <p className="text-xs text-purple-400">Impersonations</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-amber-500/30">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-amber-400">{classActions.length}</p>
            <p className="text-xs text-purple-400">Class Actions Found</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-green-500/30">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-green-400">{profileFixLogs.filter(l => l.status === 'completed').length}</p>
            <p className="text-xs text-purple-400">Actions Completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="class_actions" className="space-y-6">
        <TabsList className="bg-slate-900/50 border border-purple-500/20">
          <TabsTrigger value="class_actions">Class Actions</TabsTrigger>
          <TabsTrigger value="attorneys">Find Attorneys</TabsTrigger>
          <TabsTrigger value="evidence">Evidence Packets</TabsTrigger>
          <TabsTrigger value="rights">Victim Rights</TabsTrigger>
          <TabsTrigger value="next_steps">Legal Next Steps</TabsTrigger>
        </TabsList>

        {/* Class Actions Tab */}
        <TabsContent value="class_actions">
          <Card className="glass-card border-purple-500/30">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <Gavel className="w-5 h-5 text-purple-400" />
                Class Action Lawsuits
              </CardTitle>
              <Button
                onClick={searchAllClassActions}
                disabled={searchingClassActions || companies.length === 0}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {searchingClassActions ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Scale className="w-4 h-4 mr-2" />
                    Search All Companies
                  </>
                )}
              </Button>
            </CardHeader>
            <CardContent>
              {companies.length === 0 ? (
                <p className="text-center text-purple-300 py-8">
                  No exposures found. Run an Identity Scan first.
                </p>
              ) : classActions.length === 0 ? (
                <div className="text-center py-8">
                  <Scale className="w-12 h-12 text-purple-500 mx-auto mb-4" />
                  <p className="text-white font-semibold mb-2">Ready to Search</p>
                  <p className="text-purple-300 text-sm mb-4">
                    Will search for lawsuits against: {companies.slice(0, 5).join(', ')}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {classActions.map((action, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-lg bg-slate-800/50 border border-purple-500/20"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-white font-semibold">{action.lawsuit_name}</h3>
                          <p className="text-sm text-gray-400">{action.court}</p>
                          <div className="flex gap-2 mt-2">
                            <Badge className={
                              action.status === 'active' ? 'bg-green-500/20 text-green-300' :
                              action.status === 'settled' ? 'bg-blue-500/20 text-blue-300' :
                              'bg-gray-500/20 text-gray-300'
                            }>
                              {action.status}
                            </Badge>
                            <Badge className="bg-purple-500/20 text-purple-300">
                              {action.matched_company}
                            </Badge>
                          </div>
                        </div>
                        {action.url && (
                          <a
                            href={action.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300"
                          >
                            <ExternalLink className="w-5 h-5" />
                          </a>
                        )}
                      </div>
                      {action.deadline && (
                        <p className="text-xs text-amber-400 mt-2">
                          <Clock className="w-3 h-3 inline mr-1" />
                          Deadline: {action.deadline}
                        </p>
                      )}
                      {action.how_to_join && (
                        <p className="text-sm text-gray-300 mt-2">{action.how_to_join}</p>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attorneys Tab */}
        <TabsContent value="attorneys">
          <Card className="glass-card border-purple-500/30">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <User className="w-5 h-5 text-purple-400" />
                Recommended Attorneys
              </CardTitle>
              <Button
                onClick={searchAttorneys}
                disabled={searchingAttorneys}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {searchingAttorneys ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Gavel className="w-4 h-4 mr-2" />
                    Find Attorneys
                  </>
                )}
              </Button>
            </CardHeader>
            <CardContent>
              {attorneys.length === 0 ? (
                <div className="text-center py-8">
                  <Gavel className="w-12 h-12 text-purple-500 mx-auto mb-4" />
                  <p className="text-white font-semibold mb-2">Find Legal Help</p>
                  <p className="text-purple-300 text-sm">
                    Search for attorneys specializing in identity theft and data privacy.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {attorneys.map((attorney, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-lg bg-slate-800/50 border border-purple-500/20"
                    >
                      <h3 className="text-white font-semibold">{attorney.name}</h3>
                      <p className="text-sm text-purple-300">{attorney.firm}</p>
                      <p className="text-xs text-gray-400 mb-2">{attorney.location}</p>
                      
                      {attorney.free_consultation && (
                        <Badge className="bg-green-500/20 text-green-300 mb-2">
                          Free Consultation
                        </Badge>
                      )}
                      
                      <div className="space-y-1 mt-2">
                        {attorney.phone && (
                          <a href={`tel:${attorney.phone}`} className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300">
                            <Phone className="w-3 h-3" />
                            {attorney.phone}
                          </a>
                        )}
                        {attorney.email && (
                          <a href={`mailto:${attorney.email}`} className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300">
                            <Mail className="w-3 h-3" />
                            {attorney.email}
                          </a>
                        )}
                        {attorney.website && (
                          <a href={attorney.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300">
                            <Globe className="w-3 h-3" />
                            Website
                          </a>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Evidence Packets Tab */}
        <TabsContent value="evidence">
          <Card className="glass-card border-purple-500/30">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-400" />
                Generate Evidence Packets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {profileSocialFindings.length === 0 && profileScanResults.length === 0 ? (
                  <p className="text-center text-purple-300 py-8">
                    No findings to generate evidence packets for.
                  </p>
                ) : (
                  <>
                    {profileSocialFindings.map((finding, idx) => (
                      <div key={`social-${idx}`} className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50">
                        <div>
                          <Badge className="bg-red-500/20 text-red-300 mb-1">Impersonation</Badge>
                          <p className="text-white font-medium">@{finding.suspicious_username} on {finding.platform}</p>
                          <p className="text-xs text-gray-400">Detected: {new Date(finding.detected_date || finding.created_date).toLocaleDateString()}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => generateEvidencePacket(finding, 'law_enforcement')}
                            disabled={generatingPacket === finding.id}
                            className="border-blue-500/50 text-blue-300"
                          >
                            {generatingPacket === finding.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Shield className="w-4 h-4 mr-1" />
                                Law Enforcement
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => generateEvidencePacket(finding, 'attorney')}
                            disabled={generatingPacket === finding.id}
                            className="border-purple-500/50 text-purple-300"
                          >
                            <Gavel className="w-4 h-4 mr-1" />
                            Attorney
                          </Button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Victim Rights Tab */}
        <TabsContent value="rights">
          <Card className="glass-card border-purple-500/30">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-400" />
                Your Rights as a Victim
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {victimRights.map((right, idx) => (
                  <div key={idx} className="p-4 rounded-lg bg-slate-800/50 border border-green-500/20">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="text-white font-medium">{right.title}</h3>
                        <p className="text-sm text-gray-400 mt-1">{right.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Legal Next Steps Tab */}
        <TabsContent value="next_steps">
          <Card className="glass-card border-purple-500/30">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                Legal Next Steps
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {legalNextSteps.map((item, idx) => (
                  <div key={idx} className="flex gap-4 p-4 rounded-lg bg-slate-800/50">
                    <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold">{item.step}</span>
                    </div>
                    <div>
                      <h3 className="text-white font-medium">{item.title}</h3>
                      <p className="text-sm text-gray-400">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}