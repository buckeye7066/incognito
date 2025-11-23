import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings as SettingsIcon, Bell, Shield, Trash2 } from 'lucide-react';

export default function Settings() {
  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">Settings</h1>
        <p className="text-purple-300">Configure your privacy preferences</p>
      </div>

      {/* Scan Settings */}
      <Card className="glass-card border-purple-500/30">
        <CardHeader className="border-b border-purple-500/20">
          <CardTitle className="text-white flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-purple-400" />
            Scan Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white mb-1">Automatic Scans</p>
              <p className="text-sm text-purple-300">Enable scheduled scanning</p>
            </div>
            <Switch />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white mb-1">Scan Frequency</p>
              <p className="text-sm text-purple-300">How often to check for exposures</p>
            </div>
            <Select defaultValue="weekly">
              <SelectTrigger className="w-40 bg-slate-900/50 border-purple-500/30 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white mb-1">Deep Web Scanning</p>
              <p className="text-sm text-purple-300">Include deep web sources (slower)</p>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="glass-card border-purple-500/30">
        <CardHeader className="border-b border-purple-500/20">
          <CardTitle className="text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-purple-400" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white mb-1">New Findings Alerts</p>
              <p className="text-sm text-purple-300">Get notified of new exposures</p>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white mb-1">High Risk Alerts</p>
              <p className="text-sm text-purple-300">Immediate alerts for critical risks</p>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white mb-1">Deletion Updates</p>
              <p className="text-sm text-purple-300">Updates on removal requests</p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* Privacy */}
      <Card className="glass-card border-purple-500/30">
        <CardHeader className="border-b border-purple-500/20">
          <CardTitle className="text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-400" />
            Privacy & Security
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white mb-1">Data Encryption</p>
              <p className="text-sm text-purple-300">AES-256 encryption (always enabled)</p>
            </div>
            <div className="px-3 py-1 rounded-full bg-green-500/20 text-green-300 text-sm font-semibold">
              Active
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white mb-1">Two-Factor Authentication</p>
              <p className="text-sm text-purple-300">Add an extra layer of security</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-purple-500/50 text-purple-300"
            >
              Enable
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="glass-card border-red-500/30">
        <CardHeader className="border-b border-red-500/20">
          <CardTitle className="text-white flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-400" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white mb-1">Clear All Scan Results</p>
              <p className="text-sm text-purple-300">Remove all findings from the database</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-red-500/50 text-red-300 hover:bg-red-500/10"
            >
              Clear Results
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white mb-1">Delete All Data</p>
              <p className="text-sm text-purple-300">Permanently erase everything (30 sec retention)</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-red-500/50 text-red-300 hover:bg-red-500/10"
            >
              Wipe All
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}