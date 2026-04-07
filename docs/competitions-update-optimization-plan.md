# План оптимизации обновления соревнований

## Вопрос и scope

Нужно понять, как устроен текущий pipeline обновления соревнований в parser/worker и какие изменения дадут наибольший выигрыш по времени выполнения.

Scope анализа:

- `apps/api/src/modules/updates/execution.ts`
- `apps/worker/src/orchestration/competitions-update.ts`
- `apps/worker/src/jobs/competitions-update-job.ts`
- `apps/worker/src/orchestration/update-execution.ts`
- `apps/worker/src/mapping/competitions.ts`
- `apps/worker/src/parsing/competition-record.ts`
- `apps/worker/src/persistence/competitions-repository.ts`
- `apps/worker/src/persistence/supabase-competitions-adapter.ts`
- `supabase/migrations/0002_competitions_and_courses.sql`

## Как сейчас работает update

1. API вызывает `executeCompetitionsUpdate(...)`.
2. Worker загружает список соревнований из DiscGolfMetrix одним HTTP-запросом.
3. Маппинг фильтрует неподходящие записи, валидирует поля и строит доменные `Competition`.
4. Для каждой mapped-записи job строит payload и ищет соответствующий raw record через `Array.find(...)`.
5. `executeUpdatePlan(...)` обрабатывает элементы строго последовательно.
6. `saveCompetition(...)` для каждой записи делает до двух чтений из Supabase:
   - `findByCompetitionId(...)`
   - `findByMetrixId(...)`
7. Затем выполняется либо `insert`, либо `update`.

## Главные узкие места

### 1. Последовательная обработка всех записей

`executeUpdatePlan(...)` использует обычный `for ... of` и `await` на каждом элементе. Это значит, что даже независимые операции записи идут строго по одной.

Последствие:

- latency Supabase складывается линейно;
- на больших периодах update масштабируется плохо;
- даже при хорошем индексе БД процесс остаётся медленным из-за round-trip overhead.

Ссылки:

- [update-execution.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/worker/src/orchestration/update-execution.ts#L42)

### 2. До трёх запросов в БД на одну запись

Сейчас для одной competition возможна цепочка:

- `findByCompetitionId`
- `findByMetrixId`
- `insert` или `update`

То есть 2-3 сетевых запроса на каждую запись, хотя в таблице уже есть уникальные ограничения по `competition_id` и `metrix_id`.

Последствие:

- основное время тратится не на вычисления, а на network/database round trips;
- на 300 соревнований получается до ~900 запросов вместо 1-3 batch операций.

Ссылки:

- [competitions-repository.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/worker/src/persistence/competitions-repository.ts#L123)
- [supabase-competitions-adapter.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/worker/src/persistence/supabase-competitions-adapter.ts#L17)
- [0002_competitions_and_courses.sql](/Users/andreynikolaev/Documents/optima-ide/metrixParser/supabase/migrations/0002_competitions_and_courses.sql#L14)

### 3. Лишний `find()` по исходному payload для каждой mapped competition

В `runCompetitionsUpdateJob(...)` после маппинга для каждой competition ищется raw record через `fetchedPayload.records.find(...)`.

Это даёт лишнюю сложность `O(n * m)`, где `n` близко к числу исходных records, а `m` к числу валидных competitions.

Последствие:

- на больших выборках появляется лишний CPU overhead;
- это не главный bottleneck по сравнению с БД, но это дешёвая оптимизация.

Ссылки:

- [competitions-update-job.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/worker/src/jobs/competitions-update-job.ts#L50)

### 4. Повторное чтение одних и тех же полей из raw record

Маппер и job много раз вызывают `readOptionalStringField(...)` и родственные helper-ы для одних и тех же ключей. Для каждой записи поля читаются повторно при:

- фильтрации по стране;
- фильтрации по названию;
- валидации identity;
- извлечении дат, course id, metrix id;
- повторном поиске raw payload.

Последствие:

- CPU расходуется впустую;
- код становится сложнее расширять и профилировать.

Ссылки:

- [mapping/competitions.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/worker/src/mapping/competitions.ts#L149)
- [competition-record.ts](/Users/andreynikolaev/Documents/optima-ide/metrixParser/apps/worker/src/parsing/competition-record.ts#L1)

### 5. Нет измеримости по этапам pipeline

Сейчас результат update не показывает:

- сколько занял fetch;
- сколько занял mapping;
- сколько занял matching/persistence;
- сколько запросов ушло в БД;
- сколько записей было create/update/skip из-за unchanged.

Последствие:

- оптимизации трудно подтверждать цифрами;
- нельзя быстро понять, что именно тормозит на production данных.

## Что оптимизировать в первую очередь

### Приоритет A. Убрать per-record lookup и перейти к batch matching

Лучшее первое изменение:

1. После fetch+mapping собрать:
   - список `competitionId[]`
   - список `metrixId[]`
2. Одним-двумя запросами загрузить все существующие записи из `competitions`.
3. Построить in-memory индексы:
   - `existingByCompetitionId`
   - `existingByMetrixId`
4. Для каждой новой записи делать matching уже в памяти.
5. Разделить payload на:
   - `toInsert[]`
   - `toUpdate[]`
   - `toSkip[]`

Ожидаемый эффект:

- резкое снижение количества запросов к БД;
- выигрыш обычно на порядок на средних и больших периодах;
- минимальный риск для бизнес-логики, потому что matching остаётся тем же, только переносится в memory.

Нужные изменения:

- расширить adapter/repository методами batch read;
- оставить текущую логику conflict detection, но выполнять её над заранее загруженными картами.

### Приоритет B. Добавить batch insert/update вместо поштучной записи

После batch matching следующий шаг:

- вставлять новые записи массивом;
- обновлять изменённые записи батчами или через SQL/RPC;
- не вызывать `.select(...).single()` после каждой записи, если возвращаемое тело не используется.

Особенно важно:

- сейчас `insert` и `update` всегда возвращают полную строку, хотя job это почти не использует;
- это создаёт дополнительную нагрузку на PostgREST и сеть.

Ожидаемый эффект:

- ещё меньше round trips;
- меньше объём ответа от Supabase;
- более стабильное время выполнения.

### Приоритет C. Обновлять только реально изменившиеся записи

Если запись уже существует и `overwriteExisting=true`, имеет смысл сначала сравнивать нормализованный persisted payload с новым значением и пропускать unchanged rows.

Практика:

- сравнивать поля, которые реально поддерживает parser;
- не трогать `category_id`, как и сейчас;
- не писать `update`, если не изменились `competition_name`, `competition_date`, `parent_id`, `course_id`, `course_name`, `record_type`, `players_count`, `metrix_id`, `raw_payload`, `source_fetched_at`.

Ожидаемый эффект:

- меньше write-нагрузки;
- меньше обновлений `updated_at`;
- заметный выигрыш на повторных re-run одинакового периода.

## Быстрые улучшения с низким риском

### 1. Убрать `find()` по `fetchedPayload.records`

Во время маппинга можно сразу возвращать связку:

- `competition`
- `rawRecord`
- заранее вычисленный `recordKey`

Тогда job не будет повторно сканировать весь массив records.

### 2. Кешировать извлечённые поля raw record

Вместо постоянных вызовов `readOptionalStringField(...)` создать intermediate normalized shape, например:

- `normalizedCompetitionId`
- `normalizedMetrixId`
- `normalizedCompetitionName`
- `normalizedCompetitionDate`
- `normalizedCourseId`
- `normalizedCountryCode`

Это упростит и ускорит `mapping/competitions.ts`.

### 3. Добавить ограниченную параллельность как промежуточный шаг

Если batch persistence пока делать рано, можно временно ускорить pipeline через concurrency limit, например 5-10 одновременных записей.

Важно:

- не делать `Promise.all` без лимита;
- учитывать rate limit Supabase/PostgREST;
- это временная мера, а не финальная архитектура.

## Более глубокие улучшения

### 1. Перенести matching + upsert в SQL/RPC

Можно сделать Postgres function, которая получает массив competitions и:

- матчится по `competition_id`/`metrix_id`;
- сохраняет category-safe merge rules;
- возвращает summary по create/update/skip/conflict.

Плюсы:

- минимальное число round trips;
- matching ближе к данным;
- лучший throughput.

Минусы:

- сложнее тестировать и поддерживать;
- merge-логика уйдёт из TypeScript в SQL.

Итог:

- имеет смысл только после batch read/write варианта на TypeScript, если скорости всё ещё не хватает.

### 2. Инкрементальные обновления по watermark

Если DiscGolfMetrix позволяет надёжно забирать только изменения после последнего sync, можно хранить:

- `last_successful_competitions_sync_at`
- или rolling window по датам/источнику.

Но это уже продуктово-архитектурное изменение. Для текущей системы проще сначала ускорить существующий full-period sync.

## Рекомендуемый порядок внедрения

### Этап 1. Измеримость

Добавить тайминги и счётчики:

- `fetchMs`
- `mappingMs`
- `matchingMs`
- `persistenceMs`
- `fetchedCount`
- `mappedCount`
- `filteredOutCount`
- `unchangedCount`
- `dbReadQueries`
- `dbWriteQueries`

Без этого потом сложно доказать выигрыш.

### Этап 2. Дешёвые CPU-оптимизации

- убрать `records.find(...)`;
- прокинуть `rawRecord` из маппинга;
- сократить повторные field reads.

### Этап 3. Главная оптимизация БД

- batch preload existing competitions;
- in-memory matching;
- skip unchanged rows.

### Этап 4. Batch persistence

- grouped insert;
- grouped update;
- по возможности без возврата полной строки на каждый write.

### Этап 5. При необходимости RPC/SQL bulk ingest

- делать только если после этапов 1-4 update всё ещё слишком долгий.

## Предлагаемый целевой дизайн

Целевой pipeline:

1. `fetchCompetitions(period)`
2. `normalizeAndMap(records)` -> `{ validItems, issues, stats }`
3. `preloadExisting(validItems)` -> `{ byCompetitionId, byMetrixId }`
4. `buildPersistencePlan(validItems, existingMaps, overwriteExisting)` ->
   `{ inserts, updates, skips, issues, summaryDraft }`
5. `persistInBatches(inserts, updates)`
6. `mergeSummaryAndReturnResult(...)`

Плюсы такого дизайна:

- этапы легко профилировать;
- тесты становятся более адресными;
- можно отдельно оптимизировать CPU и DB части.

## Практический вывод

Самое выгодное изменение сейчас:

- заменить per-record matching в Supabase на batch preload + in-memory matching.

Самое быстрое изменение сейчас:

- убрать повторный `find()` по `fetchedPayload.records` и сократить повторное чтение полей.

Самое безопасное пошаговое внедрение:

1. telemetry
2. убрать `find()`
3. batch read existing competitions
4. skip unchanged
5. batch writes

## Открытые вопросы перед реализацией

- Нужно ли в summary отдельно показывать `unchanged`, а не прятать его в `skipped`?
- Допустимо ли использовать Supabase `upsert`, если у нас двойная identity-модель (`competition_id` и `metrix_id`) и special merge rule для `category_id`?
- Нужно ли сохранять `raw_payload` для каждой записи полностью, если это заметно утяжеляет update?

