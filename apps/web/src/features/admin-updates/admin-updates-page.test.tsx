import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AdminUpdatesPage } from "./admin-updates-page";

test("AdminUpdatesPage renders one shared period block and three update actions", () => {
  const markup = renderToStaticMarkup(<AdminUpdatesPage />);

  assert.match(markup, /Обновление данных/);
  assert.match(markup, /Выберите период и запустите нужные операции обновления/);
  assert.match(markup, /name="shared-date-from"/);
  assert.match(markup, /name="shared-date-to"/);
  assert.match(markup, /Период/);
  assert.match(markup, /Не выбран/);
  assert.match(markup, /Перезаписать имеющиеся данные/);
  assert.match(markup, /type="checkbox"/);
  assert.match(markup, /Сначала выберите диапазон дат \(максимум 14 дней\)/);
  assert.match(markup, /disabled=""/);
  assert.match(markup, />Соревнования</);
  assert.match(markup, />Парки</);
  assert.match(markup, />Игроки и Результаты</);
  assert.match(markup, />Категории</);
  assert.match(markup, /Причины пропуска записей при обновлении/);
  assert.match(markup, /aria-describedby="admin-updates-skip-conditions-tooltip"/);
  assert.match(markup, /id="admin-updates-skip-conditions-tooltip"/);
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
