# Разворачивание проекта в Amvera

## Что именно нужно развернуть

Для текущего состояния репозитория оптимальная схема такая:

1. `Supabase` как отдельная база данных.
2. `apps/web` как единый full-stack проект, который обслуживает SPA, API и scheduled jobs.

Отдельные runtime для `apps/api` и `apps/worker` больше не нужны: их код используется как internal layer внутри unified Cloudflare app.

## Почему старая схема с двумя проектами устарела

Раньше монорепозиторий разворачивался как два проекта, но после Cloudflare one-deploy migration это уже не целевая модель:

- `apps/web` остается единственной deployable runtime surface
- `apps/api` больше не должен стартовать как самостоятельный Node.js сервер
- `apps/worker` больше не должен жить как отдельный процесс или scheduler

Если нужен Amvera-специфичный deploy, ориентируйтесь только на surviving app workspace `apps/web`.

## Что понадобится заранее

- аккаунт в Amvera
- проект в Supabase
- значения для runtime-настроек API в Amvera
- публичный домен API-проекта в Amvera

`SUPABASE_ANON_KEY` в текущем коде не используется, поэтому для деплоя не обязателен.

Из значений API я рекомендую задавать через Amvera как минимум:

- в `Secrets`: `SUPABASE_SERVICE_ROLE_KEY`, `DISCGOLFMETRIX_API_CODE`
- в `Variables` или тоже в `Secrets`: `SUPABASE_URL`, `DISCGOLFMETRIX_COUNTRY_CODE`

`SUPABASE_URL` и `DISCGOLFMETRIX_COUNTRY_CODE` сами по себе не являются чувствительными, но их тоже можно держать в `Secrets`, если хотите хранить все интеграционные настройки в одном месте.

## Шаг 1. Подготовить Supabase

Создайте проект в Supabase и последовательно примените SQL-миграции из папки `supabase/migrations`:

1. `0001_schema_conventions.sql`
2. `0002_competitions_and_courses.sql`
3. `0003_expand_courses_for_park_sync.sql`
4. `0004_players_and_competition_results.sql`
5. `0005_add_course_id_to_competitions.sql`
6. `0006_course_rating_results_to_double_precision.sql`
7. `0007_add_parent_id_to_competitions.sql`

Если у вас уже была развернута старая версия схемы, дополнительно примените новые миграции до актуальной версии, включая:

- `0013_add_tournament_categories.sql`
- `0014_add_coefficient_to_tournament_categories.sql`
- `0022_add_competition_class_to_tournament_categories.sql`

Сделать это можно двумя способами:

- через SQL Editor в панели Supabase, выполняя файлы по порядку
- через Supabase CLI, если он уже настроен у вас локально

После применения миграций база должна содержать таблицы:

- `app_public.competitions`
- `app_public.courses`
- `app_public.players`
- `app_public.competition_results`

Дополнительно:

- схема `app_public` должна быть добавлена в `Settings -> API -> Exposed schemas`
- для `service_role` должны быть выданы права на схему и таблицы `app_public`
- колонка `app_public.competitions.course_id` должна присутствовать: она используется для последующего обновления парков через `content=course`
- колонка `app_public.competitions.parent_id` должна присутствовать: она хранит `ParentID` из DiscGolfMetrix для parent-child связей соревнований

## Шаг 2. Развернуть API в Amvera

### 2.1. Создайте ветку под API

Пример:

```bash
git switch -c amvera-api
cp deploy/amvera/api.amvera.yaml amvera.yaml
git add amvera.yaml
git commit -m "Add Amvera API deployment config"
```

Если вы не хотите хранить `amvera.yaml` в основной ветке, это нормально. Для API он нужен только в deployment-ветке `amvera-api`.

### 2.2. Создайте проект в Amvera

В интерфейсе Amvera создайте новый проект и подключите к нему репозиторий с веткой `amvera-api`.

Тип окружения для этого проекта: `Node.JS Server`.

### 2.3. Добавьте runtime-настройки API в Amvera

В проекте Amvera задайте:

#### Variables

- `API_PORT=3001`
- `DISCGOLFMETRIX_BASE_URL=https://discgolfmetrix.com`

#### Secrets

- `SUPABASE_SERVICE_ROLE_KEY=<ваш service role key>`
- `DISCGOLFMETRIX_API_CODE=<ваш код DiscGolfMetrix>`

#### Variables или Secrets

- `SUPABASE_URL=<ваш Supabase URL>`
- `DISCGOLFMETRIX_COUNTRY_CODE=<например EE>`

Если хотите единообразия, можно хранить все четыре значения ниже в `Secrets`:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DISCGOLFMETRIX_COUNTRY_CODE`
- `DISCGOLFMETRIX_API_CODE`

### 2.4. Дождитесь сборки и проверьте healthcheck

После успешного деплоя проверьте:

```text
GET https://<api-domain>/health
```

Ожидаемый ответ:

```json
{
  "data": {
    "service": "api",
    "status": "ok",
    "timestamp": "<ISO timestamp>"
  }
}
```

## Шаг 3. Развернуть Web в Amvera

### 3.1. Создайте отдельную ветку под Web

Пример:

```bash
git switch <ветка-с-актуальным-кодом>
git switch -c amvera-web
cp deploy/amvera/web.amvera.yaml amvera.yaml
```

Перед коммитом обязательно откройте `amvera.yaml` и замените:

```yaml
VITE_API_BASE_URL=https://replace-with-your-api-domain.amvera.io
```

на реальный публичный домен API-проекта, например:

```yaml
VITE_API_BASE_URL=https://metrix-parser-api.amvera.io
```

Затем закоммитьте изменения:

```bash
git add amvera.yaml
git commit -m "Add Amvera web deployment config"
```

### 3.2. Создайте второй проект в Amvera

В интерфейсе Amvera создайте второй проект и подключите к нему ту же монорепу, но уже с веткой `amvera-web`.

Тип окружения для этого проекта: `Node.JS Browser`.

### 3.3. Важная особенность Vite и Amvera

Фронтенд читает `VITE_API_BASE_URL` во время сборки.

Для Amvera это важно, потому что переменные, заведённые через интерфейс проекта, недоступны на стадии build. Поэтому URL API нужно передавать либо:

- прямо в `build.additionalCommands` внутри `amvera.yaml`
- либо через `.env`/`.env.production`, который попадёт в репозиторий

В подготовленном шаблоне используется первый вариант.

## Шаг 4. Проверить связку после деплоя

После публикации web-проекта проверьте:

1. Главная страница открывается без белого экрана.
2. Во вкладке Network запросы уходят на ваш Amvera API-домен.
3. Страницы `/`, `/courses`, `/players`, `/results` открываются без CORS-ошибок.
4. Legacy-ссылка `/competitions` тоже открывает список соревнований (alias на `/`) и не ломает старые закладки.

В API уже включены permissive CORS-заголовки для `GET`, `POST`, `OPTIONS`, поэтому отдельная настройка CORS в Amvera не требуется.

## Шаг 5. Как запускать обновление данных

Обновления можно вызывать через API:

### Обновить соревнования за период

```bash
curl -X POST "https://<api-domain>/updates/competitions" \
  -H "Content-Type: application/json" \
  -d '{"dateFrom":"2026-03-01","dateTo":"2026-03-31"}'
```

### Обновить парки

```bash
curl -X POST "https://<api-domain>/updates/courses" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Обновить игроков за период

```bash
curl -X POST "https://<api-domain>/updates/players" \
  -H "Content-Type: application/json" \
  -d '{"dateFrom":"2026-03-01","dateTo":"2026-03-31"}'
```

Сценарий использует общий DiscGolfMetrix `result` payload: за один проход обновляет и `players`, и `competition_results`. В ответе блок статистики разделён на `diagnostics.players` и `diagnostics.results`.

### Обновить результаты за период

```bash
curl -X POST "https://<api-domain>/updates/results" \
  -H "Content-Type: application/json" \
  -d '{"dateFrom":"2026-03-01","dateTo":"2026-03-31"}'
```

Этот сценарий использует тот же объединённый pipeline и тоже обновляет сразу обе сущности: `players` и `competition_results`, но возвращает раздельную статистику по ним.

Если позже захотите автоматизировать эти вызовы по расписанию, можно добавить `Cron Jobs` в Amvera или использовать внешний scheduler.

## Рекомендуемый порядок первого запуска

После первого деплоя я бы запускал обновления так:

1. `/updates/competitions`
2. `/updates/courses`
3. `/updates/players` или `/updates/results`

Это соответствует текущей модели данных проекта и зависимостям между сущностями.

Не нужно вызывать `/updates/players` и `/updates/results` подряд на один и тот же период: оба endpoint'а сейчас используют один и тот же upstream-запрос DiscGolfMetrix `content=result` и в рамках одного запуска обновляют и игроков, и результаты.

## Полезные замечания

- `apps/api/src/main.ts` больше не является production entrypoint.
- `npm run build` в корне репозитория проходит успешно, но для Amvera выгоднее запускать только нужный workspace.
- Веб-проект не должен ходить в Supabase напрямую. Он работает через unified app runtime.
- Для scheduled update-сценариев ориентируйтесь на cron wiring surviving app, а не на отдельные внешние worker-процессы.

## Быстрая памятка по runtime-настройкам

### Unified app

- `DISCGOLFMETRIX_BASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DISCGOLFMETRIX_API_CODE`
- `SUPABASE_URL`
- `DISCGOLFMETRIX_COUNTRY_CODE`

## Полезные ссылки

- Amvera config file: https://docs.amvera.ru/applications/configuration/config-file.html
- Amvera Node.JS Server: https://docs.amvera.ru/applications/environments/nodejs-server.html
- Amvera Node.JS Browser: https://docs.amvera.ru/applications/environments/nodejs-browser.html
- Amvera Cron Jobs: https://docs.amvera.ru/cron/cronjobs.html
