/**
 * Scheduled monitoring re-checks (optional backend).
 *
 * When the app isn't open, a private cron/VPS can periodically re-run breach /
 * broker re-checks and append alert events for the app to pick up via /events.
 * This module exposes the pure schedule logic; wiring to a real provider call
 * is left to the household's deployment.
 */

/** Which monitors are due to run, given last-run timestamps and an interval. */
export function dueMonitors(monitors = [], now = Date.now(), intervalMs = 24 * 60 * 60 * 1000) {
  return monitors.filter((m) => {
    const last = m.last_run_at ? Date.parse(m.last_run_at) : 0;
    return now - last >= (m.interval_ms || intervalMs);
  });
}
