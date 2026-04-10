import assert from "node:assert/strict";
import test from "node:test";

import { buildCompetitionResultsPath, buildPlayerPath } from "./route-paths";
import { appRoutes, getAppRoutesByGroup, resolveAppRoute } from "./router";

test("app route map registers admin and all data view pages", () => {
  assert.deepEqual(
    appRoutes.map((route) => route.path),
    [
      "/",
      "/competitions",
      "/courses",
      "/players",
      "/tournament-categories",
      "/divisions",
      "/admin",
      "/season-config",
      "/settings",
    ],
  );
  assert.equal(getAppRoutesByGroup("admin").length, 4);
  assert.equal(getAppRoutesByGroup("browse").length, 5);
});

test("resolveAppRoute returns configured top-level route metadata", () => {
  const route = resolveAppRoute("/");

  assert.equal(route?.label, "Игроки");
  assert.equal(route?.group, "browse");
  assert.match(route?.description ?? "", /идентификационных данных игроков/);
});

test("resolveAppRoute exposes competitions list at /competitions", () => {
  const route = resolveAppRoute("/competitions");

  assert.equal(route?.label, "Соревнования");
  assert.equal(route?.group, "browse");
  assert.equal(route?.activePath, undefined);
});

test("resolveAppRoute does not expose the hidden users page", () => {
  const route = resolveAppRoute("/users");

  assert.equal(route, null);
});

test("resolveAppRoute exposes the tournament categories page", () => {
  const route = resolveAppRoute("/tournament-categories");

  assert.equal(route?.label, "Категории турниров");
  assert.equal(route?.group, "browse");
  assert.match(route?.description ?? "", /редактирование справочника/);
});

test("resolveAppRoute exposes the season config admin page", () => {
  const route = resolveAppRoute("/season-config");

  assert.equal(route?.label, "Сезоны и очки");
  assert.equal(route?.group, "admin");
  assert.equal(route?.requiresAuth, true);
  assert.match(route?.description ?? "", /начисления очков/);
});

test("resolveAppRoute exposes unified settings page", () => {
  const route = resolveAppRoute("/settings");

  assert.equal(route?.label, "Настройки");
  assert.equal(route?.group, "admin");
  assert.equal(route?.requiresAuth, true);
  assert.match(route?.description ?? "", /Единая страница административных настроек/);
});

test("resolveAppRoute exposes divisions admin page", () => {
  const route = resolveAppRoute("/divisions");

  assert.equal(route?.label, "Дивизионы");
  assert.equal(route?.group, "admin");
  assert.equal(route?.requiresAuth, true);
  assert.match(route?.description ?? "", /каскадным обновлением/);
});

test("resolveAppRoute maps competition detail paths to the results detail page", () => {
  const route = resolveAppRoute(buildCompetitionResultsPath("competition-701"));

  assert.equal(route?.label, "Результаты соревнования");
  assert.equal(route?.group, "browse");
  assert.equal(route?.activePath, "/competitions");
  assert.match(route?.description ?? "", /DNF/);
});

test("resolveAppRoute maps player detail paths to the player page", () => {
  const route = resolveAppRoute(buildPlayerPath("player-701"));

  assert.equal(route?.label, "Игрок");
  assert.equal(route?.group, "browse");
  assert.equal(route?.activePath, "/");
  assert.match(route?.description ?? "", /результатов игрока/);
});
