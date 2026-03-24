import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { UsersPageView } from "./users-page";

test("UsersPageView renders the empty state when there are no configured users", () => {
  const markup = renderToStaticMarkup(
    <UsersPageView
      state={{
        status: "ready",
        users: [],
        total: 0,
      }}
    />,
  );

  assert.match(markup, /Пока нет пользователей/);
  assert.match(markup, /app_public\.app_users/);
});

test("UsersPageView renders the configured logins table", () => {
  const markup = renderToStaticMarkup(
    <UsersPageView
      state={{
        status: "ready",
        total: 1,
        users: [
          {
            login: "admin",
            createdAt: "2026-03-24T08:00:00.000Z",
          },
        ],
      }}
    />,
  );

  assert.match(markup, /Пользователи/);
  assert.match(markup, /Логин/);
  assert.match(markup, /Создан/);
  assert.match(markup, /admin/);
  assert.match(markup, /2026-03-24 08:00 UTC/);
});
