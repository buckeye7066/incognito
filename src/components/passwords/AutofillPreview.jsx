import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Globe, Wand2 } from 'lucide-react';
import { useCapabilities } from '@/hooks/useCapabilities';
import { CAPABILITY } from '@/providers';
import { CAPABILITY_STATUS } from '@/providers/capabilities';
import CapabilityBadge from '@/components/common/CapabilityBadge';
import { matchLogins, MATCH_EXACT } from '@/lib/domainMatch';
import extensionBridge from '@/lib/extensionBridge';

/**
 * Autofill preview.
 *
 * Honest split of what a web app can and cannot do:
 *   - Matching saved logins to a domain is pure logic, so the preview ALWAYS
 *     works (even offline, even with no extension). See lib/domainMatch.js.
 *   - Actually typing a credential into a page needs the companion extension.
 *     When it's absent, the Fill button is disabled and the capability badge
 *     says "Needs extension" — we never pretend the fill happened.
 */
export default function AutofillPreview({ passwords = [] }) {
  const [domain, setDomain] = useState('');
  const [filled, setFilled] = useState(null); // { id, ok, message }
  const { capabilities } = useCapabilities();
  const autofillCap = capabilities[CAPABILITY.AUTOFILL];
  const canFill = autofillCap?.status === CAPABILITY_STATUS.READY && extensionBridge.isPresent();

  const matches = useMemo(
    () => (domain.trim() ? matchLogins(passwords, domain.trim()) : []),
    [passwords, domain],
  );

  const handleFill = async (entry) => {
    setFilled(null);
    try {
      await extensionBridge.fillPassword(entry.id);
      setFilled({ id: entry.id, ok: true, message: 'Sent to extension to fill.' });
    } catch (err) {
      // E_NO_EXTENSION (or any bridge error) — surface it, never fake success.
      setFilled({ id: entry.id, ok: false, message: err?.message || 'Autofill failed.' });
    }
  };

  return (
    <Card className="glass-card">
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" />
            <span className="font-medium">Autofill preview</span>
          </div>
          <CapabilityBadge
            status={autofillCap?.status}
            detail={autofillCap?.providers?.[0]?.detail}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          See which saved logins would fill on a site. Filling itself needs the
          companion browser extension — without it, this is preview-only.
        </p>

        <div className="relative">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Enter a site, e.g. github.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
          />
        </div>

        {domain.trim() && (
          <div className="space-y-1.5">
            {matches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No saved logins match <span className="font-mono">{domain.trim()}</span>.
              </p>
            ) : (
              matches.map(({ entry, tier }) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{entry.service_name}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {tier === MATCH_EXACT ? 'exact match' : 'same site'}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {entry.username || '—'}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <Button
                      size="sm"
                      variant={canFill ? 'default' : 'outline'}
                      disabled={!canFill}
                      onClick={() => handleFill(entry)}
                      title={canFill ? 'Fill via the companion extension' : 'Install the companion extension to fill'}
                    >
                      Fill
                    </Button>
                    {filled?.id === entry.id && (
                      <span className={`text-[10px] ${filled.ok ? 'text-green-400' : 'text-amber-400'}`}>
                        {filled.message}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
