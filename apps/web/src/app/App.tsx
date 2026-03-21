import { appRoutes, resolveAppRoute } from "./router";

export function App() {
  const route = resolveAppRoute(window.location.pathname);

  return (
    <main className="app-shell">
      <header className="app-topbar">
        <div>
          <p className="app-topbar__eyebrow">metrixParser</p>
          <h1 className="app-topbar__title">Административный контур</h1>
        </div>
        <nav className="app-topbar__nav" aria-label="Основная навигация">
          {appRoutes.map((appRoute) => {
            const isActive = appRoute.path === (route?.path ?? window.location.pathname);

            return (
              <a
                key={appRoute.path}
                className={isActive ? "app-topbar__link app-topbar__link--active" : "app-topbar__link"}
                href={appRoute.path}
              >
                {appRoute.label}
              </a>
            );
          })}
        </nav>
      </header>

      {route ? (
        route.element
      ) : (
        <section className="not-found-panel">
          <p className="not-found-panel__eyebrow">route not found</p>
          <h2>Эта страница пока не собрана.</h2>
          <p>Вернитесь на главную административную страницу, чтобы запустить обновления.</p>
          <a className="app-topbar__link app-topbar__link--active" href="/">
            Открыть админку
          </a>
        </section>
      )}
    </main>
  );
}
