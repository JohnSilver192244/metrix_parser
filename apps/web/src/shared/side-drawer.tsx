import React, { useEffect } from "react";

export interface SideDrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

function handleEscape(onClose: () => void, event: KeyboardEvent) {
  if (event.key === "Escape") {
    onClose();
  }
}

export function SideDrawer({
  open,
  title,
  onClose,
  children,
  className,
}: SideDrawerProps) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      handleEscape(onClose, event);
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="side-drawer" role="presentation">
      <button
        type="button"
        className="side-drawer__backdrop"
        aria-label={`Закрыть панель ${title}`}
        onClick={onClose}
      />
      <aside
        className={["side-drawer__panel", className].filter(Boolean).join(" ")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="side-drawer__header">
          <h2 className="side-drawer__title">{title}</h2>
          <button
            type="button"
            className="side-drawer__close"
            aria-label={`Закрыть панель ${title}`}
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="side-drawer__content">{children}</div>
      </aside>
    </div>
  );
}
