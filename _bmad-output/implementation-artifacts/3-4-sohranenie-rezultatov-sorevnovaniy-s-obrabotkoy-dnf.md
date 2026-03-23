# Story 3.4: Сохранение результатов соревнований с обработкой DNF

Status: review

## Story

As a сотрудник РДГА,
I want чтобы результаты соревнований сохранялись в структурированном виде с корректной обработкой DNF,
so that я мог использовать их для дальнейшего просмотра и анализа.

## Acceptance Criteria

1. Система сохраняет или обновляет записи `competition_results`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-34-Сохранение-результатов-соревнований-с-обработкой-DNF]
2. Для результата сохраняются поля `competition_id`, `player_id`, `class_name`, `sum`, `diff`, `order_number`, `dnf`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-34-Сохранение-результатов-соревнований-с-обработкой-DNF]
3. Признак `DNF` учитывается как отдельное состояние результата. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-34-Сохранение-результатов-соревнований-с-обработкой-DNF]
4. Частичный результат не сохраняется как валидный результат соревнования. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-34-Сохранение-результатов-соревнований-с-обработкой-DNF]

## Tasks / Subtasks

- [x] Реализовать parsing/mapping для `competition_results`, используя raw result payloads и выделенных игроков из предыдущих stories. (AC: 1, 2)
- [x] Зафиксировать persistence strategy для `competition_results`, включая upsert/update path по согласованному ключу результата. (AC: 1, 2)
- [x] Обработать `DNF` как отдельный логический флаг и не подменять его обычным numeric/result state. (AC: 3)
- [x] Добавить validation rules, которые не пропускают partial/incomplete result как валидную запись для сохранения. (AC: 4)
- [x] Встроить outcome результатов в общий update summary contract и подготовить данные для последующей диагностической story `3.5`. (AC: 1, 3, 4)
- [x] Добавить тесты/fixtures для сценариев: обычный результат, `DNF`, неполный результат, повторное сохранение результата. (AC: 1, 2, 3, 4)

## Dev Notes

### Previous Story Learnings

- Story `3.1` должна подготовить fetch boundary для результатов, а `3.2` и `3.3` должны выделить и сохранить игроков; эта история должна использовать их outputs, а не повторно строить весь pipeline с нуля. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/3-1-poluchenie-rezultatov-sorevnovaniy-po-sohranennym-sorevnovaniyam.md#Tasks--Subtasks]
- Story `1.6` закрепляет правило, что проблемные units помечаются как skipped и не роняют весь import process. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-6-idempotentnost-i-chastichno-ustoychivoe-vypolnenie-obnovleniy.md#Acceptance-Criteria]

### Technical Requirements

- PRD требует хранить поля результата `competition_id`, `player_id`, `class_name`, `sum`, `diff`, `order_number`, `dnf`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md#Functional-Requirements]
- PRD отдельно фиксирует, что `DNF` должен учитываться как отдельное состояние результата, а частичный результат не должен сохраняться как валидный. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md#Technical-Constraints]
- Архитектура требует `snake_case` для БД и explicit mapping между external/internal/DB models. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Format-Patterns]

### Current Repo Reality

- В проекте пока нет `competition_results` table migration и worker persistence path для результатов. [Source: repo inspection]
- Shared domain types для result entities ещё не заданы. [Source: repo inspection]
- Worker runtime всё ещё требует создания parsing/mapping/persistence слоёв для Epic 3. [Source: repo inspection]

### Architecture Compliance

- Не тянуть result parsing/persistence в API или UI.
- Не сводить `DNF` к текстовой строке интерфейса на уровне БД; хранить его как осмысленный доменный признак.
- Не сохранять partial result только ради полноты набора данных; корректность важнее количества записей.

### File Structure Notes

- Ожидаемые точки изменений:
- `apps/worker/src/parsing/`
- `apps/worker/src/mapping/`
- `apps/worker/src/persistence/`
- `apps/worker/src/orchestration/`
- `supabase/migrations/`
- Возможно `packages/shared-types/src/domain/`

### Testing Requirements

- Проверить обычный result path.
- Проверить `DNF` path.
- Проверить отбрасывание partial result.
- Проверить repeat-run/update behavior.

### Risks / Watchouts

- Главный риск: ошибочно сохранить неполный result как валидный и испортить статистику/просмотр.
- Второй риск: потерять семантику `DNF`, если хранить её как обычное числовое поле или неявный sentinel.

### References

- [epics.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md)
- [architecture.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md)
- [prd.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md)
- [1-6-idempotentnost-i-chastichno-ustoychivoe-vypolnenie-obnovleniy.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-6-idempotentnost-i-chastichno-ustoychivoe-vypolnenie-obnovleniy.md)
- [3-1-poluchenie-rezultatov-sorevnovaniy-po-sohranennym-sorevnovaniyam.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/3-1-poluchenie-rezultatov-sorevnovaniy-po-sohranennym-sorevnovaniyam.md)
- [3-2-razbor-i-vydelenie-igrokov-iz-rezultatov-sorevnovaniy.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/3-2-razbor-i-vydelenie-igrokov-iz-rezultatov-sorevnovaniy.md)

## Change Log

- 2026-03-21: Created implementation-ready story file for Story 3.4 and advanced sprint status from `backlog` to `ready-for-dev`.
- 2026-03-22: Added worker-side competition result parsing, DNF-aware mapping, composite-key persistence, runtime result saving, and regression coverage for valid, partial, DNF, and repeat-run scenarios.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Implementation Plan

- Add a shared `CompetitionResult` domain model plus explicit `snake_case` DB mapper for the `competition_results` boundary.
- Add worker-side parsing and mapping for raw result payloads, reusing the existing raw fetch path and player-fragment extraction boundary from stories `3.1` and `3.2`.
- Add a repository/adapter pair for `competition_results` with idempotent matching on `(competition_id, player_id, order_number)`.
- Extend the `results` runtime so it can persist mapped competition results by default while still supporting fetch-only reuse from the `players` flow.
- Cover normal results, DNF handling, incomplete fragments, repeat-run updates, and runtime summary behavior with tests.

### Debug Log References

- Added `packages/shared-types/src/domain/competition-result.ts` and updated `packages/shared-types/src/domain/index.ts` with a dedicated domain model and explicit DB-shape mapper for persisted competition results.
- Added `apps/worker/src/parsing/competition-result.ts`, `apps/worker/src/mapping/competition-results.ts`, and fixture-based coverage in `apps/worker/src/mapping/competition-results.test.ts`.
- Added `apps/worker/src/persistence/competition-results-repository.ts`, `apps/worker/src/persistence/supabase-competition-results-adapter.ts`, and repository tests for create/update/DNF/invalid-result scenarios.
- Extended `apps/worker/src/jobs/results-update-job.ts` so `/updates/results` now maps and persists valid result records, while `apps/worker/src/jobs/players-update-job.ts` reuses the same fetch boundary in `persistResults: false` mode.
- Updated runtime/API expectations and worker test wiring in `apps/worker/src/jobs/results-update-job.test.ts`, `apps/api/src/app.test.ts`, and `apps/worker/package.json`.
- Validation completed with `./node_modules/.bin/tsx --test apps/worker/src/mapping/competition-results.test.ts apps/worker/src/persistence/competition-results-repository.test.ts apps/worker/src/jobs/results-update-job.test.ts`, `./node_modules/.bin/tsx --test apps/worker/src/jobs/players-update-job.test.ts apps/worker/src/jobs/results-update-job.test.ts`, `npm run check --workspace @metrix-parser/worker`, `npm run check --workspace @metrix-parser/shared-types`, `npm run check --workspace @metrix-parser/api`, `npm test --workspace @metrix-parser/worker`, and `npm test --workspace @metrix-parser/api`.

### Completion Notes List

- Added a reusable `CompetitionResult` domain boundary with explicit `competition_id`, `player_id`, `class_name`, `sum`, `diff`, `order_number`, and `dnf` mapping.
- Implemented worker-side parsing/mapping that preserves `DNF` as a separate boolean state instead of coercing it into the normal numeric score path.
- Added validation that skips incomplete non-DNF result fragments before persistence so partial result payloads do not become valid stored records.
- Implemented idempotent persistence for `competition_results` using the agreed composite identity `(competition_id, player_id, order_number)`, so repeat runs update existing outcomes instead of inserting duplicates.
- Extended the `results` runtime summary to include mapped/persisted result outcomes for Story `3.5`, while keeping `players` on the shared fetch boundary without forcing result persistence there.

### File List

- packages/shared-types/src/domain/competition-result.ts
- packages/shared-types/src/domain/index.ts
- apps/worker/src/parsing/competition-result.ts
- apps/worker/src/mapping/__fixtures__/competition-results.ts
- apps/worker/src/mapping/competition-results.ts
- apps/worker/src/mapping/competition-results.test.ts
- apps/worker/src/persistence/competition-results-repository.ts
- apps/worker/src/persistence/competition-results-repository.test.ts
- apps/worker/src/persistence/supabase-competition-results-adapter.ts
- apps/worker/src/jobs/results-update-job.ts
- apps/worker/src/jobs/results-update-job.test.ts
- apps/worker/src/jobs/players-update-job.ts
- apps/worker/package.json
- apps/api/src/app.test.ts
