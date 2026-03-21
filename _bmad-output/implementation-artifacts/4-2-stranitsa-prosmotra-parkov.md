# Story 4.2: Страница просмотра парков

Status: ready-for-dev

## Story

As a сотрудник РДГА,
I want просматривать список парков через интерфейс,
so that я могу видеть структурированную информацию о парках, связанных с соревнованиями.

## Acceptance Criteria

1. Интерфейс отображает список сохранённых парков. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-42-Страница-просмотра-парков]
2. Пользователь видит основные поля парка, включая рассчитанный `course_par`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-42-Страница-просмотра-парков]
3. Данные загружаются через backend API. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-42-Страница-просмотра-парков]

## Tasks / Subtasks

- [ ] Реализовать read-side API endpoint/module для списка `courses`, включая `coursePar` и другие ключевые поля в `camelCase`. (AC: 1, 2, 3)
- [ ] Добавить frontend feature/page для отображения списка парков и рассчитанного `course_par` через backend API. (AC: 1, 2, 3)
- [ ] Определить минимальный набор park fields для MVP-таблицы/списка без перегрузки интерфейса второстепенными деталями. (AC: 2)
- [ ] Реализовать loading/error/empty states и базовую доступность списка парков. (AC: 1, 2, 3)
- [ ] Добавить smoke-tests/checks для API contract и рендеринга course list page. (AC: 1, 2, 3)

## Dev Notes

### Previous Story Learnings

- Story `2.5` должна сохранить park records и рассчитанный `course_par`; эта история использует уже готовые данные, а не считает `course_par` на клиенте повторно. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/2-5-sohranenie-parkov-i-raschet-course-par.md#Architecture-Compliance]
- Story `1.3` закрепила backend API boundary, поэтому read page parks не должна читать из БД напрямую. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-3-backend-api-karkas-i-health-read-contract.md#Acceptance-Criteria]

### Technical Requirements

- PRD требует показывать структурированные данные о парках через интерфейс и отдельно фиксирует `course_par` как значимое поле сущности. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md#Functional-Requirements]
- Архитектура требует явного маппинга между DB `snake_case` и UI/API `camelCase`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Data-Boundaries]

### Current Repo Reality

- Во frontend пока отсутствуют page-level features для parks.
- Router пустой, а API-модуль `courses` ещё не создан.
- Текущий `App.tsx` — это только landing placeholder, без data-view composition. [Source: repo inspection]

### Architecture Compliance

- Не вычислять `course_par` повторно на read page.
- Не смешивать page of parks с админским запуском обновлений.
- Не отдавать наружу raw DB field names без API mapping.

### File Structure Notes

- Ожидаемые точки изменений:
- `apps/api/src/modules/courses/`
- `apps/web/src/features/courses/`
- `apps/web/src/app/router.tsx`
- Возможно `packages/shared-types/src/api/`

### Testing Requirements

- Проверить API list endpoint для парков.
- Проверить отображение `coursePar`.
- Проверить loading/empty/data states page.

### Risks / Watchouts

- Главный риск: повторно рассчитывать `course_par` на клиенте и получить расхождение с persisted данными.
- Второй риск: перегрузить MVP-страницу избыточными полями вместо фокуса на полезной read-side информации.

### References

- [epics.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md)
- [architecture.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md)
- [prd.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md)
- [1-3-backend-api-karkas-i-health-read-contract.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-3-backend-api-karkas-i-health-read-contract.md)
- [2-5-sohranenie-parkov-i-raschet-course-par.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/2-5-sohranenie-parkov-i-raschet-course-par.md)

## Change Log

- 2026-03-21: Created implementation-ready story file for Story 4.2 and advanced sprint status from `backlog` to `ready-for-dev`.
