import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ShieldCheck, ShieldAlert, Download, Upload, CheckCircle, AlertTriangle, Circle, LifeBuoy } from 'lucide-react';
import vault from '@/lib/vault';
import { exportEncryptedBackup, importEncryptedBackup } from '@/api/client';
import { assessRecoveryReadiness, READINESS_LABELS } from '@/lib/recoveryKit';
import { notify } from '@/lib/notify';

const LS = {
  lastBackup: 'vault_last_backup_at',
  pwRecorded: 'vault_master_pw_recorded',
  codesSaved: 'vault_recovery_codes_saved',
};

const LEVEL_TONE = {
  protected: { ring: 'text-green-400', bar: 'bg-green-500', Icon: ShieldCheck },
  partial: { ring: 'text-amber-400', bar: 'bg-amber-500', Icon: ShieldAlert },
  at_risk: { ring: 'text-red-400', bar: 'bg-red-500', Icon: ShieldAlert },
};

const SEVERITY_ICON = {
  good: <CheckCircle className="w-4 h-4 text-green-400" />,
  warn: <AlertTriangle className="w-4 h-4 text-amber-400" />,
  danger: <Circle className="w-4 h-4 text-red-400" />,
};

/**
 * Recovery Center surface (Pass 14): honestly scores how protected the family
 * is against losing their local-first vault, and offers a real ENCRYPTED backup
 * / restore. Attestations (password recorded, codes saved) are user-confirmed
 * because the app genuinely cannot verify them.
 */
export default function RecoveryReadiness({ recordCount = 0 }) {
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(null); // 'backup' | 'restore' | null
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);

  const read = (k) => localStorage.getItem(k);
  const setFlag = (k, v) => { localStorage.setItem(k, String(v)); rerender(); };

  const readiness = assessRecoveryReadiness({
    lastBackupAt: read(LS.lastBackup),
    masterPasswordRecorded: read(LS.pwRecorded) === 'true',
    recoveryCodesSaved: read(LS.codesSaved) === 'true',
    recordCount,
    now: Date.now(),
  });
  const tone = LEVEL_TONE[readiness.level] || LEVEL_TONE.at_risk;

  const handleBackup = async () => {
    if (!vault.isUnlocked()) { notify.warn('Unlock the vault first to create a backup.'); return; }
    setBusy('backup');
    try {
      const envelope = await exportEncryptedBackup();
      const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `incognito-encrypted-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      localStorage.setItem(LS.lastBackup, new Date().toISOString());
      rerender();
      notify.success(`Encrypted backup saved (${envelope.manifest.totalRecords} records).`);
    } catch (err) {
      notify.error(err?.message || 'Backup failed.');
    } finally {
      setBusy(null);
    }
  };

  const handleRestoreFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!vault.isUnlocked()) { notify.warn('Unlock the vault first to restore.'); return; }
    setBusy('restore');
    try {
      const envelope = JSON.parse(await file.text());
      const mode = window.confirm(
        'Restore mode:\n\nOK = Merge (add to existing data)\nCancel = Replace (clear matching data first)',
      ) ? 'merge' : 'replace';
      const result = await importEncryptedBackup(envelope, { mode });
      queryClient.invalidateQueries();
      notify.success(`Restored ${result.imported} records from backup.`);
    } catch (err) {
      notify.error(err?.message || 'Restore failed.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="glass-card border-purple-500/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-white flex items-center gap-2 text-lg">
          <LifeBuoy className="w-5 h-5 text-purple-400" />
          Recovery Center
        </CardTitle>
        <p className="text-xs text-purple-300/80">
          This vault lives only on this device. There is no server to reset it — protect it from loss.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Score + actions */}
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-center gap-3 min-w-[180px]">
            <tone.Icon className={`w-9 h-9 ${tone.ring}`} />
            <div>
              <div className={`text-2xl font-bold ${tone.ring}`}>{readiness.score}%</div>
              <div className="text-xs text-gray-400">{READINESS_LABELS[readiness.level]}</div>
            </div>
          </div>
          <div className="flex-1">
            <div className="h-2.5 w-full rounded-full bg-slate-700 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${tone.bar}`} style={{ width: `${readiness.score}%` }} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleBackup} disabled={busy === 'backup'} className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600">
              <Download className="w-4 h-4" /> {busy === 'backup' ? 'Saving…' : 'Encrypted backup'}
            </Button>
            <Button onClick={() => fileRef.current?.click()} disabled={busy === 'restore'} variant="outline" className="gap-2 border-purple-500/40 text-purple-200">
              <Upload className="w-4 h-4" /> {busy === 'restore' ? 'Restoring…' : 'Restore'}
            </Button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={handleRestoreFile} />
          </div>
        </div>

        {/* Checklist */}
        <div className="space-y-2">
          {readiness.items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-700 bg-slate-800/30 px-3 py-2">
              <div className="flex items-start gap-2 min-w-0">
                <span className="mt-0.5 shrink-0">{SEVERITY_ICON[item.severity] || SEVERITY_ICON.warn}</span>
                <div className="min-w-0">
                  <p className={`text-sm ${item.done ? 'text-gray-300' : 'text-white'}`}>{item.label}</p>
                  {item.action && <p className="text-xs text-purple-300/70">→ {item.action}</p>}
                </div>
              </div>
              {/* Attestation toggles — the app cannot verify these, so the family confirms. */}
              {item.id === 'password' && (
                <Switch checked={read(LS.pwRecorded) === 'true'} onCheckedChange={(v) => setFlag(LS.pwRecorded, v)} />
              )}
              {item.id === 'codes' && (
                <Switch checked={read(LS.codesSaved) === 'true'} onCheckedChange={(v) => setFlag(LS.codesSaved, v)} />
              )}
            </div>
          ))}
        </div>

        <p className="text-[11px] text-gray-500">
          Backups are encrypted with your master password (AES-256-GCM). Store the file somewhere safe — a USB key or a
          second device. The toggles above are your own confirmations; Incognito can&apos;t check them for you.
        </p>
      </CardContent>
    </Card>
  );
}
