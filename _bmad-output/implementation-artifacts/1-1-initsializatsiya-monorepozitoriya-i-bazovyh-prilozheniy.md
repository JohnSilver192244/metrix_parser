# Story 1.1: Инициализация монорепозитория и базовых приложений

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a владелец проекта,
I want иметь инициализированный монорепозиторий с приложениями `web`, `api`, `worker` и общей workspace-конфигурацией,
so that дальнейшая разработка будет вестись в согласованной архитектурной структуре.

## Acceptance Criteria

1. В репозитории существуют `apps/web`, `apps/api`, `apps/worker`, `packages/shared-types`, `packages/shared-utils`, `supabase/`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-11-Инициализация-монорепозитория-и-базовых-приложений]
2. Workspace-конфигурация позволяет управлять приложениями как единым монорепозиторием. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-11-Инициализация-монорепозитория-и-базовых-приложений]
3. Frontend создаётся на базе `Vite + React + TypeScript`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-11-Инициализация-монорепозитория-и-базовых-приложений]
4. Базовые конфигурационные файлы проекта добавлены в репозиторий. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-11-Инициализация-монорепозитория-и-базовых-приложений]

## Tasks / Subtasks

- [x] Создать корневую структуру монорепозитория. (AC: 1, 2, 4)
- [x] Добавить корневые файлы `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `.env.example`, `README.md`. (AC: 2, 4)
- [x] Создать каркасы приложений `apps/web`, `apps/api`, `apps/worker` с минимальными `package.json` и `tsconfig.json`. (AC: 1, 2, 4)
- [x] Инициализировать `apps/web` как `Vite + React + TypeScript` приложение с минимальным `src/main.tsx`, `src/app/App.tsx`, `vite.config.ts`, `index.html`. (AC: 3, 4)
- [x] Создать базовые пакеты `packages/shared-types` и `packages/shared-utils` с минимальной структурой `src/`. (AC: 1, 4)
- [x] Создать каталог `supabase/` и минимальный каркас для будущих миграций. (AC: 1, 4)
- [x] Проверить, что workspace видит все пакеты и приложения, а базовые скрипты запускаются без конфликтов конфигурации. (AC: 2, 4)

## Dev Notes

- Это greenfield-история, поэтому допустимо начинать с infrastructure-enabling инкремента, но он должен максимально жёстко закрепить правильную структуру проекта, чтобы следующие stories не расходились по layout и naming. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md#Project-Classification]
- Архитектура уже определила ожидаемую итоговую структуру каталогов; в этой истории важно не “примерно похоже”, а заложить именно тот skeleton, на который будут опираться `1.2+`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Project-Structure--Boundaries]
- `apps/web` должен стартовать как SPA на `Vite + React + TypeScript`; `apps/api` и `apps/worker` пока могут быть минимальными TypeScript-entrypoint skeletons без реализации доменной логики. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Selected-Starter-Vite--React--TypeScript]
- Важно не смешивать будущие ответственности уже на уровне файловой структуры: frontend будет `feature-first`, backend API и worker будут `layer-first`. Даже если директории пока пустые, их layout нужно заложить сразу. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Structure-Patterns]
- По readiness-отчёту есть архитектурная неопределённость вокруг `api -> worker orchestration`, но для story `1.1` это не blocker: здесь нужно подготовить skeleton, а не финализировать runtime-trigger contract. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/implementation-readiness-report-2026-03-20.md#Summary-and-Recommendations]

### Technical Requirements

- Использовать TypeScript как базовый язык во всех трёх приложениях. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Selected-Starter-Vite--React--TypeScript]
- Подготовить monorepo под workspace-управление; в архитектуре явно указан `pnpm-workspace.yaml`, поэтому предпочтительный package manager для структуры workspace здесь `pnpm`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Complete-Project-Directory-Structure]
- Для frontend использовать `Vite + React + TypeScript`, а не `Next.js`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Starter-Options-Considered]
- Каталог `supabase/` должен содержать как минимум основу для `migrations/`; seeds и `config.toml` можно заложить сразу, если это не создаёт лишней сложности. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Complete-Project-Directory-Structure]

### Architecture Compliance

- Не допускать прямого доступа frontend к БД даже в виде “временных” заготовок. `apps/web` должен существовать как отдельное SPA-приложение, а не как thin shell поверх Supabase client. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Architectural-Boundaries]
- Не размещать worker как ad-hoc script внутри `apps/api` или `apps/web`; он должен быть отдельным приложением `apps/worker`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Selected-Starter-Vite--React--TypeScript]
- Заранее заложить boundaries для `shared-types` и `shared-utils`, но не заполнять их случайными abstraction-слоями “на вырост”. Только минимальный skeleton. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Service-Boundaries]

### Library / Framework Requirements

- Frontend foundation: `Vite`, `React`, `TypeScript`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Selected-Starter-Vite--React--TypeScript]
- Для backend API и worker на этой истории не требуется выбирать полноценный framework, если он ещё не закреплён архитектурой; достаточно чистого TypeScript skeleton с entrypoints. Это избегает преждевременного закрепления деталей, которых нет в architecture. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Core-Architectural-Decisions]
- Так как в локальном контексте нет `project-context.md`, а git-репозиторий не инициализирован, нельзя опираться на уже существующие кодовые соглашения проекта; следуем только planning-артефактам.

### File Structure Requirements

- Ожидаемая целевая структура:
  - `apps/web/src/app`, `apps/web/src/features`, `apps/web/src/shared`, `apps/web/src/styles`
  - `apps/api/src/config`, `apps/api/src/modules`, `apps/api/src/middleware`, `apps/api/src/dto`, `apps/api/src/services`, `apps/api/src/lib`
  - `apps/worker/src/config`, `apps/worker/src/integration`, `apps/worker/src/orchestration`, `apps/worker/src/parsing`, `apps/worker/src/mapping`, `apps/worker/src/persistence`, `apps/worker/src/jobs`, `apps/worker/src/lib`
  - `packages/shared-types/src/api`, `packages/shared-types/src/domain`, `packages/shared-types/src/updates`
  - `packages/shared-utils/src/dates`, `packages/shared-utils/src/errors`, `packages/shared-utils/src/formatting`
  - `supabase/migrations`
  [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Complete-Project-Directory-Structure]
- Имена frontend component-файлов должны быть `PascalCase.tsx`, а служебных TS-файлов могут быть `kebab-case.ts`. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Naming-Patterns]

### Testing Requirements

- На этой истории минимально достаточно smoke-level verification:
  - workspace устанавливает зависимости без конфликтов;
  - `apps/web` собирается или стартует;
  - TypeScript-конфигурации приложений валидны;
  - структура каталогов соответствует story.
- Архитектура отмечает, что финальная testing strategy ещё не определена, поэтому не нужно переусложнять story setup сложной тестовой инфраструктурой. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Selected-Starter-Vite--React--TypeScript]

### UX Guidance

- Даже для setup-story frontend skeleton должен учитывать, что продукт это спокойный рабочий SPA для operator-first сценария. Базовый `App.tsx` может быть минимальным, но не должен уводить проект в marketing-site layout или SSR-oriented patterns. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/ux-design-specification.md#Project-Vision]
- Основной interaction model desktop-first, поэтому заготовки layout/router/provider structure можно ориентировать на рабочий desktop SPA shell. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/ux-design-specification.md#Platform-Strategy]

### Project Structure Notes

- Текущий workspace фактически ещё не содержит приложений `apps/web`, `apps/api`, `apps/worker`, `packages/shared-types`, `packages/shared-utils`, `supabase/`; story реально создаёт основу с нуля.
- В корне проекта присутствуют BMAD/WDS-служебные каталоги (`_bmad`, `_bmad-output`, `design-artifacts`, `.agents` и др.), поэтому новая проектная структура не должна пытаться “почистить” корень или переписать существующие planning-артефакты.
- Git-репозиторий в текущем cwd не инициализирован, поэтому нет git-history и commit-patterns для опоры.
- `docs/` существует, но `project-context.md` не найден.

### References

- [epics.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md)
- [architecture.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md)
- [prd.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md)
- [ux-design-specification.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/ux-design-specification.md)
- [implementation-readiness-report-2026-03-20.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/implementation-readiness-report-2026-03-20.md)

## Change Log

- 2026-03-20: Created the monorepo skeleton with root workspace configuration, Vite-based web app scaffold, API and worker TypeScript entrypoints, shared packages, Supabase folders, and a local workspace verification script.
- 2026-03-20: Addressed code review feedback by adding `@types/node` to backend package devDependencies for `apps/api` and `apps/worker`.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- No `project-context.md` found.
- No previous story file exists for Epic 1.
- No git repository detected in current workspace.
- `pnpm` is not installed in the current environment, so validation used repository-level smoke checks rather than a pnpm command.
- Attempted `npm install --workspaces --include-workspace-root`, but dependency installation did not complete during this session, so final validation relied on local structural verification.

### Completion Notes List

- Implemented the full repository skeleton required by Story 1.1: root workspace files, `apps/web`, `apps/api`, `apps/worker`, `packages/shared-types`, `packages/shared-utils`, and `supabase/`.
- Scaffolded `apps/web` as a `Vite + React + TypeScript` SPA shell with `main.tsx`, `App.tsx`, `vite.config.ts`, `index.html`, and base styles.
- Added minimal TypeScript entrypoints and layered directory skeletons for both `apps/api` and `apps/worker`.
- Added starter exports for shared contracts and utilities to prevent later stories from inventing ad-hoc shared boundaries.
- Added `scripts/verify-workspace.mjs` and validated the workspace skeleton successfully with `npm run check:workspace`.
- Applied the post-review fix by adding `@types/node` to both backend packages so their `tsconfig.json` settings are consistent with declared devDependencies.
- Confirmed end-to-end validation after dependency installation: `npm install --workspaces --include-workspace-root`, `npm run check`, and `npm run build` all completed successfully.

### File List

- package.json
- pnpm-workspace.yaml
- tsconfig.base.json
- .gitignore
- .env.example
- README.md
- scripts/verify-workspace.mjs
- apps/web/package.json
- apps/web/tsconfig.json
- apps/web/vite.config.ts
- apps/web/index.html
- apps/web/src/main.tsx
- apps/web/src/app/App.tsx
- apps/web/src/app/router.tsx
- apps/web/src/app/providers/.gitkeep
- apps/web/src/features/.gitkeep
- apps/web/src/shared/.gitkeep
- apps/web/src/styles/global.css
- apps/api/package.json
- apps/api/tsconfig.json
- apps/api/src/main.ts
- apps/api/src/config/.gitkeep
- apps/api/src/modules/.gitkeep
- apps/api/src/middleware/.gitkeep
- apps/api/src/dto/.gitkeep
- apps/api/src/services/.gitkeep
- apps/api/src/lib/.gitkeep
- apps/worker/package.json
- apps/worker/tsconfig.json
- apps/worker/src/main.ts
- apps/worker/src/config/.gitkeep
- apps/worker/src/integration/discgolfmetrix/.gitkeep
- apps/worker/src/orchestration/.gitkeep
- apps/worker/src/parsing/.gitkeep
- apps/worker/src/mapping/.gitkeep
- apps/worker/src/persistence/.gitkeep
- apps/worker/src/jobs/.gitkeep
- apps/worker/src/lib/.gitkeep
- packages/shared-types/package.json
- packages/shared-types/tsconfig.json
- packages/shared-types/src/index.ts
- packages/shared-types/src/api/index.ts
- packages/shared-types/src/domain/index.ts
- packages/shared-types/src/updates/index.ts
- packages/shared-utils/package.json
- packages/shared-utils/tsconfig.json
- packages/shared-utils/src/index.ts
- packages/shared-utils/src/dates/index.ts
- packages/shared-utils/src/errors/index.ts
- packages/shared-utils/src/formatting/index.ts
- supabase/config.toml
- supabase/migrations/.gitkeep
- supabase/seeds/.gitkeep
