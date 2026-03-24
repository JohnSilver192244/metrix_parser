import assert from "node:assert/strict";
import test from "node:test";

import { buildCompetitionResultsPath } from "./route-paths";
import { appRoutes, getAppRoutesByGroup, resolveAppRoute } from "./router";

test("app route map registers admin and all data view pages", () => {
  assert.deepEqual(
    appRoutes.map((route) => route.path),
    ["/", "/competitions", "/courses", "/players"],
  );
  assert.equal(getAppRoutesByGroup("admin").length, 1);
  assert.equal(getAppRoutesByGroup("browse").length, 3);
});

test("resolveAppRoute returns configured top-level route metadata", () => {
  const route = resolveAppRoute("/competitions");

  assert.equal(route?.label, "Соревнования");
  assert.equal(route?.group, "browse");
  assert.match(route?.description ?? "", /backend API/);
});

test("resolveAppRoute maps competition detail paths to the results detail page", () => {
  const route = resolveAppRoute(buildCompetitionResultsPath("competition-701"));

  assert.equal(route?.label, "Результаты соревнования");
  assert.equal(route?.group, "browse");
  assert.equal(route?.activePath, "/competitions");
  assert.match(route?.description ?? "", /DNF/);
});
