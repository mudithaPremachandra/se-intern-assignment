import { pool } from '../db';
import { toTicketDto, type TicketDto, type TicketRow } from '../mappers';
import * as usersRepository from '../users/users.repository';
import * as commentsRepository from '../comments/comments.repository';

/**
 * SQL expressions that derive the SLA fields from a ticket row, so the outcome
 * is computed once in the data layer rather than reimplemented per client.
 *
 *  - deadline   = created_at + sla_hours
 *  - the clock stops at `resolved_at` for resolved/closed tickets, else "now"
 *  - `unknown`  resolved/closed with no resolution timestamp — can't be judged
 *  - `met`/`breached` for a stopped clock: resolved at-or-before vs after deadline
 *  - active tickets warn (`at_risk`) once inside 25% of their own window (relative,
 *    so an 8h and a 48h SLA warn at the same proportional point), `breached` past it
 *
 * `alias` qualifies the column references (e.g. 't'); pass '' for an unqualified
 * context such as a RETURNING clause.
 */
function slaColumns(alias: string): string {
  const p = alias ? `${alias}.` : '';
  const deadline = `(${p}created_at + make_interval(hours => ${p}sla_hours))`;
  const stopped = `${p}status in ('resolved', 'closed')`;
  const measuredAt = `case when ${stopped} then ${p}resolved_at else now() end`;
  return `
    ${deadline} as sla_deadline,
    extract(epoch from (${deadline} - (${measuredAt})))::bigint as sla_remaining_seconds,
    case
      when ${stopped} and ${p}resolved_at is null then 'unknown'
      when ${stopped}
        then case when ${deadline} >= ${p}resolved_at then 'met' else 'breached' end
      when now() >= ${deadline} then 'breached'
      when extract(epoch from (${deadline} - now())) <= ${p}sla_hours * 3600 * 0.25 then 'at_risk'
      else 'ok'
    end as sla_state`;
}

export async function listTickets(): Promise<TicketDto[]> {
  const { rows } = await pool.query<TicketRow>(
    `select t.*, ${slaColumns('t')} from tickets t order by t.created_at desc`
  );

  const result: TicketDto[] = [];
  for (const row of rows) {
    // look up assignee
    const assigneeName = row.assignee_id
      ? await usersRepository.findNameById(row.assignee_id)
      : null;
    const commentCount = await commentsRepository.countForTicket(row.id);
    result.push(toTicketDto(row, assigneeName, commentCount));
  }
  return result;
}

export async function getTicketById(id: number): Promise<TicketDto | null> {
  const { rows } = await pool.query(
    `select t.*, u.name as assignee_name,
            (select count(*) from comments c where c.ticket_id = t.id) as comment_count,
            ${slaColumns('t')}
       from tickets t
       left join users u on u.id = t.assignee_id
      where t.id = $1`,
    [id]
  );
  if (!rows[0]) return null;
  const row = rows[0];
  return toTicketDto(row, row.assignee_name ?? null, Number(row.comment_count));
}

export interface CreateTicketInput {
  subject: string;
  description: string;
  priority: string;
  assigneeId: number | null;
  slaHours: number;
}

export async function createTicket(input: CreateTicketInput): Promise<TicketDto> {
  const { rows } = await pool.query<TicketRow>(
    `insert into tickets (subject, description, status, priority, assignee_id, sla_hours)
     values ($1, $2, 'open', $3, $4, $5)
     returning *, ${slaColumns('')}`,
    [input.subject, input.description, input.priority, input.assigneeId, input.slaHours]
  );
  const row = rows[0];
  const assigneeName = row.assignee_id
    ? await usersRepository.findNameById(row.assignee_id)
    : null;
  return toTicketDto(row, assigneeName, 0);
}

export async function updateStatus(id: number, status: string): Promise<void> {
  if (status === 'resolved') {
    // mark resolved
    await pool.query('update tickets set status = $1, resolved_at = now() where id = $2', [
      status,
      id,
    ]);
  } else {
    await pool.query('update tickets set status = $1 where id = $2', [status, id]);
  }
}
