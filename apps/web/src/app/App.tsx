import React, { useEffect, useState } from "react";

import {
  appRoutes,
  resolveAppRoute,
} from "./router";

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
  const route = resolveAppRoute(pathname);
  const activePathname = route?.activePath ?? route?.path ?? pathname;

  return (
    <main className="app-shell">
      <header className="app-topbar">
        <div className="app-topbar__brand">
          <h1 className="app-topbar__title">MetrixParser Admin</h1>
        </div>
        <nav className="app-topbar__nav" aria-label="Основная навигация">
          {appRoutes.map((appRoute) => {
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
        {route ? (
          <section key={route.path}>
            {route.render({ onNavigate })}
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

export function App() {
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
