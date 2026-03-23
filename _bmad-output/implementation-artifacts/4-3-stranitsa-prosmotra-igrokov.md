# Story 4.3: Страница просмотра игроков

Status: review

## Story

As a сотрудник РДГА,
I want просматривать список игроков через интерфейс,
so that я могу использовать собранные данные об игроках для дальнейшей статистической работы.

## Acceptance Criteria

1. Интерфейс отображает список сохранённых игроков. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-43-Страница-просмотра-игроков]
2. Пользователь видит данные, достаточные для идентификации игрока. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-43-Страница-просмотра-игроков]
3. Данные загружаются через backend API. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-43-Страница-просмотра-игроков]

## Tasks / Subtasks

- [x] Реализовать API list/read contract для `players` через backend boundary. (AC: 1, 3)
- [x] Добавить frontend feature/page для отображения списка игроков с ключевыми полями идентификации. (AC: 1, 2, 3)
- [x] Выделить минимальный полезный MVP-набор player fields для списка без привязки к конкретному результату. (AC: 2)
- [x] Реализовать loading/error/empty states и базовую keyboard-friendly доступность. (AC: 1, 2, 3)
- [x] Добавить проверки для API contract и rendering players page. (AC: 1, 2, 3)

## Dev Notes

### Previous Story Learnings

- Story `3.3` должна создать устойчивое player persistence без дублей; read page игроков должна использовать этот слой как источник данных. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/3-3-sohranenie-i-obnovlenie-igrokov-bez-dubley.md#Story]
- Story `1.3` закрепляет backend API boundary и единый response envelope. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-3-backend-api-karkas-i-health-read-contract.md#Acceptance-Criteria]

### Technical Requirements

- PRD требует, чтобы внутренний пользователь мог просматривать данные игроков через интерфейс без ручного обращения к внешнему источнику. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md#Functional-Requirements]
- Архитектура требует feature-first frontend organization и explicit DB-to-API mapping. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Structure-Patterns]

### Current Repo Reality

- Во frontend ещё нет feature modules для players.
- Router и App остаются skeletal.
- В API отсутствует `players` read module. [Source: repo inspection]

### Architecture Compliance

- Не читать игроков напрямую из frontend database client.
- Не смешивать список игроков со страницей результатов; это разные user tasks.
- Не выносить DB-shaped payload в UI без явной нормализации.

### File Structure Notes

- Ожидаемые точки изменений:
- `apps/api/src/modules/players/`
- `apps/web/src/features/players/`
- `apps/web/src/app/router.tsx`
- Возможно `packages/shared-types/src/api/`

### Testing Requirements

- Проверить API list endpoint для игроков.
- Проверить отображение идентификационных данных игрока.
- Проверить loading/empty/data states page.

### Risks / Watchouts

- Главный риск: использовать result-shaped данные вместо отдельной player model и тем самым размыть границы сущностей.
- Второй риск: спроектировать страницу игроков вокруг деталей результатов, а не вокруг идентифицируемого списка players.

### References

- [epics.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md)
- [architecture.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md)
- [prd.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md)
- [1-3-backend-api-karkas-i-health-read-contract.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-3-backend-api-karkas-i-health-read-contract.md)
- [3-3-sohranenie-i-obnovlenie-igrokov-bez-dubley.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/3-3-sohranenie-i-obnovlenie-igrokov-bez-dubley.md)

## Change Log

- 2026-03-21: Created implementation-ready story file for Story 4.3 and advanced sprint status from `backlog` to `ready-for-dev`.
- 2026-03-22: Added the players read-side API contract, frontend player list page, and smoke coverage for the API envelope and page rendering.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Implementation Plan

- Add a backend `players` read endpoint that returns persisted player records through the standard `{ data, meta }` envelope and keeps the API boundary in `camelCase`.
- Extend shared API types with a typed players list contract reused by backend and frontend.
- Build a dedicated frontend players page focused on player identity only, using `playerName` and `playerId` as the MVP field set and avoiding result-shaped payloads.
- Add smoke-tests for the API contract and page rendering, then run targeted tests and full workspace type checks.

### Debug Log References

- Implemented `apps/api/src/modules/players/index.ts` with a read-side `/players` route, Supabase-backed list query, explicit DB-to-domain mapping, and `meta.count`.
- Updated `apps/api/src/modules/index.ts` and `apps/api/src/app.test.ts` so the new players route is registered and validated by the API contract test suite.
- Extended `packages/shared-types/src/api/index.ts` with shared players list response/meta types.
- Added `apps/web/src/shared/api/players.ts` and `apps/web/src/shared/api/players.test.ts` for typed frontend API access and envelope smoke coverage.
- Added `apps/web/src/features/players/players-page.tsx` and `apps/web/src/features/players/players-page.test.tsx` for the player list page, including loading/error/empty/data states and keyboard-friendly focusable cards.
- Updated `apps/web/src/app/router.tsx` and `apps/web/src/styles/global.css` to expose and style the new `/players` page.
- Validation completed with `./node_modules/.bin/tsx --test apps/api/src/app.test.ts`, `./node_modules/.bin/tsx --test apps/web/src/shared/api/players.test.ts apps/web/src/features/players/players-page.test.tsx`, `npm run check --workspace @metrix-parser/shared-types`, `npm run check --workspace @metrix-parser/api`, `npm run check --workspace @metrix-parser/web`, and `npm run check`.

### Completion Notes List

- Added the read-side players API so the frontend now reads a dedicated `players` model through backend only.
- Kept the MVP page focused on player identification rather than result details, using `playerName` and `playerId` as the minimal useful field set.
- Added loading, error, empty, and populated states, plus keyboard-focusable player cards for basic accessibility.
- Preserved the DB-to-API normalization boundary by mapping `player_id` and `player_name` into `playerId` and `playerName` on the server.
- Added smoke coverage for both the `/players` envelope contract and the player page rendering.

### File List

- packages/shared-types/src/api/index.ts
- apps/api/src/modules/players/index.ts
- apps/api/src/modules/index.ts
- apps/api/src/app.test.ts
- apps/web/src/shared/api/players.ts
- apps/web/src/shared/api/players.test.ts
- apps/web/src/features/players/players-page.tsx
- apps/web/src/features/players/players-page.test.tsx
- apps/web/src/app/router.tsx
- apps/web/src/styles/global.css
