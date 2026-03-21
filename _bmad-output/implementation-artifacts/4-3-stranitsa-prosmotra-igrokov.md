# Story 4.3: Страница просмотра игроков

Status: ready-for-dev

## Story

As a сотрудник РДГА,
I want просматривать список игроков через интерфейс,
so that я могу использовать собранные данные об игроках для дальнейшей статистической работы.

## Acceptance Criteria

1. Интерфейс отображает список сохранённых игроков. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-43-Страница-просмотра-игроков]
2. Пользователь видит данные, достаточные для идентификации игрока. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-43-Страница-просмотра-игроков]
3. Данные загружаются через backend API. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-43-Страница-просмотра-игроков]

## Tasks / Subtasks

- [ ] Реализовать API list/read contract для `players` через backend boundary. (AC: 1, 3)
- [ ] Добавить frontend feature/page для отображения списка игроков с ключевыми полями идентификации. (AC: 1, 2, 3)
- [ ] Выделить минимальный полезный MVP-набор player fields для списка без привязки к конкретному результату. (AC: 2)
- [ ] Реализовать loading/error/empty states и базовую keyboard-friendly доступность. (AC: 1, 2, 3)
- [ ] Добавить проверки для API contract и rendering players page. (AC: 1, 2, 3)

## Dev Notes

### Previous Story Learnings

- Story `3.3` должна создать устойчивое player persistence без дублей; read page игроков должна использовать этот слой как источник данных. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/3-3-sohranenie-i-obnovlenie-igrokov-bez-dubley.md#Story]
- Story `1.3` закрепляет backend API boundary и единый response envelope. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-3-backend-api-karkas-i-health-read-contract.md#Acceptance-Criteria]

### Technical Requirements

- PRD требует, чтобы внутренний пользователь мог просматривать данные игроков через интерфейс без ручного обращения к внешнему источнику. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md#Functional-Requirements]
- Архитектура требует feature-first frontend organization и explicit DB-to-API mapping. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Structure-Patterns]

### Current Repo Reality

- Во frontend ещё нет feature modules для players.
- Router и App остаются skeletal.
- В API отсутствует `players` read module. [Source: repo inspection]

### Architecture Compliance

- Не читать игроков напрямую из frontend database client.
- Не смешивать список игроков со страницей результатов; это разные user tasks.
- Не выносить DB-shaped payload в UI без явной нормализации.

### File Structure Notes

- Ожидаемые точки изменений:
- `apps/api/src/modules/players/`
- `apps/web/src/features/players/`
- `apps/web/src/app/router.tsx`
- Возможно `packages/shared-types/src/api/`

### Testing Requirements

- Проверить API list endpoint для игроков.
- Проверить отображение идентификационных данных игрока.
- Проверить loading/empty/data states page.

### Risks / Watchouts

- Главный риск: использовать result-shaped данные вместо отдельной player model и тем самым размыть границы сущностей.
- Второй риск: спроектировать страницу игроков вокруг деталей результатов, а не вокруг идентифицируемого списка players.

### References

- [epics.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md)
- [architecture.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md)
- [prd.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md)
- [1-3-backend-api-karkas-i-health-read-contract.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-3-backend-api-karkas-i-health-read-contract.md)
- [3-3-sohranenie-i-obnovlenie-igrokov-bez-dubley.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/3-3-sohranenie-i-obnovlenie-igrokov-bez-dubley.md)

## Change Log

- 2026-03-21: Created implementation-ready story file for Story 4.3 and advanced sprint status from `backlog` to `ready-for-dev`.
