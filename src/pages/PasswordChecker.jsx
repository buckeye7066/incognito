import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Shield, Eye, EyeOff, CheckCircle, AlertTriangle, XCircle, Search, Lock, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';

async function sha1(str) {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-1', buf);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

export default function PasswordChecker() {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const checkPassword = async () => {
    if (!password) return;
    setLoading(true);
    setResult(null);
    try {
      const hash = await sha1(password);
      const prefix = hash.slice(0, 5);
      const suffix = hash.slice(5);

      const res = await base44.functions.invoke('checkPasswordBreach', { prefix });
      const entries = res.data?.entries || [];
      const match = entries.find(e => e.suffix === suffix);
      const count = match ? match.count : 0;

      setResult({ count, hash, prefix, safe: count === 0 });
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

      {/* Result */}
      <AnimatePresence>
        {result && !result.error && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
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

                    {!result.safe && (
                      <div className="mt-4 p-4 rounded-xl bg-slate-900/50 border border-red-500/20">
                        <p className="text-red-300 font-medium mb-2">⚠️ Immediate Actions Recommended:</p>
                        <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
                          <li>Stop using this password immediately</li>
                          <li>Change it on all sites where you use it</li>
                          <li>Use a unique, randomly generated password for each site</li>
                          <li>Enable two-factor authentication wherever possible</li>
                        </ul>
                      </div>
                    )}

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
          </motion.div>
        )}
      </AnimatePresence>

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