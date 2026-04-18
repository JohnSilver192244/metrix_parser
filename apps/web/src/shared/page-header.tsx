import React from "react";

import { useMobileMenuDrawer } from "./mobile-menu-context";

export interface PageHeaderProps {
  titleId: string;
  title: string;
  description?: string;
  eyebrow?: string;
  titleAction?: React.ReactNode;
}

function MobileMenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M4 6h16M4 12h16M4 18h16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PageHeader({
  titleId,
  title,
  description,
  eyebrow,
  titleAction,
}: PageHeaderProps) {
  const mobileMenuDrawer = useMobileMenuDrawer();

  return (
    <header className="page-header">
      <div className="page-header__main">
        {eyebrow ? <p className="page-header__eyebrow">{eyebrow}</p> : null}
        <div className="page-header__title-row">
          <h1 id={titleId}>{title}</h1>
          {mobileMenuDrawer ? (
            <button
              type="button"
              className="page-header__icon-button page-header__icon-button--menu"
              aria-label={
                mobileMenuDrawer.isOpen
                  ? "Закрыть меню"
                  : "Открыть меню"
              }
              aria-expanded={mobileMenuDrawer.isOpen}
              onClick={mobileMenuDrawer.toggle}
            >
              <MobileMenuIcon />
            </button>
          ) : null}
          {titleAction}
        </div>
      </div>
      {description ? <p className="page-header__description">{description}</p> : null}
    </header>
  );
}
