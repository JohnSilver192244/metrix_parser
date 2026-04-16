# Context Snapshot — cloudflare-one-deploy

## Task Statement
Plan the migration of the existing split `apps/web` + `apps/api` + `apps/worker` monorepo runtime into a single Cloudflare full-stack deployment, using `.omx/specs/deep-interview-cloudflare-one-deploy.md` as the source of truth.

## Desired Outcome
- One Cloudflare project is the only deploy target.
- One push maps to one deploy.
- Frontend, API routes, and background/scheduled jobs run within the same Cloudflare project.
- Supabase remains the database.
- Business logic and domain behavior remain unchanged.

## Known Facts / Evidence
- Root workspace currently exposes separate scripts: `dev:web`, `dev:api`, and `dev:worker` in `package.json`.
- `apps/web` is a Vite React SPA and, outside dev, its API client already falls back to `window.location.origin`, which is compatible with same-origin API hosting.
- `apps/api` currently runs as a standalone Node `http` server from `apps/api/src/main.ts`, with a custom router in `apps/api/src/lib/router.ts`.
- API routes are composed from modular route registries in `apps/api/src/modules/index.ts`.
- `apps/worker` is a separate workspace with orchestration and job modules under `apps/worker/src/jobs` and `apps/worker/src/orchestration`.
- The API already imports worker orchestration directly in `apps/api/src/modules/updates/execution.ts`, which indicates existing shared runtime coupling between API and worker code.
- No existing `wrangler.toml` or `wrangler.jsonc` is present under `apps/*`.

## Constraints
- Cloudflare free-plan compatibility is mandatory.
- The final architecture must be one Cloudflare project and one deploy path.
- Supabase remains the data layer.
- Runtime and infra changes are allowed; business logic changes are not.
- Schema changes are allowed only with full endpoint and flow verification.

## Unknowns / Open Questions
- Whether the final Cloudflare target should be Workers Assets + Worker routes, Pages Functions, or a hybrid single-project Worker entrypoint.
- Which current Node-specific APIs in `apps/api` need adaptation for Cloudflare request/response semantics.
- Which worker jobs need HTTP-triggered execution vs Cron-triggered scheduling vs queue-style decomposition.
- Whether any current scripts or tests assume a standalone Node server process boundary that must be replaced.

## Likely Codebase Touchpoints
- `package.json`
- `apps/web`
- `apps/api`
- `apps/worker`
- `packages/*`
- deployment/config files to be added at repo root or consolidated app root
- shared API/client contract modules and Supabase adapters
