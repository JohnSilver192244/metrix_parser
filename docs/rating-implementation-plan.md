# План реализации начисления рейтинга Сезона РДГА 2026

## Текущее состояние проекта

### Что уже реализовано

| Компонент | Статус | Описание |
|-----------|--------|----------|
| Соревнования | ✅ | Импорт из DiscGolfMetrix, привязка к категории турнира |
| Категории турниров | ✅ | CRUD: `coefficient`, `ratingGte`, `ratingLt`, `segmentsCount`, `competitionClass` (`league` \| `tournament`) |
| Результаты соревнований | ✅ | `sum`, `diff`, `dnf` по каждому игроку (место вычисляется отдельно) |
| Игроки | ✅ | `division`, `rdga` (флаг членства), импорт из Metrix |
| Курсы / парки | ✅ | Рейтинг парка через интерполяцию (два калибровочных значения) |
| Расчёт мест | ✅ | Фронтенд: объединение раундов, определение мест, обработка ничьих |
| Дивизионы | ✅ | MPO, FPO, MP40, FP40, MA1, MA2 |
| Привязка категории к соревнованию | ✅ | PATCH endpoint + UI (select) |

### Чего не хватает для начисления рейтинга

По Регламенту Сезона РДГА 2026, рейтинговые баллы начисляются по следующей схеме:
1. Результаты ВСЕХ дивизионов объединяются в одну таблицу, сортируются по `sum`
2. Каждому игроку присваиваются баллы из «Таблицы баллов 2026» по его месту
3. При ничье все получают балл за наивысшее из занятых мест
4. Баллы умножаются на коэффициент категории соревнования
5. В итоговый зачёт идут лучшие 4 лиги + лучшие 4 турнира
6. Баллы начисляются только членам РДГА с момента вступления
7. Минимум 8 участников (без DNS/DNF) для начисления баллов

---

## Этапы реализации

### Этап 1. Таблица баллов (Points Table)

**Проблема:** Регламент ссылается на «Таблицу баллов 2026» (маппинг: место → баллы), но самой таблицы в проекте нет.

**Задачи:**

1.1. **Получить таблицу баллов** — уточнить у заказчика или найти в документации РДГА конкретные значения (например: 1-е место = 100 баллов, 2-е = 95, 3-е = 91, …).

1.2. **Миграция БД** — создать таблицу `app_public.season_points_table`:
```sql
CREATE TABLE app_public.season_points_table (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  season text NOT NULL,          -- '2026'
  placement integer NOT NULL,    -- 1, 2, 3, ...
  points numeric(10,2) NOT NULL, -- баллы за это место
  UNIQUE (season, placement)
);
```

1.3. **Доменный тип** — `SeasonPointsEntry` в `packages/shared-types`.

1.4. **API** — CRUD-эндпоинты для управления таблицей баллов (или seed-миграция с данными).

---

### Этап 2. Дата вступления в РДГА и сезонный дивизион

**Проблема:** У игрока есть только булевый флаг `rdga`. По регламенту:
- Баллы начисляются только с момента вступления в РДГА
- Игрок выбирает дивизион на весь сезон (может играть в любом на конкретном турнире, но очки идут в выбранный)

**Задачи:**

2.1. **Миграция БД** — добавить поля в `players`:
```sql
ALTER TABLE app_public.players
  ADD COLUMN rdga_since date,         -- дата вступления в РДГА
  ADD COLUMN season_division text      -- дивизион на сезон 2026
    REFERENCES app_public.divisions(code);
```

2.2. **Обновить доменный тип** `Player` — добавить `rdgaSince`, `seasonDivision`.

2.3. **API** — расширить `UpdatePlayerRequest` и PATCH-эндпоинт для установки `rdgaSince` и `seasonDivision`.

2.4. **UI** — в таблице игроков добавить колонки и редактирование этих полей.

---

### Этап 3. Конфигурация сезона

**Проблема:** Нет понятия «сезон» с датами начала/окончания. Регламент: 01.04.2026 — 01.11.2026.

**Задачи:**

3.1. **Миграция БД** — таблица `app_public.seasons`:
```sql
CREATE TABLE app_public.seasons (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  season_code text UNIQUE NOT NULL,  -- '2026'
  name text NOT NULL,                 -- 'Сезон РДГА 2026'
  date_from date NOT NULL,            -- '2026-04-01'
  date_to date NOT NULL,              -- '2026-11-01'
  best_leagues_count integer NOT NULL DEFAULT 4,
  best_tournaments_count integer NOT NULL DEFAULT 4,
  min_players integer NOT NULL DEFAULT 8,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

3.2. **Доменный тип** — `Season` в `packages/shared-types`.

3.3. **API** — CRUD для сезонов (или seed-миграция с данными 2026).

---

### Этап 4. Типизация категорий: лига / турнир

**Проблема:** Для правила «лучшие 4 лиги + лучшие 4 турнира» нужно знать **тип** соревнования. Нужна явная классификация в `tournament_categories`.

**Задачи:**

4.1. **Миграция БД** — добавить поле `competition_class` в `tournament_categories`:
```sql
ALTER TABLE app_public.tournament_categories
  ADD COLUMN competition_class text NOT NULL DEFAULT 'tournament'
  CHECK (competition_class in ('league', 'tournament'));
```

4.2. **Обновить доменный тип** `TournamentCategory` — добавить `competitionClass`.

4.3. **API + UI** — расширить CRUD категорий, добавить выбор класса соревнования.

---

### Этап 5. Валидация допуска к начислению баллов

**Проблема:** Нет проверки условий допуска соревнования к рейтингу.

**Правила из регламента:**
- Минимум 8 участников (без DNS/DNF)
- Соревнование попадает в даты сезона
- Соревнование имеет присвоенную категорию (не Категория 0)
- Только основной лейаут

**Задачи:**

5.1. **Доменная функция** — `isCompetitionEligibleForRating(competition, season, resultsCount)`:
- `competition.categoryId` не `null`
- `competition.competitionDate` в диапазоне сезона
- Количество не-DNF участников >= `season.minPlayers`

5.2. **Тесты** — покрыть граничные случаи (ровно 8 участников, дата на границе сезона, без категории).

---

### Этап 6. Расчёт баллов за одно соревнование (scoring engine)

**Проблема:** Ключевая отсутствующая логика. Нужно:
1. Объединить результаты всех дивизионов в одну таблицу
2. Отсортировать по `sum` (меньше = лучше)
3. Определить места с учётом ничьих (при ничье — все получают наивысший балл)
4. Назначить баллы из таблицы баллов по месту
5. Умножить на коэффициент категории

**Задачи:**

6.1. **Доменная функция** — `calculateCompetitionSeasonPoints(results, pointsTable, coefficient)`:
- Вход: массив `CompetitionResult[]`, таблица баллов, коэффициент
- Фильтрация: убрать DNF и DNS
- Сортировка по `sum` (от меньшего к большему)
- Определение мест: при ничье (одинаковый `sum`) все получают место первого в группе
- Маппинг: место → баллы из таблицы
- Умножение: баллы × коэффициент
- Выход: `{ playerId, placement, rawPoints, coefficient, seasonPoints }[]`

6.2. **Тесты** — ничьи, DNF, недостаточно участников, пустая таблица баллов.

> **Примечание:** Логика определения мест уже частично реализована в `competition-results-page.tsx` (`assignCalculatedPlacements`), но она на фронтенде и привязана к UI. Нужно вынести чистую доменную логику в `packages/shared-types` или в `apps/worker`.

#### Уточнение по иерархии соревнований (введено в коде)

Для структуры DiscGolfMetrix `parent (Event) -> pool -> round`:
- единицей начисления очков сезона считается `pool` (а не `parent` и не каждый `round` отдельно);
- результаты для этой единицы собираются из всех дочерних `round` данного `pool`;
- `category_id` для `pool` наследуется от ближайшего предка с категорией (обычно от `parent`).

Для структуры `event -> round` (без `pool`) сохраняется прежняя логика:
- единица начисления очков — `event`;
- результаты берутся из его дочерних `round`.

---

### Этап 7. Хранение начисленных баллов

**Проблема:** Нет таблицы для хранения рассчитанных баллов по каждому соревнованию.

**Задачи:**

7.1. **Миграция БД** — таблица `app_public.season_standings`:
```sql
CREATE TABLE app_public.season_standings (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  season_code text NOT NULL,
  competition_id text NOT NULL REFERENCES app_public.competitions(competition_id),
  player_id text NOT NULL REFERENCES app_public.players(player_id),
  placement integer NOT NULL,
  raw_points numeric(10,2) NOT NULL,
  coefficient numeric(10,2) NOT NULL,
  season_points numeric(10,2) NOT NULL,  -- raw_points * coefficient
  competition_class text NOT NULL,        -- 'league' | 'tournament' | 'championship'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (season_code, competition_id, player_id)
);
```

7.2. **Доменный тип** — `SeasonStanding` в `packages/shared-types`.

7.3. **Репозиторий** — `season-standings-repository.ts` в `apps/worker/src/persistence/`.

---

### Этап 8. Расчёт итогового рейтинга сезона

**Проблема:** Нет агрегации итогового рейтинга по правилу «лучшие 4 лиги + лучшие 4 турнира».

**Задачи:**

8.1. **Доменная функция** — `calculateSeasonTotal(playerStandings, season)`:
- Группировка по `competitionClass`: leagues, tournaments
- Сортировка внутри каждой группы по `seasonPoints` (убывание)
- Отбор лучших N из каждой группы (`season.bestLeaguesCount`, `season.bestTournamentsCount`)
- Сумма = итоговый рейтинг

8.2. **Миграция БД** — таблица `app_public.season_totals`:
```sql
CREATE TABLE app_public.season_totals (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  season_code text NOT NULL,
  player_id text NOT NULL REFERENCES app_public.players(player_id),
  season_division text,
  leagues_total numeric(10,2) NOT NULL DEFAULT 0,
  tournaments_total numeric(10,2) NOT NULL DEFAULT 0,
  championship_total numeric(10,2) NOT NULL DEFAULT 0,
  grand_total numeric(10,2) NOT NULL DEFAULT 0,
  leagues_count integer NOT NULL DEFAULT 0,
  tournaments_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (season_code, player_id)
);
```

8.3. **Тесты** — менее 4 лиг, ровно 4 турнира, нет чемпионата, пустые данные.

---

### Этап 9. Пайплайн пересчёта рейтинга (orchestration)

**Проблема:** Нет джоба / оркестрации для запуска пересчёта.

**Задачи:**

9.1. **Job** — `rating-calculation-job.ts` в `apps/worker/src/jobs/`:
- Загрузить конфигурацию сезона
- Загрузить таблицу баллов
- Для каждого подходящего соревнования:
  - Проверить допуск (этап 5)
  - Рассчитать баллы (этап 6)
  - Сохранить в `season_standings` (этап 7)
- Пересчитать итоги сезона (этап 8)
- Сохранить в `season_totals`

9.2. **Оркестрация** — `rating-update.ts` в `apps/worker/src/orchestration/`.

9.3. **API endpoint** — `POST /updates/rating` для запуска пересчёта через admin UI.

9.4. **Обновить `UpdateOperation`** — добавить `"rating"` в тип.

---

### Этап 10. API для чтения рейтинга

**Задачи:**

10.1. **Эндпоинты:**
- `GET /season-standings?season=2026` — общая таблица рейтинга (с фильтрацией по дивизиону)
- `GET /season-standings/:playerId?season=2026` — детализация баллов конкретного игрока
- `GET /season-standings/competitions/:competitionId` — баллы, начисленные за конкретное соревнование

10.2. **Модуль API** — `apps/api/src/modules/season-standings/`.

---

### Этап 11. UI — Страница рейтинга сезона

**Задачи:**

11.1. **Страница «Рейтинг сезона»** (`/season-standings`):
- Таблица: место, игрок, дивизион, баллы (лиги + турниры = итого)
- Фильтры: дивизион, поиск по имени
- Сортировка по итоговым баллам

11.2. **Детализация игрока** — раскрываемая строка или отдельная страница:
- Список всех соревнований с баллами
- Отмечены зачётные (лучшие 4 лиги, лучшие 4 турнира)
- Итоговая формула

11.3. **Индикация баллов на странице результатов соревнования:**
- Показать колонку «Баллы сезона» рядом с результатами
- Показать коэффициент категории в шапке

11.4. **Роутинг** — добавить маршрут `/season-standings` в `router.tsx`.

---

## Порядок зависимостей

```
Этап 1 (Таблица баллов) ─────────────┐
Этап 2 (Дата РДГА + сезонный дивизион)│
Этап 3 (Конфигурация сезона) ─────────┤
Этап 4 (Тип категории) ──────────────┤
                                       ▼
                           Этап 5 (Валидация допуска)
                                       │
                                       ▼
                           Этап 6 (Scoring engine) ────┐
                                                        │
                                                        ▼
                                       Этап 7 (Хранение баллов)
                                                        │
                                                        ▼
                                       Этап 8 (Итоги сезона)
                                                        │
                                                        ▼
                                       Этап 9 (Пайплайн пересчёта)
                                                        │
                                       ┌────────────────┤
                                       ▼                ▼
                           Этап 10 (API)    Этап 11 (UI)
```

Этапы 1–4 можно делать параллельно. Этапы 5–6 зависят от 1–4. Далее — последовательно.

---

## Открытые вопросы

1. **Таблица баллов** — какие конкретно значения «место → баллы» используются? Нужна ссылка на «Таблицу баллов 2026».
2. **Категория 0** — в регламенте упоминается «Категория 0» (турниры, на которых баллы не начисляются). Нужно ли добавить такую категорию в систему, или достаточно отсутствия `categoryId`?
3. **Несколько лейаутов** — как определять «основной лейаут» программно? Сейчас соревнования с `recordType = "4"` (мульти-раунд) агрегируют дочерние раунды. Нужно ли специальное поле для обозначения основного лейаута?
4. **Женский лейаут на Чемпионате России** — регламент допускает отдельный расчёт для упрощённого лейаута. Как это технически моделировать?
5. **Ручной ввод** — регламент упоминает, что учёт будет в полуавтоматическом режиме. Нужен ли UI для ручной корректировки баллов?
6. **Метрикс рейтинг парка vs. наш расчёт** — для категорий 4–6 используется рейтинг парка по Метрикс (880+, 800+, <799). Наш расчёт рейтинга — через интерполяцию. Достаточно ли его точности, или нужно сверяться с Metrix API?
