# Story 1.3: Backend API-каркас и health/read contract

Status: done

## Story

As a владелец проекта,
I want иметь работающий backend API как единственную серверную границу для UI,
so that frontend не зависит напрямую от БД и import runtime.

## Acceptance Criteria

1. API запускается как отдельное приложение. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-13-Backend-API-каркас-и-healthread-contract]
2. Существует базовый health endpoint для проверки доступности сервиса. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-13-Backend-API-каркас-и-healthread-contract]
3. API использует единый формат успешного ответа `{ data, meta }`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-13-Backend-API-каркас-и-healthread-contract]
4. API использует единый формат ошибки `{ error: { code, message } }`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-13-Backend-API-каркас-и-healthread-contract]
5. API готов расширяться модулями `updates`, `competitions`, `courses`, `players`, `results`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-13-Backend-API-каркас-и-healthread-contract]

## Tasks / Subtasks

- [x] Заменить текущий `console.log` bootstrap в `apps/api/src/main.ts` на реальный HTTP server entrypoint, который можно запускать как отдельное приложение через существующий workspace-скрипт `dev:api`. (AC: 1)
- [x] Добавить минимальный health module в `apps/api/src/modules/health/` с endpoint наподобие `GET /health`, который возвращает success envelope и не зависит от UI или worker. (AC: 2, 3)
- [x] Вынести единые API envelope/error contracts в backend-удобные DTO/types и синхронизировать их с `packages/shared-types/src/api`, чтобы success и error shape были переиспользуемыми и не дублировались ad-hoc по файлам. (AC: 3, 4)
- [x] Заложить модульную структуру API для `updates`, `competitions`, `courses`, `players`, `results` как минимум на уровне каталогов, базовых router/handler placeholders или эквивалентных registration points, не реализуя доменную логику раньше времени. (AC: 5)
- [x] Добавить центральную обработку ошибок и маппинг в `{ error: { code, message } }`, чтобы даже базовые 404/500 ответы уже следовали зафиксированному контракту. (AC: 4)
- [x] Обновить `.env.example` и/или API env-loading только если для HTTP runtime действительно нужны новые переменные, сохранив правило, что frontend не использует Supabase напрямую. (AC: 1, 5)
- [x] Проверить рабочий запуск и статическую валидацию API-компонента через `npm run check --workspace @metrix-parser/api` и локальный smoke-test health endpoint. (AC: 1, 2, 3, 4)

## Dev Notes

### Previous Story Learnings

- Story `1.2` уже добавила runtime-зависимость `@supabase/supabase-js` в `apps/api` и `apps/worker`, а также env/bootstrap для server-side доступа к Supabase. В этой истории не нужно заново изобретать подключение к БД; достаточно не сломать существующий bootstrap path. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-2-bazovaya-integratsiya-supabase-i-infrastruktura-migratsiy.md#Completion-Notes-List]
- В story `1.2` отдельно зафиксировано, что frontend остаётся на API-only boundary. Любые быстрые обходные решения через прямой клиент в `apps/web` будут regression относительно уже принятой архитектуры. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-2-bazovaya-integratsiya-supabase-i-infrastruktura-migratsiy.md#Dev-Notes]
- Текущий `packages/shared-types/src/api/index.ts` уже содержит базовый `ApiEnvelope<TData>`. Лучше расширить этот слой аккуратно, чем заводить параллельные локальные типы ответа в API. [Source: repo inspection]

### Current Repo Reality

- `apps/api/src/main.ts` пока содержит только bootstrap `console.log`, поэтому AC1 и AC2 ещё не покрыты. [Source: repo inspection]
- `apps/api/src/config/env.ts` и `apps/api/src/lib/supabase-admin.ts` уже существуют после story `1.2`; история `1.3` должна строиться поверх них, а не заменять их. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-2-bazovaya-integratsiya-supabase-i-infrastruktura-migratsiy.md#File-List]
- В `apps/api/package.json` уже есть скрипты `dev`, `build`, `check`, поэтому новый HTTP server должен вписаться в текущий workspace без перестройки монорепозитория. [Source: repo inspection]

### Technical Requirements

- Backend API должен быть отдельным runtime-контуром и единственной server boundary для `apps/web`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#API--Communication-Patterns]
- Все JSON-поля на API boundary используют `camelCase`; database-shaped `snake_case` нельзя вытаскивать наружу без явного маппинга. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Naming-Patterns]
- Единый response contract обязателен для success и error: `{ data, meta }` и `{ error: { code, message } }`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Format-Patterns]
- API и worker организуются по принципу `layer-first`; не смешивать transport, orchestration, persistence и mapping в одном модуле. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Structure-Patterns]
- Модули `updates`, `competitions`, `courses`, `players`, `results` должны быть заранее предусмотрены в структуре, даже если в этой истории они будут только каркасом. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-13-Backend-API-каркас-и-healthread-contract]

### Architecture Compliance

- `apps/web` не должен обращаться к БД напрямую; любые будущие read-scenarios должны идти только через `apps/api`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#API-Boundaries]
- `apps/api` инициирует операции обновления через boundary к `apps/worker`, но точный orchestration mechanism ещё не зафиксирован. Для этой истории допустимо оставить только расширяемую точку интеграции, не придумывая преждевременно полноценный trigger flow. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Gap-Analysis-Results]
- Не нужно реализовывать read-side доменные endpoint'ы для списков в рамках `1.3`; достаточно заложить API skeleton и контрактные основы. Read-side gap отдельно отмечен в readiness report и должен учитываться в будущих stories. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/implementation-readiness-report-2026-03-20.md#Missing-Requirements]

### Implementation Guidance

- Предпочтительно держать HTTP bootstrap минимальным: server creation, route registration, error handling, graceful configuration loading. Не раздувать историю полноценным CRUD-framework слоем без необходимости.
- Если для server runtime выбирается фреймворк, он должен быть TypeScript-friendly и не ломать существующие scripts/build. Выбор фреймворка не является отдельной продуктовой целью этой истории, поэтому избегать глубокой framework-инфраструктуры ради самой инфраструктуры.
- Имеет смысл добавить shared helper для success/error response creation, чтобы следующая история не копировала envelope вручную.
- Для health endpoint достаточно вернуть простой payload наподобие `service`, `status`, `timestamp` или аналогичный минимальный набор, если он остаётся внутри `{ data, meta }`.
- Полезно сразу заложить registration order для модулей, чтобы дальнейшее расширение API было предсказуемым: `health`, затем placeholders для `updates`, `competitions`, `courses`, `players`, `results`.

### Testing Requirements

- Smoke test запуска API как отдельного приложения обязателен: сервис стартует и слушает порт без падения. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-13-Backend-API-каркас-и-healthread-contract]
- Проверить, что health endpoint возвращает статус-код успеха и envelope формата `{ data, meta }`.
- Проверить, что отсутствующий route или искусственно вызванная ошибка проходят через централизованный error contract `{ error: { code, message } }`.
- Сохранить прохождение `npm run check --workspace @metrix-parser/api`; по возможности также прогнать общий `npm run check`, если изменения затрагивают shared types.

### Risks / Watchouts

- Самый вероятный срыв этой истории: сделать “работающий сервер”, но оставить несогласованные response shapes между success и error. Это сломает основу для всех следующих UI/API историй.
- Второй риск: случайно закодировать orchestration с worker слишком рано и тем самым закрепить неутверждённый integration pattern. Для `1.3` нужен extension point, а не полный execution pipeline.
- Третий риск: дублировать envelope-типы локально в `apps/api`, вместо того чтобы опираться на `packages/shared-types`.

### File Structure Notes

- Ожидаемые точки изменений:
- `apps/api/src/main.ts`
- `apps/api/src/modules/health/`
- `apps/api/src/modules/updates/`
- `apps/api/src/modules/competitions/`
- `apps/api/src/modules/courses/`
- `apps/api/src/modules/players/`
- `apps/api/src/modules/results/`
- `apps/api/src/dto/`
- `apps/api/src/lib/`
- `packages/shared-types/src/api/index.ts`
- Возможно `.env.example` и `apps/api/package.json`, только если это действительно требуется выбранной server-реализации.

### References

- [epics.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md)
- [architecture.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md)
- [prd.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md)
- [implementation-readiness-report-2026-03-20.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/implementation-readiness-report-2026-03-20.md)
- [1-2-bazovaya-integratsiya-supabase-i-infrastruktura-migratsiy.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-2-bazovaya-integratsiya-supabase-i-infrastruktura-migratsiy.md)

## Change Log

- 2026-03-20: Created implementation-ready story file for Story 1.3 and advanced sprint status from `backlog` to `ready-for-dev`.
- 2026-03-21: Implemented the API HTTP server skeleton, shared response/error contracts, the health endpoint, module placeholders, centralized error handling, API contract tests, and review-ready validation.
- 2026-03-21: Addressed code-review findings for error sanitization and response-write safety, then marked Story 1.3 as `done`.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- No `project-context.md` found.
- `npm run check --workspace @metrix-parser/api` passed.
- `npm run test --workspace @metrix-parser/api` passed with two contract tests covering the success and error envelopes.
- `npm run check` passed for the full workspace.
- Live smoke test required running the API outside the sandbox because local port binding is blocked in the sandboxed environment.
- Verified live responses on `2026-03-21`: `GET /health` returned HTTP 200 with the success envelope, and `GET /missing-route` returned HTTP 404 with the shared error envelope.

### Completion Notes List

- Replaced the bootstrap stub with a real Node HTTP entrypoint, graceful shutdown handling, and route registration compatible with the existing `dev:api` workspace script.
- Added a reusable router/error pipeline so success responses follow `{ data, meta }` and missing routes or unexpected failures map into `{ error: { code, message } }`.
- Extended `packages/shared-types/src/api` with shared error contract types and aligned API-side DTO aliases to those shared contracts instead of duplicating shapes locally.
- Added the `health` module plus placeholder registration points for `updates`, `competitions`, `courses`, `players`, and `results` so later stories can extend the API predictably.
- Split generic runtime env loading from Supabase-specific env loading; `.env.example` already contained the required HTTP variables, so no new env keys were necessary.
- Added in-memory API contract tests for the `/health` success path and missing-route error path, then confirmed the real server startup and live smoke responses separately.

### File List

- apps/api/package.json
- apps/api/src/app.ts
- apps/api/src/app.test.ts
- apps/api/src/config/env.ts
- apps/api/src/dto/api.ts
- apps/api/src/lib/http-errors.ts
- apps/api/src/lib/http.ts
- apps/api/src/lib/router.ts
- apps/api/src/main.ts
- apps/api/src/modules/index.ts
- apps/api/src/modules/health/index.ts
- apps/api/src/modules/health/routes.ts
- apps/api/src/modules/updates/index.ts
- apps/api/src/modules/competitions/index.ts
- apps/api/src/modules/courses/index.ts
- apps/api/src/modules/players/index.ts
- apps/api/src/modules/results/index.ts
- packages/shared-types/src/api/index.ts
