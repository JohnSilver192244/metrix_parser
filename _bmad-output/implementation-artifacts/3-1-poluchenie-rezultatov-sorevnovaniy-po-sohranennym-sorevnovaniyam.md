# Story 3.1: Получение результатов соревнований по сохранённым соревнованиям

Status: review

## Story

As a сотрудник РДГА,
I want чтобы система получала результаты только по соревнованиям за выбранный период,
so that обновление игроков и результатов работало на релевантном наборе данных.

## Acceptance Criteria

1. Система выбирает сохранённые соревнования за указанный период. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-31-Получение-результатов-соревнований-по-сохранённым-соревнованиям]
2. Система определяет идентификаторы соревнований для запроса результатов. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-31-Получение-результатов-соревнований-по-сохранённым-соревнованиям]
3. Worker запрашивает результаты по каждому найденному соревнованию из DiscGolfMetrix. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-31-Получение-результатов-соревнований-по-сохранённым-соревнованиям]
4. В схеме данных созданы таблицы, необходимые для хранения `players` и `competition_results`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-31-Получение-результатов-соревнований-по-сохранённым-соревнованиям]

## Tasks / Subtasks

- [x] Добавить read-side выборку сохранённых `competitions` по периоду, чтобы сценарий игроков/результатов использовал только релевантные записи из БД. (AC: 1, 2)
- [x] Реализовать worker integration path для загрузки result payloads по набору `competition_id`/`metrix_id` без ручного ввода идентификаторов. (AC: 2, 3)
- [x] Подготовить raw result payload boundary для следующих stories `3.2` и `3.4`, не смешивая здесь финальный parsing/persistence игроков и результатов. (AC: 3)
- [x] Создать или зафиксировать migration scope для таблиц `players` и `competition_results`, если они ещё отсутствуют в схеме. (AC: 4)
- [x] Добавить тесты/fixtures для сценариев: пустой набор соревнований за период, несколько соревнований, частично неуспешный fetch результатов. (AC: 1, 2, 3)

## Dev Notes

### Previous Story Learnings

- Story `2.3` закрепляет `competitions` как source of truth для последующих import flows; эта история должна читать сохранённые соревнования, а не обходить БД и не брать ids из UI. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/2-3-sohranenie-i-obnovlenie-sorevnovaniy-bez-dubley.md#Architecture-Compliance]
- Story `2.5` завершает импорт базовых сущностей соревнований и парков; epic 3 начинается уже поверх сохранённых доменных данных, а не raw Metrix календаря. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/2-5-sohranenie-parkov-i-raschet-course-par.md#Technical-Requirements]
- Story `1.6` задаёт общий partially tolerant execution contract, поэтому ошибки результата одного соревнования не должны автоматически валить весь update run. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-6-idempotentnost-i-chastichno-ustoychivoe-vypolnenie-obnovleniy.md#Tasks--Subtasks]

### Technical Requirements

- PRD требует использовать сохранённые соревнования за выбранный период как источник для обновления игроков и результатов. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md#Functional-Requirements]
- DiscGolfMetrix API должен вызываться только со стороны worker. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Integration-Points]
- Архитектура требует отдельный worker import runtime и явное разделение `api -> worker -> persistence`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Component-Responsibilities]

### Current Repo Reality

- В `apps/worker/src/` пока есть только bootstrap entrypoint; read helpers, result-fetch integration и orchestration pipeline для Epic 3 ещё не созданы. [Source: repo inspection]
- В `supabase/migrations/` пока есть только `0001_schema_conventions.sql`, без таблиц `players` и `competition_results`. [Source: repo inspection]
- В `apps/api/src/` пока нет модуля `results` или `updates` с trigger contract для этого сценария. [Source: repo inspection]

### Architecture Compliance

- Не тянуть выборку соревнований по периоду и result-fetch в UI.
- Не смешивать в этой истории parsing игроков/результатов и их final persistence; это scope `3.2`, `3.3`, `3.4`.
- На DB boundary использовать `snake_case`, на API/UI boundary позже маппить в `camelCase`.

### File Structure Notes

- Ожидаемые точки изменений:
- `apps/worker/src/integration/discgolfmetrix/`
- `apps/worker/src/orchestration/`
- `apps/worker/src/jobs/`
- `apps/worker/src/persistence/` или read helpers для `competitions`
- `supabase/migrations/`
- Возможно `apps/api/src/modules/results/` или `apps/api/src/modules/updates/`

### Testing Requirements

- Проверить выборку соревнований по периоду.
- Проверить multi-competition fetch flow.
- Проверить поведение при пустом наборе соревнований.
- Проверить, что ошибка одного result payload не прерывает остальные.

### Risks / Watchouts

- Главный риск: снова начать опираться на ручной ввод competition ids, хотя продуктовая логика требует derive-from-saved-competitions flow.
- Второй риск: преждевременно смешать schema setup с полной persistence-логикой игроков и результатов.

### References

- [epics.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md)
- [architecture.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md)
- [prd.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md)
- [1-6-idempotentnost-i-chastichno-ustoychivoe-vypolnenie-obnovleniy.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-6-idempotentnost-i-chastichno-ustoychivoe-vypolnenie-obnovleniy.md)
- [2-3-sohranenie-i-obnovlenie-sorevnovaniy-bez-dubley.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/2-3-sohranenie-i-obnovlenie-sorevnovaniy-bez-dubley.md)
- [2-5-sohranenie-parkov-i-raschet-course-par.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/2-5-sohranenie-parkov-i-raschet-course-par.md)

## Change Log

- 2026-03-21: Created implementation-ready story file for Story 3.1 and advanced sprint status from `backlog` to `ready-for-dev`.
- 2026-03-22: Added period-based competition read-side selection, DiscGolfMetrix results fetch flow, runtime `/updates/results` execution, and migration scope for `players` plus `competition_results`.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Added `apps/worker/src/read-side/competitions-for-results.ts` and `apps/worker/src/read-side/competitions-for-results.test.ts` to load saved competitions for a requested period and derive the identifiers used for results fetches.
- Extended `apps/worker/src/integration/discgolfmetrix/client.ts`, `types.ts`, `parser.ts`, and `client.test.ts` with a dedicated results request/response path and raw payload boundary.
- Added `apps/worker/src/jobs/results-update-job.ts`, `apps/worker/src/jobs/results-update-job.test.ts`, and `apps/worker/src/orchestration/results-update.ts` to fetch result payloads per competition with partial-failure isolation.
- Updated `apps/api/src/modules/updates/execution.ts` and `apps/api/src/app.test.ts` so `/updates/results` now calls the real worker runtime path instead of the generic stub.
- Added `supabase/migrations/0004_players_and_competition_results.sql` to establish schema scope for future player/result persistence stories.

### Completion Notes List

- Сценарий результатов теперь выбирает сохранённые соревнования только за запрошенный период и больше не зависит от ручного ввода идентификаторов.
- Worker умеет отдельно запрашивать raw result payloads по каждому соревнованию, используя `competition_id` и при наличии `metrix_id`.
- Ошибка одного соревнования не останавливает остальные fetch-операции; она отражается в `skipped`/`errors` общей сводки.
- Raw result payload boundary подготовлен отдельно от последующего parsing/persistence, чтобы истории `3.2` и `3.4` могли переиспользовать те же данные.
- В схему добавлены таблицы `players` и `competition_results`, но их финальное заполнение остаётся scope следующих историй.

### File List

- apps/api/src/app.test.ts
- apps/api/src/modules/updates/execution.ts
- apps/worker/package.json
- apps/worker/src/integration/discgolfmetrix/client.test.ts
- apps/worker/src/integration/discgolfmetrix/client.ts
- apps/worker/src/integration/discgolfmetrix/parser.ts
- apps/worker/src/integration/discgolfmetrix/types.ts
- apps/worker/src/jobs/results-update-job.test.ts
- apps/worker/src/jobs/results-update-job.ts
- apps/worker/src/orchestration/results-update.ts
- apps/worker/src/read-side/competitions-for-results.test.ts
- apps/worker/src/read-side/competitions-for-results.ts
- supabase/migrations/0004_players_and_competition_results.sql
