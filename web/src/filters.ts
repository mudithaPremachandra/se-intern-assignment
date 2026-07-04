import type { Ticket } from './types';

export type TicketPredicate = (ticket: Ticket) => boolean;

/**
 * Builds a predicate for one column from the set of selected values and how to
 * read the comparable value off a ticket. Empty `selected` means "no
 * constraint" (everything matches). This is the OR-within-a-column half.
 *
 * The design is deliberately generic so a new filterable column (e.g. priority)
 * is just another `columnPredicate(...)` call — no shared logic to change.
 */
export function columnPredicate<V>(
  selected: Set<V>,
  valueOf: (ticket: Ticket) => V
): TicketPredicate {
  return (ticket) => selected.size === 0 || selected.has(valueOf(ticket));
}

/** AND across columns: a ticket must satisfy every column's predicate. */
export function applyFilters(
  tickets: Ticket[],
  predicates: TicketPredicate[]
): Ticket[] {
  return tickets.filter((ticket) => predicates.every((p) => p(ticket)));
}

export const STATUSES: Ticket['status'][] = [
  'open',
  'in_progress',
  'resolved',
  'closed',
];

export interface AssigneeOption {
  id: number;
  name: string;
}

/** Unique, name-sorted assignees present in the loaded tickets. */
export function deriveAssignees(tickets: Ticket[]): AssigneeOption[] {
  const byId = new Map<number, string>();
  for (const t of tickets) {
    if (t.assigneeId != null && t.assigneeName != null) {
      byId.set(t.assigneeId, t.assigneeName);
    }
  }
  return [...byId.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Immutably toggle a value's membership in a set, returning a new set. */
export function toggle<V>(set: Set<V>, value: V): Set<V> {
  const next = new Set(set);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}
