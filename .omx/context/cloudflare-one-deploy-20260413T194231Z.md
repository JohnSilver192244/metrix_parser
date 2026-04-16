# Context Snapshot — cloudflare-one-deploy phase-3-onward

## Task Statement
Execute `.omx/plans/prd-cloudflare-one-deploy.md` starting from `Phase 3 — Create the Unified Cloudflare App Shell` and continue through implementation, verification, and cleanup.

## Desired Outcome
- `apps/web` becomes the single Cloudflare app shell.
- One documented dev/build/deploy path serves SPA, API routes, and scheduled jobs.
- Existing auth and domain behavior remain intact while runtime ownership is consolidated.
- The migration continues from the completed Phase 1 and Phase 2 artifacts instead of redoing them.

## Known Facts / Evidence
- Previous Ralph execution completed only through Phase 2 and marked that scope complete.
- `.omx/plans/status-cloudflare-one-deploy.md` marks Phase 3 as the next active phase.
- `.omx/plans/test-spec-cloudflare-one-deploy.md` already defines the verification matrix for the remaining migration.
- `apps/api/src/cloudflare/fetch-handler-spike.ts` and its test exist from the compatibility spike.
- Root scripts still expose split runtime entrypoints: `dev:web`, `dev:api`, and `dev:worker`.
- `apps/web/src/shared/api/http.ts` already supports same-origin fallback via `window.location.origin`.
- No Cloudflare config is present yet in the active app shell.

## Constraints
- Preserve business logic; change runtime boundaries, not domain behavior.
- No new deploy target; end state must be one Cloudflare project.
- Supabase remains the data layer.
- Verification is mandatory before claiming completion.
- Existing unrelated workspace changes must not be reverted.

## Unknowns / Open Questions
- Exact repo files needed for Cloudflare Vite plugin + Wrangler integration in `apps/web`.
- Whether job runtime unification can be completed in one pass or needs adapter scaffolding plus follow-up deletions.
- Which existing tests require extension vs replacement for the unified handler/runtime.

## Likely Codebase Touchpoints
- `/Users/andreynikolaev/Documents/optima-ide/metrixParser/package.json`
- `/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/web`
- `/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/api`
- `/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/worker`
- `/Users/andreynikolaev/Documents/optima-ide/metrixParser/packages/*`
- Cloudflare config files to be added under `apps/web`
