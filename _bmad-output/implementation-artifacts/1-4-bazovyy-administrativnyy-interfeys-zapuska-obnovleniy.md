# Story 1.4: Базовый административный интерфейс запуска обновлений

Status: ready-for-dev

## Story

As a сотрудник РДГА,
I want видеть административный интерфейс с отдельными действиями для запуска обновлений,
so that я могу управлять процессом загрузки данных вручную из одного места.

## Acceptance Criteria

1. Интерфейс отображает отдельные элементы управления для обновления соревнований, парков, игроков и результатов. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-14-Базовый-административный-интерфейс-запуска-обновлений]
2. Для сценариев, где нужен период, доступны поля задания периода. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-14-Базовый-административный-интерфейс-запуска-обновлений]
3. Запуск каждого сценария инициируется явным действием пользователя. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-14-Базовый-административный-интерфейс-запуска-обновлений]
4. UI не обращается к БД напрямую, а работает через backend API. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-14-Базовый-административный-интерфейс-запуска-обновлений]

## Tasks / Subtasks

- [ ] Создать feature-модуль `apps/web/src/features/admin-updates/` с базовой страницей или экраном административного раздела вместо текущего placeholder в `App.tsx`. (AC: 1, 2, 3)
- [ ] Добавить в админском интерфейсе четыре отдельные action-card/form блока: `competitions`, `courses`, `players`, `results`, чтобы пользователь видел различимые сценарии обновления из одного места. (AC: 1)
- [ ] Для сценариев, где требуется период, добавить поля `dateFrom` / `dateTo` или эквивалентный парный ввод периода; для сценария парков оставить интерфейс без обязательного периода. (AC: 2)
- [ ] Сделать запуск сценария только через явные кнопки/submit-действия пользователя, без auto-run при изменении формы, mount-эффектах или переходе на страницу. (AC: 3)
- [ ] Добавить client-side API boundary в `apps/web/src/shared/api/` или feature-level API access слой для вызова backend endpoint'ов запуска обновлений; не использовать прямой доступ к Supabase или любым DB client'ам из `apps/web`. (AC: 4)
- [ ] Подготовить минимальные shared/client types для команд обновления и ответа запуска, чтобы история `1.5` могла развивать lifecycle и result rendering на уже существующей contract-основе. (AC: 3, 4)
- [ ] Если для доступа к админскому экрану нужен router-level entrypoint, аккуратно расширить `apps/web/src/app/router.tsx` и shell так, чтобы это не мешало будущей навигации Epic 4. (AC: 1)
- [ ] Проверить статическую валидацию frontend части через `npm run check --workspace @metrix-parser/web` и smoke-проверить, что админский экран рендерится без обращения к БД напрямую. (AC: 1, 2, 3, 4)

## Dev Notes

### Previous Story Learnings

- Story `1.3` фиксирует, что `apps/api` должен стать единственной backend boundary для UI и использовать единые response contracts. Эта история должна строить админский UI вокруг backend API, а не вокруг временных заглушек прямого доступа к данным. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-3-backend-api-karkas-i-health-read-contract.md#Architecture-Compliance]
- Story `1.2` уже закрепила правило, что frontend не работает напрямую с Supabase. Любая попытка упростить story `1.4` через browser-side Supabase client будет нарушением уже принятого boundary. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-2-bazovaya-integratsiya-supabase-i-infrastruktura-migratsiy.md#Dev-Notes]
- Story `1.5` будет опираться на этот UI как на базу для loading/result lifecycle, поэтому `1.4` должна сфокусироваться на структуре экрана, формах запуска и API wiring, а не на финальной диагностике. [Inference based on epic sequencing]

### Current Repo Reality

- `apps/web/src/app/App.tsx` пока отображает только один hero placeholder; административного раздела ещё нет. [Source: repo inspection]
- `apps/web/src/app/router.tsx` сейчас пустой (`appRoutes = []`), поэтому, если в реализации нужен routing, его придётся заложить почти с нуля. [Source: repo inspection]
- В `apps/web/package.json` пока есть только `react`, `react-dom`, `vite`; не стоит без необходимости тащить тяжёлый стек состояния или UI framework в рамках этой истории. [Source: repo inspection]
- `packages/shared-types/src/api/index.ts` сейчас содержит только базовый `ApiEnvelope<TData>`, так что типы update-command/result, скорее всего, придётся ввести или расширить. [Source: repo inspection]

### UX Guidance

- Продукт должен давать ощущение спокойного контроля, а не “операторской панели тревоги”; интерфейс должен быть рабочим, прямым и без визуального шума. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/ux-design-specification.md#Primary-Emotional-Goals]
- Пользователь должен легко понимать различия между сценариями обновления, запускать нужный и не бояться повредить данные. Это значит, что карточки/секции сценариев должны быть визуально и смыслово различимы. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/ux-design-specification.md#Effortless-Interactions]
- Интерфейс desktop-first; мобильная совместимость желательна, но не должна диктовать сложную адаптивную архитектуру на старте. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/ux-design-specification.md#Platform-Strategy]

### Technical Requirements

- Frontend остаётся SPA на `Vite + React + TypeScript`; не уходить в SSR/Next-паттерны. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Frontend-Architecture]
- `apps/web` должен быть организован по `feature-first`; для этой истории основной write-scope ожидаемо лежит в `apps/web/src/features/admin-updates/`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Project-Structure--Boundaries]
- API/frontend boundary использует `camelCase`; формы, payload и client DTO не должны повторять database `snake_case`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Naming-Patterns]
- UI не содержит import-логики и не оркестрирует worker напрямую; он вызывает backend API. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Frontend-Architecture]

### Architecture Compliance

- `apps/web -> apps/api` это единственный допустимый путь для запуска обновлений из интерфейса. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#API-Boundaries]
- Точный orchestration contract между `apps/api` и `apps/worker` ещё не определён полностью, поэтому UI в этой истории должен зависеть только от HTTP contract backend API, а не от device-specific assumptions о worker. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/implementation-readiness-report-2026-03-20.md#Missing-Requirements]
- Не нужно в `1.4` реализовывать полную статистику и диагностику результата; это предмет story `1.5`. Здесь достаточно заложить render slots / state shape для дальнейшего расширения. [Inference based on epic sequencing]

### Implementation Guidance

- Практичный UI shape для MVP: одна admin page с четырьмя независимыми секциями/карточками запуска и кратким описанием каждого сценария.
- Для полей периода лучше использовать одинаковый UX-паттерн в обоих сценариях, где период нужен, чтобы в `1.5` lifecycle/status не пришлось привязывать к разным формам.
- Полезно сразу заложить локальный state per operation, даже если в `1.4` он пока ограничится хранением введённых полей и факта отправки.
- Не смешивать сетевой код, UI-компоненты и mapping payload'ов в одном файле, если это начинает разрастаться.

### Testing Requirements

- Проверить, что admin UI рендерит четыре независимых действия обновления.
- Проверить, что period inputs видны только там, где они предусмотрены сценарием.
- Проверить, что запуск происходит только по явному действию пользователя.
- Проверить отсутствие прямого подключения к Supabase или БД из `apps/web`.
- Сохранить прохождение `npm run check --workspace @metrix-parser/web`.

### Risks / Watchouts

- Самый частый риск: смешать `1.4` и `1.5`, перегрузив историю статусами, итоговой диагностикой и визуализацией статистики вместо простого рабочего admin shell.
- Второй риск: сделать общую форму “один сценарий на всё”, потеряв различимость четырёх сценариев, хотя это прямо противоречит acceptance criteria.
- Третий риск: привязать UI к несуществующему ещё backend contract слишком жёстко вместо использования умеренно расширяемого client API layer.

### File Structure Notes

- Ожидаемые точки изменений:
- `apps/web/src/app/App.tsx`
- `apps/web/src/app/router.tsx`
- `apps/web/src/features/admin-updates/`
- `apps/web/src/shared/api/`
- `apps/web/src/shared/components/`
- `apps/web/src/styles/`
- Возможно `packages/shared-types/src/updates/` или `packages/shared-types/src/api/index.ts`, если update DTO удобнее держать в shared package.

### References

- [epics.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md)
- [architecture.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md)
- [prd.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md)
- [ux-design-specification.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/ux-design-specification.md)
- [implementation-readiness-report-2026-03-20.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/implementation-readiness-report-2026-03-20.md)
- [1-3-backend-api-karkas-i-health-read-contract.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-3-backend-api-karkas-i-health-read-contract.md)

## Change Log

- 2026-03-20: Created implementation-ready story file for Story 1.4 and advanced sprint status from `backlog` to `ready-for-dev`.
