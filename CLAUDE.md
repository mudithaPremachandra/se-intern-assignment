# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

DeskLine is a support-desk service: an API (`api/`) and an agent-facing web UI (`web/`). See `README.md` for the domain model and getting-started steps.

## Commands (run from repo root)

- **Start DB:** `docker compose up -d` (Postgres 15 on `localhost:5432`, Adminer on `:8081`). Tests and the app both need this running.
- **Install:** per-package, not at root — `(cd api && npm install)` and `(cd web && npm install)`.
- **Reset/seed dev DB:** `npm run seed` — drops and recreates tables from `api/db/schema.sql`, loads `api/db/seed.sql`. Safe to re-run.
- **Run API:** `npm run dev:api` → http://localhost:3000
- **Run web:** `npm run dev:web` → http://localhost:5173 (proxies API calls to port 3000)
- **Test:** `npm test` — runs `vitest run` in `api/` only (web has no tests). Uses a separate `deskline_test` DB, created automatically; the dev DB is untouched.
- **Typecheck:** `cd api && npm run typecheck`. No linter/formatter is configured — **typecheck is the only gate.**

## Stack

- `api/`: Fastify 4 + TypeScript (ESM, `"type":"module"`), PostgreSQL via `pg`, zod validation, run with `tsx`. Node 20+.
- `web/`: React 18 + TypeScript + Vite 5.
- TS is `strict`, `moduleResolution: "Bundler"` — **imports omit file extensions.**

## Conventions

- **All SQL lives in `*.repository.ts` files; route handlers (`*.routes.ts`) stay thin.** Repositories return DTOs, not raw rows. Derived/computed per-row values (e.g. an SLA state from timestamps) are computed in SQL here too, not in the web client.
- DB columns are `snake_case`; API responses are `camelCase`, converted **only** in `src/mappers.ts`.
- `pg` returns `bigint`/`numeric` columns as **strings**; coerce them to `number` in `src/mappers.ts` (allow `null` when the SQL can yield null).
- Request validation: zod schemas in `*.schema.ts`, parsed inside handlers.
- Errors: throw `new AppError(statusCode, message)`; the central handler in `src/errors.ts` renders it (ZodError → 400).
- Feature-folder layout under `api/src/` (`tickets/`, `users/`, `comments/`); routes registered in `server.ts` via `buildServer()`.
- No linter/formatter — match the surrounding code's style.

## DECISIONS.md

Keep `DECISIONS.md` updated as work proceeds: record assumptions made, design trade-offs, and specifically where AI output was used, accepted, overridden, or corrected. Follow the template already in the file.
