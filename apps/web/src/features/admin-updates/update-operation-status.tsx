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
        <dl className="update-card__summary-grid">
          <div>
            <dt>Found</dt>
            <dd>{result.summary.found}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{result.summary.created}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{result.summary.updated}</dd>
          </div>
          <div>
            <dt>Skipped</dt>
            <dd>{result.summary.skipped}</dd>
          </div>
          <div>
            <dt>Errors</dt>
            <dd>{result.summary.errors}</dd>
          </div>
        </dl>
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
    </div>
  );
}
