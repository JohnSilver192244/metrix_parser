import React from "react";

export interface PageHeaderProps {
  titleId: string;
  title: string;
  description: string;
  eyebrow?: string;
}

export function PageHeader({
  titleId,
  title,
  description,
  eyebrow,
}: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header__main">
        {eyebrow ? <p className="page-header__eyebrow">{eyebrow}</p> : null}
        <h1 id={titleId}>{title}</h1>
      </div>
      <p className="page-header__description">{description}</p>
    </header>
  );
}
