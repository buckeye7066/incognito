import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShieldQuestion, KeyRound, Save } from 'lucide-react';
import { APPROVAL_EVENT } from '@/lib/extensionHost';

/**
 * Approval gate for the browser-extension bridge.
 *
 * Secret-returning requests (autofill) and vault writes (save login) from the
 * companion extension are NOT served silently — extensionHost dispatches an
 * `incognito:approval-request` event and waits. This modal turns that into an
 * explicit human click in the APP window, which is what defeats a hidden
 * same-origin script trying to enumerate or poison the vault. No click → the
 * host's timeout denies the request.
 */
export default function FillApprovalGate() {
  const [req, setReq] = useState(null); // { kind, info, approve, deny }

  useEffect(() => {
    const onReq = (e) => {
      const detail = e.detail;
      if (!detail?.approve || !detail?.deny) return;
      // If a prompt is already open, deny it before showing the new one.
      setReq((prev) => { prev?.deny(); return detail; });
    };
    window.addEventListener(APPROVAL_EVENT, onReq);
    return () => window.removeEventListener(APPROVAL_EVENT, onReq);
  }, []);

  if (!req) return null;

  const isFill = req.kind === 'fill';
  const decide = (ok) => {
    if (ok) req.approve(); else req.deny();
    setReq(null);
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) decide(false); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldQuestion className="h-5 w-5 text-primary" />
            {isFill ? 'Allow autofill?' : 'Save this login?'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm">
            {isFill ? <KeyRound className="h-4 w-4 mt-0.5 text-amber-400" /> : <Save className="h-4 w-4 mt-0.5 text-green-400" />}
            <div className="min-w-0">
              {isFill ? (
                <p>The companion extension is requesting a credential to fill a page.</p>
              ) : (
                <>
                  <p>Save a login captured by the extension?</p>
                  {req.info?.url && <p className="text-xs text-muted-foreground truncate mt-0.5">{req.info.url}</p>}
                  {req.info?.username && <p className="text-xs text-muted-foreground truncate">{req.info.username}</p>}
                </>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Only approve if you just triggered this. Incognito never hands out a secret without your confirmation.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => decide(false)}>Deny</Button>
            <Button onClick={() => decide(true)}>{isFill ? 'Allow once' : 'Save'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
