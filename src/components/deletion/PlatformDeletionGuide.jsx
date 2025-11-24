import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, AlertCircle } from 'lucide-react';

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

export default function PlatformDeletionGuide({ platforms = [] }) {
  const matchedGuides = platforms
    .map(p => {
      const sourceName = p.source_name || '';
      return Object.values(PLATFORM_GUIDES).find(guide => 
        sourceName.toLowerCase().includes(guide.name.toLowerCase()) ||
        sourceName.toLowerCase().includes(guide.name.split(' ')[0].toLowerCase())
      );
    })
    .filter(Boolean);

  if (matchedGuides.length === 0) return null;

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

        {matchedGuides.map((guide, idx) => (
          <div key={idx} className="p-4 rounded-lg bg-slate-800/50 border border-purple-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">{guide.name}</h3>
            </div>

            <div className="space-y-2 text-xs text-purple-300">
              {guide.instructions.map((instruction, i) => (
                <p key={i}>• {instruction}</p>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
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
                Delete Account
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}