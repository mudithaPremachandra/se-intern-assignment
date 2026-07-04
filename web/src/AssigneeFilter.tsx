import { useState } from 'react';
import type { AssigneeOption } from './filters';

interface AssigneeFilterProps {
  options: AssigneeOption[];
  /** Selected assignee ids; `null` represents the Unassigned bucket. */
  selected: Set<number | null>;
  onToggle: (value: number | null) => void;
}

/**
 * Searchable assignee picker. Empty by default — the user types a name to
 * surface suggestions. A persistent "Unassigned" toggle sits above the search,
 * since tickets with no assignee can't be found by name.
 */
export function AssigneeFilter({ options, selected, onToggle }: AssigneeFilterProps) {
  const [query, setQuery] = useState('');
  const trimmed = query.trim().toLowerCase();

  // Currently-selected named assignees, always shown so they can be unchecked
  // without searching. (The Unassigned bucket has its own toggle below.)
  const selectedOptions = options.filter((o) => selected.has(o.id));
  // Search results exclude anything already selected, to avoid duplicate rows.
  const matches = trimmed
    ? options.filter(
        (o) => !selected.has(o.id) && o.name.toLowerCase().includes(trimmed)
      )
    : [];

  return (
    <div className="assignee-filter">
      <label className="filter-option">
        <input
          type="checkbox"
          checked={selected.has(null)}
          onChange={() => onToggle(null)}
        />
        Unassigned
      </label>

      {selectedOptions.map((o) => (
        <label key={o.id} className="filter-option">
          <input
            type="checkbox"
            checked
            onChange={() => onToggle(o.id)}
          />
          {o.name}
        </label>
      ))}

      <input
        type="search"
        className="assignee-search"
        placeholder="Type a name…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {!trimmed ? (
        <p className="filter-hint">Type a name to find an assignee.</p>
      ) : matches.length === 0 ? (
        <p className="filter-hint">No matching assignees.</p>
      ) : (
        matches.map((o) => (
          <label key={o.id} className="filter-option">
            <input
              type="checkbox"
              checked={selected.has(o.id)}
              onChange={() => onToggle(o.id)}
            />
            {o.name}
          </label>
        ))
      )}
    </div>
  );
}
