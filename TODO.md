# TODO

Типичный системный симптом: не "одна медленная страница", а общая латентность по цепочке Web -> API -> Supabase.

## P0 — измерения и наблюдаемость (сначала)

- [x] Добавить тайминги на каждый API endpoint (`total`, `db`, `serialize`).
- [x] Добавить метрики по каждому SQL-вызову (длительность, количество строк, endpoint-контекст).
- [x] На фронте замерять `TTFB`, `LCP`, `API call duration` по маршрутам.
- [x] Построить топ-10 самых медленных endpoint/SQL по `p95` (не среднее).
- [x] Сделать baseline и повторный замер после оптимизаций.

## P1 — горячие точки API (по коду)

- [x] Оптимизировать `GET /players/results`:
  - [x] Свести текущую цепочку запросов к одному агрегированному SQL/RPC/view.
  - [x] Перенести ранжирование и агрегации в SQL (window functions), убрать heavy post-processing в Node.
  - [x] Снизить количество последовательных Supabase-вызовов.
- [x] Оптимизировать `GET /players`:
  - [x] Убрать full-scan `competition_results` для подсчета `competitions_count`.
  - [x] Рассмотреть предвычисленный read-side счетчик соревнований на игрока.
- [x] Оптимизировать `GET /competitions`:
  - [x] Убрать проходы по большим таблицам (`competition_results`, `season_standings`) на каждый запрос списка.
  - [x] Перенести `has_results` и `season_points` в read-model/материализованную проекцию.
- [x] Оптимизировать `GET /results`:
  - [x] Добавить обязательную пагинацию (`limit/offset`) и фильтры.
  - [x] Убрать режим "загрузи все результаты" для default-case.

## P1 — фронтенд (лишние широкие загрузки)

- [x] Страница игрока: убрать `listPlayers()` для поиска одного игрока.
  - [x] Добавить/использовать endpoint `GET /players/:id`.
- [x] Детальная страница результатов соревнования:
  - [x] Убрать загрузку полных списков `competitions/courses/categories` для одного `competitionId`.
  - [x] Добавить endpoint `GET /competitions/:id/context` (competition + course/category labels + hierarchy).
- [x] Убрать waterfall-паттерны и лишние повторные запросы при навигации между связанными страницами.
  - [x] Добавлен короткий TTL-кэш на клиенте для `getPlayer`, `getCompetitionContext` и `listResults({ competitionId })`.

## P2 — SQL и индексы (после EXPLAIN ANALYZE)

- [x] Для самых медленных запросов зафиксировать `EXPLAIN ANALYZE`.
- [x] Добавить композитные индексы под реальные `WHERE/JOIN/ORDER BY` (не "вслепую"), в первую очередь для:
  - [x] выборок по `player_id + competition_id`;
  - [x] ранжирования по `competition_id, dnf, sum, player_id`;
  - [x] фильтров по `season_code + competition_id` и `season_code + player_id`.
- [x] Проверить тяжелые сортировки/`count(*)` без покрытия индексами.
- [x] Проверить, что в select запрашиваются только нужные колонки.

## P2 — кэш и read-side проекции

- [x] Добавить API-level кеш (TTL 15-60 сек) для частых read endpoint.
  - [x] Покрыть минимум: `GET /players`, `GET /players/:id`, `GET /players/results`, `GET /competitions`, `GET /competitions/:id/context`, `GET /results`.
  - [x] Зафиксировать ключи кэша по фильтрам/пагинации, чтобы избежать коллизий (канонизация query-параметров).
- [x] Проверить использование Memcached для API-level кэша (оценить hit rate, инвалидацию и эксплуатационные риски).
  - [x] Снять метрики `hit/miss`, `eviction`, среднюю/`p95` задержку чтения из кэша (добавлено в `GET /health/performance`).
  - [x] Принять решение: in-memory only или Memcached (с обоснованием по нагрузке и рискам эксплуатации) — текущий выбор: in-memory; Memcached подключать при multi-instance API и подтвержденном низком hit-rate локального кэша.
- [x] Ввести инвалидацию/обновление кэша после фоновых пересчетов.
  - [x] После завершения фонового пересчета сбрасывать/обновлять ключи проекций для затронутого сезона/соревнований.
  - [x] Добавить регрессионный тест: после пересчета API отдает свежие `season_points` и агрегаты.
- [x] Предвычислять тяжелые метрики и хранить в read-model таблицах (реализовано через SQL-функции/триггеры).
- [x] API должен читать готовые проекции, а не пересчитывать "на лету".

## P3 — payload и транспорт

- [x] Урезать JSON-ответы (без лишних полей).
  - [x] Убрано неиспользуемое поле `competition_date` из `GET /results` select/join payload.
- [x] Включить gzip/brotli для API-ответов.
  - [x] Добавлена компрессия по `Accept-Encoding` (`br`/`gzip`) в роутере для JSON-ответов с `Vary: Accept-Encoding`.
- [x] Ввести лимиты и пагинацию по умолчанию даже для "маленьких" списков.
  - [x] Единый parser `limit/offset` (default `200/0`, max `1000`) и `meta.limit/meta.offset` для list endpoint'ов.
- [x] Проверить keep-alive/pooling для HTTP и Supabase-клиента.
  - [x] Включен singleton Supabase client + `undici` `Agent` (keep-alive/pooling) для outbound запросов.
  - [x] Настроены `server.keepAliveTimeout`/`server.headersTimeout` для API HTTP server.
- [x] Проверить отсутствие блокирующих синхронных операций в hot path Node.
  - [x] Проверено поиском по `apps/api/src`: sync I/O/process/compression вызовы в hot path отсутствуют.

## Практический план на 2-3 дня

- [x] День 1: включить endpoint + DB тайминги, снять baseline `p95`.
- [x] День 1-2: исправить 2-3 самых медленных запроса (начать с `/players/results` и `/players`).
- [x] День 2: добавить read-side кеш и агрегированный endpoint для страницы игрока.
- [x] День 3: повторный замер `p95`, сравнение до/после, фиксация эффекта.

## Осталось после последних изменений

- [ ] Финально сузить payload в самых тяжелых ответах (`/players`, `/competitions`) после следующего замера `p95` и анализа фактических полей в UI.

## Новый фокус: ускорить страницу просмотра конкретного соревнования (`/results/:competitionId`)

Наблюдение по профилю сети: много однотипных `GET /results?competitionId=...` + preflight на каждый запрос, и один/несколько "длинных" `results`-вызовов формируют основную задержку страницы.

### P0 — зафиксировать baseline именно для detail-страницы

- [ ] Снять baseline метрики для 3-5 "тяжелых" соревнований:
  - [ ] `requests_count` и `preflight_count` на один page load;
  - [ ] `p50/p95` для `GET /competitions/:id/context`;
  - [ ] `p50/p95` для `GET /results?competitionId=...`;
  - [ ] client-side `time-to-ready` (до первого полного рендера таблицы).
- [ ] Добавить в API-тайминги отдельный тег/метрику для detail-страницы (`results_detail`) для сравнения до/после.

### P1 — убрать fan-out запросов с клиента

- [ ] Добавить агрегированный endpoint для detail-страницы (предпочтительно один запрос):
  - [ ] вариант A: `GET /competitions/:id/results-view` (контекст + все нужные результаты + готовая проекция);
  - [ ] вариант B: расширить `GET /competitions/:id/context`, чтобы вернуть `resultsByCompetitionId`.
- [ ] Перевести `CompetitionResultsPage` на новый endpoint и удалить `Promise.all(listResults(...))`.
- [ ] Сохранить текущую доменную логику агрегации (`Event/Pool/Round`) и покрыть регрессионными тестами для тех же record type.

### P1 — снизить preflight/CORS накладные расходы

- [ ] Не отправлять `Content-Type: application/json` для `GET`/`HEAD` запросов без body в `apps/web/src/shared/api/http.ts`.
- [ ] Проверить, что в dev используется same-origin proxy (или иная схема без лишних preflight для чтения).
- [ ] Повторно замерить количество `OPTIONS` после правки (цель: кратно меньше на одну загрузку detail-страницы).

### P1 — оптимизировать серверную часть выдачи результатов

- [ ] Для detail-сценария убрать повторный расчет season points на каждый дочерний `competitionId` (рассчитывать 1 раз на owner competition).
- [ ] Рассмотреть перенос season points в read-model для результата detail-страницы, чтобы не читать `season_standings` "на лету" в каждом запросе.
- [ ] Снять `EXPLAIN ANALYZE` для фактического detail-запроса и добавить/уточнить индексы только под реальный `WHERE/JOIN`.

### P2 — уменьшить объем клиентской работы

- [ ] При серверной агрегации отдавать уже отсортированные/ранжированные строки (или минимум данных для ранжирования), чтобы не пересчитывать тяжелую агрегацию на клиенте.
- [ ] Проверить, нужен ли полный `hierarchy` в UI; если нет, отдавать урезанный контекст только для detail-view.

### Критерий готовности

- [ ] Уменьшить число сетевых запросов detail-страницы минимум в 2-4 раза.
- [ ] Снизить `time-to-ready` detail-страницы минимум на 30% относительно baseline.
- [ ] Подтвердить отсутствие регрессий в отображении `season_points`, мест и агрегации round/pool/event тестами.
