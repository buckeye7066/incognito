import React, { useState } from 'react';
import { Lock, ExternalLink, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

const BUREAUS = [
  {
    name: 'Equifax',
    freeze_url: 'https://www.equifax.com/personal/credit-report-services/credit-freeze/',
    unfreeze_url: 'https://www.equifax.com/personal/credit-report-services/credit-freeze/',
    phone: '1-800-685-1111',
    color: 'text-red-400',
    border: 'border-red-500/30',
    bg: 'bg-red-500/5',
  },
  {
    name: 'Experian',
    freeze_url: 'https://www.experian.com/freeze/center.html',
    unfreeze_url: 'https://www.experian.com/freeze/center.html',
    phone: '1-888-397-3742',
    color: 'text-blue-400',
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/5',
  },
  {
    name: 'TransUnion',
    freeze_url: 'https://www.transunion.com/credit-freeze',
    unfreeze_url: 'https://www.transunion.com/credit-freeze',
    phone: '1-888-909-8872',
    color: 'text-green-400',
    border: 'border-green-500/30',
    bg: 'bg-green-500/5',
  },
];

export default function CreditFreezeCard() {
  const [frozen, setFrozen] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('credit_freeze_status') || '{}');
    } catch { return {}; }
  });

  const toggleFreeze = (name) => {
    const updated = { ...frozen, [name]: !frozen[name] };
    setFrozen(updated);
    localStorage.setItem('credit_freeze_status', JSON.stringify(updated));
  };

  const frozenCount = Object.values(frozen).filter(Boolean).length;
  const allFrozen = frozenCount === 3;

  return (
    <Card className="glass-card border-blue-500/20">
      <CardHeader className="border-b border-blue-500/10 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-blue-400" />
            Credit Freeze Status
          </CardTitle>
          <Badge className={allFrozen
            ? 'bg-green-500/10 text-green-400 border-green-500/30'
            : frozenCount > 0
              ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
              : 'bg-red-500/10 text-red-400 border-red-500/30'
          }>
            {frozenCount}/3 Frozen
          </Badge>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Freezing your credit prevents new accounts from being opened in your name — LifeLock's #1 recommendation.
        </p>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {!allFrozen && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300">
              You should freeze at all 3 bureaus. A freeze at only one leaves gaps that thieves can exploit.
            </p>
          </div>
        )}

        {BUREAUS.map((bureau) => {
          const isFrozen = frozen[bureau.name];
          return (
            <div
              key={bureau.name}
              className={`flex items-center justify-between p-3 rounded-xl border ${bureau.border} ${bureau.bg}`}
            >
              <div className="flex items-center gap-3">
                {isFrozen
                  ? <CheckCircle className={`w-5 h-5 ${bureau.color}`} />
                  : <AlertTriangle className="w-5 h-5 text-gray-500" />}
                <div>
                  <p className={`font-medium text-sm ${isFrozen ? bureau.color : 'text-gray-300'}`}>
                    {bureau.name}
                  </p>
                  <p className="text-xs text-gray-500">{bureau.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={!!isFrozen}
                  onCheckedChange={() => toggleFreeze(bureau.name)}
                />
                <a
                  href={bureau.freeze_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="ghost" size="icon" className={`h-7 w-7 ${bureau.color} hover:bg-current/10`}>
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </a>
              </div>
            </div>
          );
        })}

        <div className="flex items-start gap-2 pt-1">
          <Info className="w-3 h-3 text-gray-500 shrink-0 mt-0.5" />
          <p className="text-xs text-gray-500">
            Toggle the switch to track your freeze status. Freezes are free at all bureaus by law.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}