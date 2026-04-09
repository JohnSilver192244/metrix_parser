import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { TournamentCategoriesPageView } from "./tournament-categories-page";

test("TournamentCategoriesPageView renders the empty state when there is no data", () => {
  const markup = renderToStaticMarkup(
    <TournamentCategoriesPageView
      state={{
        status: "ready",
        categories: [],
        total: 0,
      }}
    />,
  );

  assert.match(markup, /Пока нет категорий турниров/);
  assert.match(markup, /Добавьте первую категорию/);
});

test("TournamentCategoriesPageView renders readonly rows for guests", () => {
  const markup = renderToStaticMarkup(
    <TournamentCategoriesPageView
      state={{
        status: "ready",
        total: 1,
        categories: [
          {
            categoryId: "category-100",
            name: "Любительские",
            description: "Турниры начального уровня.",
            competitionClass: "tournament",
            segmentsCount: 18,
            ratingGte: 72.5,
            ratingLt: 84.3,
            coefficient: 1.15,
          },
        ],
      }}
      canEdit={false}
    />,
  );

  assert.match(markup, /Войдите в систему, чтобы добавлять, редактировать и удалять категории/);
  assert.match(markup, /Любительские/);
  assert.match(markup, /Турниры начального уровня/);
  assert.match(markup, />Турнир</);
  assert.match(markup, />18</);
  assert.match(markup, />72\.5</);
  assert.match(markup, />84\.3</);
  assert.match(markup, />1\.15</);
  assert.doesNotMatch(markup, /Действия/);
  assert.doesNotMatch(markup, /Сохранить/);
  assert.doesNotMatch(markup, /Удалить/);
});

test("TournamentCategoriesPageView renders create form and editable inputs for authenticated users", () => {
  const markup = renderToStaticMarkup(
    <TournamentCategoriesPageView
      state={{
        status: "ready",
        total: 1,
        categories: [
          {
            categoryId: "category-100",
            name: "Профессиональные",
            description: "Категория для сильных составов.",
            competitionClass: "league",
            segmentsCount: 21,
            ratingGte: 85,
            ratingLt: 999,
            coefficient: 1.25,
          },
        ],
      }}
      canEdit={true}
      createDraft={{
        name: "Новая категория",
        description: "Описание",
        competitionClass: "tournament",
        segmentsCount: "18",
        ratingGte: "70.5",
        ratingLt: "84.3",
        coefficient: "1.10",
      }}
      rowDrafts={{
        "category-100": {
          name: "Профессиональные",
          description: "Категория для сильных составов.",
          competitionClass: "league",
          segmentsCount: "21",
          ratingGte: "85",
          ratingLt: "999",
          coefficient: "1.25",
        },
      }}
    />,
  );

  assert.match(markup, /Добавить категорию/);
  assert.match(markup, /placeholder="Например, Любительские"/);
  assert.match(markup, /Кол-во отрезков/);
  assert.match(markup, /Рейтинг &gt;=/);
  assert.match(markup, /Рейтинг &lt;/);
  assert.match(markup, /<option value="league" selected="">Лига<\/option>/);
  assert.match(markup, /Коэффициент/);
  assert.match(markup, /value="Профессиональные"/);
  assert.match(markup, /value="21"/);
  assert.match(markup, /value="85"/);
  assert.match(markup, /value="999"/);
  assert.match(markup, /value="1.25"/);
  assert.match(markup, /aria-label="Сохранить категорию"/);
  assert.match(markup, /aria-label="Удалить категорию"/);
  assert.match(markup, /<span aria-hidden="true">✓<\/span>/);
  assert.match(markup, /<span aria-hidden="true">×<\/span>/);
  assert.doesNotMatch(markup, />Сохранить<\/button>/);
  assert.doesNotMatch(markup, />Удалить<\/button>/);
});
