# Context Snapshot: TODO competition unification

## Task statement
Сформировать консенсусный план реализации TODO.md по унификации competition-логики в соответствии с AGENTS.md.

## Desired outcome
Пошаговый, проверяемый план внедрения с приоритизацией, критериями приемки и стратегией верификации для API + UI read-side.

## Known facts/evidence
- TODO фиксирует инварианты по competition hierarchy и season_points lookup.
- AGENTS.md требует единый смысл производных метрик между list/detail/player/results.
- Источник истины competition entity: список соревнований + detail-логика.
- season_points_table lookup должен использовать players_count scoring-сущности.
- Есть uncommitted action items по GET /competitions и GET /results.

## Constraints
- Не ломать текущие доменные и DB-конвенции (app_public, nullable links).
- Без новых зависимостей.
- Изменения обратимые и небольшими шагами.
- Для write-endpoints обязательна авторизация (401/403).

## Unknowns / open questions
- Какие конкретно модули уже реализуют hierarchy policy и где дубли.
- Текущий охват тестами по list/detail/player/results и season_points.
- Влияет ли route alias `/competitions` на e2e/static page-view тесты.

## Likely codebase touchpoints
- apps/api: competitions/results handlers, season accrual/read-side projection
- apps/web: competitions list/detail, player page navigation and fields
- packages/shared (если есть): competition/result view models
- tests: API handler tests + page-view tests
