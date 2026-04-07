import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type TooltipPlacement = "above" | "below";

interface FloatingInfoTooltipProps {
  value: string;
  ariaLabel: string;
  title: string;
  items: readonly string[];
  anchorClassName?: string;
  tooltipClassName?: string;
}

function resolveTooltipPosition(button: HTMLButtonElement): {
  left: number;
  top: number;
  placement: TooltipPlacement;
} {
  const rect = button.getBoundingClientRect();
  const preferredPlacement: TooltipPlacement = rect.top > 200 ? "above" : "below";
  const left = Math.max(16, Math.min(rect.left + rect.width / 2, window.innerWidth - 16));
  const top =
    preferredPlacement === "above"
      ? rect.top - 10
      : rect.bottom + 10;

  return {
    left,
    top,
    placement: preferredPlacement,
  };
}

export function FloatingInfoTooltip({
  value,
  ariaLabel,
  title,
  items,
  anchorClassName,
  tooltipClassName,
}: FloatingInfoTooltipProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    placement: TooltipPlacement;
  } | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const updatePosition = () => {
      const button = buttonRef.current;
      if (!button) {
        return;
      }

      setPosition(resolveTooltipPosition(button));
    };

    updatePosition();

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  const shouldRenderTooltip = !isClient || isOpen;

  const tooltip = (
    <span
      role="tooltip"
      className={["update-card__tooltip", "update-card__tooltip--info", tooltipClassName]
        .filter(Boolean)
        .join(" ")}
      style={
        position == null
          ? {
              opacity: 0,
              position: "fixed",
              pointerEvents: "none",
            }
          : {
              position: "fixed",
              left: `${position.left}px`,
              top: `${position.top}px`,
              bottom: "auto",
              opacity: 1,
              pointerEvents: "none",
              transform:
                position.placement === "above"
                  ? "translate(-50%, -100%)"
                  : "translate(-50%, 0)",
              zIndex: 1000,
            }
      }
    >
      <strong>{title}</strong>
      <ul className="update-card__tooltip-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </span>
  );

  return (
    <span
      className={[
        "update-card__tooltip-anchor",
        "update-card__tooltip-anchor--info",
        anchorClassName,
      ]
        .filter(Boolean)
        .join(" ")}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={() => setIsOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsOpen(false);
        }
      }}
    >
      <span>{value}</span>
      <button
        ref={buttonRef}
        type="button"
        className="update-launcher__info-button"
        aria-label={ariaLabel}
      >
        ?
      </button>
      {shouldRenderTooltip
        ? (typeof document !== "undefined" && isClient
            ? createPortal(tooltip, document.body)
            : tooltip)
        : null}
    </span>
  );
}
