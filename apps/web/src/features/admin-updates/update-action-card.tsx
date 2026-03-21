import { useState } from "react";

import type {
  UpdateLifecyclePhase,
  UpdateOperationResult,
  UpdatePeriod,
} from "@metrix-parser/shared-types";

import { mapUpdateError, triggerUpdate } from "../../shared/api/updates";
import type { UpdateScenarioDefinition } from "./update-scenarios";
import { UpdateOperationStatus } from "./update-operation-status";

interface UpdateActionCardProps {
  scenario: UpdateScenarioDefinition;
}

const emptyPeriod: UpdatePeriod = {
  dateFrom: "",
  dateTo: "",
};

function createInitialPeriod(requiresPeriod: boolean): UpdatePeriod {
  return requiresPeriod ? emptyPeriod : { ...emptyPeriod };
}

export function UpdateActionCard({ scenario }: UpdateActionCardProps) {
  const [period, setPeriod] = useState<UpdatePeriod>(() => createInitialPeriod(scenario.requiresPeriod));
  const [phase, setPhase] = useState<UpdateLifecyclePhase>("idle");
  const [result, setResult] = useState<UpdateOperationResult | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPhase("submitting");
    setResult(null);

    const submittedPeriod = scenario.requiresPeriod ? { ...period } : undefined;

    try {
      const response = await triggerUpdate(scenario.operation, submittedPeriod ?? {});
      setPhase(response.finalStatus === "completed" ? "success" : "error");
      setResult(response);
    } catch (error) {
      setPhase("error");
      setResult(mapUpdateError(scenario.operation, error, submittedPeriod));
    }
  }

  function handlePeriodChange(field: keyof UpdatePeriod, value: string) {
    setPeriod((currentPeriod) => ({
      ...currentPeriod,
      [field]: value,
    }));

    if (phase !== "idle") {
      setPhase("idle");
      setResult(null);
    }
  }

  const isSubmitting = phase === "submitting";

  return (
    <article className="update-card">
      <div className="update-card__header">
        <p className="update-card__eyebrow">{scenario.operation}</p>
        <h2>{scenario.title}</h2>
      </div>
      <p className="update-card__description">{scenario.description}</p>
      <p className="update-card__helper">{scenario.helperText}</p>

      <form className="update-card__form" onSubmit={handleSubmit}>
        {scenario.requiresPeriod ? (
          <div className="update-card__period-grid">
            <label className="field">
              <span>Дата начала</span>
              <input
                type="date"
                name={`${scenario.operation}-date-from`}
                value={period.dateFrom}
                onChange={(event) => {
                  handlePeriodChange("dateFrom", event.target.value);
                }}
                required
              />
            </label>
            <label className="field">
              <span>Дата окончания</span>
              <input
                type="date"
                name={`${scenario.operation}-date-to`}
                value={period.dateTo}
                onChange={(event) => {
                  handlePeriodChange("dateTo", event.target.value);
                }}
                required
              />
            </label>
          </div>
        ) : (
          <div className="update-card__passive-note">
            Для этого сценария период не нужен: запуск идёт по уже сохранённым данным.
          </div>
        )}

        <button className="update-card__submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Отправка команды..." : scenario.submitLabel}
        </button>
      </form>

      {phase === "submitting" ? (
        <div className="update-card__status update-card__status--pending" role="status">
          <div className="update-card__status-heading">
            <strong>Выполняется</strong>
            <span>Только для этой операции</span>
          </div>
          <p>Команда отправлена в backend API. Остальные сценарии остаются доступными.</p>
          <dl className="update-card__summary-grid">
            <div>
              <dt>Found</dt>
              <dd>...</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>...</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>...</dd>
            </div>
            <div>
              <dt>Skipped</dt>
              <dd>...</dd>
            </div>
          </dl>
        </div>
      ) : null}

      {result ? <UpdateOperationStatus result={result} /> : null}
    </article>
  );
}
