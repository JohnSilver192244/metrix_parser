import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CoursesPageView } from "./courses-page";

test("CoursesPageView renders the empty state when there is no data", () => {
  const markup = renderToStaticMarkup(
    <CoursesPageView
      state={{
        status: "ready",
        courses: [],
        total: 0,
      }}
    />,
  );

  assert.match(markup, /Пока нет сохранённых парков/);
  assert.match(markup, /обновление парков/);
});

test("CoursesPageView renders persisted parks including coursePar", () => {
  const markup = renderToStaticMarkup(
    <CoursesPageView
      state={{
        status: "ready",
        total: 1,
        courses: [
          {
            courseId: "course-100",
            name: "Moscow &rarr; Park",
            fullname: "Moscow Disc Golf &rarr; Park",
            type: "18 &rarr; holes",
            countryCode: "RU",
            area: "Moscow &rarr; Region",
            ratingValue1: 4.9,
            ratingResult1: 12,
            ratingValue2: 4.7,
            ratingResult2: 8,
            coursePar: 60,
          },
        ],
      }}
    />,
  );

  assert.match(markup, /<table/);
  assert.match(markup, /Moscow → Park/);
  assert.match(markup, /Par 60/);
  assert.match(markup, /Moscow Disc Golf → Park/);
  assert.match(markup, /18 → holes/);
  assert.match(markup, /Moscow → Region/);
  assert.match(markup, /4\.9 \(12\)/);
});
