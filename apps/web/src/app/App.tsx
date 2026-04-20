import React, { useEffect, useRef, useState } from "react";

import {
  appRoutes,
  resolveAppRoute,
} from "./router";
import { AuthProvider, useAuth } from "../features/auth/auth-context";
import { TopbarAuthControls } from "../features/auth/topbar-auth-controls";
import {
  ThemeToggle,
  getNextTheme,
  type ThemeMode,
} from "../shared/theme-toggle";
import {
  initWebPerformanceTracking,
  setActiveRouteForPerformance,
} from "../shared/performance/route-performance";
import {
  MobileMenuDrawerProvider,
} from "../shared/mobile-menu-context";
import { SideDrawer } from "../shared/side-drawer";
import { LoadingStatePanel } from "../shared/loading-state-panel";

interface HistoryLike {
  pushState(
    data: unknown,
    unused: string,
    url?: string | URL | null,
  ): void;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
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

const scrollRestoreStorageKey = "app-shell:scroll-positions";
const themeStorageKey = "app-shell:theme";
const legacyPlayersListPath = "/players";

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseStoredTheme(value: string | null): ThemeMode | null {
  if (value === "light" || value === "dark") {
    return value;
  }

  return null;
}

export function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  return parseStoredTheme(window.localStorage.getItem(themeStorageKey)) ?? "light";
}

export function persistTheme(theme: ThemeMode, storage: StorageLike): void {
  storage.setItem(themeStorageKey, theme);
}

export function isScrollRestorationPath(pathname: string): boolean {
  return (
    appRoutes.some((route) => route.path === pathname) ||
    pathname === legacyPlayersListPath
  );
}

export function parseScrollPositions(serialized: string | null): Record<string, number> {
  if (!serialized) {
    return {};
  }

  try {
    const parsed = JSON.parse(serialized);
    if (!isObjectRecord(parsed)) {
      return {};
    }

    const result: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        result[key] = value;
      }
    }

    return result;
  } catch {
    return {};
  }
}

export function savePathScrollPosition(
  pathname: string,
  scrollY: number,
  storage: StorageLike,
): void {
  if (!pathname || !Number.isFinite(scrollY) || scrollY < 0) {
    return;
  }

  const scrollPositions = parseScrollPositions(storage.getItem(scrollRestoreStorageKey));
  scrollPositions[pathname] = scrollY;
  storage.setItem(scrollRestoreStorageKey, JSON.stringify(scrollPositions));
}

export function restorePathScrollPosition(
  pathname: string,
  storage: StorageLike,
  scrollTo: (x: number, y: number) => void,
): boolean {
  const scrollPositions = parseScrollPositions(storage.getItem(scrollRestoreStorageKey));
  const position = scrollPositions[pathname];

  if (typeof position !== "number" || !Number.isFinite(position)) {
    return false;
  }

  scrollTo(0, position);
  return true;
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
  theme: ThemeMode;
  onNavigate: (pathname: string) => void;
  onToggleTheme: () => void;
}

export function AppShellView({
  pathname,
  theme,
  onNavigate,
  onToggleTheme,
}: AppShellViewProps) {
  const auth = useAuth();
  const route = resolveAppRoute(pathname);
  const visibleRoutes = appRoutes.filter(
    (appRoute) =>
      (appRoute.showInNav ?? true) &&
      (!appRoute.requiresAuth || auth.status === "authenticated"),
  );
  const activePathname = route?.activePath ?? route?.path ?? pathname;
  const canAccessRoute =
    !route?.requiresAuth || auth.status === "authenticated";
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  return (
    <MobileMenuDrawerProvider
      value={{
        isOpen: isMobileMenuOpen,
        open: () => {
          setIsMobileMenuOpen(true);
        },
        close: () => {
          setIsMobileMenuOpen(false);
        },
        toggle: () => {
          setIsMobileMenuOpen((currentValue) => !currentValue);
        },
      }}
    >
      <main className="app-shell">
        <header className="app-topbar">
          <div className="app-topbar__row">
            <div className="app-topbar__brand">
              <h1 className="app-topbar__title">Сезонная таблица игроков РДГА</h1>
            </div>
            <div className="app-topbar__actions">
              <ThemeToggle theme={theme} onToggle={onToggleTheme} />
              <TopbarAuthControls />
            </div>
          </div>
          <nav className="app-topbar__nav" aria-label="Основная навигация">
            {visibleRoutes.map((appRoute) => {
              const isActive = appRoute.path === activePathname;

              return (
                <button
                  key={appRoute.path}
                  type="button"
                  className={
                    isActive ? "app-topbar__link app-topbar__link--active" : "app-topbar__link"
                  }
                  onClick={() => {
                    onNavigate(appRoute.path);
                  }}
                >
                  {appRoute.label}
                </button>
              );
            })}
          </nav>
        </header>

        <section className="app-content">
          {route && route.requiresAuth && auth.status === "loading" ? (
            <LoadingStatePanel
              label="Проверяем доступ к административному разделу"
              rows={3}
            />
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
                Войдите через форму в правом верхнем углу или перейдите к
                списку игроков.
              </p>
              <p>
                <button
                  type="button"
                  className="app-topbar__link app-topbar__link--active"
                  onClick={() => {
                    onNavigate("/");
                  }}
                >
                  Открыть игроков
                </button>
              </p>
            </section>
          ) : (
            <section className="not-found-panel">
              <p className="not-found-panel__eyebrow">route not found</p>
              <h2>Эта страница пока не собрана.</h2>
              <p>Вернитесь на главную страницу, чтобы продолжить работу.</p>
              <button
                type="button"
                className="app-topbar__link app-topbar__link--active"
                onClick={() => {
                  onNavigate("/");
                }}
              >
                На главную
              </button>
            </section>
          )}
        </section>

        <SideDrawer
          open={isMobileMenuOpen}
          title="Основная навигация"
          className="side-drawer--menu"
          onClose={() => {
            setIsMobileMenuOpen(false);
          }}
        >
          <div className="side-drawer__links">
            {visibleRoutes.map((appRoute) => {
              const isActive = appRoute.path === activePathname;

              return (
                <button
                  key={appRoute.path}
                  type="button"
                  className={
                    isActive
                      ? "app-topbar__link app-topbar__link--active"
                      : "app-topbar__link"
                  }
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onNavigate(appRoute.path);
                  }}
                >
                  {appRoute.label}
                </button>
              );
            })}
          </div>
          <div className="side-drawer__actions" aria-label="Настройки и вход">
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            <TopbarAuthControls />
          </div>
        </SideDrawer>
      </main>
    </MobileMenuDrawerProvider>
  );
}

function AppShellController() {
  const [pathname, setPathname] = useState(getInitialPathname());
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const pendingScrollRestorePathRef = useRef<string | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    persistTheme(theme, window.localStorage);

    return () => {
      document.documentElement.removeAttribute("data-theme");
    };
  }, [theme]);

  useEffect(() => {
    initWebPerformanceTracking();
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const nextPathname = window.location.pathname;
      pendingScrollRestorePathRef.current = isScrollRestorationPath(nextPathname)
        ? nextPathname
        : null;
      setPathname(nextPathname);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    if (
      pendingScrollRestorePathRef.current !== pathname ||
      !isScrollRestorationPath(pathname)
    ) {
      return;
    }

    pendingScrollRestorePathRef.current = null;
    const frameId = window.requestAnimationFrame(() => {
      restorePathScrollPosition(pathname, window.sessionStorage, window.scrollTo);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [pathname]);

  useEffect(() => {
    setActiveRouteForPerformance(pathname);
  }, [pathname]);

  return (
    <AppShellView
      pathname={pathname}
      theme={theme}
      onNavigate={(nextPathname) => {
        savePathScrollPosition(pathname, window.scrollY, window.sessionStorage);
        const changed = navigateToAppPath(
          nextPathname,
          pathname,
          window.history,
          setPathname,
        );
        if (!changed) {
          return;
        }

        pendingScrollRestorePathRef.current = isScrollRestorationPath(nextPathname)
          ? nextPathname
          : null;
      }}
      onToggleTheme={() => {
        setTheme(getNextTheme);
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
