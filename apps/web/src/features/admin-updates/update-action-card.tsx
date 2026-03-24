import React from "react";

import type { UpdateScenarioDefinition } from "./update-scenarios";

interface UpdateActionCardProps {
  scenario: UpdateScenarioDefinition;
  disabled?: boolean;
  isActive?: boolean;
  disabledReason?: string | null;
  onSubmit: (scenario: UpdateScenarioDefinition) => void;
}

export function UpdateActionCard({
  scenario,
  disabled = false,
  isActive = false,
  disabledReason = null,
  onSubmit,
}: UpdateActionCardProps) {
  const button = (
    <button
      className={`update-card__submit update-card__submit--action${isActive ? " update-card__submit--active" : ""}`}
      type="button"
      disabled={disabled}
      aria-pressed={isActive}
      onClick={() => {
        onSubmit(scenario);
      }}
    >
      {disabled && isActive ? `Выполняется: ${scenario.title}` : scenario.title}
    </button>
  );

  if (!disabledReason) {
    return button;
  }

  return (
    <span className="update-card__tooltip-anchor update-card__tooltip-anchor--button">
      {button}
      <span role="tooltip" className="update-card__tooltip update-card__tooltip--button">
        {disabledReason}
      </span>
    </span>
  );
}
