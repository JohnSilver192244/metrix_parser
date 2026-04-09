import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DivisionsPageView } from "./divisions-page";

test("DivisionsPageView renders empty state", () => {
  const markup = renderToStaticMarkup(
    <DivisionsPageView
      state={{
        status: "ready",
        divisions: [],
        total: 0,
      }}
    />,
  );

  assert.match(markup, /Пока нет дивизионов/);
  assert.match(markup, /Добавьте первый дивизион/);
});

test("DivisionsPageView renders readonly mode for guests", () => {
  const markup = renderToStaticMarkup(
    <DivisionsPageView
      state={{
        status: "ready",
        total: 2,
        divisions: [
          { code: "FPO" },
          { code: "MPO" },
        ],
      }}
      canEdit={false}
    />,
  );

  assert.match(markup, /Войдите в систему, чтобы добавлять, редактировать и удалять дивизионы/);
  assert.match(markup, />FPO</);
  assert.match(markup, />MPO</);
  assert.doesNotMatch(markup, /Добавить дивизион/);
  assert.doesNotMatch(markup, /Сохранить/);
  assert.doesNotMatch(markup, /Удалить/);
});

test("DivisionsPageView renders editable controls for authenticated users", () => {
  const markup = renderToStaticMarkup(
    <DivisionsPageView
      state={{
        status: "ready",
        total: 1,
        divisions: [{ code: "MA2" }],
      }}
      canEdit={true}
      createDraft="MA3"
      rowDrafts={{
        MA2: "MA40",
      }}
    />,
  );

  assert.match(markup, /Добавить дивизион/);
  assert.match(markup, /placeholder="Например, MA3"/);
  assert.match(markup, /value="MA40"/);
  assert.match(markup, /Сохранить/);
  assert.match(markup, /Удалить/);
});
