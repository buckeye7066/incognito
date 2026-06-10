/**
 * Tiny persistence + math for in-app step-by-step setup guides.
 *
 * Progress is a plain map of { stepIndex: true }. The pure helpers
 * (completedCount / percentComplete) are unit-tested; get/set use localStorage
 * so a guide remembers what you've checked off across visits.
 */
const KEY = (id) => `incognito_setup_${id}`;

export function getProgress(id) {
  try { return JSON.parse(localStorage.getItem(KEY(id)) || '{}') || {}; }
  catch { return {}; }
}

export function setStepDone(id, step, done) {
  const p = getProgress(id);
  if (done) p[step] = true; else delete p[step];
  try { localStorage.setItem(KEY(id), JSON.stringify(p)); } catch { /* ignore quota */ }
  return p;
}

/** How many steps are marked done in a progress map. Pure. */
export function completedCount(progress) {
  return Object.values(progress || {}).filter(Boolean).length;
}

/** Percent complete given a progress map and the total step count. Pure. */
export function percentComplete(progress, total) {
  if (!total || total < 1) return 0;
  return Math.min(100, Math.round((completedCount(progress) / total) * 100));
}

export default { getProgress, setStepDone, completedCount, percentComplete };
