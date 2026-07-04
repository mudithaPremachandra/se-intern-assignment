# Decision Log

## Initial UX designs
The original design briefs I wrote before implementation; the sections below record how they were refined.

**Filters — original brief:**
> convert status and assignee columns to buttons, have a small indicator next to it that shows it is clickable, when clicked it will open a small drop-drown with options, for status it will show the available statuses, for assignee the drop down will open a small search bar which will autofill with suggestions as the user types, by default it will show no users with a button to show tasks that have no assignees, how a user confirms a filter is by clicking an option (no explicit confirmation is asked), clicking elsewhere on the site will close the filter windows, the two filters need to work in unison (if a user applies a filter on status, then that filter needs to be respected when the other column filter is applied, the two filters need to support multiple options (eg: two statuses combined with 3 assignees) and a button to clear filters needs to be available

**SLA — original brief:**
> code should take date created, current date/time and compare the two to determine how old the ticket is, then the system will decide will show how much time is remaining in DD:HH:MM format, tickets that have more than a certain amount of time remaining will be have a light green SLA row cell, tickets that are about to finish will have light orange, SLA breached tickets will be red with a text indication that sla has been breached, the dashboard should feature a last refreshed time and an option to refresh that re-calculates the times with the current time, wire it through the current filtering system, the filtering should work similar to the status filtering

## Assumptions I made
- Ticket volume stays seed-sized — the list filter runs entirely in the browser on the already-loaded `/tickets` response, which is what makes client-side filtering acceptable.

## Design decisions

**Filtering — client-side.**
- `GET /tickets` already returns everything and there is no `/users` endpoint, so filtering runs in the browser (`web/src/filters.ts`): zero backend work, instant updates. Assignee options are derived from the loaded tickets.
- Logic is generic — one predicate per column — so adding a column (or moving server-side) is a localized change.
- Trade-off: won't scale to large tables without `WHERE`-clause query params on the API.

**SLA — computed in the repository, not the client.**
- Deadline, remaining seconds, and state are derived in SQL by `slaColumns()` (`api/src/tickets/tickets.repository.ts`) and exposed as `slaDeadline` / `slaRemainingSeconds` / `slaState`. One shared fragment feeds all three read paths (list, get-by-id, create-returning) — matches the "logic in repositories, DTOs out" rule.
- The client is presentational: `web/src/sla.ts` holds only the filter options and `DD:HH:MM` formatting; the SLA filter is one more `columnPredicate(slaStates, (t) => t.slaState)`.
- Trade-off: `slaState` is a snapshot as of the last fetch, not a live clock — fine because Refresh re-fetches with the DB's `now()`.

**SLA semantics.**
- Clock keyed on status: runs against `now()` while `open`/`in_progress`; `resolved`/`closed` freeze at `resolved_at`. Status is the source of truth, so a reopened ticket resumes a live countdown.
- `met` = resolved at or before deadline; `breached` = resolved after (or, while active, already past deadline).
- Unrecorded resolution → `unknown` (muted dash, never red). An earlier draft fell back to `updated_at`, which marked every such ticket breached — fixed after the closed-ticket bug.
- `at_risk` threshold is relative — under 25% of the ticket's *own* window — so 8h and 48h SLAs warn at the same relative point.

**Refresh.**
- Refresh re-fetches `/tickets` (recomputing every SLA state server-side) and stamps "Last refreshed" in the toolbar.

## Tests
All tests live in `api/test/tickets.test.ts` and run against the `deskline_test` DB (`npm test`). The SLA computation lives in SQL, so it is covered by the API suite rather than the untested web layer. Added:

- **SLA state derivation** (`SLA computation` block) — each test inserts a ticket with precise timings and asserts the state read back from `GET /tickets`:
  - `at_risk` — active ticket with under 25% of its window remaining.
  - `breached` (active) — `in_progress` ticket past deadline, proving the clock stays live with no `resolved_at`.
  - `met` — resolved before deadline (frozen).
  - `breached` (frozen) — resolved after deadline.
  - `met` at the boundary — resolved exactly at deadline, pinning the at-or-before rule.
  - `unknown` — `closed` ticket with no `resolved_at`; `slaRemainingSeconds` is `null`.
- **Per-path SLA fields** — the shared `slaColumns()` SQL sits in three read paths, each checked:
  - `GET /tickets` (list) — `slaState`, `slaDeadline`, `slaRemainingSeconds` range for the seed's open ticket.
  - `GET /tickets/:id` — same fields on the single-ticket path.
  - `POST /tickets` — the `RETURNING` path (columns built unqualified); asserts a new ticket is `ok` with ~its full window remaining.

## Where I used AI

**SLA feature.**
- *AI proposed:*
  - drafted the initial implementation entirely in the React client, including the relative 25%-of-window "at risk" threshold and freeze-at-resolution semantics.
  - first cut fell back to `updated_at` when `resolved_at` was missing.
- *User decided:*
  - had the logic moved into the repository/SQL layer to match the "logic in repositories, DTOs out" rule.
  - flagged the `updated_at` fallback (it made every closed ticket without a resolution time read as breached) and had it replaced with an explicit `unknown` state, verified against seed data.
  - accepted the 25%-of-window threshold and freeze-at-resolution semantics as proposed.

**Filtering feature.**
- *AI proposed:*
  - suggested adding an active-filter count badge and an empty-results row; implemented the feature.
  - first cut used a heterogeneous `ColumnFilter[]` array that didn't type-check cleanly, and the assignee dropdown listed only search matches.
- *User decided:*
  - owned the UX design (column-header dropdowns, multi-select, empty-by-default assignee search with a persistent Unassigned toggle); accepted the count-badge and empty-row suggestions.
  - directed the architecture: client-side over server-side, and deriving assignee options from the loaded tickets instead of adding a `/users` endpoint.
  - had the filter logic refactored to a per-column `columnPredicate()` — type-safe, and kept the "add a column = one more predicate" generality that later made the SLA filter a one-liner.
  - caught that a selected assignee vanished once the search box cleared, and directed the fix to always render currently-selected assignees at the top.
- *Verification:* assertions on the pure `filters.ts` (AND-across / OR-within, the Unassigned `null` bucket, empty-match); a live browser pass was blocked by a Playwright Chrome/admin-rights issue in this environment.

## Anything I noticed in the existing code
- (Concerns, bugs, or things you would change — fixed or just flagged.)

## What I'd do with more time
- (What you deliberately left out, and what you'd tackle next.)
