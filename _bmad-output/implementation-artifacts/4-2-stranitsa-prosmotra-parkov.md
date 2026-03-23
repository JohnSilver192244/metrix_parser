# Story 4.2: Страница просмотра парков

Status: review

## Story

As a сотрудник РДГА,
I want просматривать список парков через интерфейс,
so that я могу видеть структурированную информацию о парках, связанных с соревнованиями.

## Acceptance Criteria

1. Интерфейс отображает список сохранённых парков. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-42-Страница-просмотра-парков]
2. Пользователь видит основные поля парка, включая рассчитанный `course_par`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-42-Страница-просмотра-парков]
3. Данные загружаются через backend API. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-42-Страница-просмотра-парков]

## Tasks / Subtasks

- [x] Реализовать read-side API endpoint/module для списка `courses`, включая `coursePar` и другие ключевые поля в `camelCase`. (AC: 1, 2, 3)
- [x] Добавить frontend feature/page для отображения списка парков и рассчитанного `course_par` через backend API. (AC: 1, 2, 3)
- [x] Определить минимальный набор park fields для MVP-таблицы/списка без перегрузки интерфейса второстепенными деталями. (AC: 2)
- [x] Реализовать loading/error/empty states и базовую доступность списка парков. (AC: 1, 2, 3)
- [x] Добавить smoke-tests/checks для API contract и рендеринга course list page. (AC: 1, 2, 3)

## Dev Notes

### Previous Story Learnings

- Story `2.5` должна сохранить park records и рассчитанный `course_par`; эта история использует уже готовые данные, а не считает `course_par` на клиенте повторно. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/2-5-sohranenie-parkov-i-raschet-course-par.md#Architecture-Compliance]
- Story `1.3` закрепила backend API boundary, поэтому read page parks не должна читать из БД напрямую. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-3-backend-api-karkas-i-health-read-contract.md#Acceptance-Criteria]

### Technical Requirements

- PRD требует показывать структурированные данные о парках через интерфейс и отдельно фиксирует `course_par` как значимое поле сущности. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md#Functional-Requirements]
- Архитектура требует явного маппинга между DB `snake_case` и UI/API `camelCase`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Data-Boundaries]

### Current Repo Reality

- Во frontend пока отсутствуют page-level features для parks.
- Router пустой, а API-модуль `courses` ещё не создан.
- Текущий `App.tsx` — это только landing placeholder, без data-view composition. [Source: repo inspection]

### Architecture Compliance

- Не вычислять `course_par` повторно на read page.
- Не смешивать page of parks с админским запуском обновлений.
- Не отдавать наружу raw DB field names без API mapping.

### File Structure Notes

- Ожидаемые точки изменений:
- `apps/api/src/modules/courses/`
- `apps/web/src/features/courses/`
- `apps/web/src/app/router.tsx`
- Возможно `packages/shared-types/src/api/`

### Testing Requirements

- Проверить API list endpoint для парков.
- Проверить отображение `coursePar`.
- Проверить loading/empty/data states page.

### Risks / Watchouts

- Главный риск: повторно рассчитывать `course_par` на клиенте и получить расхождение с persisted данными.
- Второй риск: перегрузить MVP-страницу избыточными полями вместо фокуса на полезной read-side информации.

### References

- [epics.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md)
- [architecture.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md)
- [prd.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md)
- [1-3-backend-api-karkas-i-health-read-contract.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-3-backend-api-karkas-i-health-read-contract.md)
- [2-5-sohranenie-parkov-i-raschet-course-par.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/2-5-sohranenie-parkov-i-raschet-course-par.md)

## Change Log

- 2026-03-21: Created implementation-ready story file for Story 4.2 and advanced sprint status from `backlog` to `ready-for-dev`.
- 2026-03-22: Added the parks read-side API contract, frontend park list page with persisted `coursePar`, and smoke coverage for API and rendering.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Implementation Plan

- Add a backend `courses` read endpoint that returns persisted park records via the standard `{ data, meta }` envelope and maps DB `snake_case` fields to API `camelCase`.
- Extend shared API types with a typed courses list contract so API and web use the same response shape.
- Build a dedicated frontend parks page that fetches through backend API only, highlights persisted `coursePar`, and keeps the MVP field set focused on useful park metadata.
- Add smoke-tests for the API contract and parks page rendering, then run targeted test commands and workspace checks.

### Debug Log References

- Implemented `apps/api/src/modules/courses/index.ts` with a read-side `/courses` route, Supabase-backed listing, explicit DB-to-domain mapping, and `meta.count`.
- Updated `apps/api/src/modules/index.ts` and `apps/api/src/app.test.ts` so the new courses read endpoint is registered and covered by the API contract test suite.
- Extended `packages/shared-types/src/api/index.ts` with shared courses list response/meta types.
- Added `apps/web/src/shared/api/courses.ts` and `apps/web/src/shared/api/courses.test.ts` for typed API access and envelope smoke coverage.
- Added `apps/web/src/features/courses/courses-page.tsx` and `apps/web/src/features/courses/courses-page.test.tsx` for the parks page, including persisted `coursePar`, loading/error/empty/data states, and accessible list rendering.
- Updated `apps/web/src/app/router.tsx` to expose the new `/courses` page in the app navigation.
- Validation completed with `./node_modules/.bin/tsx --test apps/api/src/app.test.ts`, `./node_modules/.bin/tsx --test apps/web/src/shared/api/courses.test.ts apps/web/src/features/courses/courses-page.test.tsx`, `npm run check --workspace @metrix-parser/shared-types`, `npm run check --workspace @metrix-parser/api`, `npm run check --workspace @metrix-parser/web`, and `npm run check`.

### Completion Notes List

- Added the read-side parks API so the frontend now loads saved course records strictly through backend API, not directly from Supabase.
- Exposed `coursePar` from persisted data without recalculating it on the client, keeping the page aligned with the sync pipeline from story `2.5`.
- Chose a compact MVP field set for parks: name, full name, area, type, country code, `coursePar`, and the two persisted rating summaries.
- Added loading, error, empty, and populated states so the parks page follows the same lifecycle pattern as the competitions page.
- Added smoke coverage for both the `/courses` envelope contract and the page rendering of saved park data.

### File List

- packages/shared-types/src/api/index.ts
- apps/api/src/modules/courses/index.ts
- apps/api/src/modules/index.ts
- apps/api/src/app.test.ts
- apps/web/src/shared/api/courses.ts
- apps/web/src/shared/api/courses.test.ts
- apps/web/src/features/courses/courses-page.tsx
- apps/web/src/features/courses/courses-page.test.tsx
- apps/web/src/app/router.tsx
