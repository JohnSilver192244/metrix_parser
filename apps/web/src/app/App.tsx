import React, { useEffect, useState } from "react";

import {
  appRoutes,
  getAppRoutesByGroup,
  resolveAppRoute,
  type AppRouteDefinition,
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

function AppNavGroup({
  title,
  routes,
  activePathname,
  onNavigate,
}: {
  title: string;
  routes: AppRouteDefinition[];
  activePathname: string;
  onNavigate: (pathname: string) => void;
}) {
  return (
    <section className="app-topbar__group" aria-label={title}>
      <p className="app-topbar__group-title">{title}</p>
      <div className="app-topbar__group-links">
        {routes.map((appRoute) => {
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
      </div>
    </section>
  );
}

export function AppShellView({ pathname, onNavigate }: AppShellViewProps) {
  const route = resolveAppRoute(pathname);
  const activePathname = route?.path ?? pathname;
  const adminRoutes = getAppRoutesByGroup("admin");
  const browseRoutes = getAppRoutesByGroup("browse");

  return (
    <main className="app-shell">
      <header className="app-topbar">
        <div className="app-topbar__meta">
          <p className="app-topbar__eyebrow">metrixParser</p>
          <h1 className="app-topbar__title">{route?.title ?? "Навигация по продукту"}</h1>
          <p className="app-topbar__summary">
            {route?.description ?? "Выберите раздел, чтобы перейти к обновлению данных или просмотру сохранённых сущностей."}
          </p>
        </div>
        <nav className="app-topbar__nav" aria-label="Основная навигация">
          <AppNavGroup
            title="Администрирование"
            routes={adminRoutes}
            activePathname={activePathname}
            onNavigate={onNavigate}
          />
          <AppNavGroup
            title="Просмотр данных"
            routes={browseRoutes}
            activePathname={activePathname}
            onNavigate={onNavigate}
          />
        </nav>
      </header>

      <section className="app-content">
        {route ? (
          appRoutes.map((appRoute) => {
            const isActive = appRoute.path === route.path;

            return (
              <section
                key={appRoute.path}
                hidden={!isActive}
                aria-hidden={isActive ? undefined : true}
              >
                {appRoute.element}
              </section>
            );
          })
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
