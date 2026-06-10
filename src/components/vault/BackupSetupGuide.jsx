import SetupSteps from '@/components/common/SetupSteps';

/**
 * Step-by-step guide for the backup routine. Because the vault is local-only,
 * a forgotten password or a lost device means permanent loss — this walks the
 * family through protecting against that. Complements the Recovery Center's
 * status score with the actual how-to.
 */
export default function BackupSetupGuide() {
  const steps = [
    {
      title: 'Make your first encrypted backup',
      body: <p>In the Recovery Center above, click <b>“Encrypted backup”</b>. It saves one file, encrypted with your master password.</p>,
    },
    {
      title: 'Store the file in two safe places',
      body: <p>For example a USB stick <i>and</i> a second device. The file is encrypted, so it's safe to keep off this computer — that's the whole point (this device could fail).</p>,
    },
    {
      title: 'Write down your master password',
      body: <p>Keep it somewhere secure (a safe, or a separate password manager). It is <b>never stored and cannot be reset</b> — without it, even a backup can't be opened.</p>,
    },
    {
      title: 'Test a restore once',
      body: <p>Use <b>“Restore”</b> in the Recovery Center on your backup file so you know the flow works before you ever need it for real.</p>,
    },
    {
      title: 'Re-back up regularly',
      body: <p>After adding important data, and at least monthly. The Recovery Center's score turns amber when your last backup is getting old.</p>,
    },
  ];

  return <SetupSteps id="backup_routine" title="Protect against data loss — step by step" steps={steps} />;
}
