import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { UpdateActionCard } from "./update-action-card";
import { updateScenarios } from "./update-scenarios";

test("UpdateActionCard renders scenario button without local date inputs", () => {
  const markup = renderToStaticMarkup(
    <UpdateActionCard scenario={updateScenarios[0]!} onSubmit={() => {}} />,
  );

  assert.doesNotMatch(markup, /type="date"/);
  assert.match(markup, />Соревнования</);
});

test("UpdateActionCard renders tooltip text when action is disabled because user input is missing", () => {
  const markup = renderToStaticMarkup(
    <UpdateActionCard
      scenario={updateScenarios[0]!}
      disabled
      disabledReason="Заполните период"
      onSubmit={() => {}}
    />,
  );

  assert.match(markup, /role="tooltip"/);
  assert.match(markup, /Заполните период/);
});

test("UpdateActionCard marks the active scenario and disables the button while request is running", () => {
  const markup = renderToStaticMarkup(
    <UpdateActionCard
      scenario={updateScenarios[2]!}
      disabled
      isActive
      disabledReason="Данные обновляются"
      onSubmit={() => {}}
    />,
  );

  assert.match(markup, /aria-pressed="true"/);
  assert.match(markup, /disabled=""/);
  assert.match(markup, /Выполняется: Игроки и Результаты/);
  assert.match(markup, /Данные обновляются/);
});
