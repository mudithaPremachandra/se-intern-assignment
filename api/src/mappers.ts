export type SlaState = 'ok' | 'at_risk' | 'breached' | 'met' | 'unknown';

export interface TicketRow {
  id: number;
  subject: string;
  description: string;
  status: string;
  priority: string;
  assignee_id: number | null;
  sla_hours: number;
  created_at: Date;
  updated_at: Date;
  resolved_at: Date | null;
  // Derived in SQL by `slaColumns()` in tickets.repository.ts.
  sla_deadline: Date;
  sla_state: SlaState;
  sla_remaining_seconds: string | null; // bigint arrives as a string from pg
}

export interface CommentRow {
  id: number;
  ticket_id: number;
  author_id: number;
  author_name: string;
  body: string;
  created_at: Date;
}

export interface TicketDto {
  id: number;
  subject: string;
  description: string;
  status: string;
  priority: string;
  assigneeId: number | null;
  assigneeName: string | null;
  slaHours: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  /** Absolute SLA deadline: created_at + sla_hours. */
  slaDeadline: string;
  /** SLA outcome/state computed server-side at query time. */
  slaState: SlaState;
  /**
   * Seconds until the deadline, measured at the clock-stop time for
   * resolved/closed tickets and at "now" for active ones. Negative once
   * breached; `null` when the state is `unknown` (no resolution time on record).
   */
  slaRemainingSeconds: number | null;
}

export interface CommentDto {
  id: number;
  ticketId: number;
  authorId: number;
  authorName: string;
  body: string;
  createdAt: string;
}

export function toTicketDto(
  row: TicketRow,
  assigneeName: string | null,
  commentCount: number
): TicketDto {
  return {
    id: row.id,
    subject: row.subject,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assigneeId: row.assignee_id,
    assigneeName,
    slaHours: row.sla_hours,
    commentCount,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    resolvedAt: row.resolved_at ? row.resolved_at.toISOString() : null,
    slaDeadline: row.sla_deadline.toISOString(),
    slaState: row.sla_state,
    slaRemainingSeconds:
      row.sla_remaining_seconds === null ? null : Number(row.sla_remaining_seconds),
  };
}

export function toCommentDto(row: CommentRow): CommentDto {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    authorId: row.author_id,
    authorName: row.author_name,
    body: row.body,
    createdAt: row.created_at.toISOString(),
  };
}
