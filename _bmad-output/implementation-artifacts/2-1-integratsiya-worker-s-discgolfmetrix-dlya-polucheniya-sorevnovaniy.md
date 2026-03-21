# Story 2.1: Интеграция worker с DiscGolfMetrix для получения соревнований

Status: done

## Story

As a владелец проекта,
I want чтобы worker мог получать данные о соревнованиях из DiscGolfMetrix за заданный период,
so that система могла запускать сценарий обновления соревнований на основе внешнего источника данных.

## Acceptance Criteria

1. Worker отправляет запрос к DiscGolfMetrix для получения списка соревнований. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-21-Интеграция-worker-с-DiscGolfMetrix-для-получения-соревнований]
2. Worker получает ответ в формате, пригодном для дальнейшего разбора. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-21-Интеграция-worker-с-DiscGolfMetrix-для-получения-соревнований]
3. Ошибки внешнего API обрабатываются предсказуемо и передаются в общий результат операции. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-21-Интеграция-worker-с-DiscGolfMetrix-для-получения-соревнований]
4. В схеме данных созданы таблицы, необходимые для хранения `competitions` и `courses`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-21-Интеграция-worker-с-DiscGolfMetrix-для-получения-соревнований]

## Tasks / Subtasks

- [x] Добавить в `apps/worker/src/integration/discgolfmetrix/` клиент для получения списка соревнований за период, не смешивая transport, parsing и persistence в одном файле. (AC: 1, 2)
- [x] Определить request params/value objects для периода (`dateFrom`, `dateTo` или эквивалент) и явно зафиксировать mapping между admin/API contract и worker integration layer. (AC: 1, 2)
- [x] Подготовить raw response typing/parsing boundary, чтобы результат DiscGolfMetrix был пригоден для story `2.2`, но без преждевременного доменного маппинга всех полей в этой истории. (AC: 2)
- [x] Добавить предсказуемый error handling для network/HTTP/parse ошибок внешнего источника и включить эти ошибки в общий update-result contract, а не только в console logs. (AC: 3)
- [x] Создать migration(и) в `supabase/migrations/` для таблиц `competitions` и `courses` с `snake_case` naming и ключами, которые поддержат будущие upsert/idempotent flows. (AC: 4)
- [x] Добавить в worker jobs/orchestration entrypoint для сценария “обновление соревнований за период”, даже если вызов из API пока остаётся тонким extension point. (AC: 1, 3)
- [x] Проверить TypeScript checks для `apps/worker` и smoke-level проверку интеграционного клиента/fixtures без реального UI. (AC: 1, 2, 3)

## Dev Notes

### Previous Story Learnings

- Story `1.6` задаёт общие правила partially-tolerant execution и update summary; интеграция с DiscGolfMetrix уже здесь должна возвращать ошибки в общий результат, а не изолированно. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-6-idempotentnost-i-chastichno-ustoychivoe-vypolnenie-obnovleniy.md#Tasks--Subtasks]
- Архитектура требует, чтобы DiscGolfMetrix вызывался только со стороны worker. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Integration-Points]

### Technical Requirements

- `apps/worker` организован `layer-first`: `integration`, `parsing`, `mapping`, `persistence`, `orchestration`, `jobs`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Complete-Project-Directory-Structure]
- Интеграция с DiscGolfMetrix должна корректно обрабатывать ошибки API и отражать их в понятной форме для пользователя или владельца проекта. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md#Non-Functional-Requirements]
- Таблицы и колонки БД должны оставаться в `snake_case`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Naming-Patterns]

### Current Repo Reality

- `apps/worker/src/main.ts` пока только логирует bootstrap message; интеграционного клиента к DiscGolfMetrix ещё нет. [Source: repo inspection]
- В env worker уже есть `DISCGOLFMETRIX_BASE_URL`, так что story должна использовать существующий конфиг, а не заводить новый. [Source: repo inspection]
- Миграционная инфраструктура `supabase/migrations/` уже существует после story `1.2`, но доменных таблиц для `competitions` и `courses` ещё нет. [Source: repo inspection]

### Architecture Compliance

- Не помещать HTTP client DiscGolfMetrix в `apps/api` или `apps/web`.
- Не смешивать создание таблиц БД с полной реализацией persistence/upsert логики; эта история готовит схему и получение raw data, а не завершает весь import pipeline.

### File Structure Notes

- Ожидаемые точки изменений:
- `apps/worker/src/integration/discgolfmetrix/`
- `apps/worker/src/jobs/`
- `apps/worker/src/orchestration/`
- `supabase/migrations/`
- Возможно `packages/shared-types/src/domain/` и `packages/shared-types/src/updates/`

### Testing Requirements

- Проверить формирование запроса по периоду.
- Проверить нормальную обработку успешного raw response.
- Проверить path с ошибкой внешнего API и его попадание в update result.
- Проверить, что миграции компонуются без нарушения `snake_case` conventions.

### Risks / Watchouts

- Главный риск: попытаться завершить одновременно integration, mapping и persistence. Story `2.1` должна довести только integration + schema foundation.
- Второй риск: жёстко привязаться к нестабильному HTML/response формату без выделенного parsing boundary.

### References

- [epics.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md)
- [architecture.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md)
- [prd.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md)
- [1-6-idempotentnost-i-chastichno-ustoychivoe-vypolnenie-obnovleniy.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-6-idempotentnost-i-chastichno-ustoychivoe-vypolnenie-obnovleniy.md)

## Change Log

- 2026-03-20: Created implementation-ready story file for Story 2.1 and advanced sprint status from `backlog` to `ready-for-dev`.
- 2026-03-21: Added DiscGolfMetrix competitions client, predictable worker error handling, raw response boundary, and schema foundation for `competitions`/`courses`.
- 2026-03-21: Code review findings were addressed and the story status was advanced to `done`.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Added a dedicated DiscGolfMetrix integration layer in `apps/worker` with separate files for transport, parsing, types, and error mapping.
- Added a worker job/orchestration entrypoint for competitions updates that reports upstream failures through the shared update result contract.
- Validation completed successfully with `npm test --workspace @metrix-parser/worker`, `npm run check --workspace @metrix-parser/worker`, and `npm run build`.

### Completion Notes List

- Added `apps/worker/src/integration/discgolfmetrix/` with a request URL builder, fetch client, raw payload parser, and predictable `network/http/parse` error mapping.
- Explicitly mapped the shared `UpdatePeriod` contract to the worker integration request layer so admin/API `dateFrom/dateTo` flow reaches DiscGolfMetrix consistently.
- Added `runCompetitionsUpdateJob` and `executeCompetitionsUpdate` as extension points for the “competitions by period” worker scenario.
- Returned external API failures through the shared update result shape with `issues`, `summary.errors`, and `finalStatus` instead of relying on logs only.
- Added `supabase/migrations/0002_competitions_and_courses.sql` with `snake_case` tables and idempotency-friendly keys for `competitions` and `courses`.
- Added worker smoke tests for request building, successful raw fetch handling, and external API failure propagation.

### File List

- apps/worker/src/config/env.ts
- apps/worker/src/integration/discgolfmetrix/index.ts
- apps/worker/src/integration/discgolfmetrix/types.ts
- apps/worker/src/integration/discgolfmetrix/errors.ts
- apps/worker/src/integration/discgolfmetrix/parser.ts
- apps/worker/src/integration/discgolfmetrix/client.ts
- apps/worker/src/integration/discgolfmetrix/client.test.ts
- apps/worker/src/jobs/competitions-update-job.ts
- apps/worker/src/jobs/competitions-update-job.test.ts
- apps/worker/src/orchestration/competitions-update.ts
- apps/worker/package.json
- supabase/migrations/0002_competitions_and_courses.sql
