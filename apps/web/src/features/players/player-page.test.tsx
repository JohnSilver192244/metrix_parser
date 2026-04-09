import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  PlayerPageView,
  sortPlayerResultsRows,
  type PlayerResultsSort,
} from "./player-page";
import { resolveCompetitionExternalUrl } from "../competitions/competition-presenters";

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
            seasonPoints: 12.5,
          },
          {
            competitionId: "competition-102",
            competitionName: "Autumn Open",
            competitionDate: "2026-09-14",
            category: "B",
            placement: 1,
            sum: 48,
            dnf: false,
            seasonPoints: 44.5,
          },
        ],
        total: 2,
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
  assert.match(markup, /data-table__external-link/);
  assert.match(markup, /https:\/\/discgolfmetrix\.com\/player\/player-500/);
  assert.match(markup, /К списку игроков/);
  assert.match(markup, /Соревнование/);
  assert.match(markup, /Дата/);
  assert.match(markup, /Категория/);
  assert.match(markup, /Место/);
  assert.match(markup, /Очки ↓/);
  assert.match(markup, /Spring Open/);
  assert.match(markup, /Autumn Open/);
  assert.match(markup, new RegExp(resolveCompetitionExternalUrl("competition-102")));
  assert.match(markup, />A</);
  assert.match(markup, />2</);
  assert.match(markup, />44\.50</);

  const autumnOpenIndex = markup.indexOf("Autumn Open");
  const springOpenIndex = markup.indexOf("Spring Open");
  assert.notEqual(autumnOpenIndex, -1);
  assert.notEqual(springOpenIndex, -1);
  assert.ok(autumnOpenIndex < springOpenIndex);
});

test("sortPlayerResultsRows supports sorting by every column", () => {
  const rows = [
    {
      competitionId: "competition-201",
      competitionName: "Gamma Cup",
      competitionDate: "2026-06-10",
      category: "B",
      placement: 2,
      sum: 58,
      dnf: false,
      seasonPoints: 14,
    },
    {
      competitionId: "competition-202",
      competitionName: "Alpha Cup",
      competitionDate: "2026-08-10",
      category: "A",
      placement: 1,
      sum: 52,
      dnf: false,
      seasonPoints: 27,
    },
    {
      competitionId: "competition-203",
      competitionName: "Beta Cup",
      competitionDate: "2026-04-10",
      category: null,
      placement: null,
      sum: null,
      dnf: true,
      seasonPoints: null,
    },
  ];

  const cases: ReadonlyArray<{
    sort: PlayerResultsSort;
    expectedOrder: readonly string[];
  }> = [
    {
      sort: { field: "competitionName", direction: "asc" },
      expectedOrder: ["competition-202", "competition-203", "competition-201"],
    },
    {
      sort: { field: "competitionDate", direction: "desc" },
      expectedOrder: ["competition-202", "competition-201", "competition-203"],
    },
    {
      sort: { field: "category", direction: "asc" },
      expectedOrder: ["competition-203", "competition-202", "competition-201"],
    },
    {
      sort: { field: "placement", direction: "asc" },
      expectedOrder: ["competition-202", "competition-201", "competition-203"],
    },
    {
      sort: { field: "seasonPoints", direction: "desc" },
      expectedOrder: ["competition-202", "competition-201", "competition-203"],
    },
  ];

  for (const entry of cases) {
    const ordered = sortPlayerResultsRows(rows, entry.sort).map((row) => row.competitionId);
    assert.deepEqual(ordered, entry.expectedOrder);
  }
});
