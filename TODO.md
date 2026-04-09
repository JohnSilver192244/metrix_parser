# TODO

1. Разобраться с результатами «Чемпионат России по диск-гольфу 2025».
2. Игнорировать skins.
3. Унифицировать `Player.competitionsCount`:
- сейчас без сезона это count raw competitions, а с сезоном count scoring competitions;
- нужен единый смысл на все приложение;
- если оба сценария важны, разделить на `resultsCount` и `seasonCompetitionsCount`.
4. Добавить/уточнить `.gitignore` для служебных артефактов (`.omx/*`, `.playwright-mcp/*`), чтобы исключить случайный коммит.
