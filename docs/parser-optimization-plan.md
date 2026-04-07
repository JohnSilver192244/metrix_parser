# План оптимизации парсера

## Что изучено

- Worker-пайплайны импорта в `apps/worker/src/jobs/*`
- HTTP-клиент DiscGolfMetrix в `apps/worker/src/integration/discgolfmetrix/*`
- orchestration и persistence-слой в `apps/worker/src/orchestration/*` и `apps/worker/src/persistence/*`
- read-side подготовка данных из Supabase в `apps/worker/src/read-side/*`

## Главные узкие места

### 1. Последовательная обработка записей в общем executor

`executeUpdatePlan` обрабатывает все `items` строго по одному через `for ... of` + `await`.

См.: `apps/worker/src/orchestration/update-execution.ts`

Эффект:
- замедляет `competitions`
- замедляет `courses`
- не даёт переиспользовать контролируемый параллелизм в persistence

### 2. Курсы загружаются из DiscGolfMetrix строго последовательно

В `fetchCoursePayloads` каждый `courseId` запрашивается по одному.

См.: `apps/worker/src/jobs/courses-update-job.ts`

Эффект:
- линейный рост времени обновления парков
- при десятках и сотнях курсов пайплайн почти полностью упирается в latency сети

### 3. `competitions` и `courses` сохраняются в Supabase по одной записи

Для `players` и `competition_results` уже есть batch `upsert`, а для `competitions` и `courses` его нет.

См.:
- `apps/worker/src/persistence/competitions-repository.ts`
- `apps/worker/src/persistence/courses-repository.ts`

Эффект:
- много round-trip в БД
- лишние `find -> insert/update` на каждую запись
- плохая масштабируемость на больших периодах

### 4. В `competitions` есть лишний поиск raw payload через `Array.find` для каждой записи

При формировании `items` код каждый раз ищет соответствующий source record через `fetchedPayload.records.find(...)`.

См.: `apps/worker/src/jobs/competitions-update-job.ts`

Эффект:
- O(n^2) на этапе подготовки данных
- не самая большая проблема на малых объёмах, но это простой и дешёвый фикс

### 5. Перед batch upsert есть полные предварительные чтения существующих строк

`players` и `competition_results` сначала читают все существующие строки, затем решают, что upsert'ить.

См.:
- `apps/worker/src/persistence/players-repository.ts`
- `apps/worker/src/persistence/competition-results-repository.ts`

Эффект:
- дополнительная нагрузка на Supabase
- лишняя передача `raw_payload`
- при больших окнах обновления размер ответа может стать существенным

### 6. Read-side для парков читает все соревнования целиком

Для поиска `course_id` читается весь список соревнований и ещё `raw_payload`.

См.: `apps/worker/src/read-side/competition-course-ids.ts`

Эффект:
- дорого по сети и памяти
- особенно заметно, если исторических соревнований станет много

## План оптимизации

## Фаза 1. Быстрые победы

### 1. Добавить ограниченный параллелизм в `executeUpdatePlan`

Что сделать:
- расширить `UpdateExecutionPlan` опцией `concurrency`
- по умолчанию оставить `1`, чтобы не сломать поведение
- для `competitions` и `courses` выставить 4-8

Ожидаемый эффект:
- заметное ускорение без перестройки доменной логики

Риск:
- нужен контроль порядка агрегации summary и issues

### 2. Параллелизовать загрузку курсов

Что сделать:
- переписать `fetchCoursePayloads` по модели `fetchResultsPayloads`
- вынести общую утилиту `runWithConcurrency`
- concurrency сделать настраиваемым через env

Ожидаемый эффект:
- самый быстрый выигрыш для сценария обновления парков

### 3. Убрать O(n^2) в `competitions-update-job`

Что сделать:
- один раз построить `Map` по `competitionId` и `metrixId`
- доставать `rawPayload` из map, а не через `records.find(...)`

Ожидаемый эффект:
- дешёвая локальная оптимизация CPU

## Фаза 2. Основное ускорение БД

### 4. Добавить batch upsert для `competitions`

Что сделать:
- расширить `CompetitionsPersistenceAdapter` методами bulk lookup и `upsert`
- перевести `CompetitionsRepository` на пакетную обработку, как в `players`/`competition_results`
- сохранить текущую защиту от конфликта `competition_id` vs `metrix_id`

Ожидаемый эффект:
- сильное сокращение количества запросов к Supabase

### 5. Добавить batch upsert для `courses`

Что сделать:
- аналогично `players`: `findByCourseIds` + `upsert`
- добавить `saveCourses(...)`
- перестать вызывать `saveCourse(...)` по одному из `executeUpdatePlan`

Ожидаемый эффект:
- ускорение записи парков в БД в разы на средних и больших объёмах

### 6. Урезать объём данных в предварительных чтениях

Что сделать:
- для existence-check выбирать только ключи и поля, реально нужные для merge
- не тянуть `raw_payload` и лишние колонки там, где они не используются

Особенно важно для:
- `findByPlayerIds`
- `findByCompetitionIds`

Ожидаемый эффект:
- меньше трафика и быстрее ответы Supabase

## Фаза 3. Архитектурная чистка

### 7. Вынести общие примитивы конкурентного выполнения

Что сделать:
- единая утилита для bounded concurrency
- единая модель сбора `summary`, `issues`, `skipped`

Ожидаемый эффект:
- меньше дублирования и проще контролировать производительность

### 8. Разделить network stage и persistence stage по батчам

Что сделать:
- fetch/mapping/persist обрабатывать чанками
- не держать все payloads большого окна обновления в памяти одновременно

Ожидаемый эффект:
- лучшее поведение на больших диапазонах дат
- ниже пик памяти

### 9. Сузить read-side для парков

Что сделать:
- хранить `course_id` в `competitions` как обязательный атрибут после успешного импорта
- для поиска парков читать сначала только `course_id`
- fallback к `raw_payload` использовать только для legacy-данных

Ожидаемый эффект:
- дешевле подготовка `courses-update`

## Что я бы делал по порядку

1. Параллелизм в `courses` fetch.
2. `concurrency` в `executeUpdatePlan`.
3. Убрать `Array.find` в `competitions-update-job`.
4. Batch upsert для `courses`.
5. Batch upsert для `competitions`.
6. Урезать select'ы в Supabase-адаптерах.
7. Чанковать крупные обновления.

## Как мерить эффект

Перед изменениями и после них собрать метрики:

- сколько соревнований выбрано
- сколько курсов загружено
- сколько результатов загружено
- время `read-side`
- время HTTP fetch stage
- время mapping stage
- время persistence stage
- общее время job
- число запросов к Supabase
- число запросов к DiscGolfMetrix

Минимально достаточно добавить `console.time`/`console.timeEnd` или структурированные тайминги в result diagnostics.

## Ожидаемый практический результат

Если делать только Фазу 1 и первую половину Фазы 2, то наиболее вероятный эффект такой:

- `courses-update` ускорится сильнее всего
- `competitions-update` станет заметно быстрее на длинных периодах
- `results-update` улучшится умеренно, в основном за счёт сокращения лишних чтений из БД
- общая устойчивость не должна пострадать, если оставить bounded concurrency и текущую tolerant-обработку ошибок
