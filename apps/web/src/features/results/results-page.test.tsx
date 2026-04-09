import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ResultsPageView } from "./results-page";

test("ResultsPageView renders the empty state when there is no data", () => {
  const markup = renderToStaticMarkup(
    <ResultsPageView
      state={{
        status: "ready",
        results: [],
        total: 0,
      }}
    />,
  );

  assert.match(markup, /Пока нет сохранённых результатов/);
  assert.match(markup, /обновление результатов/);
});

test("ResultsPageView renders result fields and explicit DNF state", () => {
  const markup = renderToStaticMarkup(
    <ResultsPageView
      state={{
        status: "ready",
        total: 2,
        results: [
          {
            competitionId: "competition-100",
            playerId: "player-100",
            competitionName: "Spring &rarr; Open",
            playerName: "Ivan &rarr; Ivanov",
            playerRdga: true,
            className: "MPO",
            sum: 54,
            diff: -6,
            dnf: false,
          },
          {
            competitionId: "competition-100",
            playerId: "player-101",
            competitionName: "Spring &rarr; Open",
            playerName: "Anna &rarr; Petrova",
            playerRdga: null,
            className: "FPO",
            sum: null,
            diff: null,
            dnf: true,
          },
        ],
      }}
    />,
  );

  assert.match(markup, /<table/);
  assert.match(markup, /Spring → Open/);
  assert.match(markup, /Ivan → Ivanov/);
  assert.match(markup, /RDGA/);
  assert.match(markup, /MPO/);
  assert.match(markup, /54/);
  assert.match(markup, /-6/);
  assert.match(markup, /DNF/);
  assert.match(markup, /Не завершил раунд/);
});

test("ResultsPageView filters results by RDGA", () => {
  const markup = renderToStaticMarkup(
    <ResultsPageView
      state={{
        status: "ready",
        total: 2,
        results: [
          {
            competitionId: "competition-100",
            playerId: "player-100",
            competitionName: "Spring Open",
            playerName: "Ivan Ivanov",
            playerRdga: true,
            className: "MPO",
            sum: 54,
            diff: -6,
            dnf: false,
          },
          {
            competitionId: "competition-100",
            playerId: "player-101",
            competitionName: "Spring Open",
            playerName: "Anna Petrova",
            playerRdga: null,
            className: "FPO",
            sum: 60,
            diff: 0,
            dnf: false,
          },
        ],
      }}
      rdgaFilter="rdga"
    />,
  );

  assert.match(markup, /Только RDGA/);
  assert.match(markup, /Ivan Ivanov/);
  assert.doesNotMatch(markup, /Anna Petrova/);
});
