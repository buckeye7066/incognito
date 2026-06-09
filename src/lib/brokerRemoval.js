/**
 * Data-broker removal task lifecycle (Pass 10).
 *
 * Pure state machine + progress math. The cardinal honesty rule: a task can
 * only enter `removed` via an explicit confirmation transition from a state
 * where removal could actually be verified (waiting_verification / in_progress).
 * Nothing auto-marks "removed", and `reappeared` reopens a removed task.
 */

export const BROKER_TASK_STATUS = {
  NOT_STARTED: 'not_started',
  READY: 'ready',
  SUBMITTED: 'submitted',
  WAITING_VERIFICATION: 'waiting_verification',
  NEEDS_USER_ACTION: 'needs_user_action',
  IN_PROGRESS: 'in_progress',
  REMOVED: 'removed',
  REJECTED: 'rejected',
  REAPPEARED: 'reappeared',
  FAILED: 'failed',
};

const T = BROKER_TASK_STATUS;

const TRANSITIONS = {
  [T.NOT_STARTED]: [T.READY, T.IN_PROGRESS],
  [T.READY]: [T.SUBMITTED, T.NEEDS_USER_ACTION, T.IN_PROGRESS, T.FAILED],
  [T.SUBMITTED]: [T.WAITING_VERIFICATION, T.REJECTED, T.NEEDS_USER_ACTION, T.FAILED],
  [T.WAITING_VERIFICATION]: [T.REMOVED, T.NEEDS_USER_ACTION, T.REJECTED, T.FAILED],
  [T.NEEDS_USER_ACTION]: [T.SUBMITTED, T.IN_PROGRESS, T.FAILED],
  [T.IN_PROGRESS]: [T.SUBMITTED, T.WAITING_VERIFICATION, T.NEEDS_USER_ACTION, T.REMOVED, T.FAILED],
  [T.REMOVED]: [T.REAPPEARED],
  [T.REJECTED]: [T.READY, T.IN_PROGRESS],
  [T.REAPPEARED]: [T.READY, T.IN_PROGRESS],
  [T.FAILED]: [T.READY, T.IN_PROGRESS],
};

export function isTerminal(status) {
  return status === T.REMOVED;
}

/** Validate + return the next state; throws on an illegal transition. */
export function nextBrokerTaskState(current, action) {
  const allowed = TRANSITIONS[current];
  if (!allowed) throw new Error(`Unknown broker task state: ${current}`);
  if (!allowed.includes(action)) {
    throw new Error(`Illegal broker task transition: ${current} → ${action}`);
  }
  return action;
}

/** Can this task legitimately be confirmed removed right now? */
export function canConfirmRemoved(current) {
  return (TRANSITIONS[current] || []).includes(T.REMOVED);
}

/** Roll up campaign progress for the dashboard. */
export function campaignProgress(tasks = []) {
  const total = tasks.length;
  const removed = tasks.filter((t) => t.status === T.REMOVED).length;
  const needsAction = tasks.filter((t) => t.status === T.NEEDS_USER_ACTION).length;
  const inProgress = tasks.filter((t) =>
    [T.SUBMITTED, T.WAITING_VERIFICATION, T.IN_PROGRESS].includes(t.status)).length;
  const reappeared = tasks.filter((t) => t.status === T.REAPPEARED).length;
  return {
    total,
    removed,
    needsAction,
    inProgress,
    reappeared,
    percent: total === 0 ? 0 : Math.round((removed / total) * 100),
  };
}
