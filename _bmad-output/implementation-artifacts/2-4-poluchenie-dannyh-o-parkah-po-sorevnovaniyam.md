# Story 2.4: Получение данных о парках по соревнованиям

Status: review

## Story

As a сотрудник РДГА,
I want чтобы система определяла необходимые парки на основе уже известных соревнований,
so that я мог загружать данные о парках без отдельного ручного поиска идентификаторов.

## Acceptance Criteria

1. Система определяет идентификаторы парков на основе данных соревнований. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-24-Получение-данных-о-парках-по-соревнованиям]
2. Worker запрашивает данные по этим паркам из DiscGolfMetrix. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-24-Получение-данных-о-парках-по-соревнованиям]
3. Ошибки получения отдельных парков не останавливают обработку остальных. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-24-Получение-данных-о-парках-по-соревнованиям]

## Tasks / Subtasks

- [x] Добавить read-side extraction шага, который получает необходимые идентификаторы парков из уже сохранённых competition records, а не из ручного ввода пользователя. (AC: 1)
- [x] Реализовать worker integration path для загрузки park/course data по набору выявленных идентификаторов DiscGolfMetrix. (AC: 2)
- [x] Обеспечить per-course error isolation: ошибка загрузки одного парка увеличивает skipped/error summary, но не останавливает обработку остальных id. (AC: 3)
- [x] Подготовить raw park payload boundary для следующей story `2.5`, не смешивая в этой истории полный persistence/`course_par` calculation. (AC: 2, 3)
- [x] Добавить тесты/fixtures для сценариев: несколько course ids, отсутствующий/битый course response, частичный успех набора запросов. (AC: 1, 2, 3)

## Dev Notes

### Previous Story Learnings

- Story `2.3` должна обеспечить сохранение соревнований без дублей; эта история опирается именно на уже сохранённые records как source of truth для course discovery. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/2-3-sohranenie-i-obnovlenie-sorevnovaniy-bez-dubley.md#Story]
- Story `1.6` фиксирует partially tolerant execution, поэтому course-fetch fan-out должен уметь переживать ошибки отдельных id. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-6-idempotentnost-i-chastichno-ustoychivoe-vypolnenie-obnovleniy.md#Acceptance-Criteria]

### Technical Requirements

- PRD прямо говорит, что система использует данные соревнований как источник для определения парков, подлежащих обновлению. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md#Functional-Requirements]
- DiscGolfMetrix API должен вызываться только со стороны worker. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Integration-Points]
- Ошибки отдельных единиц работы не должны валить весь import process. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Process-Patterns]

### Current Repo Reality

- В проекте пока нет read-side API/list endpoint для competition records и нет worker-side helper, который извлекает course identifiers из сохранённых соревнований. [Source: repo inspection]
- `apps/worker/src/integration/discgolfmetrix/` к моменту реализации должен уже содержать competition-fetch path; course-fetch path логично держать рядом в том же integration слое. [Inference based on repo structure]

### Architecture Compliance

- Не тянуть park discovery logic в UI и не требовать ручного ввода course id в админке.
- Не реализовывать `course_par` calculation и persistence полного course record в этой истории; это scope story `2.5`.

### File Structure Notes

- Ожидаемые точки изменений:
- `apps/worker/src/integration/discgolfmetrix/`
- `apps/worker/src/orchestration/`
- `apps/worker/src/jobs/`
- `apps/worker/src/persistence/` или отдельный read helper для чтения competition source records
- Возможно `apps/api/src/modules/courses/`/`updates/`, если нужен trigger contract

### Testing Requirements

- Проверить извлечение course identifiers из сохранённых competitions.
- Проверить multi-id fetch flow.
- Проверить, что ошибка одного course id не прерывает обработку остальных.

### Risks / Watchouts

- Главный риск: начать зависеть от ручного ввода course identifiers, хотя продуктовая логика требует derive-from-competitions flow.
- Второй риск: смешать загрузку course raw data и её финальное сохранение/агрегацию в одну историю.

### References

- [epics.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md)
- [architecture.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md)
- [prd.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md)
- [1-6-idempotentnost-i-chastichno-ustoychivoe-vypolnenie-obnovleniy.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-6-idempotentnost-i-chastichno-ustoychivoe-vypolnenie-obnovleniy.md)
- [2-3-sohranenie-i-obnovlenie-sorevnovaniy-bez-dubley.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/2-3-sohranenie-i-obnovlenie-sorevnovaniy-bez-dubley.md)

## Change Log

- 2026-03-20: Created implementation-ready story file for Story 2.4 and advanced sprint status from `backlog` to `ready-for-dev`.
- 2026-03-21: Added read-side course id discovery from saved competitions, DiscGolfMetrix course fetch support, per-course error isolation, and worker tests for partial-success course ingestion.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Added `apps/worker/src/read-side/competition-course-ids.ts` and `apps/worker/src/read-side/competition-course-ids.test.ts` to derive unique course identifiers from saved `competitions.raw_payload`.
- Extended `apps/worker/src/integration/discgolfmetrix/client.ts`, `parser.ts`, `types.ts`, and `client.test.ts` with a dedicated `course` fetch path and raw payload parsing boundary.
- Added `apps/worker/src/jobs/courses-update-job.ts` and `apps/worker/src/jobs/courses-update-job.test.ts` to orchestrate discovery and per-course fetch isolation before persistence.
- Updated `apps/worker/src/jobs/competitions-update-job.ts` plus the competitions repository path so future course discovery can rely on persisted competition raw payloads.

### Completion Notes List

- Реализован read-side discovery park ids из уже сохранённых соревнований без ручного ввода.
- Добавлен отдельный DiscGolfMetrix integration path для загрузки course payload по каждому найденному id.
- Ошибки отдельных course request теперь изолированы: они увеличивают `skipped`/`errors`, но не прерывают обработку остальных парков.
- Raw course payload boundary сохранён отдельным шагом и передаётся дальше в persistence flow истории `2.5`.
- Добавлены тесты на dedupe course ids, nested/flat source references, частичный успех набора запросов и битые ответы.

### File List

- apps/worker/src/integration/discgolfmetrix/client.test.ts
- apps/worker/src/integration/discgolfmetrix/client.ts
- apps/worker/src/integration/discgolfmetrix/parser.ts
- apps/worker/src/integration/discgolfmetrix/types.ts
- apps/worker/src/jobs/competitions-update-job.test.ts
- apps/worker/src/jobs/competitions-update-job.ts
- apps/worker/src/jobs/courses-update-job.test.ts
- apps/worker/src/jobs/courses-update-job.ts
- apps/worker/src/orchestration/courses-update.ts
- apps/worker/src/read-side/competition-course-ids.test.ts
- apps/worker/src/read-side/competition-course-ids.ts
- apps/worker/package.json
