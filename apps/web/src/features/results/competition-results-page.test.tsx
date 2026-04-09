import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  CompetitionResultsPageView,
  resolveCompetitionDisplayContext,
  resolveCompetitionResults,
  sortCompetitionResults,
} from "./competition-results-page";
import { resolveCompetitionExternalUrl } from "../competitions/competition-presenters";

test("sortCompetitionResults moves DNF entries to the end", () => {
  const ordered = sortCompetitionResults([
    {
      competitionId: "competition-100",
      playerId: "player-101",
      playerName: "Anna Petrova",
      className: "FPO",
      sum: null,
      diff: null,
      placement: null,
      placementLabel: "DNF",
      dnf: true,
    },
    {
      competitionId: "competition-100",
      playerId: "player-100",
      playerName: "Ivan Ivanov",
      className: "MPO",
      sum: 54,
      diff: -6,
      placement: 1,
      placementLabel: "1",
      dnf: false,
    },
  ]);

  assert.equal(ordered[0]?.playerId, "player-100");
  assert.equal(ordered[1]?.playerId, "player-101");
});

test("sortCompetitionResults supports diff and placement sorting", () => {
  const results = [
    {
      competitionId: "competition-100",
      playerId: "player-101",
      playerName: "Anna Petrova",
      className: "FPO",
      sum: 60,
      diff: 0,
      placement: 2,
      placementLabel: "2",
      dnf: false,
    },
    {
      competitionId: "competition-100",
      playerId: "player-100",
      playerName: "Ivan Ivanov",
      className: "MPO",
      sum: 54,
      diff: -6,
      placement: 1,
      placementLabel: "T1",
      dnf: false,
    },
    {
      competitionId: "competition-100",
      playerId: "player-102",
      playerName: "Boris Sidorov",
      className: "MA3",
      sum: null,
      diff: null,
      placement: null,
      placementLabel: "DNF",
      dnf: true,
    },
    {
      competitionId: "competition-100",
      playerId: "player-103",
      playerName: "Petr Petrov",
      className: "FPO",
      sum: 58,
      diff: -2,
      placement: 1,
      placementLabel: "T1",
      dnf: false,
    },
  ];

  assert.deepEqual(
    sortCompetitionResults(results, {
      field: "diff",
      direction: "asc",
    }).map((item) => item.playerId),
    ["player-100", "player-103", "player-101", "player-102"],
  );
  assert.deepEqual(
    sortCompetitionResults(results, {
      field: "placement",
      direction: "desc",
    }).map((item) => item.playerId),
    ["player-101", "player-100", "player-103", "player-102"],
  );
});

test("CompetitionResultsPageView renders competition header and result table", () => {
  const markup = renderToStaticMarkup(
    <CompetitionResultsPageView
      state={{
        status: "ready",
        competition: {
          competitionId: "competition-100",
          competitionName: "Spring &rarr; Open",
          competitionDate: "2026-05-10",
          courseId: "course-10",
          courseName: null,
          recordType: "2",
          playersCount: 2,
          metrixId: "metrix-100",
        },
        courseName: "Yaroslavl &rarr; Park",
        results: [
          {
            competitionId: "competition-100",
            playerId: "player-101",
            playerName: "Anna &rarr; Petrova",
            className: "FPO",
            sum: null,
            diff: null,
            placement: null,
            placementLabel: "DNF",
            dnf: true,
            seasonPoints: null,
          },
          {
            competitionId: "competition-100",
            playerId: "player-100",
            playerName: "Ivan &rarr; Ivanov",
            className: "MPO",
            sum: 54,
            diff: -6,
            placement: 1,
            placementLabel: "1",
            dnf: false,
            seasonPoints: 46.5,
          },
        ],
      }}
      onNavigate={() => {}}
      sourcePlayer={{
        playerId: "player-100",
        playerName: "Ivan &rarr; Ivanov",
      }}
    />,
  );

  assert.match(markup, /Хлебные крошки/);
  assert.match(markup, />Игроки</);
  assert.match(markup, /Ivan → Ivanov/);
  assert.match(markup, /Spring → Open/);
  assert.match(markup, /data-table__external-link/);
  assert.match(markup, new RegExp(resolveCompetitionExternalUrl("competition-100")));
  assert.match(markup, /10\.05\.2026 · Yaroslavl → Park · Single round event/);
  assert.match(markup, /data-table__sort-button/);
  assert.match(markup, /Место ▲/);
  assert.match(markup, /Очки/);
  assert.match(markup, /Раунд/);
  assert.match(markup, /Результат/);
  assert.match(markup, /Ivan → Ivanov/);
  assert.match(markup, /Anna → Petrova/);
  assert.match(markup, /DNF/);
  assert.match(markup, />46\.50</);
  assert.match(markup, /—/);
  assert.ok(markup.indexOf("Ivan → Ivanov") < markup.indexOf("Anna → Petrova"));
});

test("CompetitionResultsPageView renders the parent competition comment in detail view", () => {
  const markup = renderToStaticMarkup(
    <CompetitionResultsPageView
      state={{
        status: "ready",
        competition: {
          competitionId: "competition-100",
          competitionName: "Spring &rarr; Open",
          competitionDate: "2026-05-10",
          courseId: "course-10",
          courseName: null,
          recordType: "2",
          playersCount: 2,
          metrixId: "metrix-100",
        },
        comment: "Не удалось получить результаты.",
        courseName: "Yaroslavl &rarr; Park",
        results: [],
      }}
      onNavigate={() => {}}
    />,
  );

  assert.match(markup, /Не удалось получить результаты\./);
});

test("resolveCompetitionResults aggregates event rounds by player and ranks by total sum", () => {
  const aggregated = resolveCompetitionResults(
    {
      competitionId: "event-100",
      competitionName: "March Event",
      competitionDate: "2026-03-22",
      parentId: null,
      courseId: null,
      courseName: null,
      recordType: "4",
      playersCount: 4,
      metrixId: null,
    },
    [
      {
        competitionId: "event-100",
        competitionName: "March Event",
        competitionDate: "2026-03-22",
        parentId: null,
        courseId: null,
        courseName: null,
        recordType: "4",
        playersCount: 4,
        metrixId: null,
      },
      {
        competitionId: "round-1",
        competitionName: "Round 1",
        competitionDate: "2026-03-22",
        parentId: "event-100",
        courseId: null,
        courseName: null,
        recordType: "1",
        playersCount: 4,
        metrixId: null,
      },
      {
        competitionId: "round-2",
        competitionName: "Round 2",
        competitionDate: "2026-03-22",
        parentId: "event-100",
        courseId: null,
        courseName: null,
        recordType: "1",
        playersCount: 4,
        metrixId: null,
      },
    ],
    {
      "round-1": [
        {
          competitionId: "round-1",
          playerId: "player-1",
          playerName: "Egor Mikushin",
          className: "MPO",
          sum: 54,
          diff: -6,
          dnf: false,
          seasonPoints: 52.9,
        },
        {
          competitionId: "round-1",
          playerId: "player-2",
          playerName: "Ivan Ivanov",
          className: "MPO",
          sum: 56,
          diff: -4,
          dnf: false,
          seasonPoints: 44.1,
        },
        {
          competitionId: "round-1",
          playerId: "player-3",
          playerName: "Anna Petrova",
          className: "FPO",
          sum: 61,
          diff: 1,
          dnf: false,
          seasonPoints: 38,
        },
        {
          competitionId: "round-1",
          playerId: "player-4",
          playerName: "Boris Sidorov",
          className: "MPO",
          sum: null,
          diff: null,
          dnf: true,
        },
      ],
      "round-2": [
        {
          competitionId: "round-2",
          playerId: "player-1",
          playerName: "Egor Mikushin",
          className: "MPO",
          sum: 53,
          diff: -7,
          dnf: false,
          seasonPoints: 52.9,
        },
        {
          competitionId: "round-2",
          playerId: "player-2",
          playerName: "Ivan Ivanov",
          className: "MPO",
          sum: 55,
          diff: -5,
          dnf: false,
          seasonPoints: 44.1,
        },
        {
          competitionId: "round-2",
          playerId: "player-3",
          playerName: "Anna Petrova",
          className: "FPO",
          sum: 60,
          diff: 0,
          dnf: false,
          seasonPoints: 38,
        },
        {
          competitionId: "round-2",
          playerId: "player-4",
          playerName: "Boris Sidorov",
          className: "MPO",
          sum: null,
          diff: null,
          dnf: true,
        },
      ],
    },
  );

  const egor = aggregated.find((result) => result.playerId === "player-1");
  const ivan = aggregated.find((result) => result.playerId === "player-2");
  const anna = aggregated.find((result) => result.playerId === "player-3");
  const boris = aggregated.find((result) => result.playerId === "player-4");

  assert.equal(egor?.competitionId, "event-100");
  assert.equal(egor?.sum, 107);
  assert.equal(egor?.diff, -13);
  assert.equal(egor?.placement, 1);
  assert.equal(egor?.seasonPoints, 52.9);
  assert.deepEqual(egor?.roundBreakdown, [
    {
      roundId: "round-1",
      roundName: "Round 1",
      diff: -6,
    },
    {
      roundId: "round-2",
      roundName: "Round 2",
      diff: -7,
    },
  ]);

  assert.equal(ivan?.sum, 111);
  assert.equal(ivan?.diff, -9);
  assert.equal(ivan?.placement, 2);
  assert.equal(ivan?.seasonPoints, 44.1);

  assert.equal(anna?.sum, 121);
  assert.equal(anna?.diff, 1);
  assert.equal(anna?.placement, 3);
  assert.equal(anna?.seasonPoints, 38);

  assert.equal(boris?.dnf, true);
  assert.equal(boris?.sum, null);
  assert.equal(boris?.placement, null);
});

test("resolveCompetitionDisplayContext maps parent -> pool -> rounds to a combined title", () => {
  const context = resolveCompetitionDisplayContext(
    {
      competitionId: "event-100",
      competitionName: "Tour 2026 &rarr; Stage 1",
      competitionDate: "2026-04-26",
      parentId: null,
      courseId: null,
      courseName: null,
      recordType: "4",
      playersCount: null,
      metrixId: null,
    },
    [
      {
        competitionId: "event-100",
        competitionName: "Tour 2026 &rarr; Stage 1",
        competitionDate: "2026-04-26",
        parentId: null,
        courseId: null,
        courseName: null,
        recordType: "4",
        playersCount: null,
        metrixId: null,
      },
      {
        competitionId: "pool-100",
        competitionName: "Tour 2026 &rarr; Stage 1 &rarr; Experienced",
        competitionDate: "2026-04-26",
        parentId: "event-100",
        courseId: null,
        courseName: null,
        recordType: "3",
        playersCount: null,
        metrixId: null,
      },
      {
        competitionId: "round-1",
        competitionName: "Round 1",
        competitionDate: "2026-04-26",
        parentId: "pool-100",
        courseId: null,
        courseName: null,
        recordType: "1",
        playersCount: null,
        metrixId: null,
      },
      {
        competitionId: "round-2",
        competitionName: "Round 2",
        competitionDate: "2026-04-26",
        parentId: "pool-100",
        courseId: null,
        courseName: null,
        recordType: "1",
        playersCount: null,
        metrixId: null,
      },
    ],
  );

  assert.equal(context.competition.competitionId, "pool-100");
  assert.equal(context.competition.competitionName, "Stage 1 · Experienced");
  assert.deepEqual(context.resultCompetitionIds, ["round-1", "round-2"]);
});

test("CompetitionResultsPageView keeps the parent comment when event detail is displayed through a pool title", () => {
  const markup = renderToStaticMarkup(
    <CompetitionResultsPageView
      state={{
        status: "ready",
        competition: {
          competitionId: "pool-100",
          competitionName: "Stage 1 · Experienced",
          competitionDate: "2026-04-26",
          parentId: "event-100",
          courseId: null,
          courseName: null,
          recordType: "3",
          playersCount: 3,
          metrixId: null,
        },
        comment: "Нельзя сохранить результаты: в пулах меньше 8 игроков.",
        courseName: "Pioneer experiment",
        results: [],
      }}
      onNavigate={() => {}}
    />,
  );

  assert.match(markup, /Stage 1 · Experienced/);
  assert.match(markup, /Нельзя сохранить результаты: в пулах меньше 8 игроков\./);
});

test("resolveCompetitionResults aggregates pool rounds by player", () => {
  const aggregated = resolveCompetitionResults(
    {
      competitionId: "pool-100",
      competitionName: "Stage 1 · Experienced",
      competitionDate: "2026-04-26",
      parentId: "event-100",
      courseId: null,
      courseName: null,
      recordType: "3",
      playersCount: 3,
      metrixId: null,
    },
    [
      {
        competitionId: "round-1",
        competitionName: "Round 1",
        competitionDate: "2026-04-26",
        parentId: "pool-100",
        courseId: null,
        courseName: null,
        recordType: "1",
        playersCount: null,
        metrixId: null,
      },
      {
        competitionId: "round-2",
        competitionName: "Round 2",
        competitionDate: "2026-04-26",
        parentId: "pool-100",
        courseId: null,
        courseName: null,
        recordType: "1",
        playersCount: null,
        metrixId: null,
      },
    ],
    {
      "round-1": [
        {
          competitionId: "round-1",
          playerId: "player-1",
          playerName: "Player 1",
          className: "MPO",
          sum: 55,
          diff: -3,
          dnf: false,
          seasonPoints: 66.4,
        },
        {
          competitionId: "round-1",
          playerId: "player-2",
          playerName: "Player 2",
          className: "MPO",
          sum: 60,
          diff: 2,
          dnf: false,
          seasonPoints: 0,
        },
      ],
      "round-2": [
        {
          competitionId: "round-2",
          playerId: "player-1",
          playerName: "Player 1",
          className: "MPO",
          sum: 54,
          diff: -4,
          dnf: false,
          seasonPoints: 66.4,
        },
        {
          competitionId: "round-2",
          playerId: "player-2",
          playerName: "Player 2",
          className: "MPO",
          sum: null,
          diff: null,
          dnf: true,
          seasonPoints: 0,
        },
      ],
    },
  );

  assert.equal(aggregated[0]?.playerId, "player-1");
  assert.equal(aggregated[0]?.sum, 109);
  assert.equal(aggregated[0]?.placement, 1);
  assert.equal(aggregated[0]?.seasonPoints, 66.4);
  assert.equal(aggregated[1]?.playerId, "player-2");
  assert.equal(aggregated[1]?.dnf, true);
  assert.equal(aggregated[1]?.seasonPoints, 0);
});

test("resolveCompetitionResults calculates tie placements from sum", () => {
  const resolved = resolveCompetitionResults(
    {
      competitionId: "competition-100",
      competitionName: "Spring Open",
      competitionDate: "2026-05-10",
      parentId: null,
      courseId: null,
      courseName: null,
      recordType: "2",
      playersCount: 4,
      metrixId: null,
    },
    [],
    {
      "competition-100": [
        {
          competitionId: "competition-100",
          playerId: "player-1",
          playerName: "Egor Mikushin",
          className: "MPO",
          sum: 52,
          diff: -8,
          dnf: false,
        },
        {
          competitionId: "competition-100",
          playerId: "player-2",
          playerName: "Ivan Ivanov",
          className: "MPO",
          sum: 54,
          diff: -6,
          dnf: false,
        },
        {
          competitionId: "competition-100",
          playerId: "player-3",
          playerName: "Petr Petrov",
          className: "MPO",
          sum: 54,
          diff: -5,
          dnf: false,
        },
        {
          competitionId: "competition-100",
          playerId: "player-4",
          playerName: "Boris Sidorov",
          className: "MPO",
          sum: 60,
          diff: 0,
          dnf: false,
        },
      ],
    },
  );

  assert.deepEqual(
    resolved.map((result) => ({
      playerId: result.playerId,
      placementLabel: result.placementLabel,
    })),
    [
      {
        playerId: "player-1",
        placementLabel: "1",
      },
      {
        playerId: "player-2",
        placementLabel: "T2",
      },
      {
        playerId: "player-3",
        placementLabel: "T2",
      },
      {
        playerId: "player-4",
        placementLabel: "4",
      },
    ],
  );
});

test("CompetitionResultsPageView renders round breakdown rows for event results", () => {
  const markup = renderToStaticMarkup(
    <CompetitionResultsPageView
      state={{
        status: "ready",
        competition: {
          competitionId: "event-100",
          competitionName: "Это первый!",
          competitionDate: "2026-03-22",
          parentId: null,
          courseId: null,
          courseName: "Dunes 921",
          recordType: "4",
          playersCount: 2,
          metrixId: null,
        },
        courseName: "Dunes 921",
        results: [
          {
            competitionId: "event-100",
            playerId: "player-1",
            playerName: "Egor Mikushin",
            className: null,
            sum: 78,
            diff: -4,
            placement: 1,
            placementLabel: "1",
            dnf: false,
            roundBreakdown: [
              {
                roundId: "round-1",
                roundName: "Round 1",
                diff: -1,
              },
              {
                roundId: "round-2",
                roundName: "Round 2",
                diff: -3,
              },
            ],
          },
        ],
      }}
      onNavigate={() => {}}
    />,
  );

  assert.match(markup, /Egor Mikushin/);
  assert.doesNotMatch(markup, /Class/);
  assert.doesNotMatch(markup, /Не указан/);
  assert.match(markup, />78</);
  assert.match(markup, />-4</);
  assert.match(markup, /<td>Round 1<\/td>/);
  assert.match(markup, /<td>-1<\/td>/);
  assert.match(markup, /Round 1/);
  assert.match(markup, /Round 2/);
  assert.match(markup, />-3</);
  assert.ok(markup.indexOf("Round 1") < markup.indexOf("Round 2"));
});
