import React from "react";

export type ThemeMode = "light" | "dark";

export function getNextTheme(theme: ThemeMode): ThemeMode {
  return theme === "light" ? "dark" : "light";
}

export interface ThemeToggleProps {
  theme: ThemeMode;
  onToggle: () => void;
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const isDarkTheme = theme === "dark";

  return (
    <button
      className="theme-toggle"
      type="button"
      aria-pressed={isDarkTheme}
      aria-label={isDarkTheme ? "Переключить на светлую тему" : "Переключить на тёмную тему"}
      onClick={onToggle}
    >
      <span className="theme-toggle__label">
        {isDarkTheme ? "Светлая тема" : "Тёмная тема"}
      </span>
    </button>
  );
}
