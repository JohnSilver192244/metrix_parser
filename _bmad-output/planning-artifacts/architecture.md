---
stepsCompleted:
  - 1
  - 2
  - 3
  - 4
  - 5
  - 6
  - 7
  - 8
inputDocuments:
  - /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md
  - /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/brainstorming/brainstorming-session-2026-03-17-220832.md
workflowType: 'architecture'
project_name: 'metrixParser'
user_name: 'Darling'
date: '2026-03-20 18:06:16'
lastStep: 8
status: 'complete'
completedAt: '2026-03-20'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
Проект определяет 50 функциональных требований, сосредоточенных вокруг трёх независимых сценариев обновления данных, управления четырьмя основными сущностями, отображения статистики выполнения и просмотра собранных данных через веб-интерфейс. Архитектурно это означает необходимость разделить систему на понятные контуры: операции импорта, слой нормализации и сохранения данных, а также пользовательский и административный интерфейсы.

**Non-Functional Requirements:**
Архитектуру в первую очередь будут формировать требования к надёжности повторных запусков, устойчивости к ошибкам внешнего API, предсказуемой обработке неполных данных и понятной диагностике результата. Производительность важна на уровне комфортной работы со списками и запуска операций, но не требует real-time или high-scale решений. Требования по SEO, сложной безопасности и enterprise-scalability на MVP отсутствуют.

**Scale & Complexity:**
Проект относится к средней сложности. Он сочетает внешний источник данных, повторяемые import-операции, доменные правила обработки результатов и два типа интерфейса: административный и пользовательский. Основная техническая сложность сосредоточена не в UI, а в корректной и устойчивой интеграции с DiscGolfMetrix.

- Primary domain: web application with data ingestion workflow
- Complexity level: medium
- Estimated architectural components: 5-7

### Technical Constraints & Dependencies

Ключевой внешней зависимостью является DiscGolfMetrix как единственный источник истины. Архитектура должна учитывать, что данные могут приходить неполными, частично ошибочными или разбираться не полностью, при этом корректные записи должны сохраняться. Проект также ограничен solo-ресурсной моделью разработки, поэтому архитектурные решения должны минимизировать количество подвижных частей и когнитивную нагрузку.

### Cross-Cutting Concerns Identified

- Идемпотентность повторных обновлений
- Защита от дублей при повторной загрузке
- Обработка частичных ошибок без срыва всей операции
- Диагностируемость и понятная статистика обновления
- Согласованность идентификаторов и связей между сущностями
- Простота сопровождения и реализации минимальной командой

## Starter Template Evaluation

### Primary Technology Domain

Full-stack web application with a separate data-ingestion worker, based on SPA delivery and hosted backend services.

### Starter Options Considered

Рассматривались два основных направления: `Vite + React + TypeScript` как чистый SPA-стартер и `Next.js + TypeScript` как full-stack web starter. С учётом требований проекта, `Next.js` не даёт критической архитектурной выгоды для MVP, потому что продукт не требует SEO, SSR или real-time возможностей на старте. `Vite + React + TypeScript` лучше соответствует зафиксированной SPA-модели и снижает архитектурную избыточность.

### Selected Starter: Vite + React + TypeScript

**Rationale for Selection:**
Выбранный starter лучше всего соответствует документированным требованиям проекта: SPA-интерфейс, быстрый solo-friendly старт, минимальная сложность, отсутствие SEO-зависимости и независимый TypeScript worker для операций импорта. Такое основание позволяет разделить UI и import-processing без лишней framework-связности.

**Initialization Command:**

```bash
npm create vite@latest metrix-parser-web -- --template react-ts
```

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**
TypeScript-first frontend foundation on React.

**Styling Solution:**
Starter не навязывает тяжёлую UI-архитектуру и позволяет отдельно принять решение о styling-подходе на следующем шаге.

**Build Tooling:**
Vite development server and production build pipeline for modern SPA delivery.

**Testing Framework:**
Базовый starter не закрывает testing strategy полностью, значит тестовую инфраструктуру нужно будет определить отдельным архитектурным решением.

**Code Organization:**
Лёгкая фронтенд-структура для SPA без навязанной full-stack server abstraction.

**Development Experience:**
Быстрый локальный запуск, TypeScript support, low-friction dev workflow, хороший fit для AI-assisted solo development.

**Additional Architectural Note:**
Import-worker не должен жить внутри starter-приложения как ad-hoc script. Его лучше оформить как отдельный TypeScript package/service внутри одного repo, чтобы UI и ingestion-логика были разведены архитектурно.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Единая база данных: `Supabase Postgres`
- Отдельный backend API как граница между UI и серверной логикой
- Отдельный TypeScript worker для import-операций
- Раздельный deployment-контур: `frontend + Supabase + worker`
- Отсутствие auth на MVP

**Important Decisions (Shape Architecture):**
- UI не должен выполнять import-операции напрямую
- UI может читать данные только через backend API
- Worker должен быть изолирован от frontend runtime и работать как отдельный процесс/приложение
- Архитектура должна поддерживать безопасный повторный запуск import-задач

**Deferred Decisions (Post-MVP):**
- Включение аутентификации и защиты админки
- Автоматизация расписания запуска worker
- Более сложные security controls
- Расширенная аналитика и рейтинг игроков

### Data Architecture

- Основной и единственный persistent store: `Supabase Postgres`
- Supabase используется как единая база данных для `competitions`, `courses`, `players`, `competition_results`
- Архитектура не предполагает отдельной operational database, cache database или event store на MVP
- Источник истины для импортируемых данных: `DiscGolfMetrix`, источник хранения и чтения внутри продукта: `Supabase Postgres`

**Rationale:**
Единая Postgres-база минимизирует сложность, соответствует solo-friendly модели разработки и упрощает поддержку целостности данных между связанными сущностями.

### Authentication & Security

- На MVP authentication layer отсутствует
- Административный доступ не защищается отдельным auth-механизмом в первой версии
- Архитектура при этом должна оставлять возможность добавить auth позже без перелома основных границ системы

**Rationale:**
PRD прямо фиксирует отсутствие auth в MVP и перенос защиты админки в post-MVP. Это уменьшает объём первой версии и не смешивает core data-ingestion value с access-control задачами.

### API & Communication Patterns

- Архитектурная граница между frontend и backend проходит через собственный backend API
- Frontend не должен напрямую инициировать import-логику в worker
- Backend API отвечает за:
  - приём команд на запуск обновления
  - чтение данных для UI
  - возврат статистики и диагностической информации
- Worker работает за backend boundary и исполняет import-операции как отдельный процесс

**Rationale:**
Этот подход даёт более чистую изоляцию ответственности, чем прямое чтение из Supabase и отдельный ad-hoc trigger. Он также упрощает будущую эволюцию к auth, расписаниям и централизованной диагностике.

### Frontend Architecture

- Frontend остаётся SPA на `Vite + React + TypeScript`
- Frontend отвечает за:
  - административный UI запуска обновлений
  - отображение статистики обновления
  - страницы просмотра данных
- Frontend не содержит import-логики и не несёт ответственность за orchestration ingestion-процессов

**Rationale:**
Такой срез сохраняет UI простым и предсказуемым, а бизнес-логику импорта удерживает вне браузерного слоя.

### Infrastructure & Deployment

- Deployment shape: `frontend отдельно + Supabase отдельно + worker отдельно`
- Frontend деплоится как отдельное SPA-приложение
- Supabase предоставляет managed Postgres и platform services
- Worker деплоится как отдельный TypeScript service/process, независимый от frontend deployment

**Rationale:**
Разделение контуров снижает связность между UI и ingestion runtime, упрощает повторные запуски и делает архитектуру более устойчивой к будущему росту, не усложняя MVP.

### Decision Impact Analysis

**Implementation Sequence:**
1. Поднять frontend SPA foundation
2. Определить backend API boundary
3. Смоделировать схему данных в Supabase Postgres
4. Реализовать worker как отдельный import runtime
5. Связать backend API с worker trigger и чтением данных
6. Добавить UI для запуска обновлений и просмотра статистики
7. Добавить пользовательские страницы просмотра данных

**Cross-Component Dependencies:**
- Frontend зависит от backend API contract
- Backend API зависит от схемы Supabase и trigger-механизма worker
- Worker зависит от схемы данных, правил идемпотентности и обработки ошибок
- Все три слоя зависят от единой трактовки идентификаторов и import-result semantics

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:**
Критичными зонами расхождения между AI-агентами для этого проекта являются naming conventions, структура API-ответов, организация UI и backend-кода, а также единые правила обработки ошибок и loading-state.

### Naming Patterns

**Database Naming Conventions:**
- Все таблицы и колонки используют `snake_case`
- Внешние ключи именуются в формате `<entity>_id`
- Таблицы результатов и связей также используют `snake_case`

**API Naming Conventions:**
- Все JSON-поля API используют `camelCase`
- Query and payload fields также используют `camelCase`
- Backend API не должен отдавать database-shaped `snake_case` наружу без явного маппинга

**Code Naming Conventions:**
- React components: `PascalCase`
- Component files: `PascalCase.tsx`
- TypeScript functions, hooks, variables: `camelCase`
- Не-компонентные служебные файлы могут использовать `kebab-case.ts` для предсказуемой файловой навигации

### Structure Patterns

**Project Organization:**
- Frontend организуется по принципу `feature-first`
- Backend API и worker организуются по принципу `layer-first`
- Import logic, API handlers, data access, mapping and validation не смешиваются в одном слое

**File Structure Patterns:**
- UI-код группируется по feature-модулям
- Worker-код группируется по слоям: client/integration, parsing, mapping, persistence, orchestration
- Общие типы и контракты выносятся в shared boundary только там, где это действительно уменьшает дублирование

### Format Patterns

**API Response Formats:**
- Success response: `{ data, meta }`
- Error response: `{ error: { code, message } }`
- API должен возвращать единообразные структуры для списков, одиночных сущностей и operation results

**Data Exchange Formats:**
- Внутри БД допускается `snake_case`
- На границе API и frontend используется `camelCase`
- Маппинг между DB-model и API DTO должен быть явным

### Process Patterns

**Error Handling Patterns:**
- Ошибки импорта агрегируются и не валят весь запуск целиком, если часть данных может быть обработана корректно
- Проблемные записи маркируются как пропущенные и отражаются в итоговой статистике
- Технические ошибки логируются отдельно от user-facing error messages

**Loading State Patterns:**
- Loading state локален конкретной операции или экрану
- Запуск обновления всегда имеет явный pending/success/failure lifecycle
- Пользователь всегда видит финальный статус выполнения и итоговую статистику

### Enforcement Guidelines

**All AI Agents MUST:**
- использовать `snake_case` в БД и `camelCase` на API/frontend boundary
- не смешивать UI, orchestration и persistence в одном модуле
- придерживаться единого response-format для всех backend endpoints
- реализовывать импорт как partially tolerant process, а не all-or-nothing pipeline
- сохранять локальность loading/error state в UI

**Pattern Enforcement:**
- Любое новое API должно следовать contract `{ data, meta } / { error: { code, message } }`
- Любые отклонения от naming and structure rules должны считаться архитектурным отклонением и документироваться явно

## Project Structure & Boundaries

### Complete Project Directory Structure

```text
metrix-parser/
├── README.md
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .gitignore
├── .env.example
├── apps/
│   ├── web/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── app/
│   │       │   ├── App.tsx
│   │       │   ├── router.tsx
│   │       │   └── providers/
│   │       ├── features/
│   │       │   ├── admin-updates/
│   │       │   ├── competitions/
│   │       │   ├── courses/
│   │       │   ├── players/
│   │       │   └── results/
│   │       ├── shared/
│   │       │   ├── api/
│   │       │   ├── components/
│   │       │   ├── hooks/
│   │       │   └── utils/
│   │       └── styles/
│   ├── api/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── main.ts
│   │       ├── config/
│   │       ├── modules/
│   │       │   ├── health/
│   │       │   ├── competitions/
│   │       │   ├── courses/
│   │       │   ├── players/
│   │       │   ├── results/
│   │       │   └── updates/
│   │       ├── middleware/
│   │       ├── dto/
│   │       ├── services/
│   │       └── lib/
│   └── worker/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── main.ts
│           ├── config/
│           ├── integration/
│           │   └── discgolfmetrix/
│           ├── orchestration/
│           ├── parsing/
│           ├── mapping/
│           ├── persistence/
│           ├── jobs/
│           └── lib/
├── packages/
│   ├── shared-types/
│   │   ├── package.json
│   │   └── src/
│   │       ├── api/
│   │       ├── domain/
│   │       └── updates/
│   └── shared-utils/
│       ├── package.json
│       └── src/
│           ├── dates/
│           ├── errors/
│           └── formatting/
├── supabase/
│   ├── migrations/
│   ├── seeds/
│   └── config.toml
├── tests/
│   ├── integration/
│   ├── e2e/
│   └── fixtures/
└── docs/
```

### Architectural Boundaries

**API Boundaries:**
- `apps/web` не обращается к БД напрямую
- `apps/web` работает только через `apps/api`
- `apps/api` является единственной backend boundary для UI
- `apps/api` инициирует операции обновления через boundary к `apps/worker`
- `apps/worker` не обслуживает UI-запросы напрямую

**Component Boundaries:**
- `apps/web` организован по feature-модулям
- каждый feature-модуль содержит UI, hooks и feature-specific API access
- shared UI primitives и общие client utilities живут в `apps/web/src/shared`

**Service Boundaries:**
- `apps/api` отвечает за HTTP contract, DTO, orchestration запросов и чтение данных
- `apps/worker` отвечает за интеграцию с DiscGolfMetrix, parsing, mapping, persistence и update execution
- `packages/shared-types` содержит только контракты, которые действительно нужны более чем одному приложению

**Data Boundaries:**
- единственная БД: `Supabase Postgres`
- schema management lives in `supabase/`
- DB naming stays `snake_case`
- API and frontend boundary stays `camelCase`
- mapping DB ↔ DTO выполняется явно, не неявно

### Requirements to Structure Mapping

**FR Category Mapping:**
- `Data Update Management` → `apps/api/src/modules/updates`, `apps/worker/src/jobs`, `apps/worker/src/orchestration`
- `Competition Data Management` → `apps/api/src/modules/competitions`, `apps/worker/src/persistence`, `apps/worker/src/mapping`
- `Course Data Management` → `apps/api/src/modules/courses`, `apps/worker/src/persistence`, `apps/worker/src/mapping`
- `Player and Result Data Management` → `apps/api/src/modules/players`, `apps/api/src/modules/results`, `apps/worker/src/parsing`, `apps/worker/src/persistence`
- `Update Reporting and Diagnostics` → `apps/api/src/modules/updates`, `apps/web/src/features/admin-updates`
- `Administrative Interface` → `apps/web/src/features/admin-updates`
- `Data Viewing Experience` → `apps/web/src/features/competitions`, `courses`, `players`, `results`

**Cross-Cutting Concerns:**
- DTO contracts → `packages/shared-types/src/api`
- domain types → `packages/shared-types/src/domain`
- shared error models → `packages/shared-utils/src/errors`
- DB migrations and schema evolution → `supabase/migrations`

### Integration Points

**Internal Communication:**
- `web -> api`: HTTP JSON contract
- `api -> worker`: internal trigger boundary
- `api -> Supabase`: read/write access for application data
- `worker -> DiscGolfMetrix`: external ingestion integration
- `worker -> Supabase`: persistence of parsed/imported data

**External Integrations:**
- DiscGolfMetrix API only from worker side
- Supabase platform as managed database/backend dependency

**Data Flow:**
1. Пользователь запускает обновление из `web`
2. `api` принимает команду
3. `api` инициирует соответствующий update flow в `worker`
4. `worker` получает данные из DiscGolfMetrix
5. `worker` парсит, маппит и сохраняет данные в Supabase
6. `api` отдаёт в `web` итоговый operation result и статистику
7. `web` отображает статус и затем читает актуальные данные через `api`

### File Organization Patterns

**Configuration Files:**
- root содержит workspace-level config
- app-level config lives inside each app
- environment examples documented centrally

**Source Organization:**
- UI: `feature-first`
- API: `module + layer`
- worker: `layer-first` with explicit ingestion pipeline stages

**Test Organization:**
- app-local unit tests живут рядом с кодом или в app-local structure
- cross-app integration tests live in `tests/integration`
- UI and workflow e2e tests live in `tests/e2e`

**Asset Organization:**
- frontend assets stay inside `apps/web`
- data fixtures for tests stay in `tests/fixtures`

### Development Workflow Integration

**Development Server Structure:**
- `web`, `api`, `worker` могут запускаться независимо
- local development должен поддерживать параллельный запуск приложений

**Build Process Structure:**
- каждое приложение собирается отдельно
- shared packages versioned and consumed inside workspace

**Deployment Structure:**
- `web` deploy отдельно
- `api` deploy отдельно
- `worker` deploy отдельно
- `Supabase` управляется как внешний platform dependency

## Architecture Validation Results

### Coherence Validation

**Decision Compatibility:**
Архитектурные решения совместимы друг с другом. SPA frontend, отдельный backend API, отдельный worker и единая Supabase Postgres-база образуют согласованную full-stack схему без внутренних противоречий.

**Pattern Consistency:**
Принятые naming, API-format и process patterns поддерживают выбранные архитектурные границы. Разделение `snake_case` в БД и `camelCase` на API/frontend boundary согласовано с технологическим стеком и снижает вероятность конфликтов между AI-агентами.

**Structure Alignment:**
Предложенная структура монорепозитория поддерживает все основные архитектурные решения. Границы между `web`, `api`, `worker`, shared packages и Supabase выделены достаточно ясно для последовательной реализации.

### Requirements Coverage Validation

**Functional Requirements Coverage:**
Все основные категории функциональных требований имеют архитектурное покрытие: import-операции, хранение сущностей, диагностика обновлений, административный интерфейс и пользовательский просмотр данных.

**Non-Functional Requirements Coverage:**
Нефункциональные требования по надёжности, интеграционной устойчивости, базовой доступности и приемлемой производительности отражены в выбранной архитектуре. Требования по SEO, real-time и сложной security-модели сознательно не включены в MVP-архитектуру, что соответствует PRD.

### Implementation Readiness Validation

**Decision Completeness:**
Большинство критических архитектурных решений уже зафиксированы и пригодны для реализации. Стек, основные runtime boundaries, data ownership и implementation patterns определены.

**Structure Completeness:**
Проектная структура достаточно детализирована для дальнейшего перехода к implementation planning и epic/story breakdown.

**Pattern Completeness:**
Consistency rules достаточно конкретны, чтобы разные AI-агенты не расходились в naming, API contracts, layering и error-handling.

### Gap Analysis Results

**Important Gap:**
Не зафиксирован точный orchestration mechanism между `apps/api` и `apps/worker`. Архитектурная граница определена, но конкретный trigger pattern ещё не выбран.

**Impact:**
Это не разрушает общую архитектуру, но должно быть уточнено до начала реализации update flows.

### Architecture Readiness Assessment

**Overall Status:** READY WITH ONE IMPORTANT FOLLOW-UP DECISION

**Confidence Level:** high

**Key Strengths:**
- lean и согласованная MVP-архитектура
- чёткие runtime boundaries
- хорошая solo-friendly decomposition
- достаточно жёсткие consistency rules для AI-assisted implementation

**Areas for Future Enhancement:**
- auth boundary post-MVP
- scheduling/automation layer
- advanced analytics/ranking logic
- более формальный execution orchestration между API и worker

### Implementation Handoff

**AI Agent Guidelines:**
- следовать document-defined boundaries без смешивания UI/API/worker responsibilities
- использовать только зафиксированные naming and response conventions
- реализовывать import-процессы как idempotent and partially tolerant flows
- не обходить backend API boundary прямыми вызовами из frontend к persistence layer

**First Implementation Priority:**
Подтвердить точный orchestration mechanism между `apps/api` и `apps/worker`, затем переходить к schema design и implementation breakdown.
