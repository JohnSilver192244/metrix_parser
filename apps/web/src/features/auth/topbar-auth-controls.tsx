import React, { useEffect, useRef, useState } from "react";

import { useAuth } from "./auth-context";

export function TopbarAuthControls() {
  const { status, isSubmitting, errorMessage, signIn, signOut } = useAuth();
  const [loginValue, setLoginValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isPopoverOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        event.target instanceof Node &&
        !containerRef.current.contains(event.target)
      ) {
        setIsPopoverOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPopoverOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPopoverOpen]);

  if (status === "loading") {
    return (
      <div
        className="topbar-auth topbar-auth--loading"
        aria-live="polite"
        aria-label="Проверяем вход"
        role="status"
      >
        <span className="topbar-auth__spinner" aria-hidden="true" />
      </div>
    );
  }

  if (status === "authenticated") {
    return (
      <div className="topbar-auth topbar-auth--active">
        <button
          className="update-card__submit topbar-auth__button"
          type="button"
          disabled={isSubmitting}
          onClick={() => {
            void signOut();
          }}
        >
          {isSubmitting ? "Выходим..." : "Выйти"}
        </button>
      </div>
    );
  }

  return (
    <div className="topbar-auth topbar-auth--anonymous" ref={containerRef}>
      <button
        className="update-card__submit topbar-auth__button topbar-auth__toggle"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isPopoverOpen}
        aria-controls={isPopoverOpen ? "topbar-auth-popover" : undefined}
        onClick={() => {
          setIsPopoverOpen((currentValue) => !currentValue);
        }}
      >
        Войти
      </button>

      {isPopoverOpen ? (
        <div
          id="topbar-auth-popover"
          className="topbar-auth__popover"
          role="dialog"
          aria-label="Вход в систему"
        >
          <form
            className="topbar-auth__form"
            onSubmit={(event) => {
              event.preventDefault();

              void signIn(loginValue, passwordValue).then((authenticated) => {
                if (!authenticated) {
                  return;
                }

                setLoginValue("");
                setPasswordValue("");
                setIsPopoverOpen(false);
              });
            }}
          >
            <div className="topbar-auth__field-grid">
              <div>
                <label className="sr-only" htmlFor="topbar-login">
                  Логин
                </label>
                <input
                  id="topbar-login"
                  className="topbar-auth__input"
                  type="text"
                  autoComplete="username"
                  placeholder="Логин"
                  value={loginValue}
                  onChange={(event) => {
                    setLoginValue(event.target.value);
                  }}
                />
              </div>

              <div>
                <label className="sr-only" htmlFor="topbar-password">
                  Пароль
                </label>
                <input
                  id="topbar-password"
                  className="topbar-auth__input"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Пароль"
                  value={passwordValue}
                  onChange={(event) => {
                    setPasswordValue(event.target.value);
                  }}
                />
              </div>
            </div>

            <div className="topbar-auth__actions">
              <button
                className="update-card__submit topbar-auth__button topbar-auth__submit"
                type="submit"
                disabled={
                  isSubmitting ||
                  loginValue.trim().length === 0 ||
                  passwordValue.length === 0
                }
              >
                {isSubmitting ? "Входим..." : "Войти"}
              </button>
            </div>

            <p
              className={
                errorMessage
                  ? "topbar-auth__status topbar-auth__status--error"
                  : "topbar-auth__status"
              }
              role={errorMessage ? "alert" : undefined}
            >
              {errorMessage ?? "Редактирование и раздел обновлений доступны после входа."}
            </p>
          </form>
        </div>
      ) : null}
    </div>
  );
}
