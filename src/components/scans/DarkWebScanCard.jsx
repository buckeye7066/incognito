import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, AlertTriangle, Lock } from 'lucide-react';
import { motion } from 'framer-motion';

export default function DarkWebScanCard({ enabled, onEnable, onRunScan, isScanning }) {
  if (!enabled) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="glass-card border-red-500/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl" />
          <CardHeader className="border-b border-red-500/20">
            <CardTitle className="text-white flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-red-400" />
              </div>
              Dark Web Scanning
              <span className="ml-auto px-3 py-1 rounded-full bg-red-500/20 text-red-300 text-xs font-semibold">
                OPT-IN REQUIRED
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-amber-300 mb-1">Sensitive Feature</h4>
                <p className="text-sm text-amber-200">
                  Dark web scanning searches breach databases and hidden networks for your 
                  exposed data. This feature requires explicit consent due to its sensitive nature.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-white text-sm">What you'll get:</h4>
              <ul className="space-y-2 text-sm text-purple-200">
                <li className="flex gap-2">
                  <span className="text-purple-400">•</span>
                  <span>Search known data breach databases</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-purple-400">•</span>
                  <span>Monitor credential dumps and leaks</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-purple-400">•</span>
                  <span>Check dark web marketplaces (legal APIs only)</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-purple-400">•</span>
                  <span>Identify compromised accounts</span>
                </li>
              </ul>
            </div>

            <div className="pt-4">
              <Button
                onClick={onEnable}
                className="w-full bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700"
              >
                <Lock className="w-4 h-4 mr-2" />
                Enable Dark Web Scanning
              </Button>
            </div>

            <p className="text-xs text-purple-400 text-center">
              Legal OSINT practices only • Full consent required
            </p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="glass-card border-red-500/30 glow-border">
        <CardHeader className="border-b border-red-500/20">
          <CardTitle className="text-white flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-red-400" />
            </div>
            Dark Web Scanning
            <span className="ml-auto px-3 py-1 rounded-full bg-green-500/20 text-green-300 text-xs font-semibold">
              ENABLED
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="flex gap-3 p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
            <Shield className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-purple-300 mb-1">Deep Monitoring Active</h4>
              <p className="text-sm text-purple-200">
                Your identifiers will be checked against breach databases, credential dumps, 
                and monitored dark web sources using legal third-party APIs.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-slate-900/50 border border-purple-500/20">
              <p className="text-xs text-purple-400 mb-1">Scan Depth</p>
              <p className="text-lg font-bold text-white">Advanced</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/50 border border-purple-500/20">
              <p className="text-xs text-purple-400 mb-1">Est. Duration</p>
              <p className="text-lg font-bold text-white">2-5 min</p>
            </div>
          </div>

          <Button
            onClick={onRunScan}
            disabled={isScanning}
            className="w-full bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700"
          >
            {isScanning ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <Shield className="w-4 h-4 mr-2" />
                </motion.div>
                Scanning Dark Web...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4 mr-2" />
                Run Dark Web Scan
              </>
            )}
          </Button>

          <p className="text-xs text-purple-400 text-center">
            Using encrypted queries • Legal monitoring only
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}