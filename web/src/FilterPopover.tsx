import { useRef, useState, type ReactNode } from 'react';
import { useClickOutside } from './useClickOutside';

interface FilterPopoverProps {
  label: string;
  /** Number of active selections; renders a count badge and active styling when > 0. */
  count: number;
  children: ReactNode;
}

/**
 * A column-header filter trigger: a button showing the label, a count badge when
 * filters are active, and a caret. Owns its own open/close state and closes on
 * outside click or Escape.
 */
export function FilterPopover({ label, count, children }: FilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, open, () => setOpen(false));

  return (
    <div className="filter" ref={ref}>
      <button
        type="button"
        className={`filter-trigger${count > 0 ? ' is-active' : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        {count > 0 && <span className="filter-count">{count}</span>}
        <span className="filter-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && <div className="filter-panel">{children}</div>}
    </div>
  );
}
