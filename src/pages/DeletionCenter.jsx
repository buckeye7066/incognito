import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Mail, FileText, CheckCircle2, Clock, AlertCircle, RefreshCw, X } from 'lucide-react';
import { motion } from 'framer-motion';
import AutomatedTracking from '../components/deletion/AutomatedTracking';
import BulkDeletionPanel from '../components/deletion/BulkDeletionPanel';
import PlatformDeletionGuide from '../components/deletion/PlatformDeletionGuide';

export default function DeletionCenter() {
  const queryClient = useQueryClient();
  const [selectedResult, setSelectedResult] = useState(null);
  const [checkingResponses, setCheckingResponses] = useState(false);
  const [formData, setFormData] = useState({
    removal_method: 'email_request',
    contact_email: '',
    notes: ''
  });

  const activeProfileId = typeof window !== 'undefined' ? window.activeProfileId : null;

  const { data: allScanResults = [] } = useQuery({
    queryKey: ['scanResults'],
    queryFn: () => base44.entities.ScanResult.list()
  });

  const { data: allDeletionRequests = [] } = useQuery({
    queryKey: ['deletionRequests'],
    queryFn: () => base44.entities.DeletionRequest.list()
  });

  const scanResults = allScanResults.filter(r => !activeProfileId || r.profile_id === activeProfileId);
  const deletionRequests = allDeletionRequests.filter(r => !activeProfileId || r.profile_id === activeProfileId);

  const { data: allResponses = [] } = useQuery({
    queryKey: ['deletionEmailResponses'],
    queryFn: () => base44.entities.DeletionEmailResponse.list()
  });

  const responses = allResponses.filter(r => {
    const req = deletionRequests.find(d => d.id === r.deletion_request_id);
    return req && (!activeProfileId || req.profile_id === activeProfileId);
  });

  const createRequestMutation = useMutation({
    mutationFn: (data) => base44.entities.DeletionRequest.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['deletionRequests']);
      queryClient.invalidateQueries(['scanResults']);
      setSelectedResult(null);
      setFormData({ removal_method: 'email_request', contact_email: '', notes: '' });
    }
  });

  const updateRequestMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DeletionRequest.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['deletionRequests']);
    }
  });

  const deleteRequestMutation = useMutation({
    mutationFn: (id) => base44.entities.DeletionRequest.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['deletionRequests']);
    }
  });

  const [deletingFailed, setDeletingFailed] = useState(false);
  
  const deleteAllFailedRequests = async () => {
    const failedRequests = deletionRequests.filter(r => r.status === 'failed');
    if (failedRequests.length === 0) {
      alert('No failed requests to delete');
      return;
    }
    
    if (!confirm(`Delete ${failedRequests.length} failed requests?`)) return;
    
    setDeletingFailed(true);
    try {
      for (const req of failedRequests) {
        await base44.entities.DeletionRequest.delete(req.id);
      }
      queryClient.invalidateQueries(['deletionRequests']);
    } catch (error) {
      alert('Error deleting requests: ' + error.message);
    } finally {
      setDeletingFailed(false);
    }
  };

  const removalCandidates = scanResults.filter(
    r => r.status === 'removal_requested' || r.status === 'new' || r.status === 'monitoring'
  );

  const handleCreateRequest = async () => {
    if (!selectedResult) return;
    if (!activeProfileId) {
      alert('Please select a profile first');
      return;
    }

    await createRequestMutation.mutateAsync({
      profile_id: activeProfileId,
      scan_result_id: selectedResult.id,
      removal_method: formData.removal_method,
      contact_email: formData.contact_email,
      notes: formData.notes,
      status: 'pending',
      request_date: new Date().toISOString().split('T')[0]
    });

    // Update scan result status
    await base44.entities.ScanResult.update(selectedResult.id, {
      status: 'removal_requested'
    });
  };

  const generateTemplate = (result, format = 'email') => {
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const companyName = result?.source_name || 'Data Broker';
    
    if (format === 'fax') {
      return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                                    FAX TRANSMISSION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TO:         ${companyName} - Data Privacy Officer / Legal Department
FAX:        [ENTER FAX NUMBER HERE]
FROM:       [Your Full Name]
DATE:       ${today}
PAGES:      2 (including cover)
RE:         URGENT: Data Removal Request Under CCPA/GDPR

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

                           DATA REMOVAL REQUEST LETTER

${today}

${companyName}
Attention: Data Privacy Officer / Legal Department
[Company Address - if known]

RE: IMMEDIATE DATA REMOVAL REQUEST UNDER CCPA/GDPR

Dear Sir or Madam:

I am writing to formally request the immediate and permanent removal of all my personal 
information from your database, website, and any affiliated systems.

AFFECTED SOURCE INFORMATION:
• Company/Website: ${companyName}
• URL/Location: ${result?.source_url || 'See attached documentation'}
• Source Type: ${result?.source_type?.replace(/_/g, ' ').toUpperCase() || 'Data Broker/Public Records'}

LEGAL BASIS FOR REQUEST:
I am exercising my rights under:
✓ California Consumer Privacy Act (CCPA) - Right to Deletion (§1798.105)
✓ General Data Protection Regulation (GDPR) - Article 17 (Right to Erasure)
✓ Other applicable state and federal privacy laws

REQUESTED ACTIONS:
1. Remove all personal data associated with my identity from your systems
2. Cease any further collection, use, or sale of my personal information
3. Notify all third parties with whom you've shared my data to delete it
4. Provide written confirmation of complete data removal within 30 days

PERSONAL INFORMATION TO BE REMOVED:
${result?.data_exposed?.map(d => `• ${d.replace(/_/g, ' ')}`).join('\n') || '• All personal information on file'}

I do NOT consent to the retention, use, or sale of my personal information for any purpose.

COMPLIANCE DEADLINE:
Please respond within 10 business days confirming receipt and provide a timeline for 
complete removal. Failure to comply may result in filing a complaint with the appropriate 
regulatory authorities.

VERIFICATION:
Please contact me at the email/phone number below to verify my identity if needed.

Contact Information:
Email: [Your Email]
Phone: [Your Phone]

I expect full compliance with this request. Thank you for your immediate attention.

Sincerely,

_______________________________
[Your Printed Name]
[Your Signature - if mailing/faxing]


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONFIDENTIAL: This fax contains confidential information intended only for the recipient.
If received in error, please destroy and notify sender immediately.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    }
    
    // Email format
    return `SUBJECT: URGENT: Data Removal Request Under CCPA/GDPR - [Your Name]

────────────────────────────────────────────────────────────────

${today}

To: Data Privacy Officer / Legal Department
${companyName}

RE: IMMEDIATE DATA REMOVAL REQUEST

Dear Sir or Madam,

I am writing to formally request the immediate and permanent removal of all my personal information from your database, website, and any affiliated systems.

AFFECTED SOURCE INFORMATION:
• Company/Website: ${companyName}
• URL/Location: ${result?.source_url || 'Not specified'}
• Source Type: ${result?.source_type?.replace(/_/g, ' ').toUpperCase() || 'Data Broker/Public Records'}

LEGAL BASIS FOR REQUEST:
I am exercising my rights under:
✓ California Consumer Privacy Act (CCPA) - Right to Deletion (§1798.105)
✓ General Data Protection Regulation (GDPR) - Article 17 (Right to Erasure)  
✓ Other applicable state and federal privacy laws

REQUESTED ACTIONS:
1. Remove all personal data associated with my identity from your systems
2. Cease any further collection, use, or sale of my personal information
3. Notify all third parties with whom you've shared my data to delete it
4. Provide written confirmation of complete data removal within 30 days

PERSONAL INFORMATION TO BE REMOVED:
${result?.data_exposed?.map(d => `• ${d.replace(/_/g, ' ')}`).join('\n') || '• All personal information on file'}

I do NOT consent to the retention, use, or sale of my personal information for any purpose.

COMPLIANCE DEADLINE:
Please respond within 10 business days confirming receipt and provide a timeline for complete removal. Failure to comply may result in filing a complaint with the appropriate regulatory authorities including the California Attorney General and relevant data protection authorities.

VERIFICATION:
If you need to verify my identity, please contact me at:
• Email: [Your Email Address]
• Phone: [Your Phone Number]

I expect full compliance with this request and look forward to your prompt confirmation.

Sincerely,

[Your Full Name]
[Your Address - optional]
[Your Email]
[Your Phone]

────────────────────────────────────────────────────────────────
IMPORTANT: This is a formal legal request. Please retain for your records.`;
  };

  const checkDeletionResponses = async () => {
    if (!activeProfileId) {
      alert('Please select a profile first');
      return;
    }

    setCheckingResponses(true);
    try {
      const response = await base44.functions.invoke('monitorDeletionResponses', { profileId: activeProfileId });
      alert(`Found ${response.data.responsesDetected} new responses from data brokers!`);
      queryClient.invalidateQueries(['deletionEmailResponses']);
      queryClient.invalidateQueries(['deletionRequests']);
    } catch (error) {
      alert('Failed to check responses: ' + error.message);
    } finally {
      setCheckingResponses(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-400" />;
      case 'pending':
      case 'in_progress':
        return <Clock className="w-5 h-5 text-amber-400" />;
      case 'failed':
      case 'requires_action':
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      default:
        return <Mail className="w-5 h-5 text-purple-400" />;
    }
  };

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Deletion Center</h1>
          <p className="text-purple-300">Request removal of your data from exposed sources</p>
        </div>
        <Button
          onClick={checkDeletionResponses}
          disabled={checkingResponses}
          variant="outline"
          className="bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600"
        >
          <RefreshCw className={`w-5 h-5 mr-2 ${checkingResponses ? 'animate-spin' : ''}`} />
          {checkingResponses ? 'Checking...' : 'Check Responses'}
        </Button>
      </div>

      {/* Automated Response Tracking */}
      <AutomatedTracking
        responses={responses}
        onRefresh={checkDeletionResponses}
        refreshing={checkingResponses}
        profileId={activeProfileId}
      />

      {/* Platform-Specific Deletion Guide */}
      <PlatformDeletionGuide
        platforms={scanResults.filter(r => {
          const src = r.source_name?.toLowerCase() || '';
          return ['twitter', 'x.com', 'facebook', 'instagram', 'linkedin', 'tiktok', 'snapchat', 'reddit'].some(p => src.includes(p));
        })}
        profileId={activeProfileId}
      />

      {/* Bulk Deletion Panel */}
      <BulkDeletionPanel
        scanResults={scanResults}
        profileId={activeProfileId}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create Request */}
        <Card className="glass-card border-purple-500/30">
          <CardHeader className="border-b border-purple-500/20">
            <CardTitle className="text-white flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-purple-400" />
              Create Removal Request
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-purple-200">Select Finding</label>
              <Select
                value={selectedResult?.id || ''}
                onValueChange={(id) => setSelectedResult(removalCandidates.find(r => r.id === id))}
              >
                <SelectTrigger className="bg-slate-900/50 border-purple-500/30 text-white">
                  <SelectValue placeholder="Choose an exposure to remove" />
                </SelectTrigger>
                <SelectContent>
                  {removalCandidates.map((result) => (
                    <SelectItem key={result.id} value={result.id}>
                      {result.source_name} (Risk: {result.risk_score})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedResult && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-purple-200">Removal Method</label>
                  <Select
                    value={formData.removal_method}
                    onValueChange={(value) => setFormData({ ...formData, removal_method: value })}
                  >
                    <SelectTrigger className="bg-slate-900/50 border-purple-500/30 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email_request">Email Request</SelectItem>
                      <SelectItem value="form_submission">Form Submission</SelectItem>
                      <SelectItem value="manual_contact">Manual Contact</SelectItem>
                      <SelectItem value="legal_request">Legal Request</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-purple-200">Contact Email</label>
                  <input
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                    placeholder="privacy@example.com"
                    className="w-full px-3 py-2 bg-slate-900/50 border border-purple-500/30 rounded-lg text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-purple-200">Template Letter</label>
                  <Textarea
                    value={generateTemplate(selectedResult)}
                    readOnly
                    className="bg-slate-900/50 border-purple-500/30 text-white font-mono text-sm h-48"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const emailTemplate = generateTemplate(selectedResult, 'email');
                        navigator.clipboard.writeText(emailTemplate);
                        alert('✓ Email template copied!\n\nPaste into your email and fill in [Your Name], [Your Email], etc.');
                      }}
                      className="bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600"
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Copy Email
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const faxTemplate = generateTemplate(selectedResult, 'fax');
                        navigator.clipboard.writeText(faxTemplate);
                        alert('✓ Fax template copied!\n\nPrint and fax, or paste into online fax service.\nFill in [Your Name], fax number, etc.');
                      }}
                      className="bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Copy Fax
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-purple-200">Notes</label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Add any additional notes about this request..."
                    className="bg-slate-900/50 border-purple-500/30 text-white"
                  />
                </div>

                <Button
                  onClick={handleCreateRequest}
                  disabled={createRequestMutation.isPending}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600"
                >
                  {createRequestMutation.isPending ? 'Creating...' : 'Create Removal Request'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Active Requests */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Active Requests</h2>
            {deletionRequests.filter(r => r.status === 'failed').length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={deleteAllFailedRequests}
                disabled={deletingFailed}
                className="bg-red-600/20 border-red-500/50 text-red-300 hover:bg-red-600/30"
              >
                {deletingFailed ? (
                  <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <X className="w-4 h-4 mr-1" />
                )}
                {deletingFailed ? 'Deleting...' : `Clear Failed (${deletionRequests.filter(r => r.status === 'failed').length})`}
              </Button>
            )}
          </div>
          {deletionRequests.length > 0 ? (
            deletionRequests.map((request) => {
              const relatedResult = scanResults.find(r => r.id === request.scan_result_id);
              return (
                <motion.div
                  key={request.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <Card className="glass-card border-purple-500/20">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(request.status)}
                          <div>
                            <h3 className="font-semibold text-white">
                              {relatedResult?.source_name || request.notes?.split(' ')[0] || 'Data Broker Request'}
                            </h3>
                            <p className="text-xs text-purple-400">
                              {new Date(request.request_date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          request.status === 'completed' ? 'bg-green-500/20 text-green-300' :
                          request.status === 'failed' ? 'bg-red-500/20 text-red-300' :
                          'bg-amber-500/20 text-amber-300'
                        }`}>
                          {request.status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </div>

                      <p className="text-sm text-purple-300 mb-1">
                        Method: {request.removal_method?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </p>
                      
                      {request.contact_email && (
                        <p className="text-xs text-gray-400 mb-1">
                          Contact: {request.contact_email}
                        </p>
                      )}
                      
                      {request.response_received && (
                        <p className="text-xs text-gray-400 mb-3">
                          {request.response_received}
                        </p>
                      )}

                      <div className="flex gap-2 mt-3">
                        {request.status !== 'completed' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateRequestMutation.mutate({
                                id: request.id,
                                data: { status: 'in_progress' }
                              })}
                              className="bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600"
                            >
                              Mark In Progress
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateRequestMutation.mutate({
                                id: request.id,
                                data: { 
                                  status: 'completed',
                                  completion_date: new Date().toISOString().split('T')[0]
                                }
                              })}
                              className="bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600"
                            >
                              Mark Complete
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm('Delete this request?')) {
                              deleteRequestMutation.mutate(request.id);
                            }
                          }}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          ) : (
            <Card className="glass-card border-purple-500/20">
              <CardContent className="p-8 text-center">
                <Trash2 className="w-12 h-12 text-purple-500 mx-auto mb-3" />
                <p className="text-purple-300">No deletion requests yet</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}