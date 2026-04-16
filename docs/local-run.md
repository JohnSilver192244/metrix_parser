# Локальный запуск

Ниже минимальная инструкция для текущей runtime-модели проекта: один Cloudflare full-stack app в `apps/web`.

## Что понадобится

- `Node.js 20+`
- `npm`
- доступ к `Supabase`
- ключ `DISCGOLFMETRIX_API_CODE`, если хотите запускать update-сценарии

## 1. Установить зависимости

Из корня репозитория:

```bash
npm install
```

## 2. Подготовить переменные окружения

Unified Cloudflare app читает один набор runtime-переменных:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DISCGOLFMETRIX_BASE_URL` - необязательно, по умолчанию `https://discgolfmetrix.com`
- `DISCGOLFMETRIX_COUNTRY_CODE`
- `DISCGOLFMETRIX_API_CODE`

Опционально:

- `VITE_API_BASE_URL` - обычно не нужен локально, потому что `apps/web` использует same-origin API через Worker shell

## 2.1. Создать пользователя для входа

Авторизация хранится в таблице `app_public.app_users`. Пользователей можно создать вручную:

```sql
insert into app_public.app_users (login, password)
values ('admin', 'secret');
```

## 3. Запустить unified app

Из корня репозитория:

```bash
env \
  SUPABASE_URL=... \
  SUPABASE_SERVICE_ROLE_KEY=... \
  DISCGOLFMETRIX_BASE_URL=https://discgolfmetrix.com \
  DISCGOLFMETRIX_COUNTRY_CODE=RU \
  DISCGOLFMETRIX_API_CODE=... \
  npm run dev
```

Это поднимает `apps/web` через Workers-compatible runtime. SPA, API routes и scheduled/background wiring живут в одном приложении.

## 4. Проверить, что всё работает

### Web + API

Откройте локальный URL, который напечатает Vite/Wrangler.

Проверка health endpoint:

```bash
curl http://localhost:5173/health
```

Если локальный порт отличается, подставьте фактический адрес из dev-сервера.

### Пример update-запроса

Сначала получите токен сессии:

```bash
curl -X POST "http://localhost:5173/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"login":"admin","password":"secret"}'
```

Далее используйте `sessionToken` из ответа как `Bearer`-токен:

```bash
curl -X POST "http://localhost:5173/updates/players" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <sessionToken>" \
  -d '{"dateFrom":"2026-03-01","dateTo":"2026-03-14"}'
```

Теперь endpoint возвращает accepted-job ответ, а итоговый результат доступен через polling path из поля `pollPath`.

## 5. Остановить сервис

Если процесс запущен в foreground, достаточно нажать `Ctrl+C`.

## Полезные команды

Проверка типов и workspace-конфигурации:

```bash
npm run check
npm run check:workspace
```

Тесты по workspace:

```bash
npm test --workspace @metrix-parser/api
npm test --workspace @metrix-parser/worker
npm test --workspace @metrix-parser/web
```

## Важные замечания

- `apps/api` больше не является отдельным сервисом. Его код используется как internal route layer внутри `apps/web`.
- `apps/worker` больше не является отдельным runtime. Job-модули запускаются через Cloudflare fetch/scheduled hooks в `apps/web`.
- Для периодических update-сценариев production cron wiring задается в `apps/web/wrangler.jsonc` и работает в UTC.
