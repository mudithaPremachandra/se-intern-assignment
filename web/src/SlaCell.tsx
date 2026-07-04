import type { Ticket } from './types';
import { formatDuration } from './sla';

/**
 * SLA badge for one ticket, coloured by the server-computed `slaState`:
 *  - on track → green, remaining `DD:HH:MM`
 *  - at risk  → orange, remaining `DD:HH:MM`
 *  - breached → red, "Breached" plus how long it ran over
 *  - met      → green, resolved within SLA
 *  - unknown  → muted dash (resolved/closed with no resolution time)
 * The times are recalculated by the API on each fetch; Refresh re-fetches.
 */
export function SlaCell({ ticket }: { ticket: Ticket }) {
  const { slaState, slaRemainingSeconds } = ticket;

  if (slaState === 'unknown') {
    return <span className="muted" title="No resolution time recorded">—</span>;
  }

  if (slaState === 'breached') {
    const over = slaRemainingSeconds == null ? 0 : -slaRemainingSeconds;
    return (
      <span className="sla sla-breached" title="SLA breached">
        Breached
        <span className="sla-sub">{formatDuration(over)} over</span>
      </span>
    );
  }

  if (slaState === 'met') {
    return (
      <span className="sla sla-met" title="Resolved within SLA">
        Met
      </span>
    );
  }

  return (
    <span className={`sla sla-${slaState}`}>
      {formatDuration(slaRemainingSeconds ?? 0)}
      <span className="sla-sub">left</span>
    </span>
  );
}
