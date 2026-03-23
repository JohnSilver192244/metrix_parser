# Story 4.5: Базовая навигация между страницами просмотра и административным разделом

Status: review

## Story

As a пользователь системы,
I want иметь понятную навигацию между основными страницами продукта,
so that я могу переходить между обновлением данных и их просмотром без лишних действий.

## Acceptance Criteria

1. Пользователь может перейти к страницам соревнований, парков, игроков, результатов и административному разделу. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-45-Базовая-навигация-между-страницами-просмотра-и-административным-разделом]
2. Навигация работает предсказуемо в рамках SPA. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-45-Базовая-навигация-между-страницами-просмотра-и-административным-разделом]
3. Пользователь не теряет контекст текущей работы из-за некорректных переходов. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-45-Базовая-навигация-между-страницами-просмотра-и-административным-разделом]

## Tasks / Subtasks

- [x] Спроектировать базовую route map SPA для административного раздела и всех страниц просмотра данных. (AC: 1, 2)
- [x] Реализовать понятную primary navigation в `apps/web`, связывающую admin, competitions, courses, players, results. (AC: 1, 2)
- [x] Обеспечить предсказуемое поведение переходов без full-page reload и без потери локального контекста страницы при обычной навигации. (AC: 2, 3)
- [x] Встроить navigation shell в существующий frontend layout так, чтобы он мог масштабироваться вместе с Epic 4 страницами. (AC: 1, 2)
- [x] Добавить smoke-tests/checks для route registration и базовых переходов между страницами. (AC: 1, 2, 3)

## Dev Notes

### Previous Story Learnings

- Story `1.4` уже закрепляет существование административного раздела как отдельной пользовательской зоны, поэтому навигация должна включать его как first-class destination. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-4-bazovyy-administrativnyy-interfeys-zapuska-obnovleniy.md#Story]
- Stories `4.1`-`4.4` задают отдельные страницы просмотра; `4.5` должна связать их в целостный SPA flow, а не дублировать содержимое этих страниц. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Epic-4-Интерфейс-просмотра-данных-для-РДГА-и-игроков]

### Technical Requirements

- PRD требует понятную навигацию между админскими сценариями и страницами просмотра данных в рамках одного SPA-подхода. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md#Implementation-Considerations]
- Архитектура фиксирует SPA frontend на `Vite + React + TypeScript` и feature-first организацию UI. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Frontend-Architecture]

### Current Repo Reality

- `apps/web/src/app/router.tsx` сейчас пустой.
- `apps/web/src/app/App.tsx` — это один placeholder screen без navigation shell.
- В проекте пока нет route-aware layout или feature pages для data viewing. [Source: repo inspection]

### Architecture Compliance

- Не смешивать навигацию и содержимое всех страниц в одном монолитном компоненте.
- Сохранять SPA navigation behavior без серверных редиректов и full reload.
- Держать маршруты и layout в `app` слое, а page content в feature modules.

### File Structure Notes

- Ожидаемые точки изменений:
- `apps/web/src/app/router.tsx`
- `apps/web/src/app/App.tsx`
- `apps/web/src/features/`
- Возможно `apps/web/src/styles/global.css`

### Testing Requirements

- Проверить route registration.
- Проверить переходы между admin и data-view pages.
- Проверить, что обычная навигация не приводит к потере SPA context.

### Risks / Watchouts

- Главный риск: оставить router формально существующим, но без ясного navigation shell, из-за чего пользователь не сможет быстро находить разделы.
- Второй риск: собрать все страницы в один линейный экран и потерять предсказуемость переходов и масштабируемость UI.

### References

- [epics.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md)
- [architecture.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md)
- [prd.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md)
- [1-4-bazovyy-administrativnyy-interfeys-zapuska-obnovleniy.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-4-bazovyy-administrativnyy-interfeys-zapuska-obnovleniy.md)
- [4-1-stranitsa-prosmotra-sorevnovaniy.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/4-1-stranitsa-prosmotra-sorevnovaniy.md)
- [4-4-stranitsa-prosmotra-rezultatov-dlya-igrokov-i-rdga.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/4-4-stranitsa-prosmotra-rezultatov-dlya-igrokov-i-rdga.md)

## Change Log

- 2026-03-21: Created implementation-ready story file for Story 4.5 and advanced sprint status from `backlog` to `ready-for-dev`.
- 2026-03-22: Added grouped SPA navigation, history-based route transitions without full reload, and smoke coverage for route registration and in-app navigation.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Implementation Plan

- Replace plain link-based navigation with an explicit SPA route shell that groups admin and browse destinations across all Epic 4 pages.
- Add History API based navigation so route changes happen without full-page reload and remain predictable inside the current app shell.
- Keep route definitions in the `app` layer, enrich them with route metadata for scalable navigation, and expose a testable navigation helper.
- Add smoke-tests for route registration, grouped navigation rendering, and in-app route transitions, then run web and workspace checks.

### Debug Log References

- Extended `apps/web/src/app/router.tsx` with a richer route map that now carries group/title/description metadata for admin and browse sections.
- Refactored `apps/web/src/app/App.tsx` into a route-aware SPA shell with grouped primary navigation, history-based in-app transitions, `popstate` handling, and testable helpers.
- Updated `apps/web/src/styles/global.css` to support the new navigation shell, grouped nav cards, and scalable content layout for Epic 4.
- Added `apps/web/src/app/router.test.ts` and `apps/web/src/app/App.test.tsx` to validate route registration and client-side navigation behavior without full reload.
- Validation completed with `./node_modules/.bin/tsx --test apps/web/src/app/router.test.ts apps/web/src/app/App.test.tsx`, `npm run check --workspace @metrix-parser/web`, and `npm run check`.

### Completion Notes List

- Added a first-class SPA route map that connects admin, competitions, parks, players, and results from one shared navigation shell.
- Replaced full-page link behavior with history-based in-app transitions so normal navigation no longer forces document reloads.
- Kept routing/layout concerns in the `app` layer while leaving feature page content in their own modules.
- Added grouped primary navigation and route descriptions so users can move between update and browse tasks without losing orientation.
- Added smoke coverage for both route registration and in-app navigation behavior.

### File List

- apps/web/src/app/router.tsx
- apps/web/src/app/App.tsx
- apps/web/src/app/router.test.ts
- apps/web/src/app/App.test.tsx
- apps/web/src/styles/global.css
