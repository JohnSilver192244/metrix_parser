# TODO

-- 1. Исправить начисление очков: начислять на все турниры, а не только на 4.--
проверить начисление баллов
2. Начислять очки по реальному месту, а не табличному.
--3. Сделать темную тему и переключатель тем.--
4. Игроки -> игрок -> турнир: сделать нормальные хлебные крошки.

## План: унификация сущностей и алгоритмов

1. Унифицировать `Competition.hasResults`.
- Привести `GET /competitions` и `PUT /competitions/category` к одной descendant-aware логике.
- Убрать ситуацию, когда после обновления категории соревнование временно считается "без результатов", хотя в списке оно "с результатами".

2. Вынести единую политику иерархии соревнований.
- Сделать один shared-layer для `event -> pool -> round`.
- Через него определять:
  - source ids для результатов
  - owner id для season points
  - owner/source для сегментов и course rating
  - display context для detail-страниц

3. Унифицировать модель `PlayerCompetitionResult`.
- Решить, что именно означает строка в карточке игрока:
  - либо raw result из `competition_results`
  - либо scoring competition / owner tournament
- После этого привести к одному смыслу поля:
  - `competitionId`
  - `competitionName`
  - `category`
  - `seasonPoints`
  - навигацию в detail page

4. Развести raw order и вычисленное место.
- Не использовать `CompetitionResult.orderNumber` одновременно как:
  - исходное место из импорта
  - пересчитанное место на detail-странице
  - место в player view
- Ввести отдельные поля или отдельный view-model:
  - `sourceOrderNumber`
  - `placement`
  - `placementLabel`

5. Унифицировать `Player.competitionsCount`.
- Сейчас без сезона это count raw competitions, а с сезоном count scoring competitions.
- Нужен один смысл на все приложение.
- Если оба сценария важны, разделить на два поля:
  - `resultsCount`
  - `seasonCompetitionsCount`

6. Унифицировать правила eligibility турниров.
- Свести в один источник правила минимального числа игроков.
- Сейчас threshold живет и в importer, и в season accrual.
- Либо использовать season config, либо shared constant/validator, но не две независимые проверки.

## Рекомендуемый порядок

1. `Competition.hasResults`
2. Shared hierarchy policy
3. `PlayerCompetitionResult`
4. `Player.competitionsCount`
5. `CompetitionResult.orderNumber` / `placement`
6. Eligibility rules

## Code Review (uncommitted) — action items

1. Исправить агрегацию `seasonPoints` в `GET /competitions`: не суммировать очки по всем сезонам только по `competition_id` без `season_code`.
2. Исправить загрузку `seasonPoints` в `GET /results`: убрать неоднозначный ключ `competition_id:player_id` без `season_code`.
3. Добавить fallback в `competitions` API для отсутствующего столбца `comment` (по аналогии с `category_id`) для частично мигрированных окружений.
4. Добавить совместимость по маршруту `/competitions` (redirect/alias на `/`), чтобы не ломать старые ссылки.
5. Добавить/уточнить `.gitignore` для служебных артефактов (`.omx/*`, `.playwright-mcp/*`), чтобы исключить случайный коммит.
