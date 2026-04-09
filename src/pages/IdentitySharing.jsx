import React, { useState } from 'react';
import { incognito } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Share2, Plus, Copy, Trash2, Link, Lock, Clock, Eye, Shield, Ban, Key, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function IdentitySharing() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showAccess, setShowAccess] = useState(false);
  const [selectedIdentity, setSelectedIdentity] = useState('');
  const [selectedFields, setSelectedFields] = useState([]);
  const [sharePassword, setSharePassword] = useState('');
  const [expiresHours, setExpiresHours] = useState('24');
  const [createdShare, setCreatedShare] = useState(null);
  const [accessShareId, setAccessShareId] = useState('');
  const [accessPassword, setAccessPassword] = useState('');
  const [accessedData, setAccessedData] = useState(null);

  const { data: identities = [] } = useQuery({
    queryKey: ['cloakedIdentities'],
    queryFn: () => incognito.entities.CloakedIdentity.list('-created_date'),
  });

  const { data: sharedLinks = [], isLoading } = useQuery({
    queryKey: ['sharedIdentities'],
    queryFn: () => incognito.entities.SharedIdentity.list('-created_date'),
  });

  const createShareMutation = useMutation({
    mutationFn: () => incognito.functions.invoke('createShareLink', {
      identityId: selectedIdentity,
      fields: selectedFields,
      expiresInHours: parseInt(expiresHours) || 24,
      password: sharePassword || undefined,
    }),
    onSuccess: (result) => {
      setCreatedShare(result.data);
      queryClient.invalidateQueries(['sharedIdentities']);
    },
  });

  const accessShareMutation = useMutation({
    mutationFn: () => incognito.functions.invoke('accessShareLink', {
      shareId: accessShareId, password: accessPassword,
    }),
    onSuccess: (result) => setAccessedData(result.data),
  });

  const revokeMutation = useMutation({
    mutationFn: (shareId) => incognito.functions.invoke('revokeShareLink', { shareId }),
    onSuccess: () => queryClient.invalidateQueries(['sharedIdentities']),
  });

  const copyToClipboard = (text) => navigator.clipboard.writeText(text);

  const toggleField = (field) => {
    setSelectedFields(prev => prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]);
  };

  const isExpired = (share) => new Date(share.expires_at) < new Date();
  const activeShares = sharedLinks.filter(s => s.status === 'active' && !isExpired(s));
  const expiredShares = sharedLinks.filter(s => s.status !== 'active' || isExpired(s));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Share2 className="h-8 w-8 text-primary" />
            Identity Sharing
          </h1>
          <p className="text-muted-foreground mt-1">
            Share credentials securely via encrypted, time-limited, password-protected links.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowAccess(true)} className="gap-2">
            <Key className="h-4 w-4" /> Access Shared Link
          </Button>
          <Dialog open={showCreate} onOpenChange={(v) => { setShowCreate(v); if (!v) setCreatedShare(null); }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Share Identity</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Create Secure Share Link</DialogTitle></DialogHeader>
              {!createdShare ? (
                <div className="space-y-4">
                  <div>
                    <Label>Select Identity to Share</Label>
                    <Select value={selectedIdentity} onValueChange={setSelectedIdentity}>
                      <SelectTrigger><SelectValue placeholder="Choose an identity..." /></SelectTrigger>
                      <SelectContent>
                        {identities.map(i => (
                          <SelectItem key={i.id} value={i.id}>{i.service_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedIdentity && (
                    <div>
                      <Label>Fields to Share</Label>
                      <div className="space-y-2 mt-2">
                        {['email', 'phone', 'password'].map(field => (
                          <div key={field} className="flex items-center gap-2">
                            <Checkbox checked={selectedFields.includes(field)}
                              onCheckedChange={() => toggleField(field)} />
                            <span className="capitalize">{field}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <Label>Expires After</Label>
                    <Select value={expiresHours} onValueChange={setExpiresHours}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 hour</SelectItem>
                        <SelectItem value="6">6 hours</SelectItem>
                        <SelectItem value="24">24 hours</SelectItem>
                        <SelectItem value="72">3 days</SelectItem>
                        <SelectItem value="168">7 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Password Protection (optional)</Label>
                    <Input type="password" placeholder="Set a password for the link"
                      value={sharePassword} onChange={(e) => setSharePassword(e.target.value)} />
                    <p className="text-xs text-muted-foreground mt-1">
                      If blank, a random password is generated and shown to you.
                    </p>
                  </div>

                  <Button className="w-full" onClick={() => createShareMutation.mutate()}
                    disabled={!selectedIdentity || selectedFields.length === 0 || createShareMutation.isPending}>
                    {createShareMutation.isPending ? 'Encrypting...' : 'Create Secure Link'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
                    <Shield className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <h3 className="font-semibold text-green-600">Share Link Created!</h3>
                  </div>

                  <div>
                    <Label>Share ID</Label>
                    <div className="flex gap-2">
                      <Input readOnly value={createdShare.shareId} className="font-mono text-sm" />
                      <Button variant="outline" size="icon" onClick={() => copyToClipboard(createdShare.shareId)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label>Password</Label>
                    <div className="flex gap-2">
                      <Input readOnly value={createdShare.password} className="font-mono text-sm" />
                      <Button variant="outline" size="icon" onClick={() => copyToClipboard(createdShare.password)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Expires: {new Date(createdShare.expiresAt).toLocaleString()}
                  </div>

                  <div className="p-3 bg-yellow-500/10 rounded-lg text-xs text-yellow-700">
                    Share the ID and password separately for maximum security. This information will not be shown again.
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="glass-card">
          <CardContent className="pt-4 pb-3 text-center">
            <Link className="h-5 w-5 mx-auto mb-1 text-primary" />
            <div className="text-2xl font-bold">{sharedLinks.length}</div>
            <div className="text-xs text-muted-foreground">Total Shares</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="pt-4 pb-3 text-center">
            <Shield className="h-5 w-5 mx-auto mb-1 text-green-500" />
            <div className="text-2xl font-bold">{activeShares.length}</div>
            <div className="text-xs text-muted-foreground">Active Links</div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="pt-4 pb-3 text-center">
            <Clock className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <div className="text-2xl font-bold">{expiredShares.length}</div>
            <div className="text-xs text-muted-foreground">Expired/Revoked</div>
          </CardContent>
        </Card>
      </div>

      {/* Active Shared Links */}
      {activeShares.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Active Share Links</h2>
          <div className="space-y-2">
            {activeShares.map(share => {
              const identity = identities.find(i => i.id === share.identity_id);
              return (
                <Card key={share.id}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Share2 className="h-5 w-5 text-green-500" />
                        <div>
                          <div className="font-medium">{identity?.service_name || 'Unknown Identity'}</div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="font-mono">{share.share_id}</span>
                            <span>Accessed: {share.access_count}/{share.max_accesses}</span>
                            <span>Expires: {new Date(share.expires_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {share.password_protected && <Lock className="h-3 w-3 text-muted-foreground" />}
                        <Button variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => copyToClipboard(share.share_id)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                          onClick={() => revokeMutation.mutate(share.share_id)}>
                          <Ban className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* History */}
      {expiredShares.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">History</h2>
          <div className="space-y-2">
            {expiredShares.map(share => {
              const identity = identities.find(i => i.id === share.identity_id);
              return (
                <Card key={share.id} className="opacity-50">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Share2 className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <span className="font-medium">{identity?.service_name || 'Unknown'}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {share.status === 'revoked' ? 'Revoked' : 'Expired'} — {share.access_count} accesses
                          </span>
                        </div>
                      </div>
                      <Badge variant="secondary">{share.status === 'revoked' ? 'Revoked' : 'Expired'}</Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {sharedLinks.length === 0 && !isLoading && (
        <Card className="p-12 text-center">
          <Share2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold mb-2">No Shared Links</h3>
          <p className="text-muted-foreground mb-4">
            Share credentials securely with end-to-end encryption, time limits, and password protection.
          </p>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Share2 className="h-4 w-4" /> Share an Identity
          </Button>
        </Card>
      )}

      {/* Access Share Dialog */}
      <Dialog open={showAccess} onOpenChange={(v) => { setShowAccess(v); if (!v) setAccessedData(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Access Shared Identity</DialogTitle></DialogHeader>
          {!accessedData ? (
            <div className="space-y-4">
              <div>
                <Label>Share ID</Label>
                <Input placeholder="Enter the share ID" value={accessShareId}
                  onChange={(e) => setAccessShareId(e.target.value)} className="font-mono" />
              </div>
              <div>
                <Label>Password</Label>
                <Input type="password" placeholder="Enter the share password" value={accessPassword}
                  onChange={(e) => setAccessPassword(e.target.value)} />
              </div>
              <Button className="w-full" onClick={() => accessShareMutation.mutate()}
                disabled={!accessShareId || !accessPassword || accessShareMutation.isPending}>
                {accessShareMutation.isPending ? 'Decrypting...' : 'Access Shared Data'}
              </Button>
              {accessShareMutation.isError && (
                <p className="text-sm text-red-500">{accessShareMutation.error?.message || 'Access failed'}</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-green-500/10 rounded-lg text-center">
                <Shield className="h-6 w-6 mx-auto mb-1 text-green-500" />
                <p className="text-sm font-medium">Decrypted Successfully</p>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">{accessedData.service_name}</div>
                {Object.entries(accessedData.fields || {}).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="text-sm text-muted-foreground capitalize">{key}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">{value}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(value)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
