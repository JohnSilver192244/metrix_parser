import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { SettingsPage } from "./settings-page";

test("SettingsPage renders one-page step layout without tabs", () => {
  const markup = renderToStaticMarkup(<SettingsPage />);

  assert.match(markup, /Настройки/);
  assert.match(markup, /Шаг 1/);
  assert.match(markup, /Шаг 2/);
  assert.match(markup, /Шаг 3/);
  assert.match(markup, /Проверь категории турниров и дивизионы/);
  assert.match(markup, /Обнови данные/);
  assert.match(markup, /Начисли очки сезона/);
  assert.doesNotMatch(markup, /settings-page__tab/);
});
