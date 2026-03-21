# Story 4.1: Страница просмотра соревнований

Status: ready-for-dev

## Story

As a сотрудник РДГА,
I want просматривать список соревнований через интерфейс,
so that я могу использовать собранные данные без ручного обращения к DiscGolfMetrix.

## Acceptance Criteria

1. Интерфейс отображает список сохранённых соревнований. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-41-Страница-просмотра-соревнований]
2. Данные загружаются через backend API. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-41-Страница-просмотра-соревнований]
3. Пользователь видит ключевые поля соревнования, достаточные для дальнейшей работы. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-41-Страница-просмотра-соревнований]

## Tasks / Subtasks

- [ ] Реализовать read-side API endpoint/module для списка `competitions` в едином envelope `{ data, meta }`. (AC: 1, 2)
- [ ] Добавить во frontend feature/page для отображения соревнований через backend API, не обращаясь к БД напрямую. (AC: 1, 2)
- [ ] Выбрать и отобразить минимальный набор полезных полей соревнования для MVP-списка. (AC: 3)
- [ ] Обеспечить локальные loading/error/empty states страницы в соответствии с lifecycle patterns проекта. (AC: 1, 2, 3)
- [ ] Добавить тесты или smoke-checks для API read contract и рендеринга competition list page. (AC: 1, 2, 3)

## Dev Notes

### Previous Story Learnings

- Story `1.3` уже зафиксировала backend API как единственную серверную границу для UI и единый response envelope. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-3-backend-api-karkas-i-health-read-contract.md#Technical-Requirements]
- Story `1.5` закрепляет loading/success/failure lifecycle и user-visible statistics/status principles, которые стоит сохранить и на read pages. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-5-obshchiy-lifecycle-obnovleniya-i-itogovaya-statistika.md#Technical-Requirements]
- Story `2.3` определяет стабильный persistence слой соревнований, на который и должна опираться страница просмотра. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/2-3-sohranenie-i-obnovlenie-sorevnovaniy-bez-dubley.md#Story]

### Technical Requirements

- PRD требует, чтобы внутренний пользователь РДГА мог просматривать список соревнований через интерфейс без ручного обращения к DiscGolfMetrix. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md#Functional-Requirements]
- Архитектура фиксирует `api -> db` и `web -> api`, без прямого доступа frontend к Supabase. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#API--Communication-Patterns]
- На API/frontend boundary использовать `camelCase`, даже если в БД поля лежат в `snake_case`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Data-Boundaries]

### Current Repo Reality

- `apps/web/src/app/App.tsx` пока показывает только placeholder hero panel без data-view pages. [Source: repo inspection]
- `apps/web/src/app/router.tsx` сейчас содержит пустой `appRoutes = []`. [Source: repo inspection]
- В `apps/api/src/` ещё нет модуля `competitions` для list/read endpoint. [Source: repo inspection]

### Architecture Compliance

- Не читать `competitions` напрямую из frontend через Supabase.
- Не смешивать admin update controls и competition list page в одном неструктурированном компоненте.
- Держать feature-first структуру на frontend и layer-first на backend.

### File Structure Notes

- Ожидаемые точки изменений:
- `apps/api/src/modules/competitions/`
- `apps/web/src/app/router.tsx`
- `apps/web/src/features/competitions/`
- `apps/web/src/app/App.tsx`
- Возможно `packages/shared-types/src/api/`

### Testing Requirements

- Проверить API list endpoint для соревнований.
- Проверить loading/empty/data states competition page.
- Проверить, что UI получает данные через API contract, а не напрямую из БД.

### Risks / Watchouts

- Главный риск: вывести DB-shaped `snake_case` поля напрямую в UI и закрепить неправильный boundary contract.
- Второй риск: встроить страницу просмотра прямо в текущий placeholder без маршрутизации и потерять масштабируемость Epic 4.

### References

- [epics.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md)
- [architecture.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md)
- [prd.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md)
- [1-3-backend-api-karkas-i-health-read-contract.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-3-backend-api-karkas-i-health-read-contract.md)
- [1-5-obshchiy-lifecycle-obnovleniya-i-itogovaya-statistika.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-5-obshchiy-lifecycle-obnovleniya-i-itogovaya-statistika.md)
- [2-3-sohranenie-i-obnovlenie-sorevnovaniy-bez-dubley.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/2-3-sohranenie-i-obnovlenie-sorevnovaniy-bez-dubley.md)

## Change Log

- 2026-03-21: Created implementation-ready story file for Story 4.1 and advanced sprint status from `backlog` to `ready-for-dev`.
