# Story 3.2: Разбор и выделение игроков из результатов соревнований

Status: review

## Story

As a владелец проекта,
I want чтобы система извлекала игроков из результатов соревнований в отдельную сущность,
so that данные игроков можно было хранить и переиспользовать независимо от конкретного результата.

## Acceptance Criteria

1. Система извлекает данные игроков в отдельную внутреннюю модель `players`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-32-Разбор-и-выделение-игроков-из-результатов-соревнований]
2. Для игрока подготавливаются поля `player_id` и `player_name`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-32-Разбор-и-выделение-игроков-из-результатов-соревнований]
3. Разбор игроков не требует ручного вмешательства пользователя. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-32-Разбор-и-выделение-игроков-из-результатов-соревнований]

## Tasks / Subtasks

- [x] Реализовать parser/mapping слой, который преобразует raw result payloads из `3.1` в внутреннюю player-модель, не смешивая её с persistence. (AC: 1, 2)
- [x] Зафиксировать validation rules для обязательных player fields, чтобы неполные записи не считались валидными players. (AC: 1, 2)
- [x] Обеспечить, чтобы извлечение игроков происходило автоматически в рамках result-processing flow и не зависело от ручной донастройки пользователем. (AC: 3)
- [x] Подготовить boundary между player parsing и stories `3.3`/`3.4`, чтобы одни и те же result payloads можно было использовать и для игроков, и для результатов. (AC: 1, 3)
- [x] Добавить fixtures/tests для сценариев: несколько игроков в одном соревновании, повторяющийся игрок в разных result payloads, неполный player fragment. (AC: 1, 2, 3)

## Dev Notes

### Previous Story Learnings

- Story `3.1` должна отдать raw result payloads и определить set соревнований, но не брать на себя extraction игроков; здесь нужно продолжить pipeline без дублирования fetch logic. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/3-1-poluchenie-rezultatov-sorevnovaniy-po-sohranennym-sorevnovaniyam.md#Architecture-Compliance]
- Story `1.6` уже задаёт partially tolerant model, значит неполный player fragment должен быть обработан как skipped/problematic unit, а не как причина остановки всего разбора. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-6-idempotentnost-i-chastichno-ustoychivoe-vypolnenie-obnovleniy.md#Tasks--Subtasks]

### Technical Requirements

- PRD требует хранить для игрока `player_id` и `player_name` как устойчивую отдельную сущность. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md#Functional-Requirements]
- Архитектура рекомендует разделять parsing, mapping и persistence по слоям внутри worker. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Structure-Patterns]
- DiscGolfMetrix остаётся единственным источником истины, поэтому player model должна формироваться из result payloads без ручного редактирования в MVP. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md#Domain-Model-and-Data]

### Current Repo Reality

- В проекте пока нет `apps/worker/src/parsing/` или аналогичного слоя для result/player extraction. [Source: repo inspection]
- В `packages/shared-types/src/domain/` ещё нет типов для player/result entities. [Source: repo inspection]
- Runtime worker по-прежнему ограничен bootstrap entrypoint без реального ingestion pipeline. [Source: repo inspection]

### Architecture Compliance

- Не тянуть parsing игроков в API или frontend.
- Не сохранять игроков в этой истории; persistence без дублей должна прийти в `3.3`.
- Не смешивать player extraction и final competition_results mapping в одну неразделимую функцию.

### File Structure Notes

- Ожидаемые точки изменений:
- `apps/worker/src/parsing/`
- `apps/worker/src/mapping/`
- `packages/shared-types/src/domain/`
- Возможно `apps/worker/src/orchestration/`

### Testing Requirements

- Проверить extraction player fragments из result payloads.
- Проверить mapping в `player_id` и `player_name`.
- Проверить поведение при missing player identifier/name.
- Проверить повторяющегося игрока в нескольких соревнованиях.

### Risks / Watchouts

- Главный риск: смешать player extraction с result persistence и потерять переиспользуемую player model.
- Второй риск: считать неполный player fragment валидным игроком и передать его дальше в upsert flow.

### References

- [epics.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md)
- [architecture.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md)
- [prd.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md)
- [1-6-idempotentnost-i-chastichno-ustoychivoe-vypolnenie-obnovleniy.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-6-idempotentnost-i-chastichno-ustoychivoe-vypolnenie-obnovleniy.md)
- [3-1-poluchenie-rezultatov-sorevnovaniy-po-sohranennym-sorevnovaniyam.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/3-1-poluchenie-rezultatov-sorevnovaniy-po-sohranennym-sorevnovaniyam.md)

## Change Log

- 2026-03-21: Created implementation-ready story file for Story 3.2 and advanced sprint status from `backlog` to `ready-for-dev`.
- 2026-03-22: Added worker-side player parsing and mapping, automatic `players` runtime flow on top of fetched result payloads, and fixture-based coverage for repeated and incomplete player fragments.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Implementation Plan

- Add a dedicated result-player parsing helper so raw DiscGolfMetrix result entries are normalized separately from persistence.
- Add worker-side player mapping with required-field validation, duplicate collapse by `playerId`, and recoverable skipped issues for incomplete fragments.
- Introduce a shared `Player` domain model plus explicit `player_id`/`player_name` DB-shape mapper for the `3.3` persistence boundary.
- Add a `players` update job/orchestration path that reuses the `3.1` raw results fetch flow and keeps raw payloads available for `3.4`.
- Cover multi-player, repeated-player, incomplete-fragment, worker job, and API trigger scenarios with tests.

### Debug Log References

- Added `apps/worker/src/parsing/result-player.ts` to extract normalized player fragments from supported DiscGolfMetrix result payload collections.
- Added `apps/worker/src/mapping/players.ts` and fixtures/tests to validate required player fields, deduplicate by `playerId`, and keep partial-failure semantics.
- Added `apps/worker/src/jobs/players-update-job.ts` and `apps/worker/src/orchestration/players-update.ts` so the runtime can fetch results and automatically prepare reusable player records without manual identifiers.
- Extended `apps/api/src/modules/updates/execution.ts` and `apps/api/src/app.test.ts` so `/updates/players` now uses the real worker runtime path instead of the stub fallback.
- Validation completed with `./node_modules/.bin/tsx --test apps/worker/src/mapping/players.test.ts apps/worker/src/jobs/players-update-job.test.ts apps/api/src/app.test.ts`, `npm run check --workspace @metrix-parser/worker`, `npm run check --workspace @metrix-parser/api`, `npm run check --workspace @metrix-parser/shared-types`, `npm test --workspace @metrix-parser/worker`, and `npm test --workspace @metrix-parser/api`.

### Completion Notes List

- Added a shared `Player` domain model with explicit `player_id`/`player_name` mapping so `3.3` can consume validated player entities without re-parsing raw results.
- Implemented a dedicated parsing and mapping layer for raw result payloads that extracts valid players, rejects incomplete fragments, and reports recoverable validation issues.
- Added automatic `players` runtime execution that reuses the existing result-fetch flow from `3.1`, so player extraction no longer depends on manual identifiers or user-side tuning.
- Kept `fetchedResults` in the `players` job result so the same raw payload boundary remains reusable for both future player persistence and competition result mapping.
- Added fixtures and tests for multiple players in one competition, repeated players across payloads, incomplete fragments, worker job behavior, and API update triggering.

### File List

- packages/shared-types/src/domain/index.ts
- packages/shared-types/src/domain/player.ts
- apps/worker/src/parsing/result-player.ts
- apps/worker/src/mapping/__fixtures__/players.ts
- apps/worker/src/mapping/players.ts
- apps/worker/src/mapping/players.test.ts
- apps/worker/src/jobs/players-update-job.ts
- apps/worker/src/jobs/players-update-job.test.ts
- apps/worker/src/orchestration/players-update.ts
- apps/worker/package.json
- apps/api/src/modules/updates/execution.ts
- apps/api/src/app.test.ts
