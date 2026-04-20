import React from "react";

export interface LoadingStatePanelProps {
  label: string;
  rows?: number;
  className?: string;
}

export function LoadingStatePanel({
  label,
  rows = 4,
  className,
}: LoadingStatePanelProps) {
  const rowCount = Math.max(1, rows);
  const panelClassName = className
    ? `state-panel state-panel--pending loading-state ${className}`
    : "state-panel state-panel--pending loading-state";

  return (
    <section
      className={panelClassName}
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div className="loading-state__header" aria-hidden="true">
        <span className="loading-state__spinner" />
        <div className="loading-state__copy">
          <span className="loading-state__skeleton loading-state__skeleton--eyebrow" />
          <span className="loading-state__skeleton loading-state__skeleton--title" />
          <span className="loading-state__skeleton loading-state__skeleton--description" />
        </div>
      </div>

      <div className="loading-state__surface" aria-hidden="true">
        <div className="loading-state__toolbar">
          <span className="loading-state__skeleton loading-state__skeleton--chip" />
          <span className="loading-state__skeleton loading-state__skeleton--chip" />
          <span className="loading-state__skeleton loading-state__skeleton--chip loading-state__skeleton--chip-short" />
        </div>

        <div className="loading-state__rows">
          {Array.from({ length: rowCount }, (_, index) => (
            <span
              key={index}
              className={
                index % 3 === 0
                  ? "loading-state__skeleton loading-state__skeleton--row loading-state__skeleton--row-wide"
                  : index % 3 === 1
                    ? "loading-state__skeleton loading-state__skeleton--row loading-state__skeleton--row-medium"
                    : "loading-state__skeleton loading-state__skeleton--row loading-state__skeleton--row-narrow"
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
}
