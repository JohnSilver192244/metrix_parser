# Story 1.2: Базовая интеграция Supabase и инфраструктура миграций

Status: done

## Story

As a владелец проекта,
I want иметь подключённый Supabase и подготовленную инфраструктуру миграций,
so that последующие stories могли создавать доменные таблицы и безопасно развивать схему данных.

## Acceptance Criteria

1. Проект подключён к `Supabase Postgres`.
2. Структура `supabase/` и каталог `supabase/migrations` готовы к использованию.
3. Соглашения по `snake_case` для будущих таблиц и колонок зафиксированы.
4. Приложение и backend могут использовать конфигурацию подключения к Supabase без прямого обращения frontend к БД.

## Tasks / Subtasks

- [x] Добавить зависимости и конфигурационные модули для работы с Supabase в `apps/api` и `apps/worker`. (AC: 1, 4)
- [x] Создать bootstrap-файлы окружения и фабрики Supabase-клиента для backend и worker. (AC: 1, 4)
- [x] Подготовить миграционную инфраструктуру в `supabase/`, включая базовую миграцию и фиксацию `snake_case` conventions. (AC: 2, 3)
- [x] Зафиксировать boundary, что frontend не использует Supabase напрямую. (AC: 4)
- [x] Проверить install/check/build после изменений. (AC: 1, 2, 4)

## Dev Notes

- Использовать `Supabase Postgres` как единственную persistent database на MVP.
- `apps/web` не должен обращаться к БД напрямую; только через `apps/api`.
- `apps/api` и `apps/worker` могут иметь собственные конфигурационные модули и Supabase client factories.
- DB naming должен оставаться `snake_case`, а API/frontend boundary — `camelCase`.
- Структура `supabase/` уже создана в story `1.1`, теперь её нужно сделать пригодной для реальной работы следующих историй.

## Change Log

- 2026-03-20: Added Supabase client dependencies and backend/worker environment bootstrapping.
- 2026-03-20: Added migration bootstrap files and documented `snake_case` database conventions in `supabase/`.
- 2026-03-20: Validated the updated workspace successfully with `npm install`, `npm run check`, and `npm run build`.
- 2026-03-20: Addressed code review findings by moving `@supabase/supabase-js` to runtime `dependencies` and removing the unused required `SUPABASE_ANON_KEY` from API env loading.
- 2026-03-21: Added a Node 16 compatible Vite runner in `apps/web` so workspace `build` passes reliably in the current environment.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `package-lock.json` was updated after installing new workspace dependencies.
- Validation generated local `apps/web/dist` artifacts during `vite build`; these are build outputs rather than source deliverables.
- Post-review validation also completed successfully after the dependency bucket fix and API env cleanup.
- `npm run build` initially failed on `Node v16.17.0` because Vite expected `crypto.getRandomValues`; adding a compatible Vite runner resolved the workspace build.

### Completion Notes List

- Added `@supabase/supabase-js` to `apps/api` and `apps/worker` so both runtime boundaries can connect to `Supabase Postgres`.
- Added dedicated environment loaders and Supabase admin client factories for `apps/api` and `apps/worker`.
- Kept the frontend on an API-only boundary; no direct Supabase client was introduced into `apps/web`.
- Added `supabase/README.md` plus a bootstrap migration `0001_schema_conventions.sql` to lock in `snake_case` conventions before domain schema work starts.
- Successfully ran `npm install --workspaces --include-workspace-root`, `npm run check`, and `npm run build`.
- Applied the post-review fix by moving `@supabase/supabase-js` from `devDependencies` to `dependencies` in backend packages.
- Removed the unnecessary required `SUPABASE_ANON_KEY` from API environment loading because the current implementation only uses the service-role client.
- Re-ran `npm install --workspaces --include-workspace-root`, `npm run check`, and `npm run build` after the fix; all passed.
- Added `apps/web/scripts/vite-runner.mjs` and routed web `dev/build` scripts through it so Vite remains buildable under the repository's current Node 16 runtime.
- Re-validated with `npm run check`, `npm run build`, and `npm run check:workspace`; all passed on 2026-03-21.

### File List

- .env.example
- package-lock.json
- apps/api/package.json
- apps/api/src/config/env.ts
- apps/api/src/lib/supabase-admin.ts
- apps/api/src/main.ts
- apps/worker/package.json
- apps/worker/src/config/env.ts
- apps/worker/src/lib/supabase-admin.ts
- apps/worker/src/main.ts
- apps/web/package.json
- apps/web/scripts/vite-runner.mjs
- supabase/README.md
- supabase/migrations/0001_schema_conventions.sql
