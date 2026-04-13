import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { mergeUpdatedPlayer, PlayersPageView } from "./players-page";

const defaultSeasons = [
  {
    seasonCode: "2026",
    name: "Сезон 2026",
    dateFrom: "2026-01-01",
    dateTo: "2026-12-31",
    bestLeaguesCount: 3,
    bestTournamentsCount: 3,
  },
];

test("PlayersPageView renders the empty state when there is no data", () => {
  const markup = renderToStaticMarkup(
    <PlayersPageView
      state={{
        status: "ready",
        divisions: [],
        players: [],
        seasons: [],
        total: 0,
      }}
    />,
  );

  assert.match(markup, /Пока нет сохранённых игроков/);
  assert.match(markup, /обновление игроков или результатов/);
});

test("PlayersPageView renders player identification fields", () => {
  const markup = renderToStaticMarkup(
    <PlayersPageView
      state={{
        status: "ready",
        divisions: [
          { code: "MPO" },
          { code: "MA2" },
        ],
        seasons: defaultSeasons,
        total: 1,
        players: [
          {
            playerId: "player-500",
            playerName: "Pavel &rarr; Orlov",
            division: "MPO",
            rdga: null,
            rdgaSince: "2026-01-15",
            seasonDivision: "MPO",
            seasonPoints: 125.5,
            competitionsCount: 7,
          },
        ],
      }}
      seasonFilter="2026"
      canEdit={true}
    />,
  );

  assert.match(markup, /Поиск по имени/);
  assert.match(markup, /type="search"/);
  assert.match(markup, /<table/);
  assert.match(markup, /Pavel → Orlov/);
  assert.match(markup, /data-table__external-link/);
  assert.match(
    markup,
    /https:\/\/discgolfmetrix\.com\/player\/player-500/,
  );
  assert.match(markup, /Игрок/);
  assert.match(markup, /Дивизион/);
  assert.match(markup, /RDGA/);
  assert.match(markup, /RDGA с/);
  assert.match(markup, /Очки сезона/);
  assert.match(markup, /Очки зачета/);
  assert.match(markup, /Соревнований/);
  assert.match(markup, /Сохранить/);
  assert.match(markup, /MPO/);
  assert.match(markup, /Сезон 2026/);
  assert.match(markup, /type="checkbox"/);
  assert.match(markup, /type="date"/);
  assert.match(markup, /Не выбран/);
  assert.match(markup, />125\.50</);
  assert.match(markup, />—</);
  assert.match(markup, />7</);
});

test("PlayersPageView renders player name as in-app link button when navigation is provided", () => {
  const markup = renderToStaticMarkup(
    <PlayersPageView
      state={{
        status: "ready",
        divisions: [{ code: "MPO" }],
        seasons: defaultSeasons,
        total: 1,
        players: [
          {
            playerId: "player-500",
            playerName: "Sergey Ivanov",
            division: "MPO",
            rdga: true,
            rdgaSince: "2026-01-15",
            seasonDivision: "MPO",
            seasonPoints: 20,
            competitionsCount: 3,
          },
        ],
      }}
      seasonFilter="2026"
      onNavigate={() => {}}
    />,
  );

  assert.match(markup, /data-table__link-button/);
  assert.match(markup, /Открыть страницу игрока Sergey Ivanov/);
});

test("PlayersPageView filters players by name substring case-insensitively", () => {
  const markup = renderToStaticMarkup(
    <PlayersPageView
      state={{
        status: "ready",
        divisions: [{ code: "MPO" }],
        seasons: defaultSeasons,
        total: 2,
        players: [
          {
            playerId: "player-500",
            playerName: "Pavel Orlov",
            division: "MPO",
            rdga: true,
            rdgaSince: "2026-01-15",
            seasonDivision: "MPO",
            seasonPoints: 42,
            competitionsCount: 7,
          },
          {
            playerId: "player-501",
            playerName: "Sergey Petrov",
            division: "MPO",
            rdga: false,
            rdgaSince: null,
            seasonDivision: "MPO",
            seasonPoints: 15.25,
            competitionsCount: 5,
          },
        ],
      }}
      nameQuery="ORL"
    />,
  );

  assert.match(markup, /Pavel Orlov/);
  assert.doesNotMatch(markup, /Sergey Petrov/);
});

test("PlayersPageView filters players by division and RDGA", () => {
  const markup = renderToStaticMarkup(
    <PlayersPageView
      state={{
        status: "ready",
        divisions: [
          { code: "MPO" },
          { code: "MA2" },
        ],
        seasons: defaultSeasons,
        total: 3,
        players: [
          {
            playerId: "player-500",
            playerName: "Pavel Orlov",
            division: "MPO",
            rdga: true,
            rdgaSince: "2026-01-15",
            seasonDivision: "MPO",
            seasonPoints: 42,
            competitionsCount: 7,
          },
          {
            playerId: "player-501",
            playerName: "Sergey Petrov",
            division: "MA2",
            rdga: false,
            rdgaSince: null,
            seasonDivision: "MA2",
            seasonPoints: 15.25,
            competitionsCount: 5,
          },
          {
            playerId: "player-502",
            playerName: "Ivan Sidorov",
            division: "MA2",
            rdga: null,
            rdgaSince: "2026-03-10",
            seasonDivision: null,
            seasonPoints: null,
            competitionsCount: 3,
          },
        ],
      }}
      divisionFilter="MA2"
      rdgaFilter="non-rdga"
    />,
  );

  assert.match(markup, /Все дивизионы/);
  assert.match(markup, /<option value="MA2" selected="">MA2<\/option>/);
  assert.match(markup, /Sergey Petrov/);
  assert.match(markup, /Ivan Sidorov/);
  assert.doesNotMatch(markup, /Pavel Orlov/);
});

test("PlayersPageView sorts players by season points descending", () => {
  const markup = renderToStaticMarkup(
    <PlayersPageView
      state={{
        status: "ready",
        divisions: [{ code: "MPO" }],
        seasons: defaultSeasons,
        total: 3,
        players: [
          {
            playerId: "player-100",
            playerName: "Alpha",
            division: "MPO",
            rdga: true,
            rdgaSince: "2026-01-15",
            seasonDivision: "MPO",
            seasonPoints: 15.5,
            competitionsCount: 3,
          },
          {
            playerId: "player-101",
            playerName: "Bravo",
            division: "MPO",
            rdga: true,
            rdgaSince: "2026-01-15",
            seasonDivision: "MPO",
            seasonPoints: 99.25,
            competitionsCount: 4,
          },
          {
            playerId: "player-102",
            playerName: "Charlie",
            division: "MPO",
            rdga: true,
            rdgaSince: "2026-01-15",
            seasonDivision: "MPO",
            seasonPoints: null,
            competitionsCount: 2,
          },
        ],
      }}
      sort={{
        field: "seasonPoints",
        direction: "desc",
      }}
    />,
  );

  assert.match(markup, /data-table__sort-button/);
  assert.match(markup, /Очки сезона ↓/);
  assert.match(markup, /aria-sort="descending"/);
  assert.ok(markup.indexOf("Bravo") < markup.indexOf("Alpha"));
  assert.ok(markup.indexOf("Alpha") < markup.indexOf("Charlie"));
});

test("PlayersPageView sorts players by season credit points descending", () => {
  const markup = renderToStaticMarkup(
    <PlayersPageView
      state={{
        status: "ready",
        divisions: [{ code: "MPO" }],
        seasons: defaultSeasons,
        total: 3,
        players: [
          {
            playerId: "player-100",
            playerName: "Alpha",
            division: "MPO",
            rdga: true,
            rdgaSince: "2026-01-15",
            seasonDivision: "MPO",
            seasonCreditPoints: 15.5,
            competitionsCount: 3,
          },
          {
            playerId: "player-101",
            playerName: "Bravo",
            division: "MPO",
            rdga: true,
            rdgaSince: "2026-01-15",
            seasonDivision: "MPO",
            seasonCreditPoints: 99.25,
            competitionsCount: 4,
          },
          {
            playerId: "player-102",
            playerName: "Charlie",
            division: "MPO",
            rdga: true,
            rdgaSince: "2026-01-15",
            seasonDivision: "MPO",
            seasonCreditPoints: null,
            competitionsCount: 2,
          },
        ],
      }}
      sort={{
        field: "seasonCreditPoints",
        direction: "desc",
      }}
    />,
  );

  assert.match(markup, /Очки зачета ↓/);
  assert.match(markup, /aria-sort="descending"/);
  assert.ok(markup.indexOf("Bravo") < markup.indexOf("Alpha"));
  assert.ok(markup.indexOf("Alpha") < markup.indexOf("Charlie"));
});

test("PlayersPageView renders season credit tooltip rows as name, place, points", () => {
  const markup = renderToStaticMarkup(
    <PlayersPageView
      state={{
        status: "ready",
        divisions: [{ code: "MPO" }],
        seasons: defaultSeasons,
        total: 1,
        players: [
          {
            playerId: "player-500",
            playerName: "Pavel Orlov",
            division: "MPO",
            rdga: true,
            rdgaSince: "2026-01-15",
            seasonDivision: "MPO",
            seasonCreditPoints: 132.4,
            seasonCreditCompetitions: [
              {
                competitionId: "competition-2",
                competitionName: "Beta Cup",
                placement: 3,
                seasonPoints: 42.5,
              },
              {
                competitionId: "competition-1",
                competitionName: "Alpha Cup",
                placement: 1,
                seasonPoints: 89.9,
              },
            ],
            competitionsCount: 5,
          },
        ],
      }}
      sort={{
        field: "seasonCreditPoints",
        direction: "desc",
      }}
    />,
  );

  assert.match(markup, /players-page__credit-tooltip-anchor/);
  assert.match(markup, /Соревнования в зачете/);
  assert.match(markup, /Alpha Cup, 1, 89\.90/);
  assert.match(markup, /Beta Cup, 3, 42\.50/);
});

test("PlayersPageView sorts players by metrix id and player name", () => {
  const markupById = renderToStaticMarkup(
    <PlayersPageView
      state={{
        status: "ready",
        divisions: [{ code: "MPO" }],
        seasons: defaultSeasons,
        total: 2,
        players: [
          {
            playerId: "player-900",
            playerName: "Alpha",
            division: "MPO",
            rdga: true,
            rdgaSince: "2026-01-15",
            seasonDivision: "MPO",
            seasonPoints: 10,
            competitionsCount: 1,
          },
          {
            playerId: "player-100",
            playerName: "Zulu",
            division: "MPO",
            rdga: true,
            rdgaSince: "2026-01-15",
            seasonDivision: "MPO",
            seasonPoints: 20,
            competitionsCount: 2,
          },
        ],
      }}
      sort={{
        field: "playerId",
        direction: "asc",
      }}
    />,
  );

  const markupByName = renderToStaticMarkup(
    <PlayersPageView
      state={{
        status: "ready",
        divisions: [{ code: "MPO" }],
        seasons: defaultSeasons,
        total: 2,
        players: [
          {
            playerId: "player-900",
            playerName: "Alpha",
            division: "MPO",
            rdga: true,
            rdgaSince: "2026-01-15",
            seasonDivision: "MPO",
            seasonPoints: 10,
            competitionsCount: 1,
          },
          {
            playerId: "player-100",
            playerName: "Zulu",
            division: "MPO",
            rdga: true,
            rdgaSince: "2026-01-15",
            seasonDivision: "MPO",
            seasonPoints: 20,
            competitionsCount: 2,
          },
        ],
      }}
      sort={{
        field: "playerName",
        direction: "asc",
      }}
    />,
  );

  assert.ok(markupById.indexOf("Zulu") < markupById.indexOf("Alpha"));
  assert.match(markupByName, /Игрок ↑/);
  assert.ok(markupByName.indexOf("Alpha") < markupByName.indexOf("Zulu"));
});

test("PlayersPageView renders visible pagination with 25 players per page", () => {
  const players = Array.from({ length: 30 }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    return {
      playerId: `player-${number}`,
      playerName: `Player ${number}`,
      division: "MPO",
      rdga: true,
      rdgaSince: "2026-01-15",
      seasonDivision: "MPO",
      seasonPoints: Number(index + 1),
      competitionsCount: index + 1,
    };
  });

  const firstPageMarkup = renderToStaticMarkup(
    <PlayersPageView
      state={{
        status: "ready",
        divisions: [{ code: "MPO" }],
        seasons: defaultSeasons,
        total: players.length,
        players,
      }}
      currentPage={1}
      sort={{
        field: "playerId",
        direction: "asc",
      }}
    />,
  );

  assert.match(firstPageMarkup, /aria-label="Пагинация игроков"/);
  assert.match(firstPageMarkup, /Показано 25 из 30 игроков\. Страница 1 из 2\./);
  assert.match(firstPageMarkup, /Player 25/);
  assert.doesNotMatch(firstPageMarkup, /Player 26/);

  const secondPageMarkup = renderToStaticMarkup(
    <PlayersPageView
      state={{
        status: "ready",
        divisions: [{ code: "MPO" }],
        seasons: defaultSeasons,
        total: players.length,
        players,
      }}
      currentPage={2}
      sort={{
        field: "playerId",
        direction: "asc",
      }}
    />,
  );

  assert.match(secondPageMarkup, /Показано 5 из 30 игроков\. Страница 2 из 2\./);
  assert.match(secondPageMarkup, /Player 26/);
  assert.doesNotMatch(secondPageMarkup, /Player 25/);
});

test("PlayersPageView renders filtered empty state when search has no matches", () => {
  const markup = renderToStaticMarkup(
    <PlayersPageView
      state={{
        status: "ready",
        divisions: [{ code: "MPO" }],
        seasons: defaultSeasons,
        total: 1,
        players: [
          {
            playerId: "player-500",
            playerName: "Pavel Orlov",
            division: "MPO",
            rdga: true,
            rdgaSince: "2026-01-15",
            seasonDivision: "MPO",
            seasonPoints: 42,
            competitionsCount: 7,
          },
        ],
      }}
      nameQuery="zzz"
    />,
  );

  assert.match(markup, /По текущему фильтру игроков нет/);
  assert.match(markup, /Попробуйте изменить имя, дивизион или фильтр RDGA/);
  assert.doesNotMatch(markup, /<table/);
});

test("PlayersPageView disables editing for guests", () => {
  const markup = renderToStaticMarkup(
    <PlayersPageView
      state={{
        status: "ready",
        divisions: [{ code: "MPO" }],
        seasons: defaultSeasons,
        total: 1,
        players: [
          {
            playerId: "player-500",
            playerName: "Pavel Orlov",
            division: "MPO",
            rdga: true,
            rdgaSince: "2026-01-15",
            seasonDivision: "MPO",
            seasonPoints: 42,
            competitionsCount: 2,
          },
        ],
      }}
      canEdit={false}
    />,
  );

  assert.doesNotMatch(markup, /<th scope="col">Действия<\/th>/);
  assert.doesNotMatch(markup, /players-table__division-select/);
  assert.doesNotMatch(markup, /type="checkbox"/);
  assert.doesNotMatch(markup, /Сохранить/);
  assert.match(markup, /<span class="players-table__readonly-value">MPO<\/span>/);
  assert.match(markup, /<span class="players-table__readonly-value">✓<\/span>/);
  assert.match(markup, /2026-01-15/);
});

test("PlayersPageView shows guest read-only values for missing division and RDGA false", () => {
  const markup = renderToStaticMarkup(
    <PlayersPageView
      state={{
        status: "ready",
        divisions: [{ code: "MPO" }],
        seasons: defaultSeasons,
        total: 1,
        players: [
          {
            playerId: "player-501",
            playerName: "Sergey Petrov",
            division: null,
            rdga: false,
            rdgaSince: null,
            seasonDivision: null,
            seasonPoints: null,
            competitionsCount: 2,
          },
        ],
      }}
      canEdit={false}
    />,
  );

  assert.match(markup, /Не выбран/);
  assert.match(markup, /<span class="players-table__readonly-value">—<\/span>/);
});

test("mergeUpdatedPlayer keeps read-side season metrics when update response is partial", () => {
  const merged = mergeUpdatedPlayer(
    {
      playerId: "player-777",
      playerName: "Olga Smirnova",
      division: "MPO",
      rdga: false,
      rdgaSince: null,
      seasonDivision: "MPO",
      seasonPoints: 111.25,
      seasonCreditPoints: 95.5,
      competitionsCount: 4,
      seasonCreditCompetitions: [
        {
          competitionId: "competition-1",
          competitionName: "Alpha Cup",
          placement: 1,
          seasonPoints: 60,
        },
      ],
    },
    {
      playerId: "player-777",
      playerName: "Olga Smirnova",
      division: "FA1",
      rdga: true,
      rdgaSince: "2026-03-01",
      seasonDivision: "FA1",
    },
  );

  assert.equal(merged.division, "FA1");
  assert.equal(merged.rdga, true);
  assert.equal(merged.rdgaSince, "2026-03-01");
  assert.equal(merged.seasonDivision, "FA1");
  assert.equal(merged.seasonPoints, 111.25);
  assert.equal(merged.seasonCreditPoints, 95.5);
  assert.equal(merged.competitionsCount, 4);
  assert.equal(merged.seasonCreditCompetitions?.length, 1);
});
