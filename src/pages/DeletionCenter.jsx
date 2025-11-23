import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Mail, FileText, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function DeletionCenter() {
  const queryClient = useQueryClient();
  const [selectedResult, setSelectedResult] = useState(null);
  const [formData, setFormData] = useState({
    removal_method: 'email_request',
    contact_email: '',
    notes: ''
  });

  const { data: scanResults = [] } = useQuery({
    queryKey: ['scanResults'],
    queryFn: () => base44.entities.ScanResult.list()
  });

  const { data: deletionRequests = [] } = useQuery({
    queryKey: ['deletionRequests'],
    queryFn: () => base44.entities.DeletionRequest.list()
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

  const removalCandidates = scanResults.filter(
    r => r.status === 'removal_requested' || r.status === 'new' || r.status === 'monitoring'
  );

  const handleCreateRequest = async () => {
    if (!selectedResult) return;

    await createRequestMutation.mutateAsync({
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

  const generateTemplate = (result) => {
    return `Subject: Data Removal Request - ${result?.source_name || 'Your Service'}

Dear Data Protection Officer,

I am writing to request the removal of my personal data from your database under applicable privacy laws (GDPR Article 17, CCPA Section 1798.105).

Source: ${result?.source_name || 'N/A'}
Date Discovered: ${result?.scan_date ? new Date(result.scan_date).toLocaleDateString() : 'N/A'}

I hereby request that you:
1. Confirm what personal data you hold about me
2. Delete all of my personal data from your systems
3. Confirm completion of this request within 30 days

Please acknowledge receipt of this request and provide a timeline for completion.

Thank you for your prompt attention to this matter.

Best regards,
[Your Name]`;
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
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">Deletion Center</h1>
        <p className="text-purple-300">Request removal of your data from exposed sources</p>
      </div>

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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(generateTemplate(selectedResult));
                    }}
                    className="border-purple-500/50 text-purple-300"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Copy Template
                  </Button>
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
          <h2 className="text-2xl font-bold text-white">Active Requests</h2>
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
                              {relatedResult?.source_name || 'Unknown Source'}
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

                      <p className="text-sm text-purple-300 mb-3">
                        Method: {request.removal_method?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </p>

                      {request.status !== 'completed' && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateRequestMutation.mutate({
                              id: request.id,
                              data: { status: 'in_progress' }
                            })}
                            className="border-purple-500/50 text-purple-300"
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
                            className="border-green-500/50 text-green-300"
                          >
                            Mark Complete
                          </Button>
                        </div>
                      )}
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