# Story 3.4: Сохранение результатов соревнований с обработкой DNF

Status: ready-for-dev

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

- [ ] Реализовать parsing/mapping для `competition_results`, используя raw result payloads и выделенных игроков из предыдущих stories. (AC: 1, 2)
- [ ] Зафиксировать persistence strategy для `competition_results`, включая upsert/update path по согласованному ключу результата. (AC: 1, 2)
- [ ] Обработать `DNF` как отдельный логический флаг и не подменять его обычным numeric/result state. (AC: 3)
- [ ] Добавить validation rules, которые не пропускают partial/incomplete result как валидную запись для сохранения. (AC: 4)
- [ ] Встроить outcome результатов в общий update summary contract и подготовить данные для последующей диагностической story `3.5`. (AC: 1, 3, 4)
- [ ] Добавить тесты/fixtures для сценариев: обычный результат, `DNF`, неполный результат, повторное сохранение результата. (AC: 1, 2, 3, 4)

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
