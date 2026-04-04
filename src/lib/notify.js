import { toast } from 'sonner';

/**
 * Drop-in replacement for window.alert().
 * Shows a toast notification instead of a blocking browser dialog.
 *
 * Usage:
 *   import { notify } from '@/lib/notify';
 *   notify('Please select a profile first');           // info
 *   notify.success('Scan complete!');                   // success
 *   notify.error('Scan failed: ' + error.message);     // error
 *   notify.warn('No data found');                       // warning
 */
export function notify(message) {
  toast(message);
}

notify.success = (message) => toast.success(message);
notify.error = (message) => toast.error(message);
notify.warn = (message) => toast.warning(message);
notify.info = (message) => toast.info(message);
