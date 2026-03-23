# Story 4.1: Страница просмотра соревнований

Status: review

## Story

As a сотрудник РДГА,
I want просматривать список соревнований через интерфейс,
so that я могу использовать собранные данные без ручного обращения к DiscGolfMetrix.

## Acceptance Criteria

1. Интерфейс отображает список сохранённых соревнований. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-41-Страница-просмотра-соревнований]
2. Данные загружаются через backend API. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-41-Страница-просмотра-соревнований]
3. Пользователь видит ключевые поля соревнования, достаточные для дальнейшей работы. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-41-Страница-просмотра-соревнований]

## Tasks / Subtasks

- [x] Реализовать read-side API endpoint/module для списка `competitions` в едином envelope `{ data, meta }`. (AC: 1, 2)
- [x] Добавить во frontend feature/page для отображения соревнований через backend API, не обращаясь к БД напрямую. (AC: 1, 2)
- [x] Выбрать и отобразить минимальный набор полезных полей соревнования для MVP-списка. (AC: 3)
- [x] Обеспечить локальные loading/error/empty states страницы в соответствии с lifecycle patterns проекта. (AC: 1, 2, 3)
- [x] Добавить тесты или smoke-checks для API read contract и рендеринга competition list page. (AC: 1, 2, 3)

## Dev Notes

### Previous Story Learnings

- Story `1.3` уже зафиксировала backend API как единственную серверную границу для UI и единый response envelope. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-3-backend-api-karkas-i-health-read-contract.md#Technical-Requirements]
- Story `1.5` закрепляет loading/success/failure lifecycle и user-visible statistics/status principles, которые стоит сохранить и на read pages. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-5-obshchiy-lifecycle-obnovleniya-i-itogovaya-statistika.md#Technical-Requirements]
- Story `2.3` определяет стабильный persistence слой соревнований, на который и должна опираться страница просмотра. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/2-3-sohranenie-i-obnovlenie-sorevnovaniy-bez-dubley.md#Story]

### Technical Requirements

- PRD требует, чтобы внутренний пользователь РДГА мог просматривать список соревнований через интерфейс без ручного обращения к DiscGolfMetrix. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md#Functional-Requirements]
- Архитектура фиксирует `api -> db` и `web -> api`, без прямого доступа frontend к Supabase. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#API--Communication-Patterns]
- На API/frontend boundary использовать `camelCase`, даже если в БД поля лежат в `snake_case`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Data-Boundaries]

### Current Repo Reality

- `apps/web/src/app/App.tsx` пока показывает только placeholder hero panel без data-view pages. [Source: repo inspection]
- `apps/web/src/app/router.tsx` сейчас содержит пустой `appRoutes = []`. [Source: repo inspection]
- В `apps/api/src/` ещё нет модуля `competitions` для list/read endpoint. [Source: repo inspection]

### Architecture Compliance

- Не читать `competitions` напрямую из frontend через Supabase.
- Не смешивать admin update controls и competition list page в одном неструктурированном компоненте.
- Держать feature-first структуру на frontend и layer-first на backend.

### File Structure Notes

- Ожидаемые точки изменений:
- `apps/api/src/modules/competitions/`
- `apps/web/src/app/router.tsx`
- `apps/web/src/features/competitions/`
- `apps/web/src/app/App.tsx`
- Возможно `packages/shared-types/src/api/`

### Testing Requirements

- Проверить API list endpoint для соревнований.
- Проверить loading/empty/data states competition page.
- Проверить, что UI получает данные через API contract, а не напрямую из БД.

### Risks / Watchouts

- Главный риск: вывести DB-shaped `snake_case` поля напрямую в UI и закрепить неправильный boundary contract.
- Второй риск: встроить страницу просмотра прямо в текущий placeholder без маршрутизации и потерять масштабируемость Epic 4.

### References

- [epics.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md)
- [architecture.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md)
- [prd.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md)
- [1-3-backend-api-karkas-i-health-read-contract.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-3-backend-api-karkas-i-health-read-contract.md)
- [1-5-obshchiy-lifecycle-obnovleniya-i-itogovaya-statistika.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-5-obshchiy-lifecycle-obnovleniya-i-itogovaya-statistika.md)
- [2-3-sohranenie-i-obnovlenie-sorevnovaniy-bez-dubley.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/2-3-sohranenie-i-obnovlenie-sorevnovaniy-bez-dubley.md)

## Change Log

- 2026-03-21: Created implementation-ready story file for Story 4.1 and advanced sprint status from `backlog` to `ready-for-dev`.
- 2026-03-22: Added the competitions read-side API contract, frontend list page with loading/error/empty states, and smoke coverage for the API envelope and page rendering.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Implementation Plan

- Add a backend `competitions` read endpoint that loads persisted records from Supabase, maps DB `snake_case` fields into API `camelCase`, and returns a standard `{ data, meta }` envelope.
- Extend shared API types with an explicit competitions list contract so both API and web use the same payload shape.
- Build a dedicated frontend competitions feature/page that fetches through backend API only, renders the MVP field set, and covers loading, error, empty, and data states.
- Add lightweight smoke-tests for the API read contract and the competition list view, then run package checks plus targeted test commands.

### Debug Log References

- Added `apps/api/src/modules/competitions/index.ts` with a read-side route, lazy Supabase adapter, deterministic DB-to-API mapping, and `meta.count` response data.
- Updated `apps/api/src/modules/index.ts` and `apps/api/src/app.test.ts` so the new `/competitions` route participates in the registered API surface and has contract coverage.
- Extended `packages/shared-types/src/api/index.ts` with a typed competitions list response/meta contract shared by backend and frontend.
- Added `apps/web/src/shared/api/competitions.ts` and extended `apps/web/src/shared/api/http.ts` with envelope-aware fetching for read pages.
- Added `apps/web/src/features/competitions/competitions-page.tsx`, routed it from `apps/web/src/app/router.tsx`, and styled the new read page/cards/states in `apps/web/src/styles/global.css`.
- Added smoke-tests in `apps/web/src/shared/api/competitions.test.ts` and `apps/web/src/features/competitions/competitions-page.test.tsx`.
- Validation completed with `./node_modules/.bin/tsx --test apps/api/src/app.test.ts`, `./node_modules/.bin/tsx --test apps/web/src/shared/api/competitions.test.ts apps/web/src/features/competitions/competitions-page.test.tsx`, `npm run check --workspace @metrix-parser/shared-types`, `npm run check --workspace @metrix-parser/api`, `npm run check --workspace @metrix-parser/web`, and `npm run check`.
- `npm test --workspace @metrix-parser/api` and `npm test --workspace @metrix-parser/web` still fail inside the current sandbox because this environment blocks the IPC pipe that `tsx` tries to open; direct `./node_modules/.bin/tsx --test ...` commands pass.

### Completion Notes List

- Added the first read-side competitions API for Epic 4, keeping the frontend on the `web -> api -> db` path and returning a standard `{ data, meta }` envelope.
- Kept the UI boundary in `camelCase` while mapping from persisted `snake_case` competition rows on the server.
- Built a dedicated competitions page instead of folding the list into the admin update screen, preserving room for the remaining Epic 4 browse pages.
- Exposed the MVP competition fields needed for review work: name, date, course, players count, record type, `competitionId`, and `metrixId`.
- Added explicit loading, error, empty, and populated states so the page follows the lifecycle patterns already established in the project.
- Added smoke coverage for both the backend envelope contract and the frontend competitions list rendering.

### File List

- packages/shared-types/src/api/index.ts
- apps/api/src/modules/competitions/index.ts
- apps/api/src/modules/index.ts
- apps/api/src/app.test.ts
- apps/api/package.json
- apps/web/package.json
- apps/web/tsconfig.json
- apps/web/src/shared/api/http.ts
- apps/web/src/shared/api/competitions.ts
- apps/web/src/shared/api/competitions.test.ts
- apps/web/src/features/competitions/competitions-page.tsx
- apps/web/src/features/competitions/competitions-page.test.tsx
- apps/web/src/app/router.tsx
- apps/web/src/styles/global.css
