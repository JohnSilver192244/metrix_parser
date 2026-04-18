## Task Statement
Implement phase 5 and phase 6 from `.omx/plans/prd-cloudflare-one-deploy.md` under the Ralph workflow.

## Desired Outcome
- Cloudflare app shell owns scheduled/background update execution.
- Admin-triggered update flows use a true accepted-job contract with observable status instead of waiting for full completion in one HTTP request.
- Split runtime ownership is retired so `apps/api` and `apps/worker` are no longer advertised as separate runnable/deployable services.

## Known Facts / Evidence
- `.omx/plans/status-cloudflare-one-deploy.md` marks phase 5 as next active phase.
- `apps/web/src/cloudflare/app-shell.ts` exposes `scheduled(...)` but currently logs `scheduled-noop` because no cron tasks are registered.
- `apps/api/src/modules/updates/index.ts` currently waits for full execution, then returns `202` with the final result payload.
- `apps/web/src/features/admin-updates/admin-updates-page.tsx` still assumes one request returns the final result.
- Root `package.json` still exposes `dev:api` and `dev:worker`.
- `apps/api/src/main.ts` is still a standalone Node HTTP server bootstrap.
- `apps/worker/src/main.ts` is still treated as a runtime entrypoint by scripts/docs even though it is only a stub.

## Constraints
- Preserve existing business logic and auth guarantees.
- No new dependencies.
- Keep `apps/web` as the surviving Cloudflare app workspace.
- Prefer additive adapters and bounded changes over broad rewrites.

## Unknowns / Open Questions
- Minimal acceptable durability for accepted-job status in this phase without adding new infrastructure.
- Final cron set after reconciling current worker jobs with the shared players/results pipeline.

## Likely Touchpoints
- `packages/shared-types/src/updates/index.ts`
- `apps/api/src/modules/updates/*`
- `apps/web/src/cloudflare/*`
- `apps/web/src/shared/api/updates.ts`
- `apps/web/src/features/admin-updates/*`
- `apps/worker/src/jobs/*`
- `package.json`
- `apps/api/package.json`
- `apps/worker/package.json`
- `apps/api/src/main.ts`
- `apps/worker/src/main.ts`
- `scripts/verify-workspace.mjs`
- `docs/local-run.md`
- `docs/amvera-deploy.md`
