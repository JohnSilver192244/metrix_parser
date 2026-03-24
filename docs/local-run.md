# Локальный запуск

Ниже минимальная инструкция, чтобы поднять проект локально: `web`, `api` и при необходимости `worker`.

## Что понадобится

- `Node.js 20+`
- `npm`
- доступ к `Supabase`
- ключ `DISCGOLFMETRIX_API_CODE`, если хотите локально запускать сценарии импорта

## 1. Установить зависимости

Из корня репозитория:

```bash
npm install
```

## 2. Подготовить переменные окружения

У проекта сейчас нет готового `.env.example`, поэтому проще запускать сервисы через `env ...`.

### Обязательные переменные для API

- `API_PORT` - необязательно, по умолчанию `3001`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DISCGOLFMETRIX_BASE_URL` - необязательно, по умолчанию `https://discgolfmetrix.com`
- `DISCGOLFMETRIX_COUNTRY_CODE`
- `DISCGOLFMETRIX_API_CODE`

Хотя сам `api` стартует только с `API_PORT`, сценарии `/updates/*` используют DiscGolfMetrix и Supabase, поэтому для нормальной работы update-роутов эти переменные нужны.

### Переменные для web

- `VITE_API_BASE_URL` - URL локального API, обычно `http://localhost:3001`

### Переменные для worker

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DISCGOLFMETRIX_BASE_URL` - необязательно, по умолчанию `https://discgolfmetrix.com`
- `DISCGOLFMETRIX_COUNTRY_CODE`
- `DISCGOLFMETRIX_API_CODE`

## 3. Запустить API

```bash
env \
  API_PORT=3001 \
  SUPABASE_URL=... \
  SUPABASE_SERVICE_ROLE_KEY=... \
  DISCGOLFMETRIX_BASE_URL=https://discgolfmetrix.com \
  DISCGOLFMETRIX_COUNTRY_CODE=RU \
  DISCGOLFMETRIX_API_CODE=... \
  npm run dev:api
```

После старта API слушает `http://localhost:3001`.

## 4. Запустить web

В отдельном терминале:

```bash
env \
  VITE_API_BASE_URL=http://localhost:3001 \
  npm run dev:web
```

Обычно Vite поднимается на `http://localhost:5173`.

## 5. Запустить worker

`worker` нужен, если вы хотите отдельно запускать его локально или проверять bootstrap/фоновые сценарии.

```bash
env \
  SUPABASE_URL=... \
  SUPABASE_SERVICE_ROLE_KEY=... \
  DISCGOLFMETRIX_BASE_URL=https://discgolfmetrix.com \
  DISCGOLFMETRIX_COUNTRY_CODE=RU \
  DISCGOLFMETRIX_API_CODE=... \
  npm run dev:worker
```

Сейчас `worker` в dev-режиме выводит bootstrap-сообщение и следит за изменениями через `tsx watch`.

## 6. Проверить, что всё работает

### API

```bash
curl http://localhost:3001/health
```

### Web

Откройте `http://localhost:5173`.

### Пример update-запроса

```bash
curl -X POST "http://localhost:3001/updates/players" \
  -H "Content-Type: application/json" \
  -d '{"dateFrom":"2026-03-01","dateTo":"2026-03-31"}'
```

Важно: `/updates/players` и `/updates/results` используют один и тот же объединённый pipeline. За один запуск обновляются и игроки, и результаты, а статистика возвращается раздельно в `diagnostics.players` и `diagnostics.results`.

## 7. Остановить сервисы

Если процессы запущены в foreground, достаточно нажать `Ctrl+C` в каждом терминале.

Если нужно проверить занятые порты:

```bash
lsof -nP -iTCP -sTCP:LISTEN | rg '(:3001|:5173|:3101|:4173)'
```

## Полезные команды

Проверка типов и workspace-конфигурации:

```bash
npm run check
```

Тесты по workspace:

```bash
npm test --workspace @metrix-parser/api
npm test --workspace @metrix-parser/worker
npm test --workspace @metrix-parser/web
```
