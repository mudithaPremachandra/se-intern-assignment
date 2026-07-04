import { useCallback, useEffect, useMemo, useState } from 'react';
import { request } from './api';
import type { Ticket } from './types';
import {
  STATUSES,
  applyFilters,
  columnPredicate,
  deriveAssignees,
  toggle,
} from './filters';
import { SLA_STATES, SLA_STATE_LABELS, type SlaState } from './sla';
import { FilterPopover } from './FilterPopover';
import { AssigneeFilter } from './AssigneeFilter';
import { SlaCell } from './SlaCell';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function TicketList() {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // When the currently-displayed tickets were fetched. The API computes each
  // ticket's SLA state at query time, so this is also when the times were last
  // recalculated — Refresh re-fetches to advance it.
  const [refreshedAt, setRefreshedAt] = useState<number | null>(null);

  const [statuses, setStatuses] = useState<Set<string>>(new Set());
  const [assigneeIds, setAssigneeIds] = useState<Set<number | null>>(new Set());
  const [slaStates, setSlaStates] = useState<Set<SlaState>>(new Set());

  const load = useCallback(() => {
    setRefreshing(true);
    return request<Ticket[]>('/tickets')
      .then((data) => {
        setTickets(data);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => {
        setRefreshedAt(Date.now());
        setRefreshing(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const assigneeOptions = useMemo(
    () => deriveAssignees(tickets ?? []),
    [tickets]
  );

  const visibleTickets = useMemo(
    () =>
      applyFilters(tickets ?? [], [
        columnPredicate(statuses, (t) => t.status),
        columnPredicate(assigneeIds, (t) => t.assigneeId),
        columnPredicate(slaStates, (t) => t.slaState),
      ]),
    [tickets, statuses, assigneeIds, slaStates]
  );

  if (error) return <p className="error">{error}</p>;
  if (!tickets) return <p className="muted">Loading tickets…</p>;

  const hasFilters =
    statuses.size > 0 || assigneeIds.size > 0 || slaStates.size > 0;

  return (
    <>
      <div className="list-toolbar">
        <span className="muted refreshed-at">
          {refreshedAt
            ? `Last refreshed ${new Date(refreshedAt).toLocaleTimeString()}`
            : ' '}
        </span>
        <div className="toolbar-actions">
          <button
            type="button"
            className="refresh-btn"
            onClick={() => load()}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          {hasFilters && (
            <button
              type="button"
              className="clear-filters"
              onClick={() => {
                setStatuses(new Set());
                setAssigneeIds(new Set());
                setSlaStates(new Set());
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>
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
            <th>Created</th>
            <th>
              <FilterPopover label="SLA" count={slaStates.size}>
                {SLA_STATES.map((state) => (
                  <label key={state} className="filter-option">
                    <input
                      type="checkbox"
                      checked={slaStates.has(state)}
                      onChange={() => setSlaStates((s) => toggle(s, state))}
                    />
                    {SLA_STATE_LABELS[state]}
                  </label>
                ))}
              </FilterPopover>
            </th>
          </tr>
        </thead>
        <tbody>
          {visibleTickets.length === 0 ? (
            <tr>
              <td colSpan={7} className="muted empty-row">
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
                <td>
                  <SlaCell ticket={ticket} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </>
  );
}
