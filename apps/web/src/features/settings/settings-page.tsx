import React, { useRef, useState } from "react";

import { AdminUpdatesPage } from "../admin-updates/admin-updates-page";
import { DivisionsPage } from "../divisions/divisions-page";
import { SeasonConfigPage } from "../season-config/season-config-page";
import { TournamentCategoriesPage } from "../tournament-categories/tournament-categories-page";

type SettingsStepId = "step-1" | "step-2" | "step-3";

interface SettingsStep {
  id: SettingsStepId;
  title: string;
  hint: string;
}

const settingsSteps: readonly SettingsStep[] = [
  {
    id: "step-1",
    title: "Шаг 1",
    hint: "Проверь категории турниров и дивизионы",
  },
  {
    id: "step-2",
    title: "Шаг 2",
    hint: "Обнови данные",
  },
  {
    id: "step-3",
    title: "Шаг 3",
    hint: "Начисли очки сезона",
  },
];

export function SettingsPage() {
  const [isCategoriesEditModeEnabled, setIsCategoriesEditModeEnabled] = useState(false);
  const [isDivisionsEditModeEnabled, setIsDivisionsEditModeEnabled] = useState(false);
  const stepOneRef = useRef<HTMLElement | null>(null);
  const stepTwoRef = useRef<HTMLElement | null>(null);
  const stepThreeRef = useRef<HTMLElement | null>(null);

  function scrollToStep(stepId: SettingsStepId) {
    const target =
      stepId === "step-1"
        ? stepOneRef.current
        : stepId === "step-2"
          ? stepTwoRef.current
          : stepThreeRef.current;

    target?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  return (
    <section className="data-page-shell settings-page" aria-labelledby="settings-page-title">
      <header className="page-header">
        <div className="page-header__main">
          <p className="page-header__eyebrow">settings</p>
          <div className="page-header__title-row">
            <h1 id="settings-page-title">Настройки</h1>
          </div>
          <p className="page-header__description">
            Все административные разделы собраны на одной странице с пошаговой навигацией.
          </p>
        </div>
      </header>

      <div className="settings-page__layout">
        <aside className="settings-page__menu" aria-label="Навигация по шагам">
          <ol className="settings-page__menu-list">
            {settingsSteps.map((step) => (
              <li key={step.id} className="settings-page__menu-item">
                <button
                  type="button"
                  className="settings-page__menu-button"
                  onClick={() => {
                    scrollToStep(step.id);
                  }}
                >
                  <strong>{step.title}</strong>
                  <span>{step.hint}</span>
                </button>
              </li>
            ))}
          </ol>
          <p className="settings-page__menu-note">Используйте кнопки, чтобы прокручивать страницу вниз и вверх по шагам.</p>
        </aside>

        <div className="settings-page__content">
          <section ref={stepOneRef} className="settings-page__frame" aria-label="Шаг 1">
            <h2 className="settings-page__frame-title">Шаг 1. Проверь категории турниров и дивизионы</h2>
            <div className="settings-page__stack">
              <TournamentCategoriesPage
                forceCanEdit={isCategoriesEditModeEnabled}
                pageTitleAction={
                  <button
                    type="button"
                    className="update-card__submit settings-page__edit-toggle"
                    onClick={() => {
                      setIsCategoriesEditModeEnabled((current) => !current);
                    }}
                  >
                    {isCategoriesEditModeEnabled ? "Просмотр" : "Редактировать"}
                  </button>
                }
              />
              <DivisionsPage
                forceCanEdit={isDivisionsEditModeEnabled}
                showReadonlyNotice={false}
                pageTitleAction={
                  <button
                    type="button"
                    className="update-card__submit settings-page__edit-toggle"
                    onClick={() => {
                      setIsDivisionsEditModeEnabled((current) => !current);
                    }}
                  >
                    {isDivisionsEditModeEnabled ? "Просмотр" : "Редактировать"}
                  </button>
                }
              />
            </div>
          </section>

          <section ref={stepTwoRef} className="settings-page__frame" aria-label="Шаг 2">
            <h2 className="settings-page__frame-title">Шаг 2. Обнови данные</h2>
            <AdminUpdatesPage />
          </section>

          <section ref={stepThreeRef} className="settings-page__frame" aria-label="Шаг 3">
            <h2 className="settings-page__frame-title">Шаг 3. Начисли очки сезона</h2>
            <SeasonConfigPage />
          </section>
        </div>
      </div>
    </section>
  );
}
