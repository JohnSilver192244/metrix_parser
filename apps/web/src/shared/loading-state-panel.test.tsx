import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { LoadingStatePanel } from "./loading-state-panel";

test("LoadingStatePanel renders a visual skeleton without loading text", () => {
  const markup = renderToStaticMarkup(
    <LoadingStatePanel label="Загружаем страницу" rows={3} />,
  );

  assert.match(markup, /aria-label="Загружаем страницу"/);
  assert.match(markup, /loading-state__spinner/);
  assert.match(markup, /loading-state__skeleton--row/);
  assert.doesNotMatch(markup, />loading</);
  assert.doesNotMatch(markup, /state-panel__eyebrow/);
});
