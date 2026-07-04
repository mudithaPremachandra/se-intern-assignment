import type { SlaState } from './types';

/**
 * SLA state is computed server-side (see `slaColumns()` in the API's
 * tickets.repository.ts) and arrives on each ticket as `slaState`. This module
 * only holds the presentation concerns: which states are filterable, their
 * labels, and duration formatting.
 *
 *  - `ok`       active, comfortable — more than 25% of its window remains
 *  - `at_risk`  active, inside the warning band — deadline approaching
 *  - `breached` deadline passed (active and overdue, or resolved after deadline)
 *  - `met`      resolved/closed at or before its deadline
 *  - `unknown`  resolved/closed with no resolution time — SLA can't be judged
 */
export type { SlaState };

/** The filterable states, in display order. `unknown` is intentionally excluded. */
export const SLA_STATES: SlaState[] = ['ok', 'at_risk', 'breached', 'met'];

export const SLA_STATE_LABELS: Record<SlaState, string> = {
  ok: 'On track',
  at_risk: 'At risk',
  breached: 'Breached',
  met: 'Met',
  unknown: 'Unknown',
};

/**
 * Format a non-negative duration in seconds as `DD:HH:MM` (days uncapped,
 * hours/minutes zero-padded). Sub-minute remainders round down.
 */
export function formatDuration(seconds: number): string {
  const totalMinutes = Math.floor(Math.max(0, seconds) / 60);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(days)}:${pad(hours)}:${pad(minutes)}`;
}
