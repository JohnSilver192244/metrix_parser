import React from "react";

export interface PageHeaderProps {
  titleId: string;
  title: string;
  description?: string;
  eyebrow?: string;
  titleAction?: React.ReactNode;
}

export function PageHeader({
  titleId,
  title,
  description,
  eyebrow,
  titleAction,
}: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header__main">
        {eyebrow ? <p className="page-header__eyebrow">{eyebrow}</p> : null}
        <div className="page-header__title-row">
          <h1 id={titleId}>{title}</h1>
          {titleAction}
        </div>
      </div>
      {description ? <p className="page-header__description">{description}</p> : null}
    </header>
  );
}
