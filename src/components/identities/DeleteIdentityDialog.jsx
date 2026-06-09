import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle } from 'lucide-react';

/**
 * Delete confirmation that NEVER deletes linked secrets silently. The user must
 * pick: unlink only (keep password/alias/card/TOTP records) or cascade (delete
 * the linked local records too). Cancel = no-op.
 */
export default function DeleteIdentityDialog({ open, onOpenChange, identity, linkedCount = 0, onConfirm }) {
  const [mode, setMode] = useState('unlink');
  const [pending, setPending] = useState(false);

  const confirm = async () => {
    setPending(true);
    try { await onConfirm(mode); onOpenChange(false); }
    finally { setPending(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            Delete “{identity?.service_name}”?
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This identity links {linkedCount} local record{linkedCount === 1 ? '' : 's'}
            {' '}(password / email / phone / card / TOTP). Choose what happens to them.
          </p>
          <RadioGroup value={mode} onValueChange={setMode} className="space-y-2">
            <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer">
              <RadioGroupItem value="unlink" className="mt-1" />
              <span>
                <span className="font-medium">Unlink only</span>
                <span className="block text-xs text-muted-foreground">Delete the identity but keep its password/alias/card/TOTP in your vault.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer">
              <RadioGroupItem value="cascade" className="mt-1" />
              <span>
                <span className="font-medium text-red-400">Delete linked local records too</span>
                <span className="block text-xs text-muted-foreground">Permanently remove the identity AND its linked local records. Cannot be undone.</span>
              </span>
            </label>
          </RadioGroup>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button variant="destructive" disabled={pending} onClick={confirm}>
              {pending ? 'Deleting…' : (mode === 'cascade' ? 'Delete all' : 'Delete identity')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
