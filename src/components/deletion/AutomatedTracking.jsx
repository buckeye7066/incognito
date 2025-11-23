import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, XCircle, AlertCircle, RefreshCw, Mail, Brain } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AutomatedTracking({ responses, onRefresh, refreshing }) {
  const getResponseIcon = (type) => {
    switch (type) {
      case 'confirmation':
        return <CheckCircle2 className="w-5 h-5 text-green-400" />;
      case 'rejection':
        return <XCircle className="w-5 h-5 text-red-400" />;
      case 'requires_action':
        return <AlertCircle className="w-5 h-5 text-amber-400" />;
      case 'in_progress':
        return <Clock className="w-5 h-5 text-blue-400" />;
      default:
        return <Mail className="w-5 h-5 text-purple-400" />;
    }
  };

  const getResponseColor = (type) => {
    switch (type) {
      case 'confirmation':
        return 'bg-green-500/20 text-green-300 border-green-500/40';
      case 'rejection':
        return 'bg-red-500/20 text-red-300 border-red-500/40';
      case 'requires_action':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'in_progress':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      default:
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
    }
  };

  return (
    <Card className="glass-card border-purple-500/30">
      <CardHeader className="border-b border-purple-500/20">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-400" />
            Automated Response Tracking
          </CardTitle>
          <Button
            onClick={onRefresh}
            disabled={refreshing}
            size="sm"
            variant="outline"
            className="border-purple-500/50 text-purple-300"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Check Emails
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
          <p className="text-sm text-purple-300">
            AI automatically monitors your inbox for responses from data brokers and updates request status. 
            It detects confirmations, rejections, and suggests next steps.
          </p>
        </div>

        {responses && responses.length > 0 ? (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-white">Recent Responses ({responses.length})</h4>
            {responses.map((response) => (
              <motion.div
                key={response.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-4 rounded-lg bg-slate-900/50 border border-purple-500/30"
              >
                <div className="flex items-start gap-3 mb-3">
                  {getResponseIcon(response.response_type)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-white text-sm">{response.subject}</p>
                      <Badge className={getResponseColor(response.response_type)}>
                        {response.response_type.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <p className="text-xs text-purple-400 mb-2">From: {response.sender_email}</p>
                    
                    {response.body_snippet && (
                      <p className="text-xs text-purple-300 italic mb-2">"{response.body_snippet.substring(0, 150)}..."</p>
                    )}

                    {response.ai_suggested_action && (
                      <div className="mt-3 p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/30">
                        <div className="flex items-start gap-2">
                          <Brain className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-semibold text-indigo-300 mb-1">AI Recommendation:</p>
                            <p className="text-xs text-indigo-200">{response.ai_suggested_action}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {response.rejection_reason && (
                      <div className="mt-2 p-2 rounded bg-red-500/10 border border-red-500/30">
                        <p className="text-xs text-red-300">
                          <strong>Rejection Reason:</strong> {response.rejection_reason}
                        </p>
                      </div>
                    )}

                    {response.alternative_contact_method && (
                      <div className="mt-2 p-2 rounded bg-amber-500/10 border border-amber-500/30">
                        <p className="text-xs text-amber-300">
                          <strong>Try:</strong> {response.alternative_contact_method}
                        </p>
                      </div>
                    )}

                    {response.confidence_score && (
                      <div className="mt-2">
                        <p className="text-xs text-purple-400">
                          AI Confidence: {response.confidence_score}%
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Mail className="w-12 h-12 text-purple-500 mx-auto mb-3 opacity-50" />
            <p className="text-purple-300 text-sm">No responses detected yet</p>
            <p className="text-purple-400 text-xs mt-1">Check your inbox to scan for broker responses</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}