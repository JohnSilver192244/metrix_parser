# Story 3.2: Разбор и выделение игроков из результатов соревнований

Status: ready-for-dev

## Story

As a владелец проекта,
I want чтобы система извлекала игроков из результатов соревнований в отдельную сущность,
so that данные игроков можно было хранить и переиспользовать независимо от конкретного результата.

## Acceptance Criteria

1. Система извлекает данные игроков в отдельную внутреннюю модель `players`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-32-Разбор-и-выделение-игроков-из-результатов-соревнований]
2. Для игрока подготавливаются поля `player_id` и `player_name`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-32-Разбор-и-выделение-игроков-из-результатов-соревнований]
3. Разбор игроков не требует ручного вмешательства пользователя. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-32-Разбор-и-выделение-игроков-из-результатов-соревнований]

## Tasks / Subtasks

- [ ] Реализовать parser/mapping слой, который преобразует raw result payloads из `3.1` в внутреннюю player-модель, не смешивая её с persistence. (AC: 1, 2)
- [ ] Зафиксировать validation rules для обязательных player fields, чтобы неполные записи не считались валидными players. (AC: 1, 2)
- [ ] Обеспечить, чтобы извлечение игроков происходило автоматически в рамках result-processing flow и не зависело от ручной донастройки пользователем. (AC: 3)
- [ ] Подготовить boundary между player parsing и stories `3.3`/`3.4`, чтобы одни и те же result payloads можно было использовать и для игроков, и для результатов. (AC: 1, 3)
- [ ] Добавить fixtures/tests для сценариев: несколько игроков в одном соревновании, повторяющийся игрок в разных result payloads, неполный player fragment. (AC: 1, 2, 3)

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
