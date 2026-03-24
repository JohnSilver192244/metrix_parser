import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  AppShellView,
  navigateToAppPath,
  shouldHandleInAppNavigation,
} from "./App";

test("navigateToAppPath updates history and state without reloading", () => {
  const calls: string[] = [];
  const changes: string[] = [];

  const changed = navigateToAppPath(
    "/competitions/competition-100",
    "/players",
    {
      pushState(_data, _unused, url) {
        calls.push(String(url));
      },
    },
    (pathname) => {
      changes.push(pathname);
    },
  );

  assert.equal(changed, true);
  assert.deepEqual(calls, ["/competitions/competition-100"]);
  assert.deepEqual(changes, ["/competitions/competition-100"]);
});

test("navigateToAppPath is a no-op when user selects the current route", () => {
  const calls: string[] = [];

  const changed = navigateToAppPath(
    "/players",
    "/players",
    {
      pushState(_data, _unused, url) {
        calls.push(String(url));
      },
    },
    () => {
      throw new Error("pathname should not change");
    },
  );

  assert.equal(changed, false);
  assert.deepEqual(calls, []);
});

test("AppShellView renders project title and linear SPA navigation", () => {
  const markup = renderToStaticMarkup(
    <AppShellView pathname="/competitions/competition-100" onNavigate={() => {}} />,
  );

  assert.match(markup, /MetrixParser Admin/);
  assert.match(markup, /Обновления/);
  assert.match(markup, /Соревнования/);
  assert.match(markup, /Парки/);
  assert.match(markup, /Игроки/);
  assert.match(markup, /Подтягиваем результаты соревнования/);
  assert.doesNotMatch(markup, /href="\/results"/);
  assert.match(markup, /app-topbar__link app-topbar__link--active/);
});

test("AppShellView renders only the active route so page data loads on demand", () => {
  const markup = renderToStaticMarkup(
    <AppShellView pathname="/competitions/competition-100" onNavigate={() => {}} />,
  );

  assert.match(markup, /Подтягиваем результаты соревнования/);
  assert.doesNotMatch(markup, /Обновление данных/);
  assert.doesNotMatch(markup, /Список соревнований/);
  assert.doesNotMatch(markup, /Список парков/);
  assert.doesNotMatch(markup, /Список игроков/);
});

test("shouldHandleInAppNavigation ignores modified or non-primary clicks", () => {
  assert.equal(
    shouldHandleInAppNavigation({
      button: 0,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
    }),
    true,
  );
  assert.equal(
    shouldHandleInAppNavigation({
      button: 0,
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
    }),
    false,
  );
  assert.equal(
    shouldHandleInAppNavigation({
      button: 1,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
    }),
    false,
  );
});
