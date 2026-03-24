import React, { useEffect, useState } from "react";

import {
  appRoutes,
  resolveAppRoute,
} from "./router";
import { AuthProvider, useAuth } from "../features/auth/auth-context";
import { TopbarAuthControls } from "../features/auth/topbar-auth-controls";

interface HistoryLike {
  pushState(
    data: unknown,
    unused: string,
    url?: string | URL | null,
  ): void;
}

interface NavigationClickLike {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

export function getInitialPathname(): string {
  return typeof window === "undefined" ? "/" : window.location.pathname;
}

export function navigateToAppPath(
  nextPathname: string,
  currentPathname: string,
  history: HistoryLike,
  onPathnameChange: (pathname: string) => void,
): boolean {
  if (nextPathname === currentPathname) {
    return false;
  }

  history.pushState(null, "", nextPathname);
  onPathnameChange(nextPathname);

  return true;
}

export function shouldHandleInAppNavigation(
  event: NavigationClickLike,
): boolean {
  return !(
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

export interface AppShellViewProps {
  pathname: string;
  onNavigate: (pathname: string) => void;
}

export function AppShellView({ pathname, onNavigate }: AppShellViewProps) {
  const auth = useAuth();
  const route = resolveAppRoute(pathname);
  const visibleRoutes = appRoutes.filter(
    (appRoute) => !appRoute.requiresAuth || auth.status === "authenticated",
  );
  const activePathname = route?.activePath ?? route?.path ?? pathname;
  const canAccessRoute =
    !route?.requiresAuth || auth.status === "authenticated";

  return (
    <main className="app-shell">
      <header className="app-topbar">
        <div className="app-topbar__row">
          <div className="app-topbar__brand">
            <h1 className="app-topbar__title">MetrixParser</h1>
          </div>
          <TopbarAuthControls />
        </div>
        <nav className="app-topbar__nav" aria-label="Основная навигация">
          {visibleRoutes.map((appRoute) => {
            const isActive = appRoute.path === activePathname;

            return (
              <a
                key={appRoute.path}
                className={isActive ? "app-topbar__link app-topbar__link--active" : "app-topbar__link"}
                href={appRoute.path}
                onClick={(event) => {
                  if (!shouldHandleInAppNavigation(event)) {
                    return;
                  }

                  event.preventDefault();
                  onNavigate(appRoute.path);
                }}
              >
                {appRoute.label}
              </a>
            );
          })}
        </nav>
      </header>

      <section className="app-content">
        {route && route.requiresAuth && auth.status === "loading" ? (
          <section className="state-panel state-panel--pending" aria-live="polite">
            <p className="state-panel__eyebrow">loading</p>
            <h2>Проверяем доступ</h2>
            <p>Смотрим, есть ли активная сессия для административного раздела.</p>
          </section>
        ) : route && canAccessRoute ? (
          <section key={route.path}>
            {route.render({ onNavigate })}
          </section>
        ) : route ? (
          <section className="state-panel">
            <p className="state-panel__eyebrow">auth required</p>
            <h2>Доступ к странице ограничен</h2>
            <p>
              Раздел «{route.label}» доступен только авторизованным пользователям.
              Войдите через форму в правом верхнем углу или перейдите к открытому
              списку игроков.
            </p>
            <p>
              <a
                className="app-topbar__link app-topbar__link--active"
                href="/players"
                onClick={(event) => {
                  if (!shouldHandleInAppNavigation(event)) {
                    return;
                  }

                  event.preventDefault();
                  onNavigate("/players");
                }}
              >
                Открыть игроков
              </a>
            </p>
          </section>
        ) : (
          <section className="not-found-panel">
            <p className="not-found-panel__eyebrow">route not found</p>
            <h2>Эта страница пока не собрана.</h2>
            <p>Вернитесь на главную административную страницу, чтобы продолжить работу.</p>
            <a
              className="app-topbar__link app-topbar__link--active"
              href="/"
              onClick={(event) => {
                if (!shouldHandleInAppNavigation(event)) {
                  return;
                }

                event.preventDefault();
                onNavigate("/");
              }}
            >
              Открыть админку
            </a>
          </section>
        )}
      </section>
    </main>
  );
}

function AppShellController() {
  const [pathname, setPathname] = useState(getInitialPathname());

  useEffect(() => {
    const handlePopState = () => {
      setPathname(window.location.pathname);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  return (
    <AppShellView
      pathname={pathname}
      onNavigate={(nextPathname) => {
        navigateToAppPath(nextPathname, pathname, window.history, setPathname);
      }}
    />
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppShellController />
    </AuthProvider>
  );
}
