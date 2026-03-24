import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AdminUpdatesPage } from "./admin-updates-page";

test("AdminUpdatesPage renders one shared period block and three update actions", () => {
  const markup = renderToStaticMarkup(<AdminUpdatesPage />);

  assert.match(markup, /Обновление данных/);
  assert.match(markup, /Введите период и запустите нужное действие/);
  assert.match(markup, /name="shared-date-from"/);
  assert.match(markup, /name="shared-date-to"/);
  assert.match(markup, /Период/);
  assert.match(markup, />Соревнования</);
  assert.match(markup, />Парки</);
  assert.match(markup, />Игроки и Результаты</);
  assert.match(markup, /Причины пропуска записей при обновлении/);
  assert.match(markup, /Что может быть пропущено при обновлении/);
  assert.match(markup, /role="tooltip"/);
  assert.match(markup, /мастер-класс/);
  assert.match(markup, /master class/);
  assert.match(markup, /даблс/);
  assert.match(markup, /doubles/);
  assert.doesNotMatch(markup, />Игроки</);
  assert.doesNotMatch(markup, />Результаты</);
  assert.doesNotMatch(markup, /type="date"/);
});
