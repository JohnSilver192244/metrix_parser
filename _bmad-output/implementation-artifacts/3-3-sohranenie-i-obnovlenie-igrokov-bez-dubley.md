# Story 3.3: Сохранение и обновление игроков без дублей

Status: review

## Story

As a сотрудник РДГА,
I want чтобы игроки сохранялись и обновлялись без дублей при повторных загрузках,
so that база игроков оставалась согласованной при многократных обновлениях.

## Acceptance Criteria

1. Новые игроки сохраняются как новые записи. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-33-Сохранение-и-обновление-игроков-без-дублей]
2. Существующие игроки обновляются по `player_id`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-33-Сохранение-и-обновление-игроков-без-дублей]
3. Дубли игроков не создаются. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-33-Сохранение-и-обновление-игроков-без-дублей]
4. Результат обработки игроков учитывается в общей статистике обновления. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-33-Сохранение-и-обновление-игроков-без-дублей]

## Tasks / Subtasks

- [x] Реализовать persistence layer для `players`, который принимает уже валидные mapped player records из story `3.2`. (AC: 1, 2, 3)
- [x] Зафиксировать upsert strategy по `player_id`, чтобы повторные запуски обновляли существующего игрока без создания дублей. (AC: 2, 3)
- [x] На уровне persistence outcome различать create/update/skip и включать их в единый update summary contract. (AC: 1, 4)
- [x] Обработать конфликтные или неполные player records как skipped/problematic без падения всего job. (AC: 3, 4)
- [x] Добавить тесты/fixtures для сценариев: новый игрок, повторный игрок, обновление имени игрока, битая player запись. (AC: 1, 2, 3, 4)

## Dev Notes

### Previous Story Learnings

- Story `3.2` должна отдавать валидную internal player model; persistence не должна заново решать задачи raw parsing результатов. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/3-2-razbor-i-vydelenie-igrokov-iz-rezultatov-sorevnovaniy.md#Architecture-Compliance]
- Story `2.3` уже зафиксировала базовый persistence pattern для доменной сущности с upsert и summary outcome; `players` должны следовать тому же подходу. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/2-3-sohranenie-i-obnovlenie-sorevnovaniy-bez-dubley.md#Tasks--Subtasks]
- Story `1.6` требует безопасного repeat-run поведения, поэтому unchanged/invalid player outcomes должны попадать в summary предсказуемо. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-6-idempotentnost-i-chastichno-ustoychivoe-vypolnenie-obnovleniy.md#Tasks--Subtasks]

### Technical Requirements

- PRD фиксирует `player_id` как устойчивый идентификатор игрока при повторной обработке. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md#Identity-and-Matching]
- Архитектура требует хранить DB-поля в `snake_case` и не смешивать persistence с UI/API responsibility. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Implementation-Patterns--Consistency-Rules]

### Current Repo Reality

- В `apps/worker/src/persistence/` пока нет repository/helper для `players`. [Source: repo inspection]
- В схеме Supabase ещё нет явной подтверждённой миграции для таблицы `players`. [Source: repo inspection]
- Shared update contract пока минимален и может потребовать расширения для richer player persistence outcomes. [Source: repo inspection]

### Architecture Compliance

- Persistence игроков lives in worker, not API.
- Не смешивать upsert игроков с persistence результатов; `competition_results` остаются scope story `3.4`.
- Если позже players будут читаться через API, наружу отдавать `camelCase` через явный mapping.

### File Structure Notes

- Ожидаемые точки изменений:
- `apps/worker/src/persistence/`
- `apps/worker/src/orchestration/`
- `supabase/migrations/`
- Возможно `packages/shared-types/src/domain/`
- Возможно `packages/shared-types/src/updates/`

### Testing Requirements

- Проверить create path для нового игрока.
- Проверить repeat-run path без дублей.
- Проверить update path при изменении `player_name`.
- Проверить summary outcome counts.

### Risks / Watchouts

- Главный риск: выбрать match strategy шире или уже `player_id` и получить дубли/ошибочные merge при повторных обновлениях.
- Второй риск: перепутать unchanged player и problematic player в summary semantics.

### References

- [epics.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md)
- [architecture.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md)
- [prd.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md)
- [1-6-idempotentnost-i-chastichno-ustoychivoe-vypolnenie-obnovleniy.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-6-idempotentnost-i-chastichno-ustoychivoe-vypolnenie-obnovleniy.md)
- [2-3-sohranenie-i-obnovlenie-sorevnovaniy-bez-dubley.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/2-3-sohranenie-i-obnovlenie-sorevnovaniy-bez-dubley.md)
- [3-2-razbor-i-vydelenie-igrokov-iz-rezultatov-sorevnovaniy.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/3-2-razbor-i-vydelenie-igrokov-iz-rezultatov-sorevnovaniy.md)

## Change Log

- 2026-03-21: Created implementation-ready story file for Story 3.3 and advanced sprint status from `backlog` to `ready-for-dev`.
- 2026-03-22: Added worker-side player persistence, `player_id` upsert flow, Supabase adapter, and end-to-end update summary coverage for create/update/skip outcomes.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Implementation Plan

- Add a worker persistence repository for `players` that accepts validated `Player` entities from story `3.2` and writes explicit `snake_case` DB records.
- Implement a Supabase adapter and `player_id` lookup/update flow that prevents duplicates on repeat runs.
- Extend the `players` update job to persist mapped players, merge persistence outcomes into the shared update summary, and preserve partial-failure behavior.
- Add repository and job tests for create, repeat-run update, changed player name, and invalid player record scenarios.
- Keep the existing result boundary compatible with documented DiscGolfMetrix `Competition.Results` payloads used by the player pipeline.

### Debug Log References

- Added `apps/worker/src/persistence/players-repository.ts` and `apps/worker/src/persistence/supabase-players-adapter.ts` to persist `players` with `player_id`-based upsert behavior.
- Extended `apps/worker/src/jobs/players-update-job.ts` so the runtime now persists mapped players and reports create/update/skip outcomes through the shared update summary contract.
- Added `apps/worker/src/persistence/players-repository.test.ts` and extended `apps/worker/src/jobs/players-update-job.test.ts` with create, repeat-run, update-name, and problematic-record coverage.
- Updated `apps/worker/src/parsing/result-player.ts`, `apps/worker/src/mapping/players.test.ts`, and `apps/worker/src/integration/discgolfmetrix/client.test.ts` so the player flow accepts documented DiscGolfMetrix `Competition.Results` payloads and `UserID`/`Name` fields.
- Validation completed with `./node_modules/.bin/tsx --test apps/worker/src/persistence/players-repository.test.ts apps/worker/src/jobs/players-update-job.test.ts apps/worker/src/mapping/players.test.ts apps/worker/src/integration/discgolfmetrix/client.test.ts`, `npm run check --workspace @metrix-parser/worker`, `npm run check --workspace @metrix-parser/api`, `npm run check --workspace @metrix-parser/shared-types`, `npm test --workspace @metrix-parser/worker`, and `npm test --workspace @metrix-parser/api`.

### Completion Notes List

- Added a dedicated `players` persistence layer in the worker that accepts already validated mapped player entities instead of re-parsing raw result payloads.
- Implemented deterministic upsert by `player_id`, so new players are inserted and repeat runs update the existing row without creating duplicates.
- The `players` job now merges persistence outcomes into the shared update summary and distinguishes create/update/skip paths while preserving partially tolerant execution semantics.
- Invalid player records with missing `player_id` or `player_name` are treated as recoverable skipped items and do not stop the rest of the batch.
- Covered the story with repository and job tests for new player creation, repeat-run update, renamed player update, invalid player skipping, and full runtime summary behavior.

### File List

- apps/worker/src/persistence/players-repository.ts
- apps/worker/src/persistence/players-repository.test.ts
- apps/worker/src/persistence/supabase-players-adapter.ts
- apps/worker/src/jobs/players-update-job.ts
- apps/worker/src/jobs/players-update-job.test.ts
- apps/worker/src/parsing/result-player.ts
- apps/worker/src/mapping/players.test.ts
- apps/worker/src/integration/discgolfmetrix/client.test.ts
- apps/worker/package.json
