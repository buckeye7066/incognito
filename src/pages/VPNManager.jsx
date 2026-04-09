import React, { useState, useEffect } from 'react';
import { incognito } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Globe, Plus, Trash2, Shield, Wifi, WifiOff, MapPin, Server, Lock, AlertTriangle, CheckCircle, RefreshCw, Activity } from 'lucide-react';
import { motion } from 'framer-motion';

const VPN_PROVIDERS = [
  { name: 'WireGuard', type: 'wireguard', description: 'Modern, fast, minimal attack surface' },
  { name: 'OpenVPN', type: 'openvpn', description: 'Widely supported, highly configurable' },
  { name: 'IKEv2/IPSec', type: 'ikev2', description: 'Fast reconnection, great for mobile' },
];

const SERVER_REGIONS = [
  { region: 'US East', city: 'New York', flag: 'US' },
  { region: 'US West', city: 'Los Angeles', flag: 'US' },
  { region: 'Europe', city: 'Amsterdam', flag: 'NL' },
  { region: 'UK', city: 'London', flag: 'GB' },
  { region: 'Asia Pacific', city: 'Tokyo', flag: 'JP' },
  { region: 'Asia Pacific', city: 'Singapore', flag: 'SG' },
  { region: 'Canada', city: 'Toronto', flag: 'CA' },
  { region: 'Australia', city: 'Sydney', flag: 'AU' },
  { region: 'Europe', city: 'Frankfurt', flag: 'DE' },
  { region: 'Nordic', city: 'Stockholm', flag: 'SE' },
];

export default function VPNManager() {
  const queryClient = useQueryClient();
  const [showAddConfig, setShowAddConfig] = useState(false);
  const [currentIP, setCurrentIP] = useState(null);
  const [ipLoading, setIpLoading] = useState(false);
  const [killSwitch, setKillSwitch] = useState(() => localStorage.getItem('vpn_kill_switch') === 'true');
  const [autoConnect, setAutoConnect] = useState(() => localStorage.getItem('vpn_auto_connect') === 'true');
  const [selectedServer, setSelectedServer] = useState(null);
  const [configForm, setConfigForm] = useState({ name: '', type: 'wireguard', config_data: '' });

  const { data: vpnConfigs = [], isLoading } = useQuery({
    queryKey: ['vpnConfigs'],
    queryFn: () => incognito.entities.VPNConfig.list('-created_date'),
  });

  const activeConfig = vpnConfigs.find(c => c.status === 'connected');

  const checkIP = async () => {
    setIpLoading(true);
    try {
      const result = await incognito.functions.invoke('checkIPLeak');
      setCurrentIP(result.data);
    } catch (e) {
      setCurrentIP({ ip: 'Error', error: e.message });
    }
    setIpLoading(false);
  };

  useEffect(() => { checkIP(); }, []);

  const saveMutation = useMutation({
    mutationFn: (data) => incognito.functions.invoke('saveVPNConfig', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['vpnConfigs']);
      setShowAddConfig(false);
      setConfigForm({ name: '', type: 'wireguard', config_data: '' });
    },
  });

  const connectMutation = useMutation({
    mutationFn: async (configId) => {
      // Disconnect any active connection first
      for (const cfg of vpnConfigs) {
        if (cfg.status === 'connected') {
          await incognito.entities.VPNConfig.update(cfg.id, { status: 'disconnected' });
        }
      }
      await incognito.entities.VPNConfig.update(configId, {
        status: 'connected',
        last_connected: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['vpnConfigs']);
      checkIP();
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (configId) => {
      await incognito.entities.VPNConfig.update(configId, { status: 'disconnected' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['vpnConfigs']);
      checkIP();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => incognito.entities.VPNConfig.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['vpnConfigs']),
  });

  const toggleKillSwitch = (v) => {
    setKillSwitch(v);
    localStorage.setItem('vpn_kill_switch', v.toString());
  };

  const toggleAutoConnect = (v) => {
    setAutoConnect(v);
    localStorage.setItem('vpn_auto_connect', v.toString());
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Globe className="h-8 w-8 text-primary" />
            VPN Manager
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage VPN configurations, check for IP leaks, and control encrypted browsing.
          </p>
        </div>
        <Dialog open={showAddConfig} onOpenChange={setShowAddConfig}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Add Config</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add VPN Configuration</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Configuration Name</Label>
                <Input placeholder="e.g., Home VPN, Work VPN" value={configForm.name}
                  onChange={(e) => setConfigForm(d => ({ ...d, name: e.target.value }))} />
              </div>
              <div>
                <Label>Protocol</Label>
                <Select value={configForm.type} onValueChange={(v) => setConfigForm(d => ({ ...d, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VPN_PROVIDERS.map(p => (
                      <SelectItem key={p.type} value={p.type}>
                        {p.name} — {p.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Configuration File Contents</Label>
                <Textarea placeholder="Paste your WireGuard/OpenVPN config here..."
                  value={configForm.config_data} className="font-mono text-xs min-h-[200px]"
                  onChange={(e) => setConfigForm(d => ({ ...d, config_data: e.target.value }))} />
              </div>
              <Button className="w-full" onClick={() => saveMutation.mutate(configForm)}
                disabled={!configForm.name || !configForm.config_data || saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : 'Save Configuration'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Connection Status */}
      <Card className={`border-2 ${activeConfig ? 'border-green-500/50 bg-green-500/5' : 'border-red-500/50 bg-red-500/5'}`}>
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {activeConfig ? (
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Shield className="h-6 w-6 text-green-500" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                  <WifiOff className="h-6 w-6 text-red-500" />
                </div>
              )}
              <div>
                <h2 className="text-xl font-bold">
                  {activeConfig ? 'Connected' : 'Not Connected'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {activeConfig ? `Active: ${activeConfig.name} (${activeConfig.type})` : 'Your traffic is not encrypted'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4" />
                <span>IP: {ipLoading ? 'Checking...' : (currentIP?.ip || 'Unknown')}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={checkIP} disabled={ipLoading}>
                  <RefreshCw className={`h-3 w-3 ${ipLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              {activeConfig && (
                <Button variant="destructive" size="sm" className="mt-2"
                  onClick={() => disconnectMutation.mutate(activeConfig.id)}>
                  Disconnect
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settings Row */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="py-4 flex items-center justify-between">
            <div>
              <h3 className="font-medium">Kill Switch</h3>
              <p className="text-xs text-muted-foreground">Block internet if VPN disconnects</p>
            </div>
            <Switch checked={killSwitch} onCheckedChange={toggleKillSwitch} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center justify-between">
            <div>
              <h3 className="font-medium">Auto-Connect</h3>
              <p className="text-xs text-muted-foreground">Connect VPN on app launch</p>
            </div>
            <Switch checked={autoConnect} onCheckedChange={toggleAutoConnect} />
          </CardContent>
        </Card>
      </div>

      {/* Server Selection */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Server Locations</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {SERVER_REGIONS.map((server, i) => (
            <Card key={i} className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 ${selectedServer === i ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setSelectedServer(i)}>
              <CardContent className="py-3 text-center">
                <span className="text-2xl">{server.flag === 'US' ? '\uD83C\uDDFA\uD83C\uDDF8' : server.flag === 'NL' ? '\uD83C\uDDF3\uD83C\uDDF1' : server.flag === 'GB' ? '\uD83C\uDDEC\uD83C\uDDE7' : server.flag === 'JP' ? '\uD83C\uDDEF\uD83C\uDDF5' : server.flag === 'SG' ? '\uD83C\uDDF8\uD83C\uDDEC' : server.flag === 'CA' ? '\uD83C\uDDE8\uD83C\uDDE6' : server.flag === 'AU' ? '\uD83C\uDDE6\uD83C\uDDFA' : server.flag === 'DE' ? '\uD83C\uDDE9\uD83C\uDDEA' : server.flag === 'SE' ? '\uD83C\uDDF8\uD83C\uDDEA' : '\uD83C\uDF10'}</span>
                <div className="text-sm font-medium mt-1">{server.city}</div>
                <div className="text-xs text-muted-foreground">{server.region}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Saved Configurations */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Saved Configurations</h2>
        {vpnConfigs.length > 0 ? (
          <div className="space-y-2">
            {vpnConfigs.map(config => (
              <Card key={config.id}>
                <CardContent className="py-3 px-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Server className={`h-5 w-5 ${config.status === 'connected' ? 'text-green-500' : 'text-muted-foreground'}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{config.name}</span>
                        <Badge variant="outline">{config.type}</Badge>
                        <Badge variant={config.status === 'connected' ? 'default' : 'secondary'}>{config.status}</Badge>
                      </div>
                      {config.last_connected && (
                        <p className="text-xs text-muted-foreground">
                          Last connected: {new Date(config.last_connected).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {config.status !== 'connected' ? (
                      <Button size="sm" onClick={() => connectMutation.mutate(config.id)}>Connect</Button>
                    ) : (
                      <Button size="sm" variant="destructive" onClick={() => disconnectMutation.mutate(config.id)}>Disconnect</Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-destructive"
                      onClick={() => deleteMutation.mutate(config.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <Server className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-muted-foreground text-sm">
              No VPN configurations saved. Add a WireGuard or OpenVPN config to get started.
            </p>
          </Card>
        )}
      </div>

      {/* IP Leak Test Results */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" /> IP Leak Test
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className={`text-lg font-mono ${activeConfig ? 'text-green-500' : 'text-yellow-500'}`}>
                {currentIP?.ip || '—'}
              </div>
              <div className="text-xs text-muted-foreground">Your IP Address</div>
            </div>
            <div>
              <div className={`flex items-center justify-center gap-1 ${activeConfig ? 'text-green-500' : 'text-red-500'}`}>
                {activeConfig ? <CheckCircle className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                <span className="text-lg font-medium">{activeConfig ? 'Protected' : 'Exposed'}</span>
              </div>
              <div className="text-xs text-muted-foreground">VPN Status</div>
            </div>
            <div>
              <Button variant="outline" onClick={checkIP} disabled={ipLoading} className="gap-2">
                <RefreshCw className={`h-4 w-4 ${ipLoading ? 'animate-spin' : ''}`} />
                Re-check
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
