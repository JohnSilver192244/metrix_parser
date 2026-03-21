# Story 1.6: Идемпотентность и частично устойчивое выполнение обновлений

Status: review

## Story

As a владелец проекта,
I want чтобы повторный запуск обновлений был безопасным и устойчивым к частичным ошибкам,
so that система не создавала дубли и не ломала весь процесс из-за проблемных записей.

## Acceptance Criteria

1. Система не создаёт дубли по согласованным идентификаторам. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-16-Идемпотентность-и-частично-устойчивое-выполнение-обновлений]
2. Система отличает новые записи от обновляемых. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-16-Идемпотентность-и-частично-устойчивое-выполнение-обновлений]
3. Корректные записи продолжают обрабатываться даже при наличии отдельных ошибочных или неполных записей. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-16-Идемпотентность-и-частично-устойчивое-выполнение-обновлений]
4. Проблемные записи помечаются как пропущенные. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-16-Идемпотентность-и-частично-устойчивое-выполнение-обновлений]
5. Пользователь видит результат частичной обработки в статистике обновления. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-16-Идемпотентность-и-частично-устойчивое-выполнение-обновлений]

## Tasks / Subtasks

- [x] Спроектировать единый update execution/result contract для backend/worker, который различает как минимум `found`, `added|created`, `updated`, `skipped`, финальный статус и список/счётчик ошибок обработки. (AC: 2, 4, 5)
- [x] Добавить в `packages/shared-types/src/updates/` общие типы для идентификаторов update-сценариев, статусов выполнения и partially-tolerant result semantics, чтобы следующие import stories не изобретали локальные форматы. (AC: 1, 2, 5)
- [x] Заложить в `apps/api/src/modules/updates/` и/или `apps/worker/src/orchestration/` расширяемую execution-пайплайн модель, где обработка идёт по записям/единицам работы и не обрывает весь сценарий из-за одной битой записи. (AC: 3, 4)
- [x] Определить правило upsert/idempotent matching для будущих сущностей: соревнования по `competition_id`/`metrix_id`, игроки по `player_id`, результаты по согласованному составному ключу. В этой истории достаточно зафиксировать общий pattern и shared helpers, а не все доменные детали. (AC: 1, 2)
- [x] Обеспечить, чтобы пропуски и ошибки аггрегировались в update summary, а не терялись в логах, чтобы UI из story `1.5` мог показать частичную обработку пользователю. (AC: 4, 5)
- [x] Добавить минимальные unit-level helpers или smoke-level проверки для логики суммирования `found/updated/skipped` и поведения “continue on bad record”. (AC: 3, 4, 5)

## Dev Notes

### Previous Story Learnings

- Story `1.5` уже закрепила unified lifecycle/statistics на UI; теперь нужно дать этому стабильную backend/worker semantics-основу, а не только интерфейсный слой. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-5-obshchiy-lifecycle-obnovleniya-i-itogovaya-statistika.md#Technical-Requirements]
- Story `1.3` определила единый API envelope `{ data, meta } / { error: { code, message } }`, поэтому update-result model должна легко помещаться в `data`, а не обходить этот контракт. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-3-backend-api-karkas-i-health-read-contract.md#Technical-Requirements]

### Technical Requirements

- Архитектура явно требует реализовывать импорт как `partially tolerant process`, а не all-or-nothing pipeline. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Enforcement-Guidelines]
- Для повторных обновлений система должна использовать устойчивые идентификаторы DiscGolfMetrix и избегать дублей. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md#Core-Domain-Entities]
- DiscGolfMetrix остаётся единственным источником истины; ручное исправление данных в MVP не предусмотрено. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md#Domain-Model-and-Data]

### Architecture Compliance

- Не смешивать UI-level state из `apps/web` с execution semantics worker/API; эта история лежит в shared-types, API updates module и worker orchestration.
- Точный orchestration mechanism между `apps/api` и `apps/worker` в planning-артефактах не зафиксирован. Для этой истории достаточно зафиксировать контракты и точки расширения, не прибивая premature runtime mechanism. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/implementation-readiness-report-2026-03-20.md#Epic-Quality-Review]

### Current Repo Reality

- `packages/shared-types/src/updates/index.ts` сейчас содержит только `UpdateSummary` с четырьмя счётчиками, но не описывает статус выполнения, ошибки и доменную идентичность update-сценариев. [Source: repo inspection]
- `apps/api/src/main.ts` и `apps/worker/src/main.ts` пока ещё bootstrap-заглушки, поэтому story должна оставаться contract-first и не предполагать уже готовый runtime. [Source: repo inspection]

### File Structure Notes

- Ожидаемые точки изменений:
- `packages/shared-types/src/updates/index.ts`
- `apps/api/src/modules/updates/`
- `apps/worker/src/orchestration/`
- `apps/worker/src/jobs/`
- Возможно `packages/shared-utils/src/errors/`

### Testing Requirements

- Проверить, что summary-контракт умеет отражать частичную обработку без падения всей операции.
- Проверить, что bad-record path увеличивает `skipped`, а не обнуляет остальные счётчики.
- Проверить, что helper-логика различает create/update outcome.

### Risks / Watchouts

- Главный риск: смешать в одной истории контракт идемпотентности и конкретную persistence-реализацию всех сущностей. Эта история должна задать общие правила, а доменная детализация придёт в Epic 2/3.
- Второй риск: хранить детали ошибок только в логах и не выводить их в summary/result.

### References

- [epics.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md)
- [architecture.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md)
- [prd.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md)
- [1-5-obshchiy-lifecycle-obnovleniya-i-itogovaya-statistika.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-5-obshchiy-lifecycle-obnovleniya-i-itogovaya-statistika.md)

## Change Log

- 2026-03-20: Created implementation-ready story file for Story 1.6 and advanced sprint status from `backlog` to `ready-for-dev`.
- 2026-03-21: Added shared partially-tolerant update execution contracts, idempotent matching rules, worker orchestration helpers, and UI-compatible partial summary reporting.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Added worker smoke tests for per-record execution and continue-on-bad-record semantics.
- Replaced the previous hardcoded update summary stub with contract-driven per-record aggregation in the API updates module.
- Validation completed successfully with `npm test --workspace @metrix-parser/api`, `npm test --workspace @metrix-parser/worker`, `npm run check`, and `npm run build`.

### Completion Notes List

- Expanded `packages/shared-types/src/updates/index.ts` with shared final statuses, processing issues, idempotent identity rules, and summary aggregation helpers.
- Added `apps/api/src/modules/updates/execution.ts` so update endpoints now return contract-first partial-processing results with `issues` and `errors`.
- Added `apps/worker/src/orchestration/update-execution.ts` plus `apps/worker/src/jobs/demo-update-job.ts` as an extensible per-record execution pipeline that skips bad records instead of aborting the whole run.
- Documented idempotent matching rules for competitions, players, and results through `UPDATE_IDENTITY_RULES` and `resolveRecordAction`.
- Updated the admin updates UI to display `completed_with_issues`, `errors`, and skipped-record issue details in the summary card.
- Added API and worker tests that verify summary aggregation and continue-on-bad-record behavior.

### File List

- packages/shared-types/src/updates/index.ts
- apps/api/src/modules/updates/index.ts
- apps/api/src/modules/updates/execution.ts
- apps/api/src/app.test.ts
- apps/worker/src/orchestration/update-execution.ts
- apps/worker/src/orchestration/update-execution.test.ts
- apps/worker/src/jobs/demo-update-job.ts
- apps/worker/src/main.ts
- apps/worker/package.json
- apps/web/src/features/admin-updates/update-action-card.tsx
- apps/web/src/features/admin-updates/update-operation-status.tsx
- apps/web/src/shared/api/updates.ts
- apps/web/src/styles/global.css
