import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { createDefaultUpdatePeriod, UpdatePeriodPicker } from "./update-period-picker";

test("createDefaultUpdatePeriod returns a closed current-week range", () => {
  const period = createDefaultUpdatePeriod(new Date("2026-03-24T12:00:00Z"));

  assert.deepEqual(period, {
    dateFrom: "2026-03-23",
    dateTo: "2026-03-24",
  });
});

test("UpdatePeriodPicker renders one trigger and hidden api fields", () => {
  const markup = renderToStaticMarkup(
    <UpdatePeriodPicker
      value={{ dateFrom: "2026-03-23", dateTo: "2026-03-24" }}
      onChange={() => {}}
    />,
  );

  assert.match(markup, /Период/);
  assert.match(markup, /name="shared-date-from"/);
  assert.match(markup, /name="shared-date-to"/);
  assert.doesNotMatch(markup, /type="date"/);
});
