import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  AppShellView,
  getInitialTheme,
  isScrollRestorationPath,
  navigateToAppPath,
  parseScrollPositions,
  parseStoredTheme,
  persistTheme,
  restorePathScrollPosition,
  savePathScrollPosition,
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

  assert.match(markup, /Сезонная таблица игроков РДГА/);
  assert.match(markup, /Тёмная тема/);
  assert.match(markup, /Настройки/);
  assert.match(markup, /Игроки/);
  assert.match(markup, /Соревнования/);
  assert.match(markup, /Парки/);
  assert.ok(markup.indexOf(">Игроки<") < markup.indexOf(">Соревнования<"));
  assert.doesNotMatch(markup, /Категории турниров/);
  assert.doesNotMatch(markup, /Дивизионы/);
  assert.doesNotMatch(markup, /Сезоны и очки/);
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
  const markup = renderWithAuth("/settings", {
    status: "anonymous",
    user: null,
  });

  assert.doesNotMatch(markup, /href="\/users"/);
  assert.doesNotMatch(markup, /href="\/admin">/);
  assert.doesNotMatch(markup, /href="\/season-config">/);
  assert.doesNotMatch(markup, /href="\/divisions">/);
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

test("getNextTheme alternates between light and dark without persistence", () => {
  assert.equal(getNextTheme("light"), "dark");
  assert.equal(getNextTheme("dark"), "light");
});

test("parseStoredTheme accepts only known themes", () => {
  assert.equal(parseStoredTheme("light"), "light");
  assert.equal(parseStoredTheme("dark"), "dark");
  assert.equal(parseStoredTheme("other"), null);
  assert.equal(parseStoredTheme(null), null);
});

test("persistTheme writes selected theme to storage", () => {
  const storage = new Map<string, string>();
  const fakeStorage = {
    getItem(key: string) {
      return storage.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      storage.set(key, value);
    },
  };

  persistTheme("dark", fakeStorage);
  assert.equal(storage.get("app-shell:theme"), "dark");
});

test("getInitialTheme reads localStorage and falls back to light", () => {
  const originalWindow = globalThis.window;
  try {
    const fakeWindow = {
      localStorage: {
        getItem(key: string) {
          return key === "app-shell:theme" ? "dark" : null;
        },
        setItem() {},
      },
    } as unknown as Window & typeof globalThis;

    Object.defineProperty(globalThis, "window", {
      value: fakeWindow,
      configurable: true,
      writable: true,
    });
    assert.equal(getInitialTheme(), "dark");

    Object.defineProperty(globalThis, "window", {
      value: {
        localStorage: {
          getItem() {
            return "invalid";
          },
          setItem() {},
        },
      } as unknown as Window & typeof globalThis,
      configurable: true,
      writable: true,
    });
    assert.equal(getInitialTheme(), "light");
  } finally {
    Object.defineProperty(globalThis, "window", {
      value: originalWindow,
      configurable: true,
      writable: true,
    });
  }
});

test("parseScrollPositions ignores invalid payloads", () => {
  assert.deepEqual(parseScrollPositions(null), {});
  assert.deepEqual(parseScrollPositions("not-json"), {});
  assert.deepEqual(parseScrollPositions(JSON.stringify(["x"])), {});
  assert.deepEqual(
    parseScrollPositions(JSON.stringify({ "/": 120, "/players": -1, bad: "x" })),
    { "/": 120 },
  );
});

test("savePathScrollPosition and restorePathScrollPosition persist list scroll", () => {
  const storage = new Map<string, string>();
  const fakeStorage = {
    getItem(key: string) {
      return storage.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      storage.set(key, value);
    },
  };

  savePathScrollPosition("/players", 420, fakeStorage);

  let restoredX = -1;
  let restoredY = -1;
  const restored = restorePathScrollPosition("/players", fakeStorage, (x, y) => {
    restoredX = x;
    restoredY = y;
  });

  assert.equal(restored, true);
  assert.equal(restoredX, 0);
  assert.equal(restoredY, 420);
});

test("restorePathScrollPosition returns false when path was never saved", () => {
  const fakeStorage = {
    getItem() {
      return JSON.stringify({ "/players": 240 });
    },
    setItem() {},
  };

  const restored = restorePathScrollPosition("/courses", fakeStorage, () => {
    throw new Error("should not restore");
  });

  assert.equal(restored, false);
});

test("isScrollRestorationPath returns true only for list routes", () => {
  assert.equal(isScrollRestorationPath("/"), true);
  assert.equal(isScrollRestorationPath("/competitions"), true);
  assert.equal(isScrollRestorationPath("/players"), true);
  assert.equal(isScrollRestorationPath("/season-config"), true);
  assert.equal(isScrollRestorationPath("/divisions"), true);
  assert.equal(isScrollRestorationPath("/competitions"), true);
  assert.equal(isScrollRestorationPath("/players/player-100"), false);
  assert.equal(isScrollRestorationPath("/competitions/competition-100"), false);
});

test("AppShellView renders the dark theme toggle state when requested", () => {
  const markup = renderWithAuth("/competitions/competition-100", {}, "dark");

  assert.match(markup, /Светлая тема/);
  assert.match(markup, /aria-pressed="true"/);
});
