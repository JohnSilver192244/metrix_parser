import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PlayersPageView } from "./players-page";

test("PlayersPageView renders the empty state when there is no data", () => {
  const markup = renderToStaticMarkup(
    <PlayersPageView
      state={{
        status: "ready",
        divisions: [],
        players: [],
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
        total: 1,
        players: [
          {
            playerId: "player-500",
            playerName: "Pavel &rarr; Orlov",
            division: "MPO",
            rdga: null,
            competitionsCount: 7,
          },
        ],
      }}
    />,
  );

  assert.match(markup, /<table/);
  assert.match(markup, /Pavel → Orlov/);
  assert.match(markup, /player-500/);
  assert.match(markup, /Metrix ID/);
  assert.match(markup, /Игрок/);
  assert.match(markup, /Дивизион/);
  assert.match(markup, /RDGA/);
  assert.match(markup, /Соревнований/);
  assert.match(markup, /Сохранить/);
  assert.match(markup, /MPO/);
  assert.match(markup, /type="checkbox"/);
  assert.match(markup, /Не выбран/);
  assert.match(markup, />7</);
});
