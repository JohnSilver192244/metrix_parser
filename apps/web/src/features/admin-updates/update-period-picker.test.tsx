import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  createDefaultUpdatePeriod,
  UpdatePeriodPicker,
  type PeriodPreset,
} from "./update-period-picker";

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

test("UpdatePeriodPicker allows custom label, hidden field names, and presets", () => {
  const presets: PeriodPreset[] = [
    {
      id: "current-year",
      label: "Текущий год",
      resolve: () => ({
        dateFrom: "2026-01-01",
        dateTo: "2026-12-31",
      }),
    },
  ];
  const markup = renderToStaticMarkup(
    <UpdatePeriodPicker
      value={{ dateFrom: "2026-01-01", dateTo: "2026-12-31" }}
      onChange={() => {}}
      label="Период соревнований"
      inputNames={{
        dateFrom: "competitions-date-from",
        dateTo: "competitions-date-to",
      }}
      presets={presets}
    />,
  );

  assert.match(markup, /Период соревнований/);
  assert.match(markup, /name="competitions-date-from"/);
  assert.match(markup, /name="competitions-date-to"/);
});

test("UpdatePeriodPicker can hide the trigger label for compact layouts", () => {
  const markup = renderToStaticMarkup(
    <UpdatePeriodPicker
      value={{ dateFrom: "2026-01-01", dateTo: "2026-12-31" }}
      onChange={() => {}}
      hideTriggerLabel
    />,
  );

  assert.match(markup, /period-picker__trigger period-picker__trigger--compact/);
  assert.match(markup, /01\.01\.2026 - 31\.12\.2026/);
  assert.doesNotMatch(markup, /period-picker__trigger-label/);
});
