# metrixParser

Monorepo skeleton for the metrixParser MVP.

## Workspace Layout

- `apps/web` - SPA frontend on Vite + React + TypeScript
- `apps/api` - backend API skeleton
- `apps/worker` - background import worker skeleton
- `packages/shared-types` - shared contracts and domain types
- `packages/shared-utils` - shared utilities
- `supabase/` - database migrations and local platform config

## Package Manager

The architecture targets a `pnpm` workspace and also includes root `workspaces`
metadata so the repository shape remains compatible with workspace-aware tooling.

## Next Steps

1. Install dependencies with your preferred package manager.
2. Run the web app and verify the workspace resolves all packages.
3. Continue with Story `1.2` to wire Supabase and migrations.

## DiscGolfMetrix Notes

- The competitions import calls `GET /api.php?content=competitions&country_code=...&date1=...&date2=...&code=...`.
- In live DiscGolfMetrix responses, the competitions collection can arrive as `Competitions` with an uppercase key, not only as `competitions`.
- The `content=competitions` endpoint is already scoped by `country_code`, so records that omit per-record `CountryCode` or `Country` fields should still be accepted by the importer.
- Competition persistence should store `course_id` from the competition payload so the courses pipeline can fetch park details by stable source identifier instead of re-deriving it from `raw_payload`.

## Deployment

Deployment instructions for Amvera are available in [docs/amvera-deploy.md](docs/amvera-deploy.md).

## Local Development

Local run instructions are available in [docs/local-run.md](docs/local-run.md).
