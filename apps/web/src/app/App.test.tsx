import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  AppShellView,
  navigateToAppPath,
  shouldHandleInAppNavigation,
} from "./App";
import { AuthContext, type AuthContextValue } from "../features/auth/auth-context";
import { getNextTheme } from "../shared/theme-toggle";

function renderWithAuth(
  pathname: string,
  authValue: Partial<AuthContextValue> = {},
  theme: "light" | "dark" = "light",
): string {
  const value: AuthContextValue = {
    status: "authenticated",
    user: {
      login: "admin",
    },
    isSubmitting: false,
    errorMessage: null,
    signIn: async () => true,
    signOut: async () => {},
    ...authValue,
  };

  return renderToStaticMarkup(
    <AuthContext.Provider value={value}>
      <AppShellView
        pathname={pathname}
        theme={theme}
        onNavigate={() => {}}
        onToggleTheme={() => {}}
      />
    </AuthContext.Provider>,
  );
}

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
  const markup = renderWithAuth("/competitions/competition-100");

  assert.match(markup, /MetrixParser/);
  assert.match(markup, /Тёмная тема/);
  assert.match(markup, /Обновления/);
  assert.match(markup, /Сезоны и очки/);
  assert.match(markup, /Соревнования/);
  assert.match(markup, /Парки/);
  assert.match(markup, /Игроки/);
  assert.match(markup, /Подтягиваем результаты соревнования/);
  assert.match(markup, />Выйти</);
  assert.doesNotMatch(markup, /Вы вошли как/);
  assert.doesNotMatch(markup, /Пользователи/);
  assert.doesNotMatch(markup, /href="\/results"/);
  assert.match(markup, /app-topbar__link app-topbar__link--active/);
});

test("AppShellView renders only the active route so page data loads on demand", () => {
  const markup = renderWithAuth("/competitions/competition-100");

  assert.match(markup, /Подтягиваем результаты соревнования/);
  assert.doesNotMatch(markup, /Обновление данных/);
  assert.doesNotMatch(markup, /Список соревнований/);
  assert.doesNotMatch(markup, /Список парков/);
  assert.doesNotMatch(markup, /Список игроков/);
});

test("AppShellView resolves legacy /competitions path to competitions list", () => {
  const markup = renderWithAuth("/competitions");

  assert.match(markup, /Подтягиваем соревнования/);
  assert.doesNotMatch(markup, /route not found/);
});

test("AppShellView hides admin navigation for guests and blocks direct access", () => {
  const markup = renderWithAuth("/admin", {
    status: "anonymous",
    user: null,
  });

  assert.doesNotMatch(markup, /href="\/users"/);
  assert.doesNotMatch(markup, /href="\/admin">/);
  assert.doesNotMatch(markup, /href="\/season-config">/);
  assert.match(markup, />Войти</);
  assert.doesNotMatch(markup, /topbar-login/);
  assert.doesNotMatch(markup, /Редактирование и раздел обновлений доступны после входа/);
  assert.match(markup, /Доступ к странице ограничен/);
  assert.match(markup, /Открыть соревнования/);
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

test("getNextTheme alternates between light and dark without persistence", () => {
  assert.equal(getNextTheme("light"), "dark");
  assert.equal(getNextTheme("dark"), "light");
});

test("AppShellView renders the dark theme toggle state when requested", () => {
  const markup = renderWithAuth("/competitions/competition-100", {}, "dark");

  assert.match(markup, /Светлая тема/);
  assert.match(markup, /aria-pressed="true"/);
});
