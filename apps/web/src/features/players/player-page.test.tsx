import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PlayerPageView } from "./player-page";

test("PlayerPageView renders player header, filters, and results table", () => {
  const markup = renderToStaticMarkup(
    <PlayerPageView
      headerState={{
        status: "ready",
        player: {
          playerId: "player-500",
          playerName: "Sergey &amp; Ivanov",
          division: "MPO",
        },
        seasons: [
          {
            seasonCode: "2026",
            name: "Сезон 2026",
            dateFrom: "2026-01-01",
            dateTo: "2026-12-31",
            bestLeaguesCount: 3,
            bestTournamentsCount: 3,
            minPlayers: 8,
          },
        ],
      }}
      resultsState={{
        status: "ready",
        rows: [
          {
            competitionId: "competition-101",
            competitionName: "Spring Open",
            competitionDate: "2026-04-14",
            category: "A",
            placement: 2,
            sum: 54,
            dnf: false,
            seasonPoints: 44.5,
          },
        ],
        total: 1,
      }}
      seasonCode="2026"
      period={{
        dateFrom: "2026-01-01",
        dateTo: "2026-12-31",
      }}
      onNavigate={() => {}}
    />,
  );

  assert.match(markup, /Sergey &amp; Ivanov|Sergey & Ivanov/);
  assert.match(markup, /Metrix ID: player-500/);
  assert.match(markup, /К списку игроков/);
  assert.match(markup, /Соревнование/);
  assert.match(markup, /Дата/);
  assert.match(markup, /Категория/);
  assert.match(markup, /Место/);
  assert.match(markup, /Очки/);
  assert.match(markup, /Spring Open/);
  assert.match(markup, />A</);
  assert.match(markup, />2</);
  assert.match(markup, />44\.50</);
});
