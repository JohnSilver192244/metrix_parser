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
            basketsCount: 18,
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
  assert.match(markup, /<th scope="col">Корзин<\/th>/);
  assert.match(markup, /18/);
  assert.match(markup, /<th scope="col">Рейтинг<\/th>/);
  assert.doesNotMatch(markup, /<th scope="col">Рейтинг 1<\/th>/);
  assert.doesNotMatch(markup, /<th scope="col">Рейтинг 2<\/th>/);
  assert.match(markup, />\?<\/button>/);
  assert.match(markup, /role="tooltip"/);
  assert.match(markup, /Рейтинг 1: 4\.9/);
  assert.match(markup, /Рейтинг 2: 4\.7/);
  assert.match(markup, /7\.3/);
});

test("CoursesPageView renders mobile filters drawer content when opened", () => {
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
            basketsCount: 18,
          },
        ],
      }}
      mobileFiltersOpen={true}
    />,
  );

  assert.match(markup, /Закрыть фильтры/);
  assert.match(markup, /Фильтры парков/);
  assert.match(markup, /Название парка/);
  assert.match(markup, /Регион/);
  assert.match(markup, /Все парки/);
  assert.match(markup, /Все регионы/);
});

test("CoursesPageView hides rating tooltip trigger when rating data is missing", () => {
  const markup = renderToStaticMarkup(
    <CoursesPageView
      state={{
        status: "ready",
        total: 1,
        courses: [
          {
            courseId: "course-101",
            name: "No Rating Park",
            fullname: null,
            type: null,
            countryCode: null,
            area: null,
            ratingValue1: null,
            ratingResult1: null,
            ratingValue2: null,
            ratingResult2: null,
            coursePar: 54,
            basketsCount: 12,
          },
        ],
      }}
    />,
  );

  assert.match(markup, /Нет данных/);
  assert.doesNotMatch(markup, /\(\?\)/);
  assert.doesNotMatch(markup, /role="tooltip"/);
});

test("CoursesPageView shows baskets count fallback when baskets are missing", () => {
  const markup = renderToStaticMarkup(
    <CoursesPageView
      state={{
        status: "ready",
        total: 1,
        courses: [
          {
            courseId: "course-102",
            name: "No Baskets Park",
            fullname: null,
            type: null,
            countryCode: null,
            area: null,
            ratingValue1: null,
            ratingResult1: null,
            ratingValue2: null,
            ratingResult2: null,
            coursePar: 54,
            basketsCount: null,
          },
        ],
      }}
    />,
  );

  assert.match(markup, /Нет данных/);
});
