import { useState } from 'react';
import { Shield, Eye, EyeOff, CheckCircle, AlertTriangle, XCircle, Search, Lock, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { incognito } from '@/api/client';
import { useActiveProfile } from '@/hooks/useActiveProfile';

async function sha1(str) {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-1', buf);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

const COMMON_CHANGE_PW_URLS = [
  { name: 'Google / Gmail', url: 'https://myaccount.google.com/signinoptions/password', icon: '🔵' },
  { name: 'Microsoft / Outlook', url: 'https://account.live.com/password/Change', icon: '🟦' },
  { name: 'Apple ID', url: 'https://appleid.apple.com/account/manage', icon: '🍎' },
  { name: 'Facebook', url: 'https://www.facebook.com/settings?tab=security', icon: '📘' },
  { name: 'Instagram', url: 'https://www.instagram.com/accounts/password/change/', icon: '📷' },
  { name: 'Twitter / X', url: 'https://twitter.com/settings/password', icon: '🐦' },
  { name: 'Amazon', url: 'https://www.amazon.com/gp/css/account/info/view.html', icon: '📦' },
  { name: 'Netflix', url: 'https://www.netflix.com/password', icon: '🎬' },
  { name: 'LinkedIn', url: 'https://www.linkedin.com/psettings/change-password', icon: '💼' },
  { name: 'GitHub', url: 'https://github.com/settings/security', icon: '💻' },
  { name: 'Reddit', url: 'https://www.reddit.com/prefs/update/', icon: '🤖' },
  { name: 'Discord', url: 'https://discord.com/channels/@me', icon: '🎮' },
  { name: 'PayPal', url: 'https://www.paypal.com/myaccount/settings/security/password', icon: '💰' },
  { name: 'Yahoo', url: 'https://login.yahoo.com/account/security', icon: '🟣' },
];

export default function PasswordChecker() {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pw_check_history') || '[]'); } catch { return []; }
  });

  const { activeProfileId } = useActiveProfile();

  const { data: allScanResults = [] } = useQuery({
    queryKey: ['scanResults'],
    queryFn: () => incognito.entities.ScanResult.list()
  });

  const { data: allPersonalData = [] } = useQuery({
    queryKey: ['personalData'],
    queryFn: () => incognito.entities.PersonalData.list()
  });

  const myBreaches = allScanResults.filter(r =>
    (!activeProfileId || r.profile_id === activeProfileId) && r.source_type === 'breach_database'
  );
  const passwordBreaches = myBreaches.filter(b =>
    b.data_exposed?.some(d => /password/i.test(d))
  );

  const checkPassword = async () => {
    if (!password) return;
    setLoading(true);
    setResult(null);
    try {
      const hash = await sha1(password);
      const prefix = hash.slice(0, 5);
      const suffix = hash.slice(5);

      const resp = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
      if (!resp.ok) throw new Error(`HIBP returned status ${resp.status}. Try again later.`);
      const text = await resp.text();
      const match = text.split('\n').find(line => line.startsWith(suffix));
      const count = match ? parseInt(match.split(':')[1]) : 0;

      const entry = { password: '••••••••', count, safe: count === 0, date: new Date().toISOString() };
      setResult({ count, hash, prefix, safe: count === 0 });
      const updated = [entry, ...history].slice(0, 10);
      setHistory(updated);
      localStorage.setItem('pw_check_history', JSON.stringify(updated));
    } catch (e) {
      setResult({ error: e.message });
    }
    setLoading(false);
  };

  const copyHash = () => {
    if (result?.hash) {
      navigator.clipboard.writeText(result.hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getSeverity = (count) => {
    if (count === 0) return { label: 'Not Found', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30', icon: CheckCircle };
    if (count < 100) return { label: 'Rare Exposure', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', icon: AlertTriangle };
    if (count < 10000) return { label: 'Exposed', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30', icon: AlertTriangle };
    return { label: 'Highly Compromised', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', icon: XCircle };
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">Password Breach Checker</h1>
        <p className="text-gray-400">Check if your password appears in known data breaches — powered by Have I Been Pwned</p>
      </div>

      {/* Privacy Notice */}
      <Card className="glass-card border-green-500/20 bg-green-500/5">
        <CardContent className="p-4 flex items-start gap-3">
          <Lock className="w-5 h-5 text-green-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-green-300 font-medium text-sm">Your password never leaves your device</p>
            <p className="text-gray-400 text-xs mt-1">
              We use k-anonymity: only the first 5 characters of your password's SHA-1 hash are sent to HIBP. Your actual password is never transmitted.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Checker */}
      <Card className="glass-card border-red-500/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-400" />
            Check a Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && checkPassword()}
              placeholder="Enter a password to check..."
              className="bg-slate-900/50 border-red-500/30 text-white pr-10"
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <Button
            onClick={checkPassword}
            disabled={!password || loading}
            className="w-full bg-gradient-to-r from-red-600 to-purple-600 hover:from-red-700 hover:to-purple-700"
          >
            {loading ? (
              <span className="flex items-center gap-2"><Search className="w-4 h-4 animate-pulse" /> Checking...</span>
            ) : (
              <span className="flex items-center gap-2"><Search className="w-4 h-4" /> Check Password</span>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Error */}
      <AnimatePresence>
        {result?.error && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="glass-card border border-red-500/30 bg-red-500/5">
              <CardContent className="p-6 flex items-center gap-4">
                <XCircle className="w-10 h-10 text-red-400 shrink-0" />
                <div>
                  <p className="font-semibold text-red-300">Check Failed</p>
                  <p className="text-sm text-gray-400 mt-1">{result.error}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result */}
      <AnimatePresence>
        {result && !result.error && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {(() => {
              const sev = getSeverity(result.count);
              const Icon = sev.icon;
              return (
                <Card className={`glass-card border ${sev.bg}`}>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4 mb-4">
                      <Icon className={`w-12 h-12 ${sev.color}`} />
                      <div>
                        <Badge className={`${sev.color} bg-transparent border-current mb-1`}>{sev.label}</Badge>
                        <p className={`text-2xl font-bold ${sev.color}`}>
                          {result.safe
                            ? 'This password was NOT found in any known breach'
                            : `Found ${result.count.toLocaleString()} times in data breaches`}
                        </p>
                      </div>
                    </div>

                    {result.safe && (
                      <div className="mt-4 p-4 rounded-xl bg-green-900/20 border border-green-500/20">
                        <p className="text-green-300 text-sm">
                          ✅ Great! This password hasn't appeared in known data breaches. Still, use unique passwords per site and enable 2FA.
                        </p>
                      </div>
                    )}

                    <div className="mt-4 pt-4 border-t border-slate-700">
                      <p className="text-xs text-gray-500 mb-1">SHA-1 Hash (for verification)</p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-gray-400 font-mono bg-slate-900 px-2 py-1 rounded flex-1 truncate">
                          {result.hash}
                        </code>
                        <Button variant="ghost" size="icon" onClick={copyHash} className="h-7 w-7 text-gray-400">
                          <Copy className="w-3 h-3" />
                        </Button>
                        {copied && <span className="text-xs text-green-400">Copied!</span>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Breaches that leaked passwords */}
            {!result.safe && passwordBreaches.length > 0 && (
              <Card className="glass-card border-red-500/30">
                <CardHeader className="pb-3 border-b border-red-500/20">
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                    Your Accounts in Password Breaches ({passwordBreaches.length})
                  </CardTitle>
                  <p className="text-xs text-gray-400 mt-1">
                    These breaches from your vault exposed passwords. Change credentials on these sites immediately.
                  </p>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {passwordBreaches.map((b, i) => (
                    <div key={i} className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                      <div className="flex items-start justify-between mb-1">
                        <div>
                          <p className="text-white font-semibold text-sm">{b.source_name}</p>
                          {b.metadata?.email && (
                            <p className="text-red-300 text-xs font-mono">
                              {b.metadata.email.replace(/(.{2}).+(@.+)/, "$1***$2")}
                            </p>
                          )}
                        </div>
                        <Badge className="bg-red-600/20 text-red-300 border-red-600/40 text-[10px]">
                          Risk: {b.risk_score}
                        </Badge>
                      </div>
                      {b.breach_date && (
                        <p className="text-gray-400 text-xs">Breached: {b.breach_date}</p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(b.data_exposed || []).map((d, j) => (
                          <span key={j} className={`text-[10px] px-1.5 py-0.5 rounded ${
                            /password/i.test(d)
                              ? 'bg-red-600/30 text-red-200 font-semibold'
                              : 'bg-slate-700/50 text-gray-300'
                          }`}>
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Change Password Links */}
            {!result.safe && (
              <Card className="glass-card border-amber-500/30">
                <CardHeader className="pb-3 border-b border-amber-500/20">
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <Shield className="w-5 h-5 text-amber-400" />
                    Change Your Passwords Now
                  </CardTitle>
                  <p className="text-xs text-gray-400 mt-1">
                    If you used this password on any of these sites, change it immediately.
                  </p>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {COMMON_CHANGE_PW_URLS.map((site) => (
                      <a
                        key={site.name}
                        href={site.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-800/50 border border-slate-700 hover:border-amber-500/50 hover:bg-amber-500/5 transition-colors group"
                      >
                        <span className="text-lg">{site.icon}</span>
                        <span className="text-sm text-gray-300 group-hover:text-white flex-1">{site.name}</span>
                        <ExternalLink className="w-3.5 h-3.5 text-gray-500 group-hover:text-amber-400" />
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* History */}
      {history.length > 0 && (
        <Card className="glass-card border-purple-500/20">
          <CardHeader className="pb-3 border-b border-purple-500/10">
            <CardTitle className="text-white text-sm flex items-center justify-between">
              <span>Recent Checks</span>
              <button onClick={() => { setHistory([]); localStorage.removeItem('pw_check_history'); }} className="text-xs text-gray-500 hover:text-red-400">Clear</button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-2">
            {history.map((h, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <code className="text-gray-400 font-mono">{h.password}</code>
                <span className={h.safe ? 'text-green-400' : 'text-red-400'}>
                  {h.safe ? '✓ Safe' : `✗ ${h.count.toLocaleString()} breaches`}
                </span>
                <span className="text-gray-600 text-xs">{new Date(h.date).toLocaleDateString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: '🔑', title: 'Use a Password Manager', desc: 'Generate and store unique passwords for every site. Never reuse passwords.' },
          { icon: '📱', title: 'Enable 2FA Everywhere', desc: 'Two-factor authentication blocks 99.9% of automated attacks.' },
          { icon: '🔄', title: 'Rotate Regularly', desc: "Change passwords for critical accounts (banking, email) every 90 days." }
        ].map(tip => (
          <Card key={tip.title} className="glass-card border-purple-500/20">
            <CardContent className="p-4">
              <div className="text-3xl mb-2">{tip.icon}</div>
              <p className="text-white font-medium text-sm mb-1">{tip.title}</p>
              <p className="text-gray-400 text-xs">{tip.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}