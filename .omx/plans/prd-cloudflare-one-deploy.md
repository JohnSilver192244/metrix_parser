# PRD — Cloudflare One-Deploy Migration

## Execution Status
- Current status summary: [status-cloudflare-one-deploy.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/.omx/plans/status-cloudflare-one-deploy.md)
- Completed:
  - `Phase 1 — Baseline and Runtime Inventory`
  - `Phase 2 — Cloudflare Compatibility Spike and Decision Gate`
- Next active phase:
  - `Phase 3 — Create the Unified Cloudflare App Shell`
- Locked execution decisions from Phase 2:
  - thin adapter path is `GO`
  - immediate transport-neutral core rewrite is `NO-GO`
  - current synchronous admin update contract is `NO-GO`
  - future async accepted-job admin update contract is `GO`

## RALPLAN-DR Summary

### Principles
1. Preserve business behavior; migrate runtime boundaries, not domain logic.
2. Prefer additive adapters over rewriting proven route and job modules.
3. End with exactly one Cloudflare deploy target and one push-to-deploy path.
4. Keep Supabase as the only database boundary and preserve existing auth guarantees.
5. Ship with verification at every migration seam: routes, jobs, contracts, and deploy wiring.

### Decision Drivers
1. Single-project Cloudflare free-plan compatibility with frontend, API, and scheduled/background work in one deployable.
2. Lowest-risk path from the current brownfield layout: Vite SPA in `apps/web`, Node `http` server + custom router in `apps/api`, and job/orchestration modules in `apps/worker`.
3. Strong regression protection while URL/JSON/schema changes remain allowed but must be explicitly verified.
4. Fit the current Cloudflare-supported full-stack Vite path instead of inventing custom deploy plumbing when the platform now has an official Vite plugin flow.

### Viable Options
#### Option A — Consolidate into a single Cloudflare Worker app rooted in `apps/web`
- Shape: keep `apps/web` as the surviving app, adopt the official Cloudflare Vite plugin + Wrangler flow, add Worker entrypoints for `fetch` and `scheduled`, build static assets with Vite, adapt API routes to Cloudflare handlers, and absorb worker jobs as internal modules.
- Pros:
  - Best fit to the requirement that `apps/web` becomes the Cloudflare full-stack project.
  - Reuses the existing same-origin production assumption in `apps/web/src/shared/api/http.ts`.
  - Minimizes deploy-path complexity because one workspace owns static assets, API, and schedules.
- Cons:
  - Requires explicit Node-to-Cloudflare adaptation for the custom API router.
  - Forces a controlled relocation of worker runtime ownership.

#### Option B — Create a new dedicated Cloudflare app workspace and migrate web/api/worker into it
- Shape: add a new full-stack workspace, move or copy concerns from `apps/web`, `apps/api`, and `apps/worker`, then retire the old apps.
- Pros:
  - Clean separation between legacy and target runtime during migration.
  - Fewer in-place mutations while proving the Cloudflare shell.
- Cons:
  - Higher repo churn and larger rename/move surface.
  - Makes the “`apps/web` is migrated into the Cloudflare full-stack project” requirement less direct.
  - Adds transitional duplication that can obscure the single-source-of-truth goal.

#### Option C — Keep current apps and unify deployment only at CI level
- Shape: preserve separate web/api/worker runtimes but trigger them from one branch and one pipeline.
- Pros:
  - Lowest initial code churn.
- Cons:
  - Violates the explicit one-project / one-runtime goal.
  - Fails the requirement to remove `apps/api` as a separate service and to host everything as one Cloudflare project.

### Chosen Direction
Choose **Option A**: consolidate into a single Cloudflare Worker app rooted in `apps/web`, with `apps/api` runtime deleted and `apps/worker` reduced to internal job modules that execute inside the same Cloudflare project.

### Invalidation Rationale
- Reject **Option B** because it adds migration noise and duplicate app ownership without improving the final architecture.
- Reject **Option C** because it is a deploy orchestration change, not the required runtime consolidation.

### Pre-Mortem
1. **Runtime incompatibility failure**
   - Scenario: the Node `IncomingMessage`/`ServerResponse` router assumptions in `apps/api/src/lib/router.ts` are carried over too late, causing a large rewrite at the end.
   - Countermeasure: establish a Cloudflare adapter seam early, prove one representative route slice end-to-end, and use that slice as a go/no-go checkpoint before wider porting.
2. **Background job fit failure**
   - Scenario: worker jobs assume long-running or process-oriented execution and exceed Cloudflare Free limits such as 10 ms CPU time per HTTP request / Cron Trigger and the small Cron Trigger budget.
   - Countermeasure: classify each job by trigger type and runtime budget up front, collapse schedules into a small fan-in set, split orchestration into bounded scheduled and on-demand units, and budget per-invocation fan-out against the 50-subrequest limit.
3. **Contract drift failure**
   - Scenario: path, auth, or JSON envelope behavior changes while moving to same-origin Cloudflare hosting, breaking the SPA or admin flows.
   - Countermeasure: lock critical route contracts with integration tests before cutover and verify same-origin auth/session flows end-to-end.

### Expanded Test Plan
- **Unit**
  - Cloudflare request/response adapter for API routing.
  - URL/path normalization, JSON envelope generation, auth header propagation, cache behavior guards, and cron dispatch mapping.
- **Integration**
  - Route-level tests for representative read and write endpoints against the new Cloudflare handler surface.
  - Scheduled/on-demand job execution tests against decomposed worker modules.
  - Static asset + API co-hosting verification from the built app entrypoint.
- **E2E**
  - Guest and authenticated navigation through SPA routes with same-origin API calls.
  - Admin update flows that currently cross web -> API -> worker orchestration.
  - One-deploy smoke test: deploy artifact serves web, `/api/*`, and scheduled jobs from one Cloudflare project.
- **Observability**
  - Deployment health endpoint checks.
  - Structured logs for route failures, scheduled job failures, and adapter boundary errors.
  - Timing markers for hot API routes and background job runs to compare pre/post migration behavior against Cloudflare Free limits.

## Problem Statement
The repository currently operates as three runtime surfaces:
- `apps/web`: Vite React SPA
- `apps/api`: standalone Node `http` server with modular routes
- `apps/worker`: standalone job/orchestration workspace

This split conflicts with the target operating model: one repo, one branch, one push, one Cloudflare project, and one deploy path suitable for the Cloudflare free plan. The migration must preserve business logic while collapsing runtime ownership into a single Cloudflare full-stack deployment.

## Goals
1. Serve the frontend from one Cloudflare project.
2. Handle API routes inside that same Cloudflare project.
3. Run scheduled/background jobs inside that same Cloudflare project as bounded internal job modules.
4. Remove `apps/api` as an independent runtime.
5. Preserve existing business logic, auth rules, domain calculations, and Supabase as the data layer.
6. Keep one branch and one push-to-deploy path.
7. Prove compatibility with updated tests across endpoints, jobs, and user flows.

## Non-Goals
- No intentional business-logic, algorithm, or scoring changes.
- No second deploy target.
- No repo split.
- No migration away from Supabase.
- No unverified schema change.
- No long-term coexistence of separate frontend/backend/worker runtimes after cutover.

## Architecture Decision and Migration Shape
### Target Shape
- `apps/web` becomes the single Cloudflare application workspace.
- Vite continues to build the SPA assets, but now through the official `@cloudflare/vite-plugin` + Wrangler path.
- A Cloudflare Worker entrypoint in `apps/web` (or an adjacent Cloudflare runtime folder under that workspace) handles:
  - `fetch` for static asset serving and `/api/*` dispatch
  - `scheduled` for cron-driven jobs
  - optional internal service dispatch for on-demand admin update flows
- The current modular API route layer is preserved logically, but adapted from Node request/response objects to Cloudflare `Request`/`Response`.
- `apps/worker` job and orchestration logic is preserved logically, but refactored into Cloudflare-compatible internal modules invoked by:
  - cron schedules for autonomous tasks
  - fetch-triggered handlers for admin/manual updates
- Shared logic that is currently imported across workspace boundaries remains reusable, but runtime-only bootstrap code is consolidated.
- If adapter seams reveal unstable cross-workspace imports, extract only the runtime-neutral pieces into `packages/*`; do not mass-move domain logic preemptively.

### Why This Fits the Brownfield
- `apps/web` already supports same-origin production API resolution.
- `apps/api` already centralizes routing via `getRegisteredRoutes()` and `createApiRequestHandler()`, giving a clear boundary for adapter work.
- `apps/api/src/modules/updates/execution.ts` already imports worker orchestration directly, which reduces conceptual distance between API and worker logic and supports a single runtime.
- Cloudflare’s current official Vite plugin supports full-stack applications, static assets, and local development in the Workers runtime, which matches the existing React + Vite app better than a bespoke deploy setup.
- The final shape remains one Cloudflare project, but the migration path must still keep an explicit rollback gate until the router seam, update-flow contract, and workload-fit assumptions are proven against the current brownfield.

## Phased Implementation Plan

### Phase 1 — Baseline and Runtime Inventory
Scope:
- Inventory all current entrypoints, deploy scripts, env requirements, route groups, admin write paths, and worker triggers.
- Identify Node-only assumptions in `apps/api` and long-running assumptions in `apps/worker`.
- Measure or estimate current Cloudflare-fit constraints that can invalidate the target shape early: CPU-heavy paths, subrequest-heavy flows, worker bundle size, static asset count, and cron trigger count.
- Explicitly map current and target schedules to UTC because Cloudflare cron handlers execute on UTC.
- Freeze critical API and admin contracts with baseline tests where missing.

Acceptance Criteria:
1. A migration inventory exists for API routes, job triggers, and required env vars.
2. All write endpoints and auth-protected flows are explicitly identified.
3. A baseline verification list exists for critical user and admin flows.
4. Free-plan blockers are explicitly listed with a pass/fail call, not left implicit.
5. Each current worker flow has an estimated budget for request count, subrequests, CPU pressure, and schedule ownership.
6. The migration inventory records worker bundle size and static asset count constraints for the surviving app workspace.
7. Baseline p95 evidence exists for hot read paths that will cross the Cloudflare adapter boundary.

### Phase 2 — Cloudflare Compatibility Spike and Decision Gate
Scope:
- Prove one representative read route and one representative protected write route through a Cloudflare-style `fetch` entrypoint before broader migration.
- Classify the current API runtime seam into one of two explicit implementation paths:
  - thin adapter over the existing route registry, or
  - extracted transport-neutral HTTP core with runtime-specific adapters.
- Validate the highest-risk Node-only assumptions up front:
  - `IncomingMessage` / `ServerResponse` dependence in the router,
  - in-app gzip/brotli response capture,
  - `undici.Agent` and global fetch bootstrapping in the Supabase client,
  - current test harness dependence on fake Node request/response objects.
- Decide the update-flow execution contract for Cloudflare:
  - keep a synchronous HTTP-triggered flow only if it is proven bounded for Free-plan limits and client disconnect behavior, or
  - move to a true async accepted-job + status/poll contract.

Acceptance Criteria:
1. A read-route spike and a protected write-route spike run through a Cloudflare-style `fetch` surface.
2. The plan records an explicit go/no-go choice between thin adapter and extracted transport-neutral core.
3. The plan records an explicit go/no-go choice for synchronous vs async admin-triggered updates.
4. If the spike fails to preserve behavior with a thin adapter, the migration path escalates to the extracted-core option before wider porting.
5. The current test harness migration strategy is decided before route-by-route implementation starts.

### Phase 3 — Create the Unified Cloudflare App Shell
Scope:
- Add Cloudflare project config and single deploy wiring to `apps/web`.
- Adopt `@cloudflare/vite-plugin` and Wrangler as the standard build/deploy path.
- Define Worker entrypoints for `fetch` and `scheduled`.
- Wire Vite build output into the Cloudflare project.
- Preserve local dev parity strategy for web + API within the unified app.

Acceptance Criteria:
1. The repo has one Cloudflare project configuration and one documented deploy path.
2. Static assets build through `apps/web` and can be served by the Cloudflare shell.
3. The unified app shell can answer a basic health check and serve the SPA entry.
4. Local development runs the app in the Workers-compatible runtime, not only through a standalone Node server.
5. The shell design records asset-routing policy for the SPA and proves the asset/bundle layout stays within Cloudflare limits.

### Phase 4 — Adapt API Routing to Cloudflare Request Handling
Scope:
- Introduce an adapter layer that maps Cloudflare `Request`/`Response` to the existing route/module composition.
- Port auth/session extraction, JSON envelopes, compression policy, caching hooks, and error handling.
- Keep module boundaries intact where possible; move only bootstrap/runtime glue.
- Explicitly isolate Node-only seams before broad migration: `node:http` request/response types, `zlib` compression, and the `undici`-backed Supabase bootstrap.
- If a thin adapter proves unstable after the first slice, extract a runtime-neutral HTTP core before touching individual route modules broadly.
- Replace the current Node-only test harness with a unified-handler harness that can validate the Cloudflare path without depending on fake `IncomingMessage` / `ServerResponse` objects.

Acceptance Criteria:
1. One representative read route and one representative protected write route execute through the Cloudflare handler before wider route migration begins.
2. Auth-required endpoints still return `401 unauthorized` when appropriate.
3. Same-origin SPA calls work against the unified project without cross-origin fallback in production.
4. The old standalone `apps/api` runtime is no longer required for local or deployed execution.
5. The plan explicitly decides whether response compression remains in-app, moves to platform handling, or is dropped where Cloudflare already covers it.
6. Route-level verification no longer depends exclusively on the existing Node request/response test shim.

### Phase 5 — Decompose Worker Runtime into Cloudflare Jobs
Scope:
- Classify current worker jobs into cron-driven, on-demand admin-triggered, or shared orchestration-only modules.
- Refactor bootstrap/process assumptions out of `apps/worker/src/main.ts`.
- Re-home or expose the jobs through the unified Cloudflare runtime while preserving orchestration behavior.
- Consolidate schedules to respect Cloudflare Free cron limits and move heavier work to explicitly triggered bounded units where needed.
- Add explicit chunking or resume boundaries for flows whose current fan-out can exceed Cloudflare request/subrequest budgets.
- For admin-triggered update flows, align the UI/API contract with the chosen execution model from Phase 2 so a Cloudflare request does not pretend to be asynchronous while still waiting for the full workload to complete.

Acceptance Criteria:
1. Current update flows still reach the same orchestration logic from the unified app.
2. Scheduled jobs are configured through the Cloudflare project, not a separate worker runtime.
3. Job modules remain bounded enough for Cloudflare execution limits.
4. The final cron design fits within the Cloudflare Free trigger budget.
5. No single on-demand or scheduled job invocation relies on unbounded upstream fetch fan-out.
6. The final update-flow contract is explicit and testable: either bounded synchronous execution or accepted-job plus observable completion state.

### Phase 6 — Retire Split Runtime Ownership
Scope:
- Remove separate deploy/runtime responsibilities from `apps/api`.
- Reduce `apps/worker` to reusable internal modules or merge the necessary runtime-owned modules into the surviving app/package boundary.
- Simplify root scripts so one dev/deploy path maps to one app.

Acceptance Criteria:
1. `apps/api` no longer exists as a separate service/runtime.
2. Root scripts no longer imply three independent deployable runtimes.
3. One push maps to one deployable Cloudflare project.

### Phase 7 — End-to-End Verification and Cutover Hardening
Scope:
- Run full test suites for web, API handler behavior, and job execution.
- Verify critical guest, authenticated, and admin update flows.
- Validate deploy suitability for Cloudflare free-plan constraints.
- Apply only schema changes that were proven necessary and fully verified.

Acceptance Criteria:
1. Web, API, and job verification pass from the unified project.
2. Business behavior matches baseline expectations.
3. Any URL/JSON/schema changes are documented and covered by tests.
4. The final deploy is one Cloudflare project suitable for the free plan.

## Concrete Codebase Touchpoints
- Root:
  - `package.json`
  - CI/deploy scripts and any new Cloudflare config files
- Frontend:
  - `apps/web/package.json`
  - `apps/web/vite.config.ts`
  - `apps/web/src/shared/api/http.ts`
  - `apps/web/src/main.tsx`
  - route shell under `apps/web/src/app/*`
- API:
  - `apps/api/src/app.ts`
  - `apps/api/src/main.ts`
  - `apps/api/src/lib/router.ts`
  - `apps/api/src/modules/index.ts`
  - representative route modules under `apps/api/src/modules/*`
  - `apps/api/src/config/env.ts`
- Worker:
  - `apps/worker/src/main.ts`
  - `apps/worker/src/jobs/*`
  - `apps/worker/src/orchestration/*`
  - `apps/worker/src/config/env.ts`
  - shared persistence/integration modules under `apps/worker/src/lib`, `src/persistence`, `src/integration`
- Shared:
  - `packages/*`
  - shared contract types used by web/api/worker

## Risks and Mitigations
1. **Cloudflare runtime mismatch**
   - Mitigation: isolate a request/response adapter layer before touching route modules broadly and use an early route-slice proof as the decision gate.
2. **Auth regression on write paths**
   - Mitigation: preserve server-side authorization checks and add targeted integration tests for protected endpoints.
3. **Scheduled job time-budget overruns**
   - Mitigation: split jobs by trigger and scope, keep CPU-heavy work out of cron hot paths, validate subrequest counts as well as CPU time, and introduce bounded chunking where a single invocation is too large.
4. **Excessive migration churn**
   - Mitigation: keep `apps/web` as the surviving workspace and preserve module boundaries where possible.
5. **Contract drift for admin update flows**
   - Mitigation: lock `web -> api -> worker` flows with integration/E2E coverage before retiring the old runtime split.
6. **Performance regressions on hot read paths**
   - Mitigation: measure p95 before/after and keep payload/caching behavior explicit during adapter migration.
7. **Free-plan incompatibility discovered late**
   - Mitigation: validate request volume, cron count, worker size, static asset count, subrequest budgets, and CPU budgets during Phase 1 and treat any breach as an architectural blocker, not a post-cutover surprise.
8. **UTC schedule drift**
   - Mitigation: define the production cron schedule in UTC explicitly and verify any user-facing operational expectations against that schedule before cutover.
9. **False async contract on admin-triggered updates**
   - Mitigation: explicitly choose bounded sync vs accepted-job semantics in Phase 2, then update UI/API tests to match the chosen contract instead of preserving the current ambiguous `202 after completion` behavior.

## Execution Handoff

### Available Agent Types
- `planner` — sequence implementation slices and maintain migration checkpoints.
- `architect` — validate transport-seam, runtime-boundary, and Cloudflare-fit decisions.
- `executor` — implement the chosen migration path.
- `debugger` — isolate runtime regressions or Cloudflare-specific failures.
- `test-engineer` — design and extend unit/integration/E2E coverage.
- `verifier` — confirm completion evidence against the PRD and test spec.

### Suggested Reasoning by Lane
- Planning / sequencing: medium
- Transport adapter / runtime-boundary changes: high
- Worker/job decomposition: high
- Test harness and regression coverage: medium
- Final verification / evidence review: high

### Ralph Staffing Guidance
- Use `$ralph` when one owner should execute the phases sequentially with hard verification gates between them.
- Recommended lane order:
  1. Phase 1 inventory and baseline evidence
  2. Phase 2 compatibility spike and decision gate
  3. Phase 3 shell setup
  4. Phase 4 API migration
  5. Phase 5 job migration and update-flow contract
  6. Phase 6 runtime retirement
  7. Phase 7 verification and cutover evidence
- Required stop gates:
  - Do not begin broad API migration until the Phase 2 read/write spike passes.
  - Do not finalize job migration until the update-flow contract is explicit and testable.
  - Do not retire split runtimes until the unified handler and jobs pass the verification matrix.

### Team Staffing Guidance
- Use `$team` when you want bounded parallel lanes after Phase 2 approves the migration path.
- Recommended initial lane split:
  - Lane A: Cloudflare app shell and deploy wiring
  - Lane B: API transport seam and test harness migration
  - Lane C: Worker/job decomposition and update-flow contract
  - Lane D: Verification matrix, p95 baselines, and end-to-end evidence
- Shared-file caution:
  - `apps/web/package.json`, `apps/web/vite.config.ts`, Cloudflare config, and shared contract files need explicit ownership to avoid conflicts.
  - `apps/api/src/lib/router.ts`, `apps/api/src/app.ts`, and update-route files should stay in one lane at a time.

### Launch Hints
- Sequential execution:
  - `$ralph .omx/plans/prd-cloudflare-one-deploy.md`
- Parallel execution after Phase 2 choice is approved:
  - `$team .omx/plans/prd-cloudflare-one-deploy.md`
  - `omx team` should assign at least one verification lane that does not own production edits.

### Team Verification Path
1. Verify the Phase 2 compatibility spike against one read route and one protected write route.
2. Verify the chosen update-flow contract against the UI and API together.
3. Verify worker/job limits with measured or budgeted evidence for subrequests, cron count, worker size, and asset count.
4. Run workspace tests affected by web, API, and worker changes.
5. Run deployment smoke checks proving one Cloudflare project serves SPA, `/api/*`, and scheduled work.
6. Compare hot-path p95 before and after the adapter migration.

## Verification Strategy
- Baseline critical routes and admin flows before structural changes.
- Verify each phase independently rather than relying on one final big-bang test run.
- Keep API behavior comparison focused on:
  - status codes
  - envelope shape
  - auth behavior
  - route coverage
  - read-path performance
- Keep worker behavior comparison focused on:
  - trigger mapping
  - side effects in Supabase
  - idempotent reruns
- Keep SPA behavior comparison focused on:
  - route rendering
  - same-origin API usage
  - guest vs authenticated access
- Keep platform-fit comparison focused on:
  - cron trigger count
  - CPU time headroom
  - subrequest headroom
  - worker bundle size
  - static asset count
  - request-budget assumptions on the Free plan
- Capture p95 before/after for hot read paths whose behavior changes during the adapter migration, and keep SQL/endpoint metrics for those routes as evidence.

## ADR
### Decision
Consolidate the application into a single Cloudflare Worker-based full-stack project rooted in `apps/web`, adapting the existing API and worker logic into Cloudflare-compatible handlers and scheduled jobs.

### Drivers
- Single-project Cloudflare free-plan target.
- Preserve existing application behavior while minimizing migration churn.
- Align the surviving app with the already-existing frontend same-origin production model.

### Alternatives Considered
- New dedicated Cloudflare workspace with later retirement of legacy apps.
- CI-only unified deploy while keeping separate runtimes.

### Why Chosen
It best satisfies the one-project requirement while minimizing duplicate ownership and preserving the clearest brownfield path from current modules to the target runtime.

### Consequences
- `apps/web` gains runtime responsibilities beyond static SPA hosting.
- API bootstrap code must be adapted away from Node-specific request/response primitives.
- Worker jobs must become bounded Cloudflare-compatible modules.
- Local dev and deploy scripts will materially change.

### Follow-Ups
1. Produce the paired test spec and trace each phase back to explicit verification.
2. Run architect review focused on Cloudflare runtime fit and adapter boundaries.
3. Run critic review focused on migration risk, test adequacy, and phase completeness.
