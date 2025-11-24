import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ExternalLink, AlertCircle, Zap, Loader2, CheckCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const PLATFORM_GUIDES = {
  'X (formerly Twitter)': {
    name: 'X (formerly Twitter)',
    deletionUrl: 'https://twitter.com/settings/your_twitter_data/account',
    deactivateUrl: 'https://twitter.com/settings/deactivate',
    instructions: [
      'Go to Settings > Your Account > Deactivate your account',
      'Or request your data archive first: Settings > Your Account > Download an archive',
      'Account stays deactivated for 30 days before permanent deletion'
    ]
  },
  'Facebook': {
    name: 'Facebook',
    deletionUrl: 'https://www.facebook.com/help/delete_account',
    downloadUrl: 'https://www.facebook.com/dyi',
    instructions: [
      'Download your data first: Settings > Your Facebook Information > Download Your Information',
      'Delete account: Settings > Your Facebook Information > Deactivation and Deletion',
      'Account deletion is permanent after 30 days'
    ]
  },
  'Instagram': {
    name: 'Instagram',
    deletionUrl: 'https://www.instagram.com/accounts/remove/request/permanent/',
    downloadUrl: 'https://www.instagram.com/download/request/',
    instructions: [
      'Download your data first from the app or website',
      'Go to Delete Your Account page (link above)',
      'Select reason and confirm permanent deletion',
      'Data deleted within 90 days'
    ]
  },
  'LinkedIn': {
    name: 'LinkedIn',
    deletionUrl: 'https://www.linkedin.com/psettings/data-privacy',
    downloadUrl: 'https://www.linkedin.com/psettings/member-data',
    instructions: [
      'Settings > Data Privacy > Get a copy of your data',
      'Then: Settings > Account Preferences > Account Management > Close Account',
      'Account closes immediately, data deleted within 30 days'
    ]
  },
  'TikTok': {
    name: 'TikTok',
    deletionUrl: 'https://www.tiktok.com/setting/account',
    downloadUrl: 'https://www.tiktok.com/setting/download-your-data',
    instructions: [
      'Profile > Settings > Manage Account > Download Your Data',
      'Then: Settings > Manage Account > Delete Account',
      'Account deactivated for 30 days before permanent deletion'
    ]
  },
  'Reddit': {
    name: 'Reddit',
    deletionUrl: 'https://www.reddit.com/settings/data-request',
    instructions: [
      'User Settings > Privacy & Security > Request all of my data (optional)',
      'Then: User Settings > Deactivate Account',
      'Deletion is immediate and permanent'
    ]
  },
  'Snapchat': {
    name: 'Snapchat',
    deletionUrl: 'https://accounts.snapchat.com/accounts/delete_account',
    downloadUrl: 'https://accounts.snapchat.com/accounts/downloadmydata',
    instructions: [
      'Go to accounts.snapchat.com and log in',
      'Select "Download My Data" (optional)',
      'Then select "Delete My Account" and enter password',
      'Account deactivated for 30 days before deletion'
    ]
  }
};

export default function PlatformDeletionGuide({ platforms = [], profileId }) {
  const [automating, setAutomating] = useState(null);
  const [showCredentials, setShowCredentials] = useState(null);
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [results, setResults] = useState({});
  const [user, setUser] = useState(null);

  // Load user credentials
  React.useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const matchedGuides = platforms
    .map(p => {
      const sourceName = p.source_name || '';
      const guide = Object.values(PLATFORM_GUIDES).find(guide => 
        sourceName.toLowerCase().includes(guide.name.toLowerCase()) ||
        sourceName.toLowerCase().includes(guide.name.split(' ')[0].toLowerCase())
      );
      return guide ? { ...guide, scanResult: p } : null;
    })
    .filter(Boolean);

  if (matchedGuides.length === 0) return null;

  const handleAIAutomation = async (guide) => {
    if (!profileId) {
      alert('Please select a profile first');
      return;
    }

    const platform = guide.name.toLowerCase().replace(/\s+/g, '');
    const platformKey = platform.replace('(formerlytwitter)', '').replace('twitter', 'twitter');
    
    // Check if credentials exist
    const storedCreds = user?.platform_credentials?.[platformKey];
    
    if (!storedCreds && !showCredentials) {
      setShowCredentials(guide.name);
      return;
    }

    setAutomating(guide.name);
    setResults({});

    try {
      const response = await base44.functions.invoke('automatedPlatformDeletion', {
        profileId,
        platform: guide.name,
        credentials: storedCreds || credentials
      });

      setResults({ 
        [guide.name]: {
          success: response.data.status === 'completed',
          message: response.data.message,
          status: response.data.status,
          loginRequired: response.data.loginRequired
        }
      });

    } catch (error) {
      setResults({ 
        [guide.name]: { 
          success: false, 
          message: 'Automation failed: ' + error.message 
        }
      });
    } finally {
      setAutomating(null);
    }
  };

  const handleSaveCredentials = async (guide) => {
    const platformKey = guide.name.toLowerCase().replace(/\s+/g, '').replace('(formerlytwitter)', '').replace('x', 'twitter');
    
    const updatedCreds = {
      ...(user?.platform_credentials || {}),
      [platformKey]: credentials
    };

    await base44.auth.updateMe({
      platform_credentials: updatedCreds
    });

    // Reload user
    const updatedUser = await base44.auth.me();
    setUser(updatedUser);
    setShowCredentials(null);
    setCredentials({ username: '', password: '' });

    // Start automation
    handleAIAutomation(guide);
  };

  return (
    <Card className="glass-card border-blue-500/30">
      <CardHeader className="border-b border-blue-500/20">
        <CardTitle className="text-white flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-blue-400" />
          Platform-Specific Deletion Tools
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <p className="text-sm text-blue-200">
            Social media platforms require their own deletion tools. Automated email won't work.
            Use the direct links below:
          </p>
        </div>

        {matchedGuides.map((guide, idx) => {
          const result = results[guide.name];
          const isAutomating = automating === guide.name;
          
          return (
            <div key={idx} className="p-4 rounded-lg bg-slate-800/50 border border-purple-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">{guide.name}</h3>
                {result?.success && (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                )}
              </div>

              {result && (
                <div className={`p-3 rounded-lg text-xs ${
                  result.success 
                    ? 'bg-green-500/10 border border-green-500/30 text-green-200'
                    : 'bg-amber-500/10 border border-amber-500/30 text-amber-200'
                }`}>
                  {result.message}
                </div>
              )}

              {showCredentials === guide.name && !result && (
                <div className="space-y-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                  <p className="text-xs text-blue-200 mb-2">🔐 Login credentials for {guide.name}:</p>
                  <div>
                    <Label className="text-xs text-purple-200">Username/Email</Label>
                    <Input
                      type="text"
                      value={credentials.username}
                      onChange={(e) => setCredentials({...credentials, username: e.target.value})}
                      className="h-8 text-xs bg-slate-900/50 border-purple-500/30 text-white"
                      placeholder="username@example.com"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-purple-200">Password</Label>
                    <Input
                      type="password"
                      value={credentials.password}
                      onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                      className="h-8 text-xs bg-slate-900/50 border-purple-500/30 text-white"
                      placeholder="••••••••"
                    />
                  </div>
                  <p className="text-xs text-purple-400">✓ Credentials will be securely encrypted and saved</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowCredentials(null)}
                      className="flex-1 border-purple-500/50 text-purple-300"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSaveCredentials(guide)}
                      disabled={!credentials.username || !credentials.password}
                      className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600"
                    >
                      <Zap className="w-3 h-3 mr-2" />
                      Save & Automate
                    </Button>
                  </div>
                </div>
              )}

              {!result && (
                <div className="space-y-2 text-xs text-purple-300">
                  {guide.instructions.map((instruction, i) => (
                    <p key={i}>• {instruction}</p>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => handleAIAutomation(guide)}
                  disabled={isAutomating}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600"
                >
                  {isAutomating ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                      AI Automating...
                    </>
                  ) : (
                    <>
                      <Zap className="w-3 h-3 mr-2" />
                      AI Auto-Delete
                    </>
                  )}
                </Button>

                {guide.downloadUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(guide.downloadUrl, '_blank')}
                    className="border-green-500/50 text-green-300 hover:bg-green-500/10"
                  >
                    <ExternalLink className="w-3 h-3 mr-2" />
                    Download Data
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(guide.deletionUrl, '_blank')}
                  className="border-red-500/50 text-red-300 hover:bg-red-500/10"
                >
                  <ExternalLink className="w-3 h-3 mr-2" />
                  Manual Delete
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}