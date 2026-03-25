import React, { useEffect, useState } from "react";

import type {
  Competition,
  CompetitionResult,
} from "@metrix-parser/shared-types";

import {
  createCourseNamesById,
  formatCompetitionRecordType,
  formatCompetitionDate,
  resolveCompetitionCourseName,
  resolveCompetitionExternalUrl,
} from "../competitions/competition-presenters";
import {
  listCompetitions,
  resolveCompetitionsErrorMessage,
} from "../../shared/api/competitions";
import { listCourses } from "../../shared/api/courses";
import {
  listResults,
  resolveResultsErrorMessage,
} from "../../shared/api/results";
import { decodeHtmlEntities } from "../../shared/text";

type CompetitionResultsPageState =
  | {
      status: "loading";
    }
  | {
      status: "error";
      message: string;
    }
  | {
      status: "not-found";
      competitionId: string;
    }
  | {
      status: "ready";
      competition: Competition;
      courseName: string;
      results: CompetitionResultsRow[];
    };

export interface CompetitionRoundBreakdown {
  roundId: string;
  roundName: string;
  diff: number | null;
}

export interface CompetitionResultsRow extends CompetitionResult {
  roundBreakdown?: CompetitionRoundBreakdown[];
}

type CompetitionResultsSortField = "placement" | "className" | "diff";

interface CompetitionResultsSort {
  field: CompetitionResultsSortField;
  direction: "asc" | "desc";
}

const DEFAULT_SORT: CompetitionResultsSort = {
  field: "placement",
  direction: "asc",
};

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

function resolvePlayerLabel(result: CompetitionResult): string {
  return decodeHtmlEntities(result.playerName?.trim()) || result.playerId;
}

function formatClassName(value: string | null): string {
  return value === null ? "Не указан" : value;
}

function compareCompetitionResults(
  left: CompetitionResultsRow,
  right: CompetitionResultsRow,
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

  return resolvePlayerLabel(left).localeCompare(resolvePlayerLabel(right), "ru");
}

export function resolveCompetitionResults(
  competition: Competition,
  competitions: readonly Competition[],
  resultsByCompetitionId: Readonly<Record<string, readonly CompetitionResult[]>>,
): CompetitionResultsRow[] {
  if (competition.recordType !== "4") {
    return [...(resultsByCompetitionId[competition.competitionId] ?? [])].map((result) => ({
      ...result,
      roundBreakdown: [],
    }));
  }

  const roundCompetitions = competitions
    .filter((item) => item.parentId === competition.competitionId)
    .sort((left, right) => left.competitionDate.localeCompare(right.competitionDate));

  if (roundCompetitions.length === 0) {
    return [...(resultsByCompetitionId[competition.competitionId] ?? [])].map((result) => ({
      ...result,
      roundBreakdown: [],
    }));
  }

  const expectedRoundIds = new Set(
    roundCompetitions.map((roundCompetition) => roundCompetition.competitionId),
  );
  const resultsByPlayerId = new Map<string, CompetitionResult[]>();
  const roundNamesById = new Map<string, string>(
    roundCompetitions.map((roundCompetition) => [
      roundCompetition.competitionId,
      decodeHtmlEntities(roundCompetition.competitionName),
    ]),
  );
  for (const roundCompetition of roundCompetitions) {
    const roundResults = resultsByCompetitionId[roundCompetition.competitionId] ?? [];

    for (const result of roundResults) {
      const existingResults = resultsByPlayerId.get(result.playerId) ?? [];
      existingResults.push(result);
      resultsByPlayerId.set(result.playerId, existingResults);
    }
  }

  const aggregatedResults = Array.from(resultsByPlayerId.values()).map((playerResults) => {
    const [baseResult] = [...playerResults].sort(compareCompetitionResults);
    const playerRoundIds = new Set(
      playerResults.map((playerResult) => playerResult.competitionId),
    );
    const isMissingRound = expectedRoundIds.size !== playerRoundIds.size;
    const dnf = isMissingRound || playerResults.some((playerResult) => playerResult.dnf);
    const sum = dnf
      ? null
      : playerResults.every((playerResult) => playerResult.sum !== null)
        ? playerResults.reduce((total, playerResult) => total + (playerResult.sum ?? 0), 0)
        : null;
    const diff = dnf
      ? null
      : playerResults.every((playerResult) => playerResult.diff !== null)
        ? playerResults.reduce((total, playerResult) => total + (playerResult.diff ?? 0), 0)
        : null;

    const roundBreakdown = [...playerResults]
      .sort((left, right) => {
        return left.competitionId.localeCompare(right.competitionId, "ru");
      })
      .map((playerResult) => ({
        roundId: playerResult.competitionId,
        roundName:
          roundNamesById.get(playerResult.competitionId) ??
          decodeHtmlEntities(playerResult.competitionName ?? playerResult.competitionId),
        diff: playerResult.diff,
      }));

    return {
      ...baseResult,
      competitionId: competition.competitionId,
      competitionName: competition.competitionName,
      sum,
      diff,
      dnf,
      orderNumber: Number.MAX_SAFE_INTEGER,
      roundBreakdown,
    };
  });

  const placementsByPlayerId = new Map<string, number>();
  const resultsByClassName = new Map<string, CompetitionResultsRow[]>();

  for (const result of aggregatedResults) {
    const classKey = formatClassName(result.className);
    const classResults = resultsByClassName.get(classKey) ?? [];
    classResults.push(result);
    resultsByClassName.set(classKey, classResults);
  }

  for (const classResults of resultsByClassName.values()) {
    const rankedResults = classResults
      .filter((result) => !result.dnf && result.sum !== null)
      .sort(compareCompetitionResults);

    rankedResults.forEach((result, index) => {
      placementsByPlayerId.set(result.playerId, index + 1);
    });
  }

  return aggregatedResults.map((result) => ({
    ...result,
    orderNumber: placementsByPlayerId.get(result.playerId) ?? Number.MAX_SAFE_INTEGER,
  }));
}

export function sortCompetitionResults(
  results: readonly CompetitionResultsRow[],
  sort: CompetitionResultsSort = DEFAULT_SORT,
): CompetitionResultsRow[] {
  return [...results].sort((left, right) => {
    if (left.dnf !== right.dnf) {
      return left.dnf ? 1 : -1;
    }

    const direction = sort.direction === "asc" ? 1 : -1;

    if (sort.field === "placement" && left.orderNumber !== right.orderNumber) {
      return (left.orderNumber - right.orderNumber) * direction;
    }

    if (sort.field === "className") {
      const classNameComparison = formatClassName(left.className).localeCompare(
        formatClassName(right.className),
        "ru",
      );

      if (classNameComparison !== 0) {
        return classNameComparison * direction;
      }

      const leftDiff = left.diff ?? Number.POSITIVE_INFINITY;
      const rightDiff = right.diff ?? Number.POSITIVE_INFINITY;

      if (leftDiff !== rightDiff) {
        return leftDiff - rightDiff;
      }
    }

    if (sort.field === "diff") {
      const leftDiff = left.diff ?? Number.POSITIVE_INFINITY;
      const rightDiff = right.diff ?? Number.POSITIVE_INFINITY;

      if (leftDiff !== rightDiff) {
        return (leftDiff - rightDiff) * direction;
      }
    }

    const leadingComparison = compareCompetitionResults(left, right);
    if (leadingComparison !== 0) {
      return leadingComparison;
    }

    if (left.orderNumber !== right.orderNumber) {
      return left.orderNumber - right.orderNumber;
    }

    return resolvePlayerLabel(left).localeCompare(resolvePlayerLabel(right), "ru");
  });
}

export function formatCompetitionPlacement(result: CompetitionResult): string {
  return result.dnf ? "DNF" : `${result.orderNumber}`;
}

function resolveCompetitionResultsErrorMessage(
  competitionError: unknown,
  resultsError: unknown,
): string {
  if (resultsError) {
    return resolveResultsErrorMessage(resultsError);
  }

  return resolveCompetitionsErrorMessage(competitionError);
}

export interface CompetitionResultsPageViewProps {
  state: CompetitionResultsPageState;
  onNavigate: (pathname: string) => void;
}

export function CompetitionResultsPageView({
  state,
  onNavigate,
}: CompetitionResultsPageViewProps) {
  const [sort, setSort] = useState<CompetitionResultsSort>(DEFAULT_SORT);
  const backButton = (
    <button
      className="page-back-link"
      type="button"
      onClick={() => {
        onNavigate("/competitions");
      }}
    >
      К списку соревнований
    </button>
  );

  if (state.status === "loading") {
    return (
      <section className="data-page-shell" aria-labelledby="competition-results-title">
        {backButton}

        <section className="state-panel state-panel--pending" aria-live="polite">
          <p className="state-panel__eyebrow">loading</p>
          <h2 id="competition-results-title">Подтягиваем результаты соревнования</h2>
          <p>Подождите немного, подготавливаем карточку соревнования и итоговую таблицу.</p>
        </section>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="data-page-shell" aria-labelledby="competition-results-title">
        {backButton}

        <section className="state-panel state-panel--error" role="alert">
          <p className="state-panel__eyebrow">error</p>
          <h2 id="competition-results-title">Не удалось открыть результаты соревнования</h2>
          <p>{state.message}</p>
        </section>
      </section>
    );
  }

  if (state.status === "not-found") {
    return (
      <section className="data-page-shell" aria-labelledby="competition-results-title">
        {backButton}

        <section className="state-panel" aria-live="polite">
          <p className="state-panel__eyebrow">empty</p>
          <h2 id="competition-results-title">Соревнование не найдено</h2>
          <p>
            В сохранённых данных нет записи с идентификатором <strong>{state.competitionId}</strong>.
          </p>
        </section>
      </section>
    );
  }

  const { competition, courseName, results } = state;
  const orderedResults = sortCompetitionResults(results, sort);
  const competitionName = decodeHtmlEntities(competition.competitionName);
  const courseLabel = decodeHtmlEntities(courseName);
  const externalUrl = resolveCompetitionExternalUrl(competition.competitionId);
  const toggleSort = (field: CompetitionResultsSortField) => {
    setSort((currentSort) => {
      if (currentSort.field === field) {
        return {
          field,
          direction: currentSort.direction === "asc" ? "desc" : "asc",
        };
      }

      return {
        field,
        direction: "asc",
      };
    });
  };
  const resolveSortIndicator = (field: CompetitionResultsSortField): string => {
    if (sort.field !== field) {
      return "";
    }

    return sort.direction === "asc" ? " ▲" : " ▼";
  };
  const resolveAriaSort = (
    field: CompetitionResultsSortField,
  ): "ascending" | "descending" | "none" => {
    if (sort.field !== field) {
      return "none";
    }

    return sort.direction === "asc" ? "ascending" : "descending";
  };

  return (
    <section className="data-page-shell" aria-labelledby="competition-results-title">
      {backButton}

      <header className="competition-results-page__header">
        <h1 id="competition-results-title" className="competition-results-page__title">
          <span>{competitionName}</span>
          <a
            className="data-table__external-link"
            href={externalUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`Открыть соревнование ${competitionName} на Disc Golf Metrix в новой вкладке`}
          >
            <svg
              className="data-table__external-link-icon"
              viewBox="0 0 16 16"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M6 3h7v7M13 3 6 10M10 6v7H3V6h7"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        </h1>
        <p className="competition-results-page__meta">
          {formatCompetitionDate(competition.competitionDate)} · {courseLabel} ·{" "}
          {formatCompetitionRecordType(competition.recordType)}
        </p>
      </header>

      {orderedResults.length === 0 ? (
        <section className="state-panel" aria-live="polite">
          <p className="state-panel__eyebrow">empty</p>
          <h2>Пока нет сохранённых результатов</h2>
          <p>
            Для этого соревнования ещё не загружены итоговые результаты
            {competition.recordType === "4" ? " по раундам" : ""}.
          </p>
        </section>
      ) : (
        <section
          className="data-table-panel"
          aria-label={`Результаты соревнования ${competitionName}`}
        >
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col" aria-sort={resolveAriaSort("placement")}>
                    <button
                      className="data-table__sort-button"
                      type="button"
                      onClick={() => {
                        toggleSort("placement");
                      }}
                    >
                      Место{resolveSortIndicator("placement")}
                    </button>
                  </th>
                  <th scope="col" aria-sort={resolveAriaSort("className")}>
                    <button
                      className="data-table__sort-button"
                      type="button"
                      onClick={() => {
                        toggleSort("className");
                      }}
                    >
                      Class{resolveSortIndicator("className")}
                    </button>
                  </th>
                  <th scope="col">Игрок</th>
                  <th scope="col">Сумма</th>
                  <th scope="col" aria-sort={resolveAriaSort("diff")}>
                    <button
                      className="data-table__sort-button"
                      type="button"
                      onClick={() => {
                        toggleSort("diff");
                      }}
                    >
                      Diff{resolveSortIndicator("diff")}
                    </button>
                  </th>
                  <th scope="col">Раунд</th>
                  <th scope="col">Результат</th>
                </tr>
              </thead>
              <tbody>
                {orderedResults.map((result) => {
                  const playerLabel = resolvePlayerLabel(result);
                  const roundBreakdown = result.roundBreakdown ?? [];
                  const primaryRound = roundBreakdown[0] ?? null;
                  const additionalRounds = roundBreakdown.slice(1);

                  return (
                    <React.Fragment key={`${result.competitionId}-${result.playerId}`}>
                      <tr
                        className={result.dnf ? "data-table__row--warning" : undefined}
                      >
                        <td>{formatCompetitionPlacement(result)}</td>
                        <td>{formatClassName(result.className)}</td>
                        <td className="data-table__cell-primary">{playerLabel}</td>
                        <td>{formatSum(result.sum)}</td>
                        <td>{formatDiff(result.diff)}</td>
                        <td>{primaryRound ? primaryRound.roundName : "—"}</td>
                        <td>{primaryRound ? formatDiff(primaryRound.diff) : "—"}</td>
                      </tr>
                      {additionalRounds.map((round) => (
                        <tr
                          key={`${result.competitionId}-${result.playerId}-${round.roundId}`}
                          className="data-table__row--subtle"
                        >
                          <td></td>
                          <td></td>
                          <td></td>
                          <td></td>
                          <td></td>
                          <td className="data-table__subrow-label">{round.roundName}</td>
                          <td>{formatDiff(round.diff)}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </section>
  );
}

export interface CompetitionResultsPageProps {
  competitionId: string;
  onNavigate: (pathname: string) => void;
}

export function CompetitionResultsPage({
  competitionId,
  onNavigate,
}: CompetitionResultsPageProps) {
  const [state, setState] = useState<CompetitionResultsPageState>({
    status: "loading",
  });

  useEffect(() => {
    let isActive = true;

    void (async () => {
      try {
        const [competitionsResult, coursesResult] = await Promise.allSettled([
          listCompetitions(),
          listCourses(),
        ]);

        if (!isActive) {
          return;
        }

        if (competitionsResult.status === "rejected") {
          setState({
            status: "error",
            message: resolveCompetitionResultsErrorMessage(
              competitionsResult.reason,
              null,
            ),
          });

          return;
        }

        const allCompetitions = competitionsResult.value.data;
        const competition = allCompetitions.find((item) => {
          return item.competitionId === competitionId;
        });

        if (!competition) {
          setState({
            status: "not-found",
            competitionId,
          });

          return;
        }

        const courseNamesById =
          coursesResult.status === "fulfilled"
            ? createCourseNamesById(coursesResult.value.data)
            : {};
        const roundCompetitions =
          competition.recordType === "4"
            ? allCompetitions.filter((item) => item.parentId === competition.competitionId)
            : [];
        const resultCompetitionIds =
          roundCompetitions.length > 0
            ? roundCompetitions.map((item) => item.competitionId)
            : [competition.competitionId];
        const resultEnvelopes = await Promise.all(
          resultCompetitionIds.map(async (resultCompetitionId) => {
            const response = await listResults({
              competitionId: resultCompetitionId,
            });

            return [resultCompetitionId, response.data] as const;
          }),
        );

        if (!isActive) {
          return;
        }

        setState({
          status: "ready",
          competition,
          courseName: resolveCompetitionCourseName(competition, courseNamesById),
          results: resolveCompetitionResults(
            competition,
            allCompetitions,
            Object.fromEntries(resultEnvelopes),
          ),
        });
      } catch (error) {
        if (!isActive) {
          return;
        }

        setState({
          status: "error",
          message: resolveCompetitionResultsErrorMessage(null, error),
        });
      }
    })();

    return () => {
      isActive = false;
    };
  }, [competitionId]);

  return <CompetitionResultsPageView state={state} onNavigate={onNavigate} />;
}
