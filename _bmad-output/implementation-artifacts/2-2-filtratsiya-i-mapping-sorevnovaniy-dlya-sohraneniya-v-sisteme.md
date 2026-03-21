# Story 2.2: Фильтрация и маппинг соревнований для сохранения в системе

Status: done

## Story

As a владелец проекта,
I want чтобы система отбирала только российские соревнования и преобразовывала их в внутреннюю модель данных,
so that в БД сохранялись только релевантные записи в согласованном формате.

## Acceptance Criteria

1. Система отбирает только соревнования, относящиеся к России. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-22-Фильтрация-и-маппинг-соревнований-для-сохранения-в-системе]
2. Система маппит данные соревнований во внутреннюю модель `competitions`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-22-Фильтрация-и-маппинг-соревнований-для-сохранения-в-системе]
3. Для каждой записи подготавливаются поля `competition_id`, `competition_name`, `competition_date`, `course_name`, `record_type`, `players_count`, `metrix_id`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-22-Фильтрация-и-маппинг-соревнований-для-сохранения-в-системе]

## Tasks / Subtasks

- [x] Добавить parsing/mapping слой для raw competition response из story `2.1`, отделив raw transport structures от внутренней domain-модели. (AC: 2, 3)
- [x] Реализовать фильтр “только Россия” на базе явного признака из данных DiscGolfMetrix; если приходится делать inference, он должен быть локализован в одном mapping helper и покрыт тестом. (AC: 1)
- [x] Определить внутренний тип/domain shape для `competitions` с полями `competitionId`, `competitionName`, `competitionDate`, `courseName`, `recordType`, `playersCount`, `metrixId` на API/code boundary и подготовить явный mapping в будущую DB `snake_case` форму. (AC: 2, 3)
- [x] Обработать неполные/битые raw competition records так, чтобы они не ломали всю обработку: валидные записи проходят дальше, невалидные попадают в skipped/error summary. (AC: 1, 2)
- [x] Подготовить fixture-based тесты на фильтрацию российских и не-российских соревнований и на корректный mapping обязательных полей. (AC: 1, 3)

## Dev Notes

### Previous Story Learnings

- Story `2.1` должна дать raw integration boundary и базовую схему БД; `2.2` не должна заново реализовывать HTTP client, а должна опираться на уже полученный raw payload. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/2-1-integratsiya-worker-s-discgolfmetrix-dlya-polucheniya-sorevnovaniy.md#Tasks--Subtasks]
- Story `1.6` уже закрепила pattern “continue on bad record”; filtering/mapping должен уважать эту семантику. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-6-idempotentnost-i-chastichno-ustoychivoe-vypolnenie-obnovleniy.md#Technical-Requirements]

### Technical Requirements

- API/frontend boundary использует `camelCase`, БД использует `snake_case`; mapping между ними должен быть явным. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Format-Patterns]
- DiscGolfMetrix остаётся единственным источником истины, поэтому rules фильтрации и mapping должны быть deterministic и воспроизводимыми, а не вручную корректируемыми. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md#Domain-Model-and-Data]

### Current Repo Reality

- В кодовой базе ещё нет competition domain types и parsing/mapping helpers для worker. [Source: repo inspection]
- Shared/domain packages сейчас минимальны, поэтому story может расширить `packages/shared-types/src/domain/` только при реальной пользе, без лишних абстракций. [Source: repo inspection]

### Architecture Compliance

- Фильтрация и mapping должны жить на стороне worker, а не в `apps/api` и не в UI.
- Не переходить в persistence/upsert в этой истории; она готовит валидные internal records для story `2.3`.

### File Structure Notes

- Ожидаемые точки изменений:
- `apps/worker/src/parsing/`
- `apps/worker/src/mapping/`
- Возможно `packages/shared-types/src/domain/`
- Возможно `apps/worker/src/jobs/` или `apps/worker/src/orchestration/` для включения фильтрации в pipeline

### Testing Requirements

- Проверить, что не-российские соревнования не попадают в mapped output.
- Проверить наличие и корректность всех обязательных полей в mapped record.
- Проверить skipped path на неполной записи.

### Risks / Watchouts

- Главный риск: спрятать бизнес-правило “только Россия” глубоко в ad-hoc if-ветке без теста и явного helper.
- Второй риск: перепутать boundary-поля `camelCase` и DB fields `snake_case` слишком рано.

### References

- [epics.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md)
- [architecture.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md)
- [prd.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md)
- [2-1-integratsiya-worker-s-discgolfmetrix-dlya-polucheniya-sorevnovaniy.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/2-1-integratsiya-worker-s-discgolfmetrix-dlya-polucheniya-sorevnovaniy.md)

## Change Log

- 2026-03-20: Created implementation-ready story file for Story 2.2 and advanced sprint status from `backlog` to `ready-for-dev`.
- 2026-03-21: Added worker-side competition parsing and mapping, Russian-only filtering, explicit domain-to-DB shape conversion, and fixture-based tests for mapping and skipped records.
- 2026-03-21: Code review fixed date validation in the parsing boundary so impossible calendar dates are skipped instead of being normalized into persisted records.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Implementation Plan

- Add a worker-local parsing layer for raw competition record field extraction and date/number normalization.
- Add a mapping layer that keeps only Russian competitions, validates required fields, and returns recoverable skipped issues for broken records.
- Extend shared domain types with a `Competition` boundary model and explicit `snake_case` DB mapping helper.
- Wire the mapping stage into the competitions worker job and cover the behavior with fixture-based tests.

### Debug Log References

- Added `apps/worker/src/parsing/competition-record.ts` to normalize optional string, number, and date fields from raw DiscGolfMetrix records.
- Added `apps/worker/src/mapping/competitions.ts` with deterministic Russian filtering and recoverable validation issues for broken records.
- Extended the worker job result to expose `mappedCompetitions` and return a mapping-stage final status based on successfully prepared records.
- Added Node 16-compatible mock response helpers so the worker tests can run in the current local environment.
- Validation completed with `./node_modules/.bin/tsx --test apps/worker/src/orchestration/update-execution.test.ts apps/worker/src/integration/discgolfmetrix/client.test.ts apps/worker/src/mapping/competitions.test.ts apps/worker/src/jobs/competitions-update-job.test.ts`, `npm run check --workspace @metrix-parser/worker`, and `npm run check --workspace @metrix-parser/shared-types`.

### Completion Notes List

- Added a dedicated parsing and mapping flow for raw competition payloads without changing the HTTP integration boundary from story `2.1`.
- Implemented a single helper for the “only Russia” rule, using explicit country codes first and a localized country-name fallback only in that helper.
- Added shared domain types for `Competition` and an explicit `toCompetitionDbRecord` mapper to keep `camelCase` and `snake_case` boundaries separate.
- Ensured invalid Russian records are skipped with recoverable validation issues while valid records continue through the batch.
- Added fixture-based tests for Russian vs non-Russian filtering, required field mapping, DB-shape conversion, and skipped broken records.

### File List

- packages/shared-types/src/domain/index.ts
- packages/shared-types/src/domain/competition.ts
- apps/worker/src/parsing/competition-record.ts
- apps/worker/src/mapping/__fixtures__/competitions.ts
- apps/worker/src/mapping/competitions.ts
- apps/worker/src/mapping/competitions.test.ts
- apps/worker/src/jobs/competitions-update-job.ts
- apps/worker/src/jobs/competitions-update-job.test.ts
- apps/worker/src/integration/discgolfmetrix/client.test.ts
- apps/worker/src/test-support/mock-response.ts
- apps/worker/package.json
