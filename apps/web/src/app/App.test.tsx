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

function renderWithAuth(
  pathname: string,
  authValue: Partial<AuthContextValue> = {},
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
      <AppShellView pathname={pathname} onNavigate={() => {}} />
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
  assert.match(markup, /Обновления/);
  assert.match(markup, /Соревнования/);
  assert.match(markup, /Парки/);
  assert.match(markup, /Игроки/);
  assert.match(markup, /Подтягиваем результаты соревнования/);
  assert.match(markup, />Выйти</);
  assert.doesNotMatch(markup, /Вы вошли как/);
  assert.doesNotMatch(markup, /admin/);
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

test("AppShellView hides admin navigation for guests and blocks direct access", () => {
  const markup = renderWithAuth("/", {
    status: "anonymous",
    user: null,
  });

  assert.doesNotMatch(markup, /href="\/users"/);
  assert.doesNotMatch(markup, /href="\/">/);
  assert.match(markup, />Войти</);
  assert.doesNotMatch(markup, /topbar-login/);
  assert.doesNotMatch(markup, /Редактирование и раздел обновлений доступны после входа/);
  assert.match(markup, /Доступ к странице ограничен/);
  assert.match(markup, /Открыть игроков/);
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
