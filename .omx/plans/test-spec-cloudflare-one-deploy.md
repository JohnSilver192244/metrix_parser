# Test Spec — Cloudflare One-Deploy Migration

## Scope of Verification
Verify that the migrated system:
- deploys as one Cloudflare project,
- serves the SPA, API routes, and scheduled/background jobs from that single project,
- preserves auth and business behavior,
- keeps Supabase as the data layer,
- and removes separate runtime ownership for `apps/api`.

## Verification Matrix

### 1) Unit Tests
Focus:
- Cloudflare request/response adapter behavior.
- Route path matching and parameter extraction under the new runtime boundary.
- Auth token extraction and protected-route rejection behavior.
- Error-envelope and JSON response parity.
- Cron/scheduled dispatch mapping to decomposed job modules.
- Env parsing and config normalization for the unified app.

Key Cases:
1. Cloudflare `Request` maps correctly into the router context.
2. Representative route params resolve identically to the Node path matcher.
3. Protected write handlers still reject unauthenticated requests with `401 unauthorized`.
4. Same-origin API path construction still resolves correctly from the SPA client.
5. Scheduled trigger names map to the intended job/orchestration module.
6. The extracted runtime seam handles or intentionally drops Node-only compression behavior without changing response correctness.
7. The new handler-test harness validates routes without relying exclusively on fake `IncomingMessage` / `ServerResponse` shims.

### 2) Integration Tests — API Runtime
Focus:
- Representative read and write endpoints served through the unified Cloudflare handler.
- JSON envelope and status-code compatibility.
- Auth/session flows against `app_public.user_sessions`.
- Cache/compression behavior only where it remains intentionally supported.

Key Cases:
1. Health endpoint responds from the unified app.
2. Representative read routes from `competitions`, `players`, and `results` succeed through the Cloudflare handler.
3. Representative protected write/update routes reject guests and accept valid auth.
4. Admin update routes continue to call the correct orchestration modules.
5. No endpoint still depends on the standalone `apps/api/src/main.ts` server bootstrap.
6. Hot read routes capture p95 before/after evidence when the adapter affects their execution path.
7. The chosen update-flow contract is verified explicitly: bounded synchronous completion or accepted-job initiation plus completion lookup/polling.

### 3) Integration Tests — Worker / Job Runtime
Focus:
- Scheduled jobs and on-demand admin-triggered jobs inside the unified Cloudflare project.
- Idempotent behavior of update orchestration.
- Supabase side effects and error handling.
- Fit of the final trigger design to Cloudflare Free cron limits.

Key Cases:
1. Competitions, courses, players, and results update flows still execute the same orchestration logic.
2. Scheduled jobs invoke the correct bounded modules.
3. Failure paths produce structured error signals without leaving the runtime in a partially migrated state.
4. Manual/admin-triggered update flow remains available via the unified API surface.
5. The final schedule set stays within the Cloudflare Free cron-trigger budget.
6. Any job path that currently fans out multiple upstream result fetches proves bounded chunking or another limit-safe invocation strategy.
7. Job invocations that depend on external DiscGolfMetrix fetches stay within the chosen Cloudflare request/subrequest budget.

### 4) UI / SPA Tests
Focus:
- SPA routing via `pushState`.
- Same-origin API behavior.
- Guest vs authenticated navigation.
- Stability of page labels and render structure where UX is not intentionally changed.

Key Cases:
1. Core SPA routes render without page reload.
2. Guests can still access read-only pages and cannot access protected sections.
3. Authenticated users can still use admin update flows.
4. The frontend no longer depends on a separate production API origin.
5. The admin updates UI matches the chosen execution contract instead of assuming a synchronous full-result response forever.

### 5) End-to-End / Deploy Verification
Focus:
- One deploy artifact and one Cloudflare project.
- End-to-end guest, authenticated, and admin flows.
- Scheduled job execution in deployed form.

Key Cases:
1. A deployed build serves the SPA from the Cloudflare project.
2. `/api/*` routes are handled by the same project.
3. Admin update action executes through the same project and reaches the worker modules.
4. Scheduled jobs are configured and executed within that project.
5. There is no second deployable runtime remaining for `apps/api`.
6. The deployed app stays within worker bundle-size and static-asset-count limits for the target Cloudflare plan.
7. The deployed admin update flow behaves correctly when the client disconnects or refreshes mid-operation.

### 6) Observability / Runtime Signals
Focus:
- Health, logs, and timing evidence proving the migration is operating correctly.

Key Cases:
1. Health check reports the unified app is live.
2. Route failures emit structured logs with enough context to identify the adapter boundary.
3. Scheduled job failures emit structured logs with operation identifiers.
4. Hot read paths have before/after p95 comparison captured if the adapter affects them.
5. CPU time, subrequest usage, worker size, static asset count, and cron-trigger usage are measured or explicitly budgeted against current Cloudflare Free limits.
6. Cron schedules are verified in UTC so operational timing does not silently drift after cutover.
7. Update-flow logging shows whether an admin-triggered operation completed synchronously or transitioned to async completion tracking.

## Manual Verification Checklist
1. Build and deploy the Cloudflare project once from the surviving app workspace.
2. Load the SPA and navigate across representative public and protected routes.
3. Sign in and exercise at least one protected admin action.
4. Call representative read and write API endpoints through the deployed same-origin app.
5. Trigger at least one admin update flow that currently crosses into worker orchestration.
6. Verify at least one scheduled job path from the Cloudflare project configuration.
7. Confirm the repo no longer requires a standalone `apps/api` runtime to operate.
8. Confirm the chosen schedule layout and runtime budgets are still acceptable for the current Cloudflare Free plan.
9. Confirm the final cron schedule is correct in UTC.
10. Confirm the built worker and static assets stay within Cloudflare plan limits.
11. Confirm hot read routes have baseline and post-migration p95 evidence.

## Pass / Fail Criteria
- **Pass**
  - One Cloudflare project serves web, API, and scheduled/background functions.
  - Existing business behavior and auth guarantees remain intact.
  - Supabase remains the only data layer.
  - `apps/api` is no longer an independent runtime.
  - Any contract or schema changes are explicitly verified.
- **Fail**
  - Any required flow still depends on split deployment/runtime ownership.
  - Protected endpoints regress on auth.
  - Job execution no longer matches prior orchestration behavior.
  - The system requires more than one deploy target after migration.

## Traceability to Acceptance Criteria
1. **One Cloudflare project**
   - Verified by deploy smoke, health check, and elimination of separate runtime ownership.
2. **One deploy path per push**
   - Verified by root script/deploy config simplification and deployment documentation checks.
3. **Frontend served from the same project**
   - Verified by SPA asset serving and same-origin production requests.
4. **API handled inside that project**
   - Verified by integration tests through the Cloudflare handler.
5. **Background/scheduled work in that project**
   - Verified by scheduled/on-demand job execution tests.
6. **`apps/api` no longer separate**
   - Verified by script/runtime removal and no standalone bootstrap dependency.
7. **Supabase unchanged as data layer**
   - Verified by runtime env and adapter usage.
8. **Business logic unchanged**
   - Verified by route/job regression tests against baseline behavior.
9. **Contract changes covered**
   - Verified by route-level integration tests and SPA E2E checks.
10. **Schema changes covered**
   - Verified only if schema changes are introduced; otherwise explicitly record none.
11. **Free-plan suitability**
   - Verified by bounded job design, one-project deployment, cron-count checks, subrequest budgets, worker-size and asset-count checks, UTC schedule verification, and runtime-budget checks.
