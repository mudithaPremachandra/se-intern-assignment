# Decision Log

## Assumptions I made
- (Where the brief was unclear, what did you decide and why?)
- Ticket volume stays seed-sized. The list filter runs entirely in the browser on the already-loaded `/tickets` response, so this assumption is what makes client-side filtering acceptable.

## Design decisions
- (Key choices about how you structured the feature, and the trade-offs.)
- **Client-side filtering.** `GET /tickets` already returns the full list and there is no `/users` endpoint, so filtering in the browser (`web/src/filters.ts`) needed zero backend work and gives instant, round-trip-free updates. Assignee options are derived from the loaded tickets rather than a user list. Trade-off: won't scale to large tables — that would need `WHERE`-clause query params on the API. Filter logic is kept generic (one predicate per column) so adding Priority, or moving to server-side, is a localized change.

## Where I used AI
- (What you used it for, and where you accepted / rejected / corrected its output.)

## Anything I noticed in the existing code
- (Concerns, bugs, or things you would change — fixed or just flagged.)

## What I'd do with more time
- (What you deliberately left out, and what you'd tackle next.)
