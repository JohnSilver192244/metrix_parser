import React, { useEffect, useState } from "react";

import type { CompetitionResult } from "@metrix-parser/shared-types";

import { PageHeader } from "../../shared/page-header";
import {
  listResults,
  resolveResultsErrorMessage,
  resolveResultsTotal,
} from "../../shared/api/results";
import { useSessionStorageState } from "../../shared/session-storage";
import { decodeHtmlEntities } from "../../shared/text";

type ResultsPageState =
  | {
      status: "loading";
    }
  | {
      status: "error";
      message: string;
    }
  | {
      status: "ready";
      results: CompetitionResult[];
      total: number;
    };

type ResultsRdgaFilter = "all" | "rdga" | "non-rdga";

const resultsRdgaFilterStorageKey = "results-page:rdga-filter";

function formatDiff(value: number | null): string {
  if (value === null) {
    return "Не указан";
  }

  if (value > 0) {
    return `+${value}`;
  }

  return `${value}`;
}

function formatSum(value: number | null): string {
  return value === null ? "Не указан" : `${value}`;
}

function formatClassName(value: string | null): string {
  return value === null ? "Не указан" : value;
}

function resolveCompetitionLabel(result: CompetitionResult): string {
  return decodeHtmlEntities(result.competitionName?.trim()) || result.competitionId;
}

function resolvePlayerLabel(result: CompetitionResult): string {
  return decodeHtmlEntities(result.playerName?.trim()) || result.playerId;
}

function compareResultsForPlacement(
  left: CompetitionResult,
  right: CompetitionResult,
): number {
  if (left.dnf !== right.dnf) {
    return left.dnf ? 1 : -1;
  }

  const leftSum = left.sum ?? Number.POSITIVE_INFINITY;
  const rightSum = right.sum ?? Number.POSITIVE_INFINITY;
  if (leftSum !== rightSum) {
    return leftSum - rightSum;
  }

  const leftDiff = left.diff ?? Number.POSITIVE_INFINITY;
  const rightDiff = right.diff ?? Number.POSITIVE_INFINITY;
  if (leftDiff !== rightDiff) {
    return leftDiff - rightDiff;
  }

  return left.playerId.localeCompare(right.playerId, "ru");
}

function resolvePlacementLabelsByResult(
  results: readonly CompetitionResult[],
): Map<string, string> {
  const byCompetitionId = new Map<string, CompetitionResult[]>();

  for (const result of results) {
    const rows = byCompetitionId.get(result.competitionId) ?? [];
    rows.push(result);
    byCompetitionId.set(result.competitionId, rows);
  }

  const placementByResultKey = new Map<string, string>();

  for (const [competitionId, competitionResults] of byCompetitionId.entries()) {
    const ranked = [...competitionResults].sort(compareResultsForPlacement);
    let currentPlacement = 1;
    let index = 0;

    while (index < ranked.length) {
      const row = ranked[index];
      if (!row || row.dnf || row.sum === null) {
        placementByResultKey.set(`${competitionId}:${row?.playerId ?? index}`, "DNF");
        index += 1;
        continue;
      }

      let tieEndIndex = index + 1;
      while (tieEndIndex < ranked.length) {
        const next = ranked[tieEndIndex];
        if (!next || next.dnf || next.sum !== row.sum) {
          break;
        }
        tieEndIndex += 1;
      }

      const label = tieEndIndex - index > 1 ? `T${currentPlacement}` : `${currentPlacement}`;
      for (let tieIndex = index; tieIndex < tieEndIndex; tieIndex += 1) {
        const tied = ranked[tieIndex];
        if (!tied) {
          continue;
        }

        placementByResultKey.set(`${competitionId}:${tied.playerId}`, label);
      }

      currentPlacement += tieEndIndex - index;
      index = tieEndIndex;
    }
  }

  return placementByResultKey;
}

export interface ResultsPageViewProps {
  state: ResultsPageState;
  rdgaFilter?: ResultsRdgaFilter;
  onRdgaFilterChange?: (value: ResultsRdgaFilter) => void;
}

function filterResultsByRdga(
  results: CompetitionResult[],
  rdgaFilter: ResultsRdgaFilter,
): CompetitionResult[] {
  if (rdgaFilter === "rdga") {
    return results.filter((result) => result.playerRdga === true);
  }

  if (rdgaFilter === "non-rdga") {
    return results.filter((result) => result.playerRdga !== true);
  }

  return results;
}

export function ResultsPageView({
  state,
  rdgaFilter = "all",
  onRdgaFilterChange,
}: ResultsPageViewProps) {
  if (state.status === "loading") {
    return (
      <section className="data-page-shell" aria-labelledby="results-page-title">
        <PageHeader
          titleId="results-page-title"
          eyebrow="Данные"
          title="Результаты соревнований"
          description="Загружаем сохранённые результаты через backend API."
        />

        <section className="state-panel state-panel--pending" aria-live="polite">
          <p className="state-panel__eyebrow">loading</p>
          <h2>Подтягиваем результаты</h2>
          <p>Подождите немного, данные загружаются с серверного read-side.</p>
        </section>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="data-page-shell" aria-labelledby="results-page-title">
        <PageHeader
          titleId="results-page-title"
          eyebrow="Данные"
          title="Результаты соревнований"
          description="Страница использует backend API и сохраняет семантику DNF."
        />

        <section className="state-panel state-panel--error" role="alert">
          <p className="state-panel__eyebrow">error</p>
          <h2>Не удалось загрузить результаты</h2>
          <p>{state.message}</p>
        </section>
      </section>
    );
  }

  const { results, total } = state;
  const visibleResults = filterResultsByRdga(results, rdgaFilter);
  const placementLabelsByResult = resolvePlacementLabelsByResult(visibleResults);

  return (
    <section className="data-page-shell" aria-labelledby="results-page-title">
      <PageHeader
        titleId="results-page-title"
        eyebrow="Данные"
        title="Результаты соревнований"
        description={
          total > 0
            ? `В системе доступно ${total} результатов соревнований для просмотра.`
            : "Сохранённые результаты появятся здесь после обновления результатов соревнований."
        }
      />

      {results.length === 0 ? (
        <section className="state-panel" aria-live="polite">
          <p className="state-panel__eyebrow">empty</p>
          <h2>Пока нет сохранённых результатов</h2>
          <p>Сначала выполните обновление результатов в административном разделе.</p>
        </section>
      ) : (
        <>
          <section className="results-page__filters" aria-label="Фильтры результатов">
            <label className="results-page__filter">
              <span>RDGA</span>
              <select
                className="results-page__filter-select"
                value={rdgaFilter}
                onChange={(event) =>
                  onRdgaFilterChange?.(event.target.value as ResultsRdgaFilter)
                }
              >
                <option value="all">Все</option>
                <option value="rdga">Только RDGA</option>
                <option value="non-rdga">Без RDGA</option>
              </select>
            </label>
          </section>

          {visibleResults.length === 0 ? (
            <section className="state-panel" aria-live="polite">
              <p className="state-panel__eyebrow">filtered</p>
              <h2>По текущему фильтру результатов нет</h2>
              <p>Попробуйте выбрать другой вариант фильтра RDGA.</p>
            </section>
          ) : (
            <section className="data-table-panel" aria-label="Сохранённые результаты соревнований">
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Соревнование</th>
                      <th scope="col">Игрок</th>
                      <th scope="col">Класс</th>
                      <th scope="col">Место</th>
                      <th scope="col">Сумма</th>
                      <th scope="col">Diff</th>
                      <th scope="col">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleResults.map((result) => {
                      const isDnf = result.dnf;

                      return (
                        <tr
                          key={`${result.competitionId}-${result.playerId}`}
                          className={isDnf ? "data-table__row--warning" : undefined}
                        >
                          <td>{resolveCompetitionLabel(result)}</td>
                          <td>
                            <span className="data-table__primary-text-with-badge">
                              <span>{resolvePlayerLabel(result)}</span>
                              {result.playerRdga ? (
                                <span className="data-table__badge data-table__badge--info">
                                  RDGA
                                </span>
                              ) : null}
                            </span>
                          </td>
                          <td className="data-table__cell-primary">
                            {formatClassName(result.className)}
                          </td>
                          <td>
                            {placementLabelsByResult.get(
                              `${result.competitionId}:${result.playerId}`,
                            ) ?? "DNF"}
                          </td>
                          <td>{isDnf ? "DNF" : formatSum(result.sum)}</td>
                          <td>{isDnf ? "DNF" : formatDiff(result.diff)}</td>
                          <td>
                            <span
                              className={
                                isDnf
                                  ? "data-table__badge data-table__badge--warning"
                                  : "data-table__badge"
                              }
                            >
                              {isDnf ? "Не завершил раунд" : "Финишировал"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </section>
  );
}

export function ResultsPage() {
  const [state, setState] = useState<ResultsPageState>({
    status: "loading",
  });
  const [rdgaFilter, setRdgaFilter] = useSessionStorageState<ResultsRdgaFilter>(
    resultsRdgaFilterStorageKey,
    "all",
  );

  useEffect(() => {
    let isActive = true;

    void (async () => {
      try {
        const envelope = await listResults();

        if (!isActive) {
          return;
        }

        setState({
          status: "ready",
          results: envelope.data,
          total: resolveResultsTotal(envelope.data, envelope.meta),
        });
      } catch (error) {
        if (!isActive) {
          return;
        }

        setState({
          status: "error",
          message: resolveResultsErrorMessage(error),
        });
      }
    })();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <ResultsPageView
      state={state}
      rdgaFilter={rdgaFilter}
      onRdgaFilterChange={setRdgaFilter}
    />
  );
}
