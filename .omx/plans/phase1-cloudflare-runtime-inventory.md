# Phase 1 Inventory — Cloudflare One-Deploy Migration

## Scope
Execution inventory for PRD Phase 1 of the Cloudflare one-deploy migration. This document captures the current brownfield runtime shape, free-plan fit gates, baseline verification targets, and the concrete files that drive the Phase 2 compatibility decision.

## Current Runtime Surfaces

### Root orchestration
- Root scripts currently assume three separate runtime surfaces in [package.json](/Users/andreynikolaev/Documents/optima-ide/metrixParser/package.json):
  - `dev:web`
  - `dev:api`
  - `dev:worker`
- Current deploy/runtime ownership is therefore explicitly split before any Cloudflare migration work begins.

### Frontend
- [apps/web/package.json](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/web/package.json) is a Vite React SPA workspace.
- [apps/web/vite.config.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/web/vite.config.ts) is still plain Vite with no Cloudflare plugin or Wrangler integration.
- [apps/web/src/shared/api/http.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/web/src/shared/api/http.ts) already prefers same-origin production requests via `window.location.origin`, which supports the one-project target.

### API runtime
- [apps/api/src/main.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/api/src/main.ts) is a standalone Node `http` server bootstrap.
- [apps/api/src/app.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/api/src/app.ts) routes everything through `createApiRequestHandler()`.
- [apps/api/src/lib/router.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/api/src/lib/router.ts) owns route matching, response capture, gzip/brotli compression, read-cache integration, and final error handling.
- [apps/api/src/modules/index.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/api/src/modules/index.ts) composes the route registry cleanly enough for a Phase 2 transport spike.

### Worker/runtime jobs
- `apps/worker` is not a deployed service in the codebase yet, but it is a separate workspace with its own `dev`, `check`, and `test` scripts in [apps/worker/package.json](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/worker/package.json).
- Current job entry modules:
  - [competitions-update-job.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/worker/src/jobs/competitions-update-job.ts)
  - [courses-update-job.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/worker/src/jobs/courses-update-job.ts)
  - [players-update-job.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/worker/src/jobs/players-update-job.ts)
  - [results-update-job.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/worker/src/jobs/results-update-job.ts)
  - [results-pipeline-update-job.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/worker/src/jobs/results-pipeline-update-job.ts)
  - [demo-update-job.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/worker/src/jobs/demo-update-job.ts)
- [apps/api/src/modules/updates/execution.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/api/src/modules/updates/execution.ts) already imports worker orchestration into the API runtime, which makes single-project consolidation plausible.

## API Route Inventory

### Protected write surfaces
Current explicit write routes in `apps/api/src/modules/*`:
- `PUT /competitions/category` in [apps/api/src/modules/competitions/index.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/api/src/modules/competitions/index.ts)
- `POST|PUT|DELETE /divisions` in [apps/api/src/modules/divisions/index.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/api/src/modules/divisions/index.ts)
- `POST /season-standings/accrual` in [apps/api/src/modules/season-standings/index.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/api/src/modules/season-standings/index.ts)
- `POST /updates/*` in [apps/api/src/modules/updates/index.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/api/src/modules/updates/index.ts)
- `PUT /players` in [apps/api/src/modules/players/index.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/api/src/modules/players/index.ts)
- `POST|PUT|DELETE /tournament-categories` in [apps/api/src/modules/tournament-categories/index.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/api/src/modules/tournament-categories/index.ts)
- `GET /users` is auth-protected even though it is read-only in [apps/api/src/modules/users/index.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/api/src/modules/users/index.ts)

### Auth behavior that must not regress
- Session storage remains in `app_public.user_sessions` through [apps/api/src/modules/auth/runtime.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/api/src/modules/auth/runtime.ts).
- Auth extraction is header-based and currently reads `Authorization: Bearer <token>` directly from `IncomingMessage.headers.authorization`.
- Protected writes correctly rely on server-side `requireAuthenticatedUser(...)`; UI hiding alone is not the guard.

## Environment Inventory

### API runtime env
- [apps/api/src/config/env.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/api/src/config/env.ts)
  - `API_PORT`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- [apps/api/src/modules/updates/execution.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/api/src/modules/updates/execution.ts)
  - `DISCGOLFMETRIX_BASE_URL`
  - `DISCGOLFMETRIX_COUNTRY_CODE`
  - `DISCGOLFMETRIX_API_CODE`
- [apps/api/src/lib/api-read-cache.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/api/src/lib/api-read-cache.ts)
  - `API_READ_CACHE_ENABLED`
  - `API_READ_CACHE_TTL_SECONDS`
  - `API_READ_CACHE_MAX_ENTRIES`

### Worker runtime env
- [apps/worker/src/config/env.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/worker/src/config/env.ts)
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `DISCGOLFMETRIX_BASE_URL`
  - `DISCGOLFMETRIX_COUNTRY_CODE`
  - `DISCGOLFMETRIX_API_CODE`

## Cloudflare Free-Plan Fit Gates

### Gate A — transport/runtime compatibility
- Status: `OPEN`
- Evidence:
  - `apps/api` currently depends on `IncomingMessage` / `ServerResponse` in [apps/api/src/lib/http.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/api/src/lib/http.ts), [apps/api/src/lib/router.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/api/src/lib/router.ts), and [apps/api/src/modules/auth/runtime.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/api/src/modules/auth/runtime.ts).
  - Current route tests in [apps/api/src/app.test.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/api/src/app.test.ts) are built around fake Node request/response shims.
- Phase 2 action: prove a Cloudflare-style `Request -> Response` spike and decide thin adapter vs extracted transport-neutral core.

### Gate B — admin update contract
- Status: `OPEN`
- Evidence:
  - [apps/api/src/modules/updates/index.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/api/src/modules/updates/index.ts) returns `202`, but only after `await executeUpdateOperation(...)` fully completes.
  - [apps/web/src/features/admin-updates/admin-updates-page.tsx](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/web/src/features/admin-updates/admin-updates-page.tsx) waits for a completed `TriggerUpdateResponse` and renders final success/error immediately.
- Phase 2 action: choose bounded sync vs true async contract explicitly.

### Gate C — upstream fan-out and subrequest pressure
- Status: `OPEN`
- Evidence:
  - [apps/worker/src/jobs/results-update-job.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/worker/src/jobs/results-update-job.ts) fetches multiple competition payloads concurrently and can fan out DiscGolfMetrix requests.
  - [apps/worker/src/jobs/results-pipeline-update-job.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/worker/src/jobs/results-pipeline-update-job.ts) is another likely high-fan-out candidate.
- Phase 2 action: do not preserve synchronous HTTP execution for update flows unless the bounded workload is proven safe.

### Gate D — compression and caching behavior
- Status: `OPEN`
- Evidence:
  - [apps/api/src/lib/router.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/api/src/lib/router.ts) currently handles gzip/brotli and response caching itself.
- Phase 2 action: decide whether compression remains application-managed, becomes platform-managed, or is removed at the unified handler boundary.

### Gate E — schedule and UTC ownership
- Status: `OPEN`
- Evidence:
  - No current Cloudflare cron config exists.
  - Worker jobs have to be mapped to explicit cron-driven vs on-demand execution paths.
- Phase 2 action: carry UTC schedule ownership into the compatibility decision and mark cron count as a deployment gate, not a post-cutover task.

## Measured Phase 1 Baselines

### Hot read-route p95 baseline
- Command:
  - `./node_modules/.bin/tsx --eval '(async () => { ...createApiRequestHandler...getPerformanceSnapshot... })();'`
- Persisted snapshot:
  - [.omx/perf/cloudflare-phase1-api-baseline.json](/Users/andreynikolaev/Documents/optima-ide/metrixParser/.omx/perf/cloudflare-phase1-api-baseline.json)
- Captured in-process baseline for routes that will cross the transport seam:
  - `GET /players` — `p95=1.31ms`, `avg=0.24ms`, `n=25`
  - `GET /results` — `p95=0.70ms`, `avg=0.22ms`, `n=25`
  - `GET /competitions` — `p95=0.49ms`, `avg=0.67ms`, `n=25`
- Interpretation:
  - this is a controlled local baseline against the current Node handler with injected in-memory dependencies;
  - it is sufficient for Phase 1 comparison evidence, not for production capacity claims.

### Surviving app static asset baseline
- Command:
  - `npm run build --workspace @metrix-parser/web`
- Build output confirms the current surviving app workspace can be measured today:
  - `dist/index.html` — `397 B`
  - `dist/assets/index-DzrCJU-O.css` — `38,122 B`
  - `dist/assets/index-cGp-SQ64.js` — `305,598 B`
  - total current static asset footprint — `344,117 B`
  - total current built file count — `3`
- Current worker bundle baseline:
  - there is no Cloudflare Worker entrypoint or Wrangler config yet under `apps/web`, so current Worker bundle count is effectively `0` and current Worker bundle size is `not yet materialized`.
  - this is now explicitly recorded, so later phases can compare future Worker output against a known zero-baseline rather than leaving it implicit.

### UTC schedule ownership matrix
Current state:
- there is no repo-level scheduler or cron wiring today; all update jobs are effectively manual/on-demand.

Target planning defaults in UTC for Cloudflare design work:
| Job | Current ownership | Target ownership | Tentative UTC slot | Reason |
| --- | --- | --- | --- | --- |
| `competitions-update-job` | manual/on-demand | scheduled | `01:00 UTC daily` | upstream competition discovery can run first and feed later jobs |
| `courses-update-job` | manual/on-demand | scheduled | `01:30 UTC daily` | derives course ids from saved competitions |
| `results-update-job` | manual/on-demand | scheduled | `02:00 UTC daily` | depends on competition set and fetches external results |
| `players-update-job` | manual/on-demand | scheduled | `02:30 UTC daily` | depends on results pipeline output |
| `results-pipeline-update-job` | manual/on-demand | on-demand only | `no cron by default` | highest fan-out risk; keep behind explicit trigger until bounded |
| `demo-update-job` | manual/non-prod | disabled in prod | `no cron` | not part of production target |

Scheduling rule carried forward:
- keep the production cron count to four or fewer recurring jobs unless later evidence proves more are needed;
- keep all cron definitions in UTC and treat any local-time operational expectation as a documentation concern, not an implicit runtime assumption.

## Baseline Verification Targets

### Existing tests that already protect critical behavior
- Representative API read/write/auth/update behavior in [apps/api/src/app.test.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/api/src/app.test.ts)
- SPA route/auth shell behavior in [apps/web/src/app/App.test.tsx](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/web/src/app/App.test.tsx)
- Admin update UI behavior in [apps/web/src/features/admin-updates/admin-updates-page.test.tsx](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/web/src/features/admin-updates/admin-updates-page.test.tsx)
- Update API client behavior in [apps/web/src/shared/api/updates.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/web/src/shared/api/updates.ts)
- Worker orchestration behavior in:
  - [results-update-job.test.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/worker/src/jobs/results-update-job.test.ts)
  - [results-pipeline-update-job.test.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/worker/src/jobs/results-pipeline-update-job.test.ts)
  - [players-update-job.test.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/worker/src/jobs/players-update-job.test.ts)
  - [competitions-update-job.test.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/worker/src/jobs/competitions-update-job.test.ts)
  - [courses-update-job.test.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/worker/src/jobs/courses-update-job.test.ts)

### Baseline evidence still missing
- No blocking Phase 1 baseline evidence remains open.
- The next unresolved Cloudflare-fit work is Phase 2+ execution work, not missing Phase 1 inventory.

## Phase 1 Exit Decision
- `GO` to Phase 2 compatibility spike.
- Reason:
  - the route graph and auth boundaries are centralized enough to spike the transport seam without broad migration,
  - the admin update contract is already isolated enough to make an explicit bounded-sync vs async decision,
  - the largest migration risks are transport and workload shape, not missing repository context.
