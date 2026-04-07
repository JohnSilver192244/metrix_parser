import React, { useEffect } from "react";

export interface ActionToastProps {
  message: string | null;
  tone?: "success" | "error";
  onClose?: () => void;
  durationMs?: number;
}

export function ActionToast({
  message,
  tone = "success",
  onClose,
  durationMs = 3200,
}: ActionToastProps) {
  useEffect(() => {
    if (!message || !onClose) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      onClose();
    }, durationMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [durationMs, message, onClose]);

  if (!message) {
    return null;
  }

  return (
    <div className="action-toast-stack" aria-live="polite" aria-atomic="true">
      <div
        className={`action-toast action-toast--${tone}`}
        role={tone === "error" ? "alert" : "status"}
      >
        <p className="action-toast__message">{message}</p>
        <button
          type="button"
          className="action-toast__close"
          aria-label="Закрыть уведомление"
          onClick={() => onClose?.()}
        >
          ×
        </button>
      </div>
    </div>
  );
}
