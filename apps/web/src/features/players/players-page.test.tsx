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

  assert.match(markup, /Поиск по имени/);
  assert.match(markup, /type="search"/);
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

test("PlayersPageView filters players by name substring case-insensitively", () => {
  const markup = renderToStaticMarkup(
    <PlayersPageView
      state={{
        status: "ready",
        divisions: [{ code: "MPO" }],
        total: 2,
        players: [
          {
            playerId: "player-500",
            playerName: "Pavel Orlov",
            division: "MPO",
            rdga: true,
            competitionsCount: 7,
          },
          {
            playerId: "player-501",
            playerName: "Sergey Petrov",
            division: "MPO",
            rdga: false,
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
        total: 3,
        players: [
          {
            playerId: "player-500",
            playerName: "Pavel Orlov",
            division: "MPO",
            rdga: true,
            competitionsCount: 7,
          },
          {
            playerId: "player-501",
            playerName: "Sergey Petrov",
            division: "MA2",
            rdga: false,
            competitionsCount: 5,
          },
          {
            playerId: "player-502",
            playerName: "Ivan Sidorov",
            division: "MA2",
            rdga: null,
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

test("PlayersPageView renders filtered empty state when search has no matches", () => {
  const markup = renderToStaticMarkup(
    <PlayersPageView
      state={{
        status: "ready",
        divisions: [{ code: "MPO" }],
        total: 1,
        players: [
          {
            playerId: "player-500",
            playerName: "Pavel Orlov",
            division: "MPO",
            rdga: true,
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
        total: 1,
        players: [
          {
            playerId: "player-500",
            playerName: "Pavel Orlov",
            division: "MPO",
            rdga: true,
            competitionsCount: 2,
          },
        ],
      }}
      canEdit={false}
    />,
  );

  assert.match(markup, /Войдите в систему, чтобы менять дивизион и RDGA/);
  assert.match(markup, /<select[^>]*disabled/);
  assert.match(markup, /<input[^>]*type="checkbox"[^>]*disabled/);
  assert.match(markup, /<button[^>]*disabled/);
});
