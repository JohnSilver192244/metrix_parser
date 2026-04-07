import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { SeasonConfigPageView } from "./season-config-page";

test("SeasonConfigPageView renders empty blocks when data is missing", () => {
  const markup = renderToStaticMarkup(
    <SeasonConfigPageView
      state={{
        status: "ready",
        seasons: [],
        seasonsTotal: 0,
        pointsEntries: [],
        pointsTotal: 0,
      }}
      selectedSeasonCode=""
      selectedPlayersCount={null}
    />,
  );

  assert.match(markup, /Пока нет сезонов/);
  assert.match(markup, /Нет строк для выбранного фильтра/);
});

test("SeasonConfigPageView renders readonly data for guests", () => {
  const markup = renderToStaticMarkup(
    <SeasonConfigPageView
      state={{
        status: "ready",
        seasons: [
          {
            seasonCode: "2026",
            name: "Сезон РДГА 2026",
            dateFrom: "2026-04-01",
            dateTo: "2026-11-01",
            bestLeaguesCount: 4,
            bestTournamentsCount: 4,
            minPlayers: 8,
          },
        ],
        seasonsTotal: 1,
        pointsEntries: [
          {
            seasonCode: "2026",
            playersCount: 32,
            placement: 1,
            points: 75,
          },
        ],
        pointsTotal: 1,
      }}
      canEdit={false}
      selectedSeasonCode="2026"
      accrualSeasonCode="2026"
      selectedPlayersCount={32}
    />,
  );

  assert.match(markup, /Сезон РДГА 2026/);
  assert.match(markup, />32</);
  assert.match(markup, />75\.00</);
  assert.match(markup, /Сезоны добавляются и изменяются только миграциями БД/);
  assert.match(markup, /Таблица редактируется только миграциями БД/);
  assert.doesNotMatch(markup, /Начислить очки/);
  assert.doesNotMatch(markup, /Добавить сезон/);
  assert.doesNotMatch(markup, /Добавить строку/);
});

test("SeasonConfigPageView renders create controls and editable rows for admins", () => {
  const markup = renderToStaticMarkup(
    <SeasonConfigPageView
      state={{
        status: "ready",
        seasons: [
          {
            seasonCode: "2026",
            name: "Сезон РДГА 2026",
            dateFrom: "2026-04-01",
            dateTo: "2026-11-01",
            bestLeaguesCount: 4,
            bestTournamentsCount: 4,
            minPlayers: 8,
          },
        ],
        seasonsTotal: 1,
        pointsEntries: [
          {
            seasonCode: "2026",
            playersCount: 32,
            placement: 1,
            points: 75,
          },
        ],
        pointsTotal: 1,
      }}
      canEdit={true}
      canRunAccrual={true}
      selectedSeasonCode="2026"
      accrualSeasonCode="2026"
      selectedPlayersCount={32}
      seasonCreateDraft={{
        seasonCode: "2027",
        name: "Сезон РДГА 2027",
        dateFrom: "2027-04-01",
        dateTo: "2027-11-01",
        bestLeaguesCount: "4",
        bestTournamentsCount: "4",
        minPlayers: "8",
      }}
      seasonRowDrafts={{
        "2026": {
          seasonCode: "2026",
          name: "Сезон РДГА 2026",
          dateFrom: "2026-04-01",
          dateTo: "2026-11-01",
          bestLeaguesCount: "4",
          bestTournamentsCount: "4",
          minPlayers: "8",
        },
      }}
      pointsCreateDraft={{
        seasonCode: "2026",
        playersCount: "32",
        placement: "2",
        points: "64.50",
      }}
      pointsRowDrafts={{
        "2026:32:1": {
          seasonCode: "2026",
          playersCount: "32",
          placement: "1",
          points: "75.00",
        },
      }}
    />,
  );

  assert.match(markup, /Сезоны добавляются и изменяются только миграциями БД/);
  assert.match(markup, /Таблица редактируется только миграциями БД/);
  assert.match(markup, /Сезон РДГА 2026/);
  assert.match(markup, /Начислить очки/);
  assert.match(markup, /Сезон для начисления/);
  assert.match(markup, /Пересчитать уже начисленные очки/);
  assert.doesNotMatch(markup, /Добавить сезон/);
  assert.doesNotMatch(markup, /aria-label="Сохранить сезон"/);
  assert.doesNotMatch(markup, /aria-label="Удалить сезон"/);
  assert.doesNotMatch(markup, /Добавить строку/);
  assert.doesNotMatch(markup, /aria-label="Сохранить строку"/);
  assert.doesNotMatch(markup, /aria-label="Удалить строку"/);
});
