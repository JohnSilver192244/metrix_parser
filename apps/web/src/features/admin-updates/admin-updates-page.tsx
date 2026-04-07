import React, { useMemo, useState } from "react";

import type {
  UpdateLifecyclePhase,
  UpdateOperationResult,
  UpdatePeriod,
} from "@metrix-parser/shared-types";

import { mapUpdateError, triggerUpdate } from "../../shared/api/updates";
import { UpdateActionCard } from "./update-action-card";
import { createDefaultUpdatePeriod, UpdatePeriodPicker } from "./update-period-picker";
import type { UpdateScenarioDefinition } from "./update-scenarios";
import { updateScenarios } from "./update-scenarios";
import { UpdateOperationStatus } from "./update-operation-status";

const updateSkipConditions = [
  "Соревнования не импортируются, если запись не из РФ. Такие записи отфильтровываются и не попадают в импорт.",
  "Соревнования пропускаются, если у записи нет competitionId, competitionName, competitionDate или courseId.",
  "Соревнования пропускаются, если в записи меньше 8 игроков.",
  "Соревнования не импортируются, если в названии есть «мастер-класс», «master class», «даблс» или «doubles» без учёта регистра.",
  "Парки пропускаются, если у сохранённого соревнования нельзя определить courseId.",
  "Парки пропускаются, если в payload курса нет courseId, name или course_par.",
  "Игроки пропускаются, если во фрагменте результата нет playerId или playerName.",
  "Игроки пропускаются при сохранении, если playerId или playerName пустые.",
  "Результаты пропускаются, если во фрагменте результата нет playerId или orderNumber.",
  "Результаты пропускаются, если запись не DNF и в ней нет sum или diff.",
  "Результаты пропускаются при сохранении, если пусты competitionId или playerId, отсутствует целочисленный orderNumber, либо для не-DNF записи отсутствуют sum или diff.",
] as const;

function PendingStatus({ scenario, period }: { scenario: UpdateScenarioDefinition; period: UpdatePeriod }) {
  return (
    <div className="update-card__status update-card__status--pending" role="status">
      <div className="update-card__status-heading">
        <strong>Выполняется обновление: {scenario.title}</strong>
        <span>Остальные кнопки временно заблокированы</span>
      </div>
      <p>Команда отправлена в backend API. Как только запрос завершится, здесь появится итоговая статистика.</p>
      <p>
        Период: {period.dateFrom} - {period.dateTo}
      </p>
      <dl className="update-card__summary-grid">
        <div>
          <dt>Найдено</dt>
          <dd>...</dd>
        </div>
        <div>
          <dt>Создано</dt>
          <dd>...</dd>
        </div>
        <div>
          <dt>Обновлено</dt>
          <dd>...</dd>
        </div>
        <div>
          <dt>Пропущено</dt>
          <dd>...</dd>
        </div>
        <div>
          <dt>Ошибок</dt>
          <dd>...</dd>
        </div>
      </dl>
    </div>
  );
}

export function AdminUpdatesPage() {
  const scenarios = useMemo(
    () =>
      updateScenarios.filter((scenario) =>
        ["competitions", "courses", "players"].includes(scenario.operation),
      ),
    [],
  );
  const [period, setPeriod] = useState<UpdatePeriod>(() => createDefaultUpdatePeriod());
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [phase, setPhase] = useState<UpdateLifecyclePhase>("idle");
  const [activeScenario, setActiveScenario] = useState<UpdateScenarioDefinition | null>(null);
  const [result, setResult] = useState<UpdateOperationResult | null>(null);
  const isSubmitting = phase === "submitting";
  const disabledReason = isSubmitting
    ? "Данные обновляются"
    : null;

  async function handleScenarioSubmit(scenario: UpdateScenarioDefinition) {
    const submittedPeriod = { ...period };

    setActiveScenario(scenario);
    setPhase("submitting");
    setResult(null);

    try {
      const response = await triggerUpdate(scenario.operation, {
        ...submittedPeriod,
        overwriteExisting,
      });
      setPhase(response.finalStatus === "failed" ? "error" : "success");
      setResult(response);
    } catch (error) {
      setPhase("error");
      setResult(mapUpdateError(scenario.operation, error, submittedPeriod));
    }
  }

  return (
    <section className="admin-shell" aria-labelledby="admin-updates-title">
      <section className="update-launcher" aria-label="Запуск обновлений">
        <div className="update-launcher__panel">
          <div className="update-launcher__intro">
            <div className="update-launcher__title-row">
              <h1 id="admin-updates-title">Обновление данных</h1>
              <span className="update-card__tooltip-anchor update-card__tooltip-anchor--info">
                <button
                  type="button"
                  className="update-launcher__info-button"
                  aria-label="Причины пропуска записей при обновлении"
                >
                  ?
                </button>
                <span
                  role="tooltip"
                  className="update-card__tooltip update-card__tooltip--info"
                >
                  <strong>Что может быть пропущено при обновлении</strong>
                  <ul className="update-card__tooltip-list">
                    {updateSkipConditions.map((condition) => (
                      <li key={condition}>{condition}</li>
                    ))}
                  </ul>
                </span>
              </span>
            </div>
            <p>Введите период и запустите нужное действие.</p>
          </div>
          <div className="update-launcher__controls">
            <UpdatePeriodPicker value={period} onChange={setPeriod} />
            <label className="update-launcher__checkbox">
              <input
                type="checkbox"
                checked={overwriteExisting}
                onChange={(event) => {
                  setOverwriteExisting(event.target.checked);
                }}
              />
              <span>Перезаписать имеющиеся данные</span>
            </label>
          </div>
          <div className="update-launcher__actions" aria-label="Сценарии обновления">
            {scenarios.map((scenario) => {
              return (
                <UpdateActionCard
                  key={scenario.operation}
                  scenario={scenario}
                  disabled={isSubmitting}
                  isActive={activeScenario?.operation === scenario.operation}
                  disabledReason={disabledReason}
                  onSubmit={handleScenarioSubmit}
                />
              );
            })}
          </div>
        </div>
      </section>

      <section className="update-launcher__status" aria-live="polite" aria-label="Статус обновления">
        {phase === "submitting" && activeScenario ? (
          <PendingStatus scenario={activeScenario} period={period} />
        ) : null}
        {phase !== "submitting" && result ? <UpdateOperationStatus result={result} /> : null}
        {phase === "idle" && !result ? (
          <div className="update-card__status update-card__status--idle">
            <div className="update-card__status-heading">
              <strong>Статистика появится здесь</strong>
              <span>После запуска одного из обновлений</span>
            </div>
            <p>Выберите общий период и нажмите нужную кнопку. Новый запуск скроет предыдущую статистику до завершения запроса.</p>
          </div>
        ) : null}
      </section>
    </section>
  );
}
