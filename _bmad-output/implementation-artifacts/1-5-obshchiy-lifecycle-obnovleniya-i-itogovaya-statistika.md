# Story 1.5: Общий lifecycle обновления и итоговая статистика

Status: ready-for-dev

## Story

As a сотрудник РДГА,
I want после запуска обновления видеть его статус и итоговую статистику,
so that я понимаю, что произошло и можно ли доверять результату.

## Acceptance Criteria

1. UI отображает локальный loading state для конкретной операции. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-15-Общий-lifecycle-обновления-и-итоговая-статистика]
2. После завершения пользователь видит финальный статус выполнения. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-15-Общий-lifecycle-обновления-и-итоговая-статистика]
3. Интерфейс отображает количество найденных, добавленных, обновлённых и пропущенных записей. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-15-Общий-lifecycle-обновления-и-итоговая-статистика]
4. Формат результата одинаков для всех сценариев обновления. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-15-Общий-lifecycle-обновления-и-итоговая-статистика]

## Tasks / Subtasks

- [ ] Расширить admin-updates UI из story `1.4`, добавив локальный per-operation state machine как минимум для состояний `idle`, `submitting`, `success`, `error` или эквивалентного набора. (AC: 1, 2)
- [ ] Добавить визуальный loading state только для той операции, которую пользователь запустил, не блокируя остальные сценарии обновления целиком. (AC: 1)
- [ ] Спроектировать и реализовать единый client-facing result model для всех четырёх сценариев обновления, включающий как минимум `found`, `created`, `updated`, `skipped` и итоговый статус выполнения. (AC: 2, 3, 4)
- [ ] Синхронизировать UI result model с backend/API contract из story `1.3`; при необходимости расширить shared types, чтобы все сценарии потребляли один и тот же shape результата. (AC: 3, 4)
- [ ] Добавить в интерфейсе единый блок/паттерн отображения результата операции, который одинаково рендерит статистику и финальный статус для `competitions`, `courses`, `players`, `results`. (AC: 2, 3, 4)
- [ ] Обработать error path так, чтобы пользователь видел финальное неуспешное состояние в том же lifecycle-паттерне, а не “тихий” сбой без статуса. (AC: 2, 4)
- [ ] Если backend contract на момент реализации ещё не полностью готов, использовать согласованную adapter/mock boundary только внутри API layer, не зашивая временные shapes в UI-компоненты. (AC: 4)
- [ ] Проверить статическую валидацию frontend и shared types через `npm run check --workspace @metrix-parser/web` и при необходимости `npm run check --workspace @metrix-parser/api`. (AC: 1, 2, 3, 4)

## Dev Notes

### Previous Story Learnings

- Story `1.4` должна дать базовый admin shell с отдельными действиями запуска. Эта история не должна заново проектировать layout страницы, а должна развить его lifecycle-логикой и unified result rendering. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-4-bazovyy-administrativnyy-interfeys-zapuska-obnovleniy.md#Implementation-Guidance]
- Story `1.3` уже закрепила requirement на единый API contract `{ data, meta } / { error: { code, message } }`. Здесь важно не изобрести второй, UI-only формат результата выполнения. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-3-backend-api-karkas-i-health-read-contract.md#Technical-Requirements]
- Readiness report специально подчёркивает ценность unified result semantics и прозрачной диагностики, но отмечает, что orchestration path ещё не до конца определён. Значит, UI нужно строить вокруг стабильного contract shape, а не вокруг предположений о runtime-механике. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/implementation-readiness-report-2026-03-20.md#UX-Alignment-Assessment]

### UX Guidance

- Диагностика является частью UX, а не скрытой технической деталью; пользователь должен понимать, что произошло после запуска операции. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/ux-design-specification.md#Experience-Principles]
- Интерфейс должен поддерживать ощущение контроля даже при частичных ошибках, поэтому финальный статус и статистика должны быть читаемыми, спокойными и прямыми, без технического шума. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/ux-design-specification.md#Emotional-Design-Principles]
- Один из критических моментов успеха продукта: после запуска пользователь понимает, что именно обновилось, а что было пропущено. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/ux-design-specification.md#Critical-Success-Moments]

### Technical Requirements

- Loading state должен быть локален конкретной операции или экрану; это прямо зафиксировано архитектурой как consistency rule. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Process-Patterns]
- Пользователь всегда должен видеть финальный статус выполнения и итоговую статистику. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Process-Patterns]
- API должен возвращать единообразные структуры для operation results; UI должен пользоваться именно этой унификацией. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Format-Patterns]
- API/frontend boundary использует `camelCase`, поэтому все fields статистики и статуса на клиенте должны оставаться в `camelCase`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Naming-Patterns]

### Architecture Compliance

- Эта история лежит на стыке `apps/web/src/features/admin-updates`, shared API types и backend contract, но не должна проникать в worker implementation.
- Не нужно в `1.5` реализовывать истинную идемпотентность или частичную устойчивость pipeline; это тема story `1.6`. Здесь задача UI и contract-level presentation уже существующего результата. [Inference based on epic sequencing]
- Если для отображения статистики нужны временные backend stubs, они должны следовать общему response-format и не ломать дальнейшую эволюцию к реальной update orchestration.

### Current Repo Reality

- На момент создания story в `apps/web` нет admin-updates feature и нет lifecycle state для операций, так что история предполагает развитие почти с нуля поверх `1.4`. [Source: repo inspection]
- Shared API types пока минимальны; вероятно, понадобится добавить тип результата обновления и тип статуса операции. [Source: repo inspection]

### Implementation Guidance

- Лучший путь для MVP: один повторно используемый `UpdateOperationStatus`-компонент или эквивалентный view-pattern, который принимает единый result model и используется всеми четырьмя сценариями.
- Для статистики полезно использовать фиксированный порядок метрик: `found`, `created`, `updated`, `skipped`, чтобы визуальный паттерн был стабильным и легко считывался.
- Error state не должен быть отдельным UX-миром; он должен жить в том же компоненте/слое, что и success result, чтобы сохранялась единая mental model операции.
- Стоит отделить raw API response от UI view-model через небольшую mapping-функцию, если backend meta/error shape начнёт усложняться.

### Testing Requirements

- Проверить, что запуск одной операции показывает loading только в её собственном блоке.
- Проверить, что после завершения всегда отображается финальный статус, включая error case.
- Проверить, что все четыре сценария используют один и тот же визуальный/result contract.
- Проверить, что статистика отображает `found`, `created`, `updated`, `skipped` и не зависит от scenario-specific кастомных полей.
- Сохранить прохождение `npm run check --workspace @metrix-parser/web`; если shared/API contracts меняются, дополнительно проверить соответствующие workspace checks.

### Risks / Watchouts

- Главный риск: сделать четыре разных result-pattern'а для четырёх сценариев и тем самым нарушить AC4.
- Второй риск: показать loading глобально на всю страницу, хотя архитектура требует локальность состояния.
- Третий риск: спутать “операция завершилась с пропусками” и “операция полностью упала”; для пользователя это должны быть различимые финальные состояния, но внутри одного общего lifecycle.

### File Structure Notes

- Ожидаемые точки изменений:
- `apps/web/src/features/admin-updates/`
- `apps/web/src/shared/api/`
- `apps/web/src/shared/components/`
- `apps/web/src/styles/`
- Возможно `packages/shared-types/src/api/index.ts` и/или `packages/shared-types/src/updates/index.ts`
- Возможно `apps/api/src/modules/updates/`, если понадобится согласованный stub/result contract для UI integration

### References

- [epics.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md)
- [architecture.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md)
- [prd.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md)
- [ux-design-specification.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/ux-design-specification.md)
- [implementation-readiness-report-2026-03-20.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/implementation-readiness-report-2026-03-20.md)
- [1-3-backend-api-karkas-i-health-read-contract.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-3-backend-api-karkas-i-health-read-contract.md)
- [1-4-bazovyy-administrativnyy-interfeys-zapuska-obnovleniy.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-4-bazovyy-administrativnyy-interfeys-zapuska-obnovleniy.md)

## Change Log

- 2026-03-20: Created implementation-ready story file for Story 1.5 and advanced sprint status from `backlog` to `ready-for-dev`.
