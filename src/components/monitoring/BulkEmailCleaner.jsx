import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Trash2, Mail, Loader2, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function BulkEmailCleaner() {
  const [loading, setLoading] = useState(false);
  const [senderGroups, setSenderGroups] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [deleteResults, setDeleteResults] = useState(null);

  const fetchEmails = async () => {
    setLoading(true);
    setDeleteResults(null);
    try {
      const response = await base44.functions.invoke('fetchInboxEmails', {
        maxResults: 100
      });
      setSenderGroups(response.data.senderGroups || []);
    } catch (error) {
      alert('Failed to fetch emails: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async (senderGroup) => {
    const emailIds = senderGroup.emails.map(e => e.id);
    
    if (!confirm(`Delete all ${emailIds.length} emails from ${senderGroup.senderEmail}?`)) {
      return;
    }

    setDeleting(senderGroup.senderEmail);
    setDeleteResults(null);
    try {
      const response = await base44.functions.invoke('bulkDeleteEmails', {
        emailIds
      });
      
      setDeleteResults({
        sender: senderGroup.senderEmail,
        deleted: response.data.deleted,
        failed: response.data.failed
      });

      // Remove deleted sender from list
      setSenderGroups(prev => prev.filter(g => g.senderEmail !== senderGroup.senderEmail));
    } catch (error) {
      alert('Failed to delete emails: ' + error.message);
    } finally {
      setDeleting(null);
    }
  };

  const filteredGroups = senderGroups.filter(g => 
    g.senderEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.senderName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card className="glass-card border-purple-500/30">
      <CardHeader className="border-b border-purple-500/20">
        <CardTitle className="text-white flex items-center gap-2">
          <Mail className="w-5 h-5 text-purple-400" />
          Inbox Bulk Cleaner
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-blue-200 font-semibold mb-1">
                Gmail Inbox Cleanup
              </p>
              <p className="text-xs text-blue-300">
                Connect your Gmail to identify spam senders and bulk delete all emails from unwanted sources.
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={fetchEmails}
          disabled={loading}
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Scanning Inbox...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Scan My Inbox
            </>
          )}
        </Button>

        {deleteResults && (
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <p className="text-sm font-semibold text-green-300">
                Deletion Complete
              </p>
            </div>
            <p className="text-xs text-green-200">
              ✓ Deleted {deleteResults.deleted} email{deleteResults.deleted !== 1 ? 's' : ''} from {deleteResults.sender}
            </p>
            {deleteResults.failed > 0 && (
              <p className="text-xs text-amber-300 mt-1">
                ⚠ {deleteResults.failed} email{deleteResults.failed !== 1 ? 's' : ''} failed to delete
              </p>
            )}
          </div>
        )}

        {senderGroups.length > 0 && (
          <>
            <Input
              placeholder="Search by sender email or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-900/50 border-purple-500/30 text-white"
            />

            <div className="space-y-2 max-h-96 overflow-y-auto">
              <p className="text-sm text-purple-300 font-semibold">
                Found {filteredGroups.length} sender{filteredGroups.length !== 1 ? 's' : ''}
              </p>
              
              {filteredGroups.map((group) => (
                <div
                  key={group.senderEmail}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800/70 transition-colors"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white truncate">
                      {group.senderName}
                    </p>
                    <p className="text-xs text-purple-400 truncate">
                      {group.senderEmail}
                    </p>
                    <Badge className="mt-1 text-xs bg-purple-500/20 text-purple-300">
                      {group.count} email{group.count !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkDelete(group)}
                    disabled={deleting === group.senderEmail}
                    className="border-red-500/50 text-red-300 hover:bg-red-500/10"
                  >
                    {deleting === group.senderEmail ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3 h-3 mr-1" />
                        Delete All
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}

        {!loading && senderGroups.length === 0 && (
          <div className="text-center py-8 text-purple-300">
            <Mail className="w-12 h-12 text-purple-500 mx-auto mb-3" />
            <p>Click "Scan My Inbox" to get started</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}