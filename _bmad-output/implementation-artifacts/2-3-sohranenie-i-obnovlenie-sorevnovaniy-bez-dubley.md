# Story 2.3: Сохранение и обновление соревнований без дублей

Status: done

## Story

As a сотрудник РДГА,
I want чтобы соревнования корректно сохранялись и обновлялись без дублей,
so that повторные запуски обновления не портили данные.

## Acceptance Criteria

1. Новые соревнования сохраняются как новые записи. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-23-Сохранение-и-обновление-соревнований-без-дублей]
2. Существующие соревнования обновляются по согласованным идентификаторам. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-23-Сохранение-и-обновление-соревнований-без-дублей]
3. Дубли не создаются. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-23-Сохранение-и-обновление-соревнований-без-дублей]
4. Результат сохранения отражается в статистике обновления. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-23-Сохранение-и-обновление-соревнований-без-дублей]

## Tasks / Subtasks

- [x] Реализовать persistence layer для `competitions` в `apps/worker/src/persistence/`, который принимает уже валидные mapped records из story `2.2`. (AC: 1, 2, 3)
- [x] Зафиксировать и реализовать upsert/match strategy на согласованных идентификаторах `competition_id` и `metrix_id`, избегая дублей при повторных запусках. (AC: 2, 3)
- [x] На уровне persistence outcome различать create/update/skip, чтобы update summary корректно увеличивал нужные счётчики и feeding в UI story `1.5` оставался единообразным. (AC: 1, 2, 4)
- [x] Обработать конфликтные/неполные competition records как skipped/problematic без падения всего job. (AC: 3, 4)
- [x] Добавить persistence-focused тесты или репозиторные smoke-checks для сценариев: новый record, повторный record, обновление изменившегося record, битой record. (AC: 1, 2, 3, 4)

## Dev Notes

### Previous Story Learnings

- Story `2.2` должна отдать валидные internal competition records; persistence не должна повторно решать задачи фильтрации по стране и raw parsing. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/2-2-filtratsiya-i-mapping-sorevnovaniy-dlya-sohraneniya-v-sisteme.md#Architecture-Compliance]
- Story `1.6` уже фиксирует общую idempotent strategy, поэтому `2.3` должна реализовать её для сущности `competitions`, а не изобретать собственный формат результата. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-6-idempotentnost-i-chastichno-ustoychivoe-vypolnenie-obnovleniy.md#Tasks--Subtasks]

### Technical Requirements

- PRD прямо требует использовать `competition_id` и `metrix_id` как устойчивые идентификаторы соревнований. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md#Core-Domain-Entities]
- БД сохраняет поля в `snake_case`, а mapping между DB-model и code/API DTO выполняется явно. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Data-Boundaries]
- Итог сохранения должен встраиваться в единый operation result semantics. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Format-Patterns]

### Current Repo Reality

- В `apps/worker/src/persistence/` пока нет ни repository, ни persistence helper для `competitions`. [Source: repo inspection]
- Таблицы `competitions` и `courses` должны появиться в story `2.1`; эта история опирается на уже готовую схему. [Inference based on epic sequencing]

### Architecture Compliance

- Persistence logic lives in worker, not API.
- Не смешивать upsert логику соревнований с парками; `courses` будут отдельным persistence flow в `2.5`.

### File Structure Notes

- Ожидаемые точки изменений:
- `apps/worker/src/persistence/`
- `apps/worker/src/orchestration/`
- Возможно `packages/shared-types/src/updates/`
- Возможно `apps/worker/src/lib/`

### Testing Requirements

- Проверить create path.
- Проверить repeat-run path без дублей.
- Проверить update path при изменении данных записи.
- Проверить summary outcome counts.

### Risks / Watchouts

- Главный риск: выбрать match strategy, которая допускает дубли при расхождении одного из идентификаторов.
- Второй риск: смешать понятия “битая запись” и “существующая запись без изменений”; для summary это разные исходы.

### References

- [epics.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md)
- [architecture.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md)
- [prd.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md)
- [1-6-idempotentnost-i-chastichno-ustoychivoe-vypolnenie-obnovleniy.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-6-idempotentnost-i-chastichno-ustoychivoe-vypolnenie-obnovleniy.md)
- [2-2-filtratsiya-i-mapping-sorevnovaniy-dlya-sohraneniya-v-sisteme.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/2-2-filtratsiya-i-mapping-sorevnovaniy-dlya-sohraneniya-v-sisteme.md)

## Change Log

- 2026-03-20: Created implementation-ready story file for Story 2.3 and advanced sprint status from `backlog` to `ready-for-dev`.
- 2026-03-21: Added competitions persistence repository, Supabase adapter, duplicate-safe save flow, and persistence-focused tests for create/update/skip behavior.
- 2026-03-21: Code review completed after fixing the upstream date-validation defect in story `2.2`; duplicate-safe persistence flow remains valid on top of the corrected mapping boundary.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Implementation Plan

- Add a dedicated worker persistence repository for `competitions` that accepts already-mapped records from story `2.2`.
- Implement fallback identity matching via `competition_id` and `metrix_id`, with a skipped outcome for conflicting identities.
- Wire the repository into the competitions update job so summary counters reflect create/update/skip persistence outcomes.
- Cover create, repeat-run, update, conflict, and invalid identity paths with repository-focused tests.

### Debug Log References

- Added `apps/worker/src/persistence/competitions-repository.ts` to encapsulate duplicate-safe save semantics for competitions.
- Added `apps/worker/src/persistence/supabase-competitions-adapter.ts` as the production adapter for the `competitions` table.
- Updated `apps/worker/src/jobs/competitions-update-job.ts` to run fetch -> map -> persist and merge mapping/persistence issues into one update result.
- Added repository tests plus job-level tests for create, repeat-run update, mapping skip, and transport failure scenarios.
- Validation completed with `npm test --workspace @metrix-parser/worker`, `npm run check --workspace @metrix-parser/worker`, and `npm run check --workspace @metrix-parser/shared-types`.

### Completion Notes List

- Implemented a dedicated competitions persistence layer in the worker instead of mixing save logic into mapping or API code.
- Applied the agreed identity strategy by matching `competition_id` first and `metrix_id` as a fallback, with conflict detection when they point to different rows.
- Ensured persistence outcomes distinguish `created`, `updated`, and `skipped`, so update summaries stay consistent with the shared operation contract.
- Kept problematic records recoverable: identity conflicts and missing stable identifiers become skipped issues instead of crashing the whole job.
- Added persistence-focused tests covering new inserts, repeat-run updates without duplicates, changed-record updates, and problematic record handling.

### File List

- apps/worker/src/jobs/competitions-update-job.ts
- apps/worker/src/jobs/competitions-update-job.test.ts
- apps/worker/src/persistence/competitions-repository.ts
- apps/worker/src/persistence/competitions-repository.test.ts
- apps/worker/src/persistence/supabase-competitions-adapter.ts
- apps/worker/package.json
