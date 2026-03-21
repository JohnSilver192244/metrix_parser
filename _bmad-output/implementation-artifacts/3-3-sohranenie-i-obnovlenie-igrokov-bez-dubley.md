# Story 3.3: Сохранение и обновление игроков без дублей

Status: ready-for-dev

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

- [ ] Реализовать persistence layer для `players`, который принимает уже валидные mapped player records из story `3.2`. (AC: 1, 2, 3)
- [ ] Зафиксировать upsert strategy по `player_id`, чтобы повторные запуски обновляли существующего игрока без создания дублей. (AC: 2, 3)
- [ ] На уровне persistence outcome различать create/update/skip и включать их в единый update summary contract. (AC: 1, 4)
- [ ] Обработать конфликтные или неполные player records как skipped/problematic без падения всего job. (AC: 3, 4)
- [ ] Добавить тесты/fixtures для сценариев: новый игрок, повторный игрок, обновление имени игрока, битая player запись. (AC: 1, 2, 3, 4)

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
