import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  CompetitionsPageView,
  resolveCompetitionExternalUrl,
} from "./competitions-page";

test("CompetitionsPageView renders the empty state when there is no data", () => {
  const markup = renderToStaticMarkup(
    <CompetitionsPageView
      state={{
        status: "ready",
        competitions: [],
        courseNamesById: {},
        total: 0,
      }}
      onNavigate={() => {}}
    />,
  );

  assert.match(markup, /Пока нет сохранённых соревнований/);
  assert.match(markup, /административном разделе/);
});

test("CompetitionsPageView renders saved competitions with key fields", () => {
  const markup = renderToStaticMarkup(
    <CompetitionsPageView
      state={{
        status: "ready",
        total: 1,
        courseNamesById: {
          "course-701": "Yaroslavl &rarr; Park",
        },
        competitions: [
          {
            competitionId: "competition-701",
            competitionName: "RDGA Spring &rarr; Tour",
            competitionDate: "2026-05-10",
            courseId: "course-701",
            courseName: null,
            recordType: "4",
            playersCount: 52,
            metrixId: "metrix-701",
          },
        ],
      }}
      onNavigate={() => {}}
    />,
  );

  assert.match(markup, /<table/);
  assert.match(markup, /Фильтры соревнований/);
  assert.match(markup, /Поиск по названию/);
  assert.match(markup, /Все парки/);
  assert.match(markup, /type="date"/);
  assert.match(markup, /data-table__link-button/);
  assert.match(markup, /data-table__external-link/);
  assert.match(markup, new RegExp(resolveCompetitionExternalUrl("competition-701")));
  assert.match(markup, /target="_blank"/);
  assert.match(markup, /RDGA Spring → Tour/);
  assert.match(markup, /10\.05\.2026/);
  assert.match(markup, /Yaroslavl → Park/);
  assert.match(markup, /52/);
  assert.match(markup, /Event/);
  assert.doesNotMatch(markup, /Metrix ID/);
  assert.doesNotMatch(markup, /metrix-701/);
});

test("CompetitionsPageView prompts to update parks when course is missing in parks table", () => {
  const markup = renderToStaticMarkup(
    <CompetitionsPageView
      state={{
        status: "ready",
        total: 1,
        courseNamesById: {},
        competitions: [
          {
            competitionId: "competition-702",
            competitionName: "RDGA Autumn Tour",
            competitionDate: "2026-09-21",
            courseId: "course-missing",
            courseName: null,
            recordType: "2",
            playersCount: 18,
            metrixId: "metrix-702",
          },
        ],
      }}
      onNavigate={() => {}}
    />,
  );

  assert.match(markup, /Обновите парки/);
});

test("CompetitionsPageView renders human-readable record type labels", () => {
  const markup = renderToStaticMarkup(
    <CompetitionsPageView
      state={{
        status: "ready",
        total: 2,
        courseNamesById: {},
        competitions: [
          {
            competitionId: "competition-801",
            competitionName: "Single Round Event",
            competitionDate: "2026-06-01",
            courseId: null,
            courseName: "Course A",
            recordType: "2",
            playersCount: 10,
            metrixId: null,
          },
          {
            competitionId: "competition-802",
            competitionName: "Main Event",
            competitionDate: "2026-06-02",
            courseId: null,
            courseName: "Course B",
            recordType: "4",
            playersCount: 20,
            metrixId: null,
          },
        ],
      }}
      onNavigate={() => {}}
    />,
  );

  assert.match(markup, /Single round event/);
  assert.match(markup, /Event/);
});
