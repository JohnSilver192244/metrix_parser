# Story 2.5: Сохранение парков и расчёт course_par

Status: ready-for-dev

## Story

As a сотрудник РДГА,
I want чтобы данные о парках сохранялись в системе вместе с рассчитанным `course_par`,
so that по каждому парку была доступна полная структурированная информация.

## Acceptance Criteria

1. Система сохраняет новые записи парков и обновляет существующие. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-25-Сохранение-парков-и-расчёт-course_par]
2. Для каждого парка рассчитывается и сохраняется суммарный `course_par`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-25-Сохранение-парков-и-расчёт-course_par]
3. В БД сохраняются поля `id`, `name`, `fullname`, `type`, `country_code`, `area`, `rating_value1`, `rating_result1`, `rating_value2`, `rating_result2`, `course_par`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-25-Сохранение-парков-и-расчёт-course_par]
4. Результат обработки парков отражается в статистике обновления. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-25-Сохранение-парков-и-расчёт-course_par]

## Tasks / Subtasks

- [ ] Реализовать worker-side mapping/persistence flow для park records, который принимает raw course payloads из story `2.4` и превращает их в валидные записи для `courses`. (AC: 1, 3)
- [ ] Зафиксировать и реализовать upsert strategy для `courses` по устойчивому идентификатору парка, чтобы повторные запуски обновляли существующие записи без дублей. (AC: 1)
- [ ] Добавить вычисление суммарного `course_par` на основе структуры лунок/сегментов в ответе DiscGolfMetrix и сохранять агрегированное значение вместе с park record. (AC: 2, 3)
- [ ] Встроить результат сохранения парков в общий update summary contract из story `1.6`, различая как минимум `found`, `added`, `updated`, `skipped`. (AC: 1, 4)
- [ ] Обработать неполные или битые course payloads как skipped/problematic без падения всего park update job. (AC: 1, 2, 4)
- [ ] Добавить тесты/fixtures для сценариев: новый парк, повторное сохранение того же парка, изменение данных существующего парка, неполный payload, корректный расчёт `course_par`. (AC: 1, 2, 3, 4)

## Dev Notes

### Previous Story Learnings

- Story `2.4` должна подготовить raw park payload boundary и per-course error isolation; эта история не должна повторно решать задачу discovery course ids или fan-out загрузки. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/2-4-poluchenie-dannyh-o-parkah-po-sorevnovaniyam.md#Architecture-Compliance]
- Story `2.3` уже зафиксировала pattern `worker persistence + upsert + summary outcome`; для `courses` нужно продолжить тот же подход, а не вводить отдельную семантику сохранения. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/2-3-sohranenie-i-obnovlenie-sorevnovaniy-bez-dubley.md#Tasks--Subtasks]
- Story `1.6` требует partially tolerant execution и единый update-result contract, поэтому битый park payload должен увеличивать `skipped`, а не останавливать весь сценарий. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-6-idempotentnost-i-chastichno-ustoychivoe-vypolnenie-obnovleniy.md#Tasks--Subtasks]

### Technical Requirements

- PRD прямо требует рассчитывать и сохранять суммарный `course_par` для каждого парка. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md#Functional-Requirements]
- PRD фиксирует обязательный набор полей парка: `id`, `name`, `fullname`, `type`, `country_code`, `area`, `rating_value1`, `rating_result1`, `rating_value2`, `rating_result2`, `course_par`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md#Functional-Requirements]
- Архитектура требует хранить БД-поля в `snake_case`, а import/persistence-логику держать в worker слое, отдельно от UI и API. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Implementation-Patterns--Consistency-Rules]
- DiscGolfMetrix остаётся единственным источником истины, поэтому park record при повторном запуске должен обновляться из внешнего источника, а не из локально редактируемых данных. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md#Domain-Model-and-Data]

### Current Repo Reality

- В `apps/worker/src/` сейчас есть только bootstrap entrypoint; отдельных слоёв `integration`, `mapping`, `persistence`, `orchestration` ещё нет, поэтому story, вероятно, создаст их с нуля. [Source: repo inspection]
- В `packages/shared-types/src/updates/index.ts` есть только базовый `UpdateSummary` без расширенного operation result, но story `1.6` уже задаёт направление для общего summary contract. [Source: repo inspection]
- В `supabase/migrations/0001_schema_conventions.sql` пока зафиксированы только schema conventions; доменная таблица `courses` и её upsert-ready constraints, скорее всего, ещё не созданы. [Source: repo inspection]

### Architecture Compliance

- Persistence и расчёт `course_par` должны жить в worker, не в `apps/api` и не в `apps/web`.
- На DB boundary использовать `snake_case`; если позже появится read API для парков, наружу отдавать `camelCase` через явный mapping.
- Не смешивать в этой истории повторную загрузку данных из DiscGolfMetrix с UI-trigger логикой: fetch boundary приходит из `2.4`, а здесь основной scope это mapping, persistence и aggregation.

### File Structure Notes

- Ожидаемые точки изменений:
- `apps/worker/src/mapping/`
- `apps/worker/src/persistence/`
- `apps/worker/src/orchestration/`
- `apps/worker/src/jobs/`
- `packages/shared-types/src/domain/` или `packages/shared-types/src/updates/`
- `supabase/migrations/`

### Testing Requirements

- Проверить create path для нового park record.
- Проверить repeat-run/upsert path без дублей.
- Проверить update path при изменении входных данных парка.
- Проверить корректность вычисления `course_par` на representative fixture.
- Проверить, что неполный payload увеличивает `skipped` и не ломает остальные записи.

### Risks / Watchouts

- Главный риск: неверно вычислить `course_par`, если структура ответа DiscGolfMetrix содержит нестандартные hole/segment данные или частично отсутствующие значения.
- Второй риск: выбрать persistence strategy без уникального match key и снова открыть путь к дублям при повторных запусках.
- Третий риск: смешать raw payload shape и DB entity shape без явного mapping, из-за чего наружу утечёт несогласованный контракт.

### References

- [epics.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md)
- [architecture.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md)
- [prd.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md)
- [1-6-idempotentnost-i-chastichno-ustoychivoe-vypolnenie-obnovleniy.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-6-idempotentnost-i-chastichno-ustoychivoe-vypolnenie-obnovleniy.md)
- [2-3-sohranenie-i-obnovlenie-sorevnovaniy-bez-dubley.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/2-3-sohranenie-i-obnovlenie-sorevnovaniy-bez-dubley.md)
- [2-4-poluchenie-dannyh-o-parkah-po-sorevnovaniyam.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/2-4-poluchenie-dannyh-o-parkah-po-sorevnovaniyam.md)

## Change Log

- 2026-03-21: Created implementation-ready story file for Story 2.5 and advanced sprint status from `backlog` to `ready-for-dev`.
