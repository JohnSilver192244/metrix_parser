# TODO

1. Игроки -> игрок -> турнир: сделать нормальные хлебные крошки.

## План: унификация competition-сущностей и алгоритмов

### Инварианты из AGENTS.md (обязательные)

1. Источник истины для того, что считается отдельным соревнованием:
- страница `Список соревнований` + вложенная detail-логика результатов.

2. Классификация competition для scoring/read-side:
- `Single round event (2)` и `Event (4)` считаются отдельными соревнованиями.
- `Round (1)` без родителя считается отдельным соревнованием.
- `Round (1)` с родителем не считается отдельным соревнованием и агрегируется в родителя.

3. Для `Event (4)` с дочерними `round` (напрямую или через единственный `pool`) scoring берет дочерние результаты,
   но сущность соревнования определяется list/detail-моделью, а не сырыми `competition_results`.

4. Для lookup в `season_points_table` использовать `players_count` scoring-сущности соревнования,
   а не число валидно ранжированных финишировавших после фильтрации (`DNF`, `null sum`, неполные `round`).

5. Изменения производных метрик (особенно `season_points`) считаются завершенными только после проверки
   согласованности минимум между списком соревнований и detail-экраном одной и той же сущности.

## Сделано

1. Унифицирована identity/hierarchy policy в shared-layer (`event -> pool -> round`):
- добавлен минимальный identity API с owner/source semantics;
- `GET /competitions` и `GET /results` используют единый owner/source смысл.

2. Унифицирован `Competition.hasResults`:
- descendant-aware логика применена согласованно;
- убрана проблема, когда parent competition мог временно считаться "без результатов".

3. Исправлена сезонная проекция `season_points`:
- в `GET /results` убран неоднозначный ключ `competition_id:player_id` без `season_code`;
- в `GET /competitions` убрана агрегация только по `competition_id` без сезонной дисамбигуации;
- добавлены регрессии на owner remapping и multi-season selection.

## Рабочий план (осталось)

1. Унифицировать модель `PlayerCompetitionResult`.
- Зафиксировать единый смысл строки в карточке игрока: scoring competition (owner tournament), а не raw запись.
- Привести к одному смыслу поля:
  - `competitionId`
  - `competitionName`
  - `category`
  - `seasonPoints`
  - навигацию в detail page

2. Развести raw order и вычисленное место.
- Не использовать `CompetitionResult.orderNumber` одновременно как:
  - исходное место из импорта
  - пересчитанное место на detail-странице
  - место в player view
- Ввести отдельные поля или отдельный view-model:
  - `sourceOrderNumber`
  - `placement`
  - `placementLabel`

3. Унифицировать `Player.competitionsCount`.
- Сейчас без сезона это count raw competitions, а с сезоном count scoring competitions.
- Нужен один смысл на все приложение.
- Если оба сценария важны, разделить на два поля:
  - `resultsCount`
  - `seasonCompetitionsCount`

4. Унифицировать правила eligibility турниров.
- Свести в один источник правила минимального числа игроков.
- Сейчас threshold живет и в importer, и в season accrual.
- Либо использовать season config, либо shared constant/validator, но не две независимые проверки.

## Рекомендуемый порядок

1. `PlayerCompetitionResult`
2. `Player.competitionsCount`
3. `CompetitionResult.orderNumber` / `placement`
4. Eligibility rules
5. Хлебные крошки `Игрок -> Турнир`

## Code Review (uncommitted) — action items

1. Добавить fallback в `competitions` API для отсутствующего столбца `comment` (по аналогии с `category_id`) для частично мигрированных окружений.
2. (done) Исправить агрегацию `seasonPoints` в `GET /competitions`: убрать агрегацию только по `competition_id` без сезонной дисамбигуации.
3. (done) Исправить загрузку `seasonPoints` в `GET /results`: убрать неоднозначный ключ `competition_id:player_id` без `season_code`.
4. Добавить совместимость по маршруту `/competitions` (redirect/alias на `/`), чтобы не ломать старые ссылки.
5. Добавить/уточнить `.gitignore` для служебных артефактов (`.omx/*`, `.playwright-mcp/*`), чтобы исключить случайный коммит.
