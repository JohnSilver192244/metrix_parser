# Story 4.4: Страница просмотра результатов для игроков и РДГА

Status: ready-for-dev

## Story

As a игрок в дискгольф или сотрудник РДГА,
I want просматривать результаты соревнований через интерфейс,
so that я могу быстро найти и понять результаты выступления без ручного поиска по внешним источникам.

## Acceptance Criteria

1. Интерфейс отображает сохранённые результаты соревнований. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-44-Страница-просмотра-результатов-для-игроков-и-РДГА]
2. Пользователь видит ключевые поля результата, включая `class_name`, `sum`, `diff`, `order_number`, `dnf`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-44-Страница-просмотра-результатов-для-игроков-и-РДГА]
3. Данные загружаются через backend API. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-44-Страница-просмотра-результатов-для-игроков-и-РДГА]
4. Признак `DNF` отображается как отдельное состояние результата. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-44-Страница-просмотра-результатов-для-игроков-и-РДГА]

## Tasks / Subtasks

- [ ] Реализовать API read endpoint/module для `competition_results`, возвращающий UI-friendly `camelCase` payload с полями результата. (AC: 1, 2, 3)
- [ ] Добавить frontend feature/page для отображения results list с явным показом `dnf` state. (AC: 1, 2, 4)
- [ ] Определить MVP presentation для результатов так, чтобы игрок и сотрудник РДГА могли быстро понять outcome без сложной аналитики. (AC: 2, 4)
- [ ] Реализовать loading/error/empty states и аккуратное отображение `DNF` как отдельного состояния, а не как сломанного значения. (AC: 1, 2, 4)
- [ ] Добавить smoke-tests/checks для result read contract и рендеринга results page. (AC: 1, 2, 3, 4)

## Dev Notes

### Previous Story Learnings

- Story `3.4` фиксирует структуру persisted results и семантику `DNF`; read page должна отображать их, а не переинтерпретировать произвольно. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/3-4-sohranenie-rezultatov-sorevnovaniy-s-obrabotkoy-dnf.md#Technical-Requirements]
- Story `3.5` должна обеспечить итоговую корректность и безопасность result updates, после чего read page может опираться на консистентные данные. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/3-5-chastichno-ustoychivoe-obnovlenie-rezultatov-i-itogovaya-diagnostika.md#Story]
- Story `1.3` закрепляет backend API boundary и единый envelope. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-3-backend-api-karkas-i-health-read-contract.md#Acceptance-Criteria]

### Technical Requirements

- PRD требует, чтобы игроки и сотрудники РДГА могли просматривать результаты через интерфейс продукта. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md#Functional-Requirements]
- PRD отдельно фиксирует `DNF` как особое состояние результата. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md#Technical-Constraints]
- Архитектура требует `camelCase` на API/frontend boundary. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Data-Boundaries]

### Current Repo Reality

- Во frontend отсутствует results page и любые data tables/views.
- В API ещё нет `results` read module.
- Текущий router пуст, поэтому route composition для Epic 4 предстоит создавать с нуля. [Source: repo inspection]

### Architecture Compliance

- Не тянуть raw worker/result DTOs напрямую в UI без API mapping.
- Не терять `DNF` semantics на уровне отображения.
- Не превращать страницу результатов в ad-hoc debug screen для сырых полей.

### File Structure Notes

- Ожидаемые точки изменений:
- `apps/api/src/modules/results/`
- `apps/web/src/features/results/`
- `apps/web/src/app/router.tsx`
- Возможно `packages/shared-types/src/api/`

### Testing Requirements

- Проверить API read endpoint для результатов.
- Проверить отображение ключевых полей результата.
- Проверить корректный UI для `dnf`.
- Проверить loading/empty/data states page.

### Risks / Watchouts

- Главный риск: отрисовать `DNF` как обычный текст/число без отдельного состояния и тем самым исказить смысл результата.
- Второй риск: использовать слишком низкоуровневый payload и получить неудобную для чтения страницу результатов.

### References

- [epics.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md)
- [architecture.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md)
- [prd.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md)
- [1-3-backend-api-karkas-i-health-read-contract.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-3-backend-api-karkas-i-health-read-contract.md)
- [3-4-sohranenie-rezultatov-sorevnovaniy-s-obrabotkoy-dnf.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/3-4-sohranenie-rezultatov-sorevnovaniy-s-obrabotkoy-dnf.md)
- [3-5-chastichno-ustoychivoe-obnovlenie-rezultatov-i-itogovaya-diagnostika.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/3-5-chastichno-ustoychivoe-obnovlenie-rezultatov-i-itogovaya-diagnostika.md)

## Change Log

- 2026-03-21: Created implementation-ready story file for Story 4.4 and advanced sprint status from `backlog` to `ready-for-dev`.
