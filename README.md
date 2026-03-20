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
