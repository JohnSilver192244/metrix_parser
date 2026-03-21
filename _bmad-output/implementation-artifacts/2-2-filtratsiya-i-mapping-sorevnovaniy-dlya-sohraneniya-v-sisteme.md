# Story 2.2: Фильтрация и маппинг соревнований для сохранения в системе

Status: ready-for-dev

## Story

As a владелец проекта,
I want чтобы система отбирала только российские соревнования и преобразовывала их в внутреннюю модель данных,
so that в БД сохранялись только релевантные записи в согласованном формате.

## Acceptance Criteria

1. Система отбирает только соревнования, относящиеся к России. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-22-Фильтрация-и-маппинг-соревнований-для-сохранения-в-системе]
2. Система маппит данные соревнований во внутреннюю модель `competitions`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-22-Фильтрация-и-маппинг-соревнований-для-сохранения-в-системе]
3. Для каждой записи подготавливаются поля `competition_id`, `competition_name`, `competition_date`, `course_name`, `record_type`, `players_count`, `metrix_id`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-22-Фильтрация-и-маппинг-соревнований-для-сохранения-в-системе]

## Tasks / Subtasks

- [ ] Добавить parsing/mapping слой для raw competition response из story `2.1`, отделив raw transport structures от внутренней domain-модели. (AC: 2, 3)
- [ ] Реализовать фильтр “только Россия” на базе явного признака из данных DiscGolfMetrix; если приходится делать inference, он должен быть локализован в одном mapping helper и покрыт тестом. (AC: 1)
- [ ] Определить внутренний тип/domain shape для `competitions` с полями `competitionId`, `competitionName`, `competitionDate`, `courseName`, `recordType`, `playersCount`, `metrixId` на API/code boundary и подготовить явный mapping в будущую DB `snake_case` форму. (AC: 2, 3)
- [ ] Обработать неполные/битые raw competition records так, чтобы они не ломали всю обработку: валидные записи проходят дальше, невалидные попадают в skipped/error summary. (AC: 1, 2)
- [ ] Подготовить fixture-based тесты на фильтрацию российских и не-российских соревнований и на корректный mapping обязательных полей. (AC: 1, 3)

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
