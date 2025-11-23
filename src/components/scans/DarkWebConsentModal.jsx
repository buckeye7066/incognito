import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, Shield, Eye, Lock } from 'lucide-react';
import { motion } from 'framer-motion';

export default function DarkWebConsentModal({ open, onClose, onConsent }) {
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [understoodRisks, setUnderstoodRisks] = useState(false);

  const handleConsent = () => {
    if (agreedToTerms && understoodRisks) {
      onConsent();
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-2 border-red-500/50 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            Dark Web Scanning - Important Notice
          </DialogTitle>
          <DialogDescription className="text-purple-300 text-base">
            Please read carefully before enabling this feature
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Warning Banner */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-red-500/10 border border-red-500/30 rounded-xl p-4"
          >
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-300 mb-2">Sensitive Feature - Proceed with Caution</h3>
                <p className="text-sm text-red-200">
                  Dark web scanning searches hidden networks and breach databases for your exposed data. 
                  This process involves specialized APIs and may take longer than standard scans.
                </p>
              </div>
            </div>
          </motion.div>

          {/* What We Search */}
          <div className="space-y-3">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Eye className="w-5 h-5 text-purple-400" />
              What We Search
            </h3>
            <ul className="space-y-2 text-sm text-purple-200">
              <li className="flex gap-2">
                <span className="text-purple-400">•</span>
                <span>Known data breach databases (Have I Been Pwned, DeHashed, etc.)</span>
              </li>
              <li className="flex gap-2">
                <span className="text-purple-400">•</span>
                <span>Credential dumps and leaked password repositories</span>
              </li>
              <li className="flex gap-2">
                <span className="text-purple-400">•</span>
                <span>Dark web marketplaces (legal monitoring services only)</span>
              </li>
              <li className="flex gap-2">
                <span className="text-purple-400">•</span>
                <span>Paste sites and forums known for data trading</span>
              </li>
            </ul>
          </div>

          {/* Legal & Ethical Boundaries */}
          <div className="space-y-3">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-400" />
              Legal & Ethical Boundaries
            </h3>
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <ul className="space-y-2 text-sm text-green-200">
                <li className="flex gap-2">
                  <span className="text-green-400">✓</span>
                  <span>We ONLY use legal third-party APIs and monitoring services</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-green-400">✓</span>
                  <span>No illegal crawling or unauthorized access</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-green-400">✓</span>
                  <span>OSINT (Open Source Intelligence) practices only</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-green-400">✓</span>
                  <span>Full compliance with data protection regulations</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Important Limitations */}
          <div className="space-y-3">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-400" />
              Important Limitations
            </h3>
            <ul className="space-y-2 text-sm text-purple-200">
              <li className="flex gap-2">
                <span className="text-amber-400">⚠</span>
                <span>Results depend on third-party API availability and accuracy</span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-400">⚠</span>
                <span>Not all dark web content is accessible through legal means</span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-400">⚠</span>
                <span>Scans may take 2-5 minutes per identifier</span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-400">⚠</span>
                <span>False positives are possible with common names/emails</span>
              </li>
            </ul>
          </div>

          {/* Privacy Guarantee */}
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
            <h4 className="font-semibold text-purple-200 mb-2">Your Privacy is Protected</h4>
            <p className="text-sm text-purple-300">
              Your identifiers are encrypted before being sent to scanning APIs. We never store 
              raw query data in logs. All results are encrypted at rest in your private vault.
            </p>
          </div>

          {/* Consent Checkboxes */}
          <div className="space-y-4 pt-4 border-t border-purple-500/20">
            <div className="flex items-start gap-3">
              <Checkbox
                id="understood-risks"
                checked={understoodRisks}
                onCheckedChange={setUnderstoodRisks}
                className="mt-1"
              />
              <label
                htmlFor="understood-risks"
                className="text-sm text-purple-200 leading-relaxed cursor-pointer"
              >
                I understand the risks, limitations, and sensitive nature of dark web scanning, 
                and I acknowledge that results depend on third-party services.
              </label>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="agreed-terms"
                checked={agreedToTerms}
                onCheckedChange={setAgreedToTerms}
                className="mt-1"
              />
              <label
                htmlFor="agreed-terms"
                className="text-sm text-purple-200 leading-relaxed cursor-pointer"
              >
                I confirm that I will only use this feature for monitoring my own personal data 
                and agree to use the information responsibly and legally.
              </label>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-purple-500/20 pt-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-purple-500/50 text-purple-300"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConsent}
            disabled={!agreedToTerms || !understoodRisks}
            className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700"
          >
            Enable Dark Web Scanning
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}