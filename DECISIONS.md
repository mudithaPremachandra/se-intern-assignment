# Decision Log

## Assumptions I made
- (Where the brief was unclear, what did you decide and why?)
- Ticket volume stays seed-sized. The list filter runs entirely in the browser on the already-loaded `/tickets` response, so this assumption is what makes client-side filtering acceptable.

## Design decisions
- (Key choices about how you structured the feature, and the trade-offs.)
- **Client-side filtering.** `GET /tickets` already returns the full list and there is no `/users` endpoint, so filtering in the browser (`web/src/filters.ts`) needed zero backend work and gives instant, round-trip-free updates. Assignee options are derived from the loaded tickets rather than a user list. Trade-off: won't scale to large tables — that would need `WHERE`-clause query params on the API. Filter logic is kept generic (one predicate per column) so adding Priority, or moving to server-side, is a localized change.
- **SLA state is computed in the repository (data layer), not the client.** Following the project rule that logic belongs in `*.repository.ts` and repositories return DTOs, the SLA deadline, remaining seconds, and state are derived in SQL by `slaColumns()` (`api/src/tickets/tickets.repository.ts`) and exposed as `slaDeadline` / `slaRemainingSeconds` / `slaState` on the ticket DTO. One shared SQL fragment feeds all three read paths (list, get-by-id, create-returning). The browser is purely presentational: `web/src/sla.ts` holds only the filter option list and `DD:HH:MM` formatting, and the SLA filter is one more `columnPredicate(slaStates, (t) => t.slaState)` over the server-provided value. Trade-off: `slaState` is a snapshot as of the last fetch rather than a live-ticking clock — acceptable because Refresh re-fetches, which re-runs the computation with the DB's `now()`.
- **Clock stops at resolution, keyed on status.** The SLA clock runs against `now()` only while a ticket is `open`/`in_progress`; `resolved`/`closed` tickets freeze at `resolved_at`, giving a `met` state (resolved at or before deadline) vs `breached` (resolved after). Status is the source of truth for whether the clock has stopped, so a ticket with a stale `resolved_at` that was reopened to `in_progress` still shows a live countdown.
- **No fabricated breaches; unrecorded resolutions are `unknown`.** A `resolved`/`closed` ticket with no `resolved_at` can't be judged, so it gets a distinct `unknown` state rendered as a muted dash — never red. (Earlier draft fell back to `updated_at`, which made every such closed ticket read as breached. Fixed after the closed-ticket bug report.) The at-or-before-deadline boundary counts as `met`, not `breached`.
- **Relative warning threshold, not absolute.** A ticket flips to `at_risk` when under 25% of its *own* SLA window remains, rather than a fixed hours cutoff, so an 8h and a 48h SLA warn at the same relative point instead of one warning far earlier.
- **Refresh = recompute + refetch.** Refresh re-fetches `/tickets` (which recomputes every SLA state server-side) and stamps the "Last refreshed" time in the toolbar.
- **Tested in the data layer.** Because the SLA computation now lives in SQL, it is covered by the API suite (`api/test/tickets.test.ts`) rather than the untested web layer. See the Tests section below.

## Tests
All tests live in `api/test/tickets.test.ts` and run against the `deskline_test` DB (`npm test`). The SLA work added the following.

- **SLA state derivation** (`SLA computation` block) — each test inserts a ticket with precise timings via a helper and asserts the state read back from `GET /tickets`:
  - `at_risk` — active ticket with under 25% of its window remaining.
  - `breached` (active) — an `in_progress` ticket past its deadline, proving the clock stays live when there is no `resolved_at`.
  - `met` — a ticket resolved before its deadline (frozen).
  - `breached` (frozen) — a ticket resolved *after* its deadline.
  - `met` at the boundary — resolved exactly at the deadline, pinning the at-or-before-deadline rule.
  - `unknown` — a `closed` ticket with no `resolved_at`, and its `slaRemainingSeconds` is `null`.
- **Per-path SLA field assertions** — the shared `slaColumns()` SQL is embedded in three read paths, so each is checked to build the fields correctly:
  - `GET /tickets` (list) — `slaState`, `slaDeadline`, and the `slaRemainingSeconds` range for the seed's open ticket.
  - `GET /tickets/:id` (get-by-id) — the same fields on the single-ticket path.
  - `POST /tickets` — the `RETURNING` path, which builds the columns unqualified; asserts a newly created ticket is `ok` with roughly its full window remaining.

The web layer has no test runner configured in this project, which is acceptable since `web/src/sla.ts` is now only option lists and `DD:HH:MM` formatting — the behaviour under test moved to the API.

## Where I used AI
- (What you used it for, and where you accepted / rejected / corrected its output.)
- **SLA feature.** AI drafted the initial implementation entirely in the React client. Two corrections were made: (1) it was moved into the repository/SQL layer to match the project's "logic lives in repositories, DTOs out" rule; (2) its first cut fell back to `updated_at` when `resolved_at` was missing, which made every closed ticket without a resolution time render as breached — replaced with an explicit `unknown` state after testing against the seed data. The relative (25%-of-window) threshold and freeze-at-resolution semantics were accepted as designed.

## Anything I noticed in the existing code
- (Concerns, bugs, or things you would change — fixed or just flagged.)

## What I'd do with more time
- (What you deliberately left out, and what you'd tackle next.)
