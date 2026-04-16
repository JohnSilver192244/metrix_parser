# Status — Cloudflare One-Deploy Migration

## Current Status
- `Phase 1` — complete
- `Phase 2` — complete
- `Phase 3` — complete
- `Phase 4` — complete
- `Phase 5` — next active phase

## Completed Artifacts
- [PRD](/Users/andreynikolaev/Documents/optima-ide/metrixParser/.omx/plans/prd-cloudflare-one-deploy.md)
- [Test Spec](/Users/andreynikolaev/Documents/optima-ide/metrixParser/.omx/plans/test-spec-cloudflare-one-deploy.md)
- [Phase 1 Inventory](/Users/andreynikolaev/Documents/optima-ide/metrixParser/.omx/plans/phase1-cloudflare-runtime-inventory.md)
- [Phase 2 Spike Report](/Users/andreynikolaev/Documents/optima-ide/metrixParser/.omx/plans/phase2-cloudflare-compatibility-spike.md)
- [Phase 1 API p95 Baseline](/Users/andreynikolaev/Documents/optima-ide/metrixParser/.omx/perf/cloudflare-phase1-api-baseline.json)

## Locked Decisions
- Surviving app root: `apps/web`
- Initial migration path: thin adapter over the existing API route graph
- Immediate transport-neutral core rewrite: rejected for now
- Current synchronous admin update contract as Cloudflare target: rejected
- Future direction for admin updates: true async accepted-job contract

## Verified Evidence
- `npm run check --workspace @metrix-parser/api`
- `npm run check --workspace @metrix-parser/worker`
- `npm run check --workspace @metrix-parser/web`
- `./node_modules/.bin/tsx --test apps/api/src/app.test.ts apps/api/src/cloudflare/fetch-handler-spike.test.ts`
- `./node_modules/.bin/tsx --test apps/api/src/cloudflare/fetch-handler-spike.test.ts apps/web/src/cloudflare/app-shell.test.ts`
- `npm run test --workspace @metrix-parser/api`
- `npm run test --workspace @metrix-parser/web`
- `npm run build --workspace @metrix-parser/web`

## Next Phase Scope
- Start `Phase 5`
- Classify and expose current worker jobs as cron-driven vs on-demand modules under the unified Cloudflare runtime
- Replace the `scheduled` no-op placeholder with explicit Cloudflare cron dispatch wiring
- Align admin-triggered update flows with the accepted-job contract selected in Phase 2
- Do not reopen Phase 1 or Phase 2 decisions unless new evidence breaks the thin-adapter path

## Suggested Starting Point
Read in this order:
1. [status-cloudflare-one-deploy.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/.omx/plans/status-cloudflare-one-deploy.md)
2. [prd-cloudflare-one-deploy.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/.omx/plans/prd-cloudflare-one-deploy.md)
3. [phase2-cloudflare-compatibility-spike.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/.omx/plans/phase2-cloudflare-compatibility-spike.md)
