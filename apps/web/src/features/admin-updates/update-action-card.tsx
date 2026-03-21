import { useState } from "react";

import type {
  TriggerUpdateResponse,
  UpdateOperation,
  UpdatePeriod,
} from "@metrix-parser/shared-types";

import { triggerUpdate } from "../../shared/api/updates";
import { ApiClientError } from "../../shared/api/http";
import type { UpdateScenarioDefinition } from "./update-scenarios";

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

function formatOperationLabel(operation: UpdateOperation): string {
  return operation === "courses" ? "парков" : operation;
}

export function UpdateActionCard({ scenario }: UpdateActionCardProps) {
  const [period, setPeriod] = useState<UpdatePeriod>(() => createInitialPeriod(scenario.requiresPeriod));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<TriggerUpdateResponse | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await triggerUpdate(
        scenario.operation,
        scenario.requiresPeriod ? period : {},
      );

      setResult(response);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Не удалось отправить команду обновления.");
      }
      setResult(null);
    } finally {
      setIsSubmitting(false);
    }
  }

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
                  setPeriod((currentPeriod) => ({
                    ...currentPeriod,
                    dateFrom: event.target.value,
                  }));
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
                  setPeriod((currentPeriod) => ({
                    ...currentPeriod,
                    dateTo: event.target.value,
                  }));
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

      {errorMessage ? (
        <div className="update-card__status update-card__status--error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {result ? (
        <div className="update-card__status update-card__status--success">
          <strong>Команда принята.</strong>
          <p>{result.message}</p>
          <p>Запрос зарегистрирован: {new Date(result.requestedAt).toLocaleString("ru-RU")}.</p>
          {result.period ? (
            <p>
              Период для {formatOperationLabel(result.operation)}: {result.period.dateFrom} -{" "}
              {result.period.dateTo}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
