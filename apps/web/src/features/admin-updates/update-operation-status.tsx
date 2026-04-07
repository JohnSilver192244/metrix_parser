import React from "react";

import type { UpdateOperationResult } from "@metrix-parser/shared-types";

interface UpdateOperationStatusProps {
  result: UpdateOperationResult;
}

function getStatusLabel(finalStatus: UpdateOperationResult["finalStatus"]): string {
  if (finalStatus === "completed") {
    return "Завершено";
  }

  if (finalStatus === "completed_with_issues") {
    return "Завершено с пропусками";
  }

  return "Завершилось с ошибкой";
}

function getDiagnosticsLabel(sectionKey: "transport" | "players" | "results"): string {
  if (sectionKey === "transport") {
    return "Получение данных";
  }

  if (sectionKey === "players") {
    return "Игроки";
  }

  return "Результаты";
}

function getSummaryLabel(
  summaryKey: "found" | "created" | "updated" | "skipped" | "errors",
): string {
  if (summaryKey === "found") {
    return "Найдено";
  }

  if (summaryKey === "created") {
    return "Создано";
  }

  if (summaryKey === "updated") {
    return "Обновлено";
  }

  if (summaryKey === "skipped") {
    return "Пропущено";
  }

  return "Ошибок";
}

export function UpdateOperationStatus({ result }: UpdateOperationStatusProps) {
  const statusModifier =
    result.finalStatus === "completed"
      ? "update-card__status--success"
      : result.finalStatus === "completed_with_issues"
        ? "update-card__status--warning"
        : "update-card__status--error";

  return (
    <div className={`update-card__status ${statusModifier}`} role="status">
      <div className="update-card__status-heading">
        <strong>{getStatusLabel(result.finalStatus)}</strong>
        <span>{new Date(result.finishedAt).toLocaleString("ru-RU")}</span>
      </div>
      {result.source === "stub" ? (
        <p className="update-card__status-note">
          Демонстрационный результат: статистика показана из согласованного API stub до
          подключения реального pipeline.
        </p>
      ) : null}
      <p>{result.message}</p>
      {result.period ? (
        <p>
          Период: {result.period.dateFrom} - {result.period.dateTo}
        </p>
      ) : null}
      {result.summary ? (
        <>
          <dl className="update-card__summary-grid">
            <div>
              <dt>{getSummaryLabel("found")}</dt>
              <dd>{result.summary.found}</dd>
            </div>
            <div>
              <dt>{getSummaryLabel("created")}</dt>
              <dd>{result.summary.created}</dd>
            </div>
            <div>
              <dt>{getSummaryLabel("updated")}</dt>
              <dd>{result.summary.updated}</dd>
            </div>
            <div>
              <dt>{getSummaryLabel("skipped")}</dt>
              <dd>{result.summary.skipped}</dd>
            </div>
            <div>
              <dt>{getSummaryLabel("errors")}</dt>
              <dd>{result.summary.errors}</dd>
            </div>
          </dl>
          {result.diagnostics ? (
            <div className="update-card__diagnostics">
              <p className="update-card__status-note">
                Детальная разбивка показывает, какие данные были получены, сохранены или
                пропущены по этапам обработки.
              </p>
              {(["transport", "players", "results"] as const).map((sectionKey) => {
                const section = result.diagnostics?.[sectionKey];

                if (!section) {
                  return null;
                }

                return (
                  <section key={sectionKey} className="update-card__diagnostics-section">
                    <h3>{getDiagnosticsLabel(sectionKey)}</h3>
                    <dl className="update-card__summary-grid">
                      <div>
                        <dt>{getSummaryLabel("found")}</dt>
                        <dd>{section.summary.found}</dd>
                      </div>
                      <div>
                        <dt>{getSummaryLabel("created")}</dt>
                        <dd>{section.summary.created}</dd>
                      </div>
                      <div>
                        <dt>{getSummaryLabel("updated")}</dt>
                        <dd>{section.summary.updated}</dd>
                      </div>
                      <div>
                        <dt>{getSummaryLabel("skipped")}</dt>
                        <dd>{section.summary.skipped}</dd>
                      </div>
                      <div>
                        <dt>{getSummaryLabel("errors")}</dt>
                        <dd>{section.summary.errors}</dd>
                      </div>
                    </dl>
                    {section.issues.length > 0 ? (
                      <ul className="update-card__issues-list">
                        {section.issues.map((issue) => (
                          <li key={`${sectionKey}-${issue.code}-${issue.recordKey ?? issue.message}`}>
                            {issue.recordKey ? `${issue.recordKey}: ` : ""}
                            {issue.message}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </section>
                );
              })}
            </div>
          ) : null}
        </>
      ) : (
        <p className="update-card__status-note">
          Итоговая статистика недоступна, потому что операция завершилась ошибкой до
          получения корректного результата.
        </p>
      )}
      {result.issues.length > 0 ? (
        <ul className="update-card__issues-list">
          {result.issues.map((issue) => (
            <li key={`${issue.code}-${issue.recordKey ?? issue.message}`}>
              {issue.recordKey ? `${issue.recordKey}: ` : ""}
              {issue.message}
            </li>
          ))}
        </ul>
      ) : null}
      {result.skipReasons && result.skipReasons.length > 0 ? (
        <ul className="update-card__issues-list">
          {result.skipReasons.map((issue) => (
            <li key={`skip-${issue.code}-${issue.recordKey ?? issue.message}`}>
              {issue.recordKey ? `${issue.recordKey}: ` : ""}
              {issue.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
