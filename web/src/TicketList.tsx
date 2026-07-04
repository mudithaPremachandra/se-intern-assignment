import { useEffect, useMemo, useState } from 'react';
import { request } from './api';
import type { Ticket } from './types';
import {
  STATUSES,
  applyFilters,
  columnPredicate,
  deriveAssignees,
  toggle,
} from './filters';
import { FilterPopover } from './FilterPopover';
import { AssigneeFilter } from './AssigneeFilter';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function TicketList() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [statuses, setStatuses] = useState<Set<string>>(new Set());
  const [assigneeIds, setAssigneeIds] = useState<Set<number | null>>(new Set());

  useEffect(() => {
    request<Ticket[]>('/tickets')
      .then(setTickets)
      .catch((err: Error) => setError(err.message));
  }, []);

  const assigneeOptions = useMemo(
    () => deriveAssignees(tickets ?? []),
    [tickets]
  );

  const visibleTickets = useMemo(
    () =>
      applyFilters(tickets ?? [], [
        columnPredicate(statuses, (t) => t.status),
        columnPredicate(assigneeIds, (t) => t.assigneeId),
      ]),
    [tickets, statuses, assigneeIds]
  );

  if (error) return <p className="error">{error}</p>;
  if (!tickets) return <p className="muted">Loading tickets…</p>;

  const hasFilters = statuses.size > 0 || assigneeIds.size > 0;

  return (
    <table className="ticket-table">
      <thead>
        <tr>
          <th>Subject</th>
          <th>
            <FilterPopover label="Status" count={statuses.size}>
              {STATUSES.map((status) => (
                <label key={status} className="filter-option">
                  <input
                    type="checkbox"
                    checked={statuses.has(status)}
                    onChange={() => setStatuses((s) => toggle(s, status))}
                  />
                  {status.replace('_', ' ')}
                </label>
              ))}
            </FilterPopover>
          </th>
          <th>Priority</th>
          <th>
            <FilterPopover label="Assignee" count={assigneeIds.size}>
              <AssigneeFilter
                options={assigneeOptions}
                selected={assigneeIds}
                onToggle={(value) => setAssigneeIds((s) => toggle(s, value))}
              />
            </FilterPopover>
          </th>
          <th>Comments</th>
          <th>
            Created
            {hasFilters && (
              <button
                type="button"
                className="clear-filters"
                onClick={() => {
                  setStatuses(new Set());
                  setAssigneeIds(new Set());
                }}
              >
                Clear filters
              </button>
            )}
          </th>
        </tr>
      </thead>
      <tbody>
        {visibleTickets.length === 0 ? (
          <tr>
            <td colSpan={6} className="muted empty-row">
              No tickets match the current filters.
            </td>
          </tr>
        ) : (
          visibleTickets.map((ticket) => (
            <tr key={ticket.id}>
              <td>
                <a href={`#/tickets/${ticket.id}`}>{ticket.subject}</a>
              </td>
              <td>
                <span className={`badge status-${ticket.status}`}>
                  {ticket.status.replace('_', ' ')}
                </span>
              </td>
              <td>{ticket.priority}</td>
              <td>{ticket.assigneeName ?? '—'}</td>
              <td>{ticket.commentCount}</td>
              <td>{formatDate(ticket.createdAt)}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
