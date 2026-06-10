/** Shared constants for the Cloaked Identity bundle UI. */

export const IDENTITY_CATEGORIES = [
  { value: 'shopping', label: 'Shopping', color: 'bg-blue-500' },
  { value: 'social', label: 'Social Media', color: 'bg-purple-500' },
  { value: 'finance', label: 'Finance & Banking', color: 'bg-green-500' },
  { value: 'email', label: 'Email & Communication', color: 'bg-yellow-500' },
  { value: 'streaming', label: 'Streaming & Entertainment', color: 'bg-red-500' },
  { value: 'work', label: 'Work & Professional', color: 'bg-indigo-500' },
  { value: 'health', label: 'Health & Medical', color: 'bg-pink-500' },
  { value: 'travel', label: 'Travel', color: 'bg-teal-500' },
  { value: 'gaming', label: 'Gaming', color: 'bg-orange-500' },
  { value: 'general', label: 'General', color: 'bg-gray-500' },
];

export function categoryInfo(value) {
  return IDENTITY_CATEGORIES.find((c) => c.value === value) || IDENTITY_CATEGORIES[IDENTITY_CATEGORIES.length - 1];
}

export const IDENTITY_STATUS_META = {
  active: { label: 'Active', variant: 'default' },
  muted: { label: 'Muted', variant: 'secondary' },
  disabled: { label: 'Disabled', variant: 'secondary' },
  archived: { label: 'Archived', variant: 'outline' },
  compromised: { label: 'Compromised', variant: 'destructive' },
};

export const SEVERITY_TONE = {
  critical: 'text-red-400 bg-red-500/10 border-red-500/30',
  warning: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  info: 'text-blue-300 bg-blue-500/10 border-blue-500/30',
};

/** Generate a friendly, unique username from a service name. */
export function generateUsername(serviceName = '') {
  const base = String(serviceName).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10) || 'user';
  let rand = '';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const a = crypto.getRandomValues(new Uint32Array(1))[0];
    rand = a.toString(36).slice(0, 5);
  } else {
    rand = Math.floor(Math.random() * 1e6).toString(36);
  }
  return `${base}.${rand}`;
}
