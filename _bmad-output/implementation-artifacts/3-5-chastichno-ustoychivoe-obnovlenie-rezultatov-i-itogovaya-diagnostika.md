# Story 3.5: Частично устойчивое обновление результатов и итоговая диагностика

Status: ready-for-dev

## Story

As a владелец проекта,
I want чтобы ошибки разбора отдельных результатов не ломали весь сценарий обновления,
so that система сохраняла всё корректное и показывала, что именно было пропущено.

## Acceptance Criteria

1. Корректные игроки и результаты всё равно сохраняются. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-35-Частично-устойчивое-обновление-результатов-и-итоговая-диагностика]
2. Проблемные записи помечаются как пропущенные. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-35-Частично-устойчивое-обновление-результатов-и-итоговая-диагностика]
3. Пользователь получает итоговую статистику по добавленным, обновлённым и пропущенным данным. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-35-Частично-устойчивое-обновление-результатов-и-итоговая-диагностика]
4. Повторный запуск сценария остаётся безопасным. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md#Story-35-Частично-устойчивое-обновление-результатов-и-итоговая-диагностика]

## Tasks / Subtasks

- [ ] Соединить player/result flows из `3.2`, `3.3`, `3.4` в единый resilient orchestration path, который продолжает обработку при локальных ошибках. (AC: 1, 2)
- [ ] Агрегировать skipped/problematic result units и причины пропуска в общий update summary/result contract. (AC: 2, 3)
- [ ] Обеспечить согласованное поведение повторного запуска: корректные повторные records не создают дублей, проблемные записи не блокируют повторную обработку остальных. (AC: 1, 4)
- [ ] Подготовить API-facing diagnostic payload для UI lifecycle/statistics story `1.5`, чтобы финальный результат был понятен пользователю. (AC: 3)
- [ ] Добавить end-to-end-ish worker-level tests/fixtures для смешанного набора валидных, DNF и битых результатов. (AC: 1, 2, 3, 4)

## Dev Notes

### Previous Story Learnings

- Story `1.6` уже задаёт базовый contract частично устойчивых обновлений; эта история должна применить его к полному result pipeline, а не придумывать отдельную модель поведения. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-6-idempotentnost-i-chastichno-ustoychivoe-vypolnenie-obnovleniy.md#Tasks--Subtasks]
- Story `3.4` закрывает корректное сохранение result records и обработку `DNF`, но итоговая resilient orchestration и user-facing diagnostics здесь становятся полноценным финальным слоем Epic 3. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/3-4-sohranenie-rezultatov-sorevnovaniy-s-obrabotkoy-dnf.md#Architecture-Compliance]
- Story `1.5` уже закрепила UI lifecycle/statistics ожидания, поэтому summary этого сценария должен быть совместим с тем же форматом. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-5-obshchiy-lifecycle-obnovleniya-i-itogovaya-statistika.md#Technical-Requirements]

### Technical Requirements

- PRD требует сохранять все корректные записи и не останавливать весь процесс из-за отдельных проблемных данных. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md#Risk-Mitigations]
- Архитектура требует partially tolerant import flows и user-visible final status/statistics. [Source: /Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md#Process-Patterns]

### Current Repo Reality

- Полного orchestration слоя для комплексного result update в репозитории пока нет. [Source: repo inspection]
- В API ещё нет готового diagnostic/read contract для запуска и возврата итога Epic 3 flows. [Source: repo inspection]
- Shared update summary всё ещё минимален и, вероятно, потребует расширения error/skipped metadata. [Source: repo inspection]

### Architecture Compliance

- Не переносить диагностику только в логи; ключевой итог должен быть доступен как structured operation result.
- Не превращать resilient flow в all-or-nothing transaction на уровне всей операции.
- Не нарушать idempotent semantics ради удобства диагностики.

### File Structure Notes

- Ожидаемые точки изменений:
- `apps/worker/src/orchestration/`
- `apps/worker/src/jobs/`
- `packages/shared-types/src/updates/`
- Возможно `apps/api/src/modules/updates/`
- Возможно `packages/shared-utils/src/errors/`

### Testing Requirements

- Проверить mixed success/failure scenario.
- Проверить aggregation `added/updated/skipped`.
- Проверить repeat-run safety после частичного сбоя.
- Проверить, что bad records не стирают already processed valid records.

### Risks / Watchouts

- Главный риск: оставить диагностическую информацию только в инфраструктурных логах и не довести её до user-facing summary.
- Второй риск: объединить ошибки player и result flows так, что станет невозможно понять, что именно было пропущено.

### References

- [epics.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/epics.md)
- [architecture.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/architecture.md)
- [prd.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/planning-artifacts/prd.md)
- [1-5-obshchiy-lifecycle-obnovleniya-i-itogovaya-statistika.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-5-obshchiy-lifecycle-obnovleniya-i-itogovaya-statistika.md)
- [1-6-idempotentnost-i-chastichno-ustoychivoe-vypolnenie-obnovleniy.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/1-6-idempotentnost-i-chastichno-ustoychivoe-vypolnenie-obnovleniy.md)
- [3-4-sohranenie-rezultatov-sorevnovaniy-s-obrabotkoy-dnf.md](/Users/andreynikolaev/Documents/optima-ide/metrixParser/_bmad-output/implementation-artifacts/3-4-sohranenie-rezultatov-sorevnovaniy-s-obrabotkoy-dnf.md)

## Change Log

- 2026-03-21: Created implementation-ready story file for Story 3.5 and advanced sprint status from `backlog` to `ready-for-dev`.
