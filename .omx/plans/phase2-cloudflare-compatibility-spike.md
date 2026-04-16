# Phase 2 Report — Cloudflare Compatibility Spike

## Scope
This report records the scoped execution result for PRD Phase 2 only: prove a Cloudflare-style `fetch` route seam on one representative read route and one representative protected write route, then decide the migration direction for:
- thin adapter vs extracted transport-neutral core
- bounded synchronous vs true async admin update contract

## Spike Implementation

### Added spike handler
- [fetch-handler-spike.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/api/src/cloudflare/fetch-handler-spike.ts)

What it does:
- accepts a Web `Request`
- maps it into a minimal Node-like request surface needed by the existing route graph
- captures the current API handler output into a Web `Response`
- reuses the current `createApiRequestHandler(...)` route registry without touching business modules

### Added spike proof tests
- [fetch-handler-spike.test.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/api/src/cloudflare/fetch-handler-spike.test.ts)

Covered proof routes:
- representative read route: `GET /competitions`
- representative protected write route: `POST /updates/competitions`

## Verification Evidence

Targeted test run:
```text
./node_modules/.bin/tsx --test apps/api/src/cloudflare/fetch-handler-spike.test.ts
```

Observed result:
- `2` tests passed
- read route succeeded through the Cloudflare-style `fetch` surface
- protected write route succeeded through the Cloudflare-style `fetch` surface with auth preserved

Additional runtime evidence from the test run:
- `GET /competitions` emitted endpoint metrics through the current instrumentation path
- `POST /updates/competitions` preserved the current `202` contract and auth guard behavior

## Decision 1 — Thin Adapter vs Transport-Neutral Core

### Decision
- `GO` with a thin adapter as the initial migration path.
- `NO-GO` on committing immediately to a transport-neutral core rewrite.

### Why
- The Phase 2 spike proved that the current route registry can be exercised through a Cloudflare-style `Request -> Response` seam without changing business modules.
- The fetch spike reused the existing API composition from [apps/api/src/app.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/api/src/app.ts) and the current route registry from [apps/api/src/modules/index.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/api/src/modules/index.ts).
- The spike therefore clears the minimum transport feasibility bar for a thin-adapter-first migration.

### Caveats that remain open
- The current router and helper stack still depends on Node-shaped types and semantics in:
  - [apps/api/src/lib/router.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/api/src/lib/router.ts)
  - [apps/api/src/lib/http.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/api/src/lib/http.ts)
  - [apps/api/src/modules/auth/runtime.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/api/src/modules/auth/runtime.ts)
- [apps/api/src/lib/supabase-admin.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/api/src/lib/supabase-admin.ts) still assumes the current `undici`-based bootstrap.
- [apps/api/src/app.test.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/api/src/app.test.ts) still uses a fake `IncomingMessage` / `ServerResponse` harness.

### Practical consequence
- Continue with thin-adapter-first execution in later phases.
- Escalate to an extracted transport-neutral core only if the wider route migration breaks on one of the known open seams above.

## Decision 2 — Sync vs Async Admin Update Contract

### Decision
- `NO-GO` for preserving the current effectively synchronous admin update contract as the Cloudflare target.
- `GO` for moving to a true async accepted-job contract in later phases unless a bounded sync path is explicitly proven safe.

### Why
- [apps/api/src/modules/updates/index.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/api/src/modules/updates/index.ts) currently returns HTTP `202`, but only after awaiting the whole update operation. That is not genuinely asynchronous.
- [apps/web/src/features/admin-updates/admin-updates-page.tsx](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/web/src/features/admin-updates/admin-updates-page.tsx) waits for the final result payload before updating the UI.
- Worker flows such as [results-update-job.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/worker/src/jobs/results-update-job.ts) already show enough external fetch fan-out risk that preserving the current contract on Cloudflare Free would be a speculative bet, not a proven safe design.

### Practical consequence
- Later phases should redesign admin updates around:
  - accepted-job initiation
  - observable completion state
  - UI messaging that no longer assumes the full workload finishes within one request lifecycle

## Decision Summary

### Phase 2 gate outcome
- Cloudflare-style route seam: `PASS`
- Thin adapter initial path: `GO`
- Immediate transport-core rewrite: `NO-GO`
- Current synchronous admin updates as final Cloudflare contract: `NO-GO`
- Future async admin update contract: `GO`

## Next-Phase Constraints Created by This Spike
- Broad route migration must not begin without replacing or extending the current Node-only route test harness.
- Compression behavior must be explicitly re-decided during the unified handler implementation.
- Update-flow UI/API tests must be updated when the async contract is introduced; the current UI assumptions are now a tracked migration target, not a preserved invariant.
