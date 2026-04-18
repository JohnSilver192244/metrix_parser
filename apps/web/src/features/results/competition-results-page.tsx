import React, { useEffect, useState } from "react";

import type {
  Competition,
  CompetitionResult,
} from "@metrix-parser/shared-types";
import {
  buildCompetitionChildrenByParentId,
  resolveCompetitionResultSourceIds,
} from "@metrix-parser/shared-types";

import {
  formatCompetitionRecordType,
  formatCompetitionDate,
  resolveCompetitionCourseName,
  resolveCompetitionExternalUrl,
} from "../competitions/competition-presenters";
import {
  getCompetitionContext,
  resolveCompetitionsErrorMessage,
} from "../../shared/api/competitions";
import {
  listResults,
  resolveResultsErrorMessage,
} from "../../shared/api/results";
import { ApiClientError } from "../../shared/api/http";
import { decodeHtmlEntities } from "../../shared/text";
import {
  consumeCompetitionResultsSourcePlayerContext,
  type CompetitionResultsSourcePlayer,
} from "../../shared/navigation-context";
import { buildPlayerPath } from "../../app/route-paths";

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
      categoryName: string;
      results: CompetitionResultsRow[];
      comment?: string | null;
    };

export interface CompetitionRoundBreakdown {
  roundId: string;
  roundName: string;
  diff: number | null;
}

export interface CompetitionResultsRow extends CompetitionResult {
  placement: number | null;
  placementLabel: string;
  roundBreakdown?: CompetitionRoundBreakdown[];
}

type CompetitionResultsSortField = "placement" | "diff";

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

function formatSeasonPoints(value: number | null | undefined): string {
  return value == null ? "—" : value.toFixed(2);
}

function formatPlayersCount(value: number | null): string {
  return value === null ? "—" : String(value);
}

function resolveCompetitionCategoryName(
  competition: Competition,
  categoryNamesById: Readonly<Record<string, string>>,
): string {
  if (!competition.categoryId) {
    return "Не указана";
  }

  const categoryName = categoryNamesById[competition.categoryId];
  const normalizedCategoryName = decodeHtmlEntities(categoryName?.trim() ?? "");

  return normalizedCategoryName.length > 0 ? normalizedCategoryName : "Не указана";
}

function resolveCompetitionComment(competition: Competition): string | null {
  const value = (competition as Competition & { comment?: string | null }).comment;
  const normalized = value?.trim() ?? "";

  return normalized.length > 0 ? normalized : null;
}

function resolvePlayerLabel(result: CompetitionResult): string {
  return decodeHtmlEntities(result.playerName?.trim()) || result.playerId;
}

interface ResolvedCompetitionDisplayContext {
  competition: Competition;
  resultCompetitionIds: string[];
}

type CompetitionHierarchyEntry = {
  competitionId: string;
  parentId: string | null;
  recordType: string | null;
  competition: Competition;
};

function resolveCompetitionNameTail(value: string): string {
  const normalizedValue = decodeHtmlEntities(value)
    .split("→")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  return normalizedValue[normalizedValue.length - 1] ?? decodeHtmlEntities(value).trim();
}

function composeParentPoolCompetitionName(
  parentCompetition: Competition,
  poolCompetition: Competition,
): string {
  const parentName = resolveCompetitionNameTail(parentCompetition.competitionName);
  const poolName = resolveCompetitionNameTail(poolCompetition.competitionName);

  if (!parentName) {
    return decodeHtmlEntities(poolCompetition.competitionName);
  }

  if (!poolName || poolName === parentName) {
    return parentName;
  }

  return `${parentName} · ${poolName}`;
}

export function resolveCompetitionDisplayContext(
  selectedCompetition: Competition,
  competitions: readonly Competition[],
): ResolvedCompetitionDisplayContext {
  const hierarchyEntries: CompetitionHierarchyEntry[] = competitions.map((competition) => ({
    competitionId: competition.competitionId,
    parentId: competition.parentId ?? null,
    recordType: competition.recordType,
    competition,
  }));
  const childrenByParentId = buildCompetitionChildrenByParentId(hierarchyEntries);
  const selectedCompetitionEntry: CompetitionHierarchyEntry = {
    competitionId: selectedCompetition.competitionId,
    parentId: selectedCompetition.parentId ?? null,
    recordType: selectedCompetition.recordType,
    competition: selectedCompetition,
  };
  const directChildren =
    (childrenByParentId.get(selectedCompetition.competitionId) ?? []).map(
      (entry) => entry.competition,
    );
  const directRoundChildren = directChildren.filter((competition) => competition.recordType === "1");

  if (directRoundChildren.length > 0) {
    return {
      competition: selectedCompetition,
      resultCompetitionIds: resolveCompetitionResultSourceIds(
        selectedCompetitionEntry,
        childrenByParentId,
      ),
    };
  }

  if (selectedCompetition.recordType === "3") {
    const parentCompetition =
      selectedCompetition.parentId
        ? competitions.find((competition) => {
            return competition.competitionId === selectedCompetition.parentId;
          }) ?? null
        : null;

    const roundChildren = directChildren.filter((competition) => competition.recordType === "1");
    if (roundChildren.length > 0) {
      return {
        competition: {
          ...selectedCompetition,
          competitionName: parentCompetition
            ? composeParentPoolCompetitionName(parentCompetition, selectedCompetition)
            : selectedCompetition.competitionName,
        },
        resultCompetitionIds: resolveCompetitionResultSourceIds(selectedCompetitionEntry, childrenByParentId),
      };
    }
  }

  if (selectedCompetition.recordType === "4") {
    const directPoolChildren = directChildren.filter((competition) => competition.recordType === "3");

    if (directPoolChildren.length === 1) {
      const [poolCompetition] = directPoolChildren;
      if (poolCompetition) {
        const poolRoundChildren =
          (childrenByParentId.get(poolCompetition.competitionId) ?? [])
            .map((entry) => entry.competition)
            .filter((competition) => competition.recordType === "1");

        if (poolRoundChildren.length > 0) {
          return {
            competition: {
              ...poolCompetition,
              competitionName: composeParentPoolCompetitionName(
                selectedCompetition,
                poolCompetition,
              ),
            },
            resultCompetitionIds: resolveCompetitionResultSourceIds(selectedCompetitionEntry, childrenByParentId),
          };
        }
      }
    }
  }

  return {
    competition: selectedCompetition,
    resultCompetitionIds: [selectedCompetition.competitionId],
  };
}

function compareCompetitionResults(
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

  return resolvePlayerLabel(left).localeCompare(resolvePlayerLabel(right), "ru");
}

function assignCalculatedPlacements(
  results: readonly CompetitionResultsRow[],
): CompetitionResultsRow[] {
  const rankedResults = [...results].sort(compareCompetitionResults);
  const placementByPlayerId = new Map<
    string,
    {
      placement: number | null;
      placementLabel: string;
    }
  >();

  let currentPlacement = 1;
  let index = 0;

  while (index < rankedResults.length) {
    const result = rankedResults[index];

    if (!result || result.dnf || result.sum === null) {
      placementByPlayerId.set(result?.playerId ?? `${index}`, {
        placement: null,
        placementLabel: "DNF",
      });
      index += 1;
      continue;
    }

    let tieEndIndex = index + 1;
    while (tieEndIndex < rankedResults.length) {
      const nextResult = rankedResults[tieEndIndex];
      if (!nextResult || nextResult.dnf || nextResult.sum !== result.sum) {
        break;
      }

      tieEndIndex += 1;
    }

    const isTie = tieEndIndex - index > 1;
    const placementLabel = isTie ? `T${currentPlacement}` : `${currentPlacement}`;

    for (let tieIndex = index; tieIndex < tieEndIndex; tieIndex += 1) {
      const tiedResult = rankedResults[tieIndex];
      if (!tiedResult) {
        continue;
      }

      placementByPlayerId.set(tiedResult.playerId, {
        placement: currentPlacement,
        placementLabel,
      });
    }

    currentPlacement += tieEndIndex - index;
    index = tieEndIndex;
  }

  return results.map((result) => {
    const placement = placementByPlayerId.get(result.playerId);

    return {
      ...result,
      placement: placement?.placement ?? null,
      placementLabel: placement?.placementLabel ?? "DNF",
    };
  });
}

export function resolveCompetitionResults(
  competition: Competition,
  competitions: readonly Competition[],
  resultsByCompetitionId: Readonly<Record<string, readonly CompetitionResult[]>>,
): CompetitionResultsRow[] {
  const directRoundCompetitions = competitions
    .filter((item) => item.parentId === competition.competitionId)
    .filter((item) => item.recordType === "1")
    .sort((left, right) => left.competitionDate.localeCompare(right.competitionDate));
  const resultSourceRoundCompetitions = Object.keys(resultsByCompetitionId)
    .map((competitionId) =>
      competitions.find((item) => item.competitionId === competitionId) ?? null,
    )
    .filter((item): item is Competition => item !== null && item.recordType === "1")
    .sort((left, right) => left.competitionDate.localeCompare(right.competitionDate));
  const roundCompetitions =
    directRoundCompetitions.length > 0
      ? directRoundCompetitions
      : resultSourceRoundCompetitions;

  if (roundCompetitions.length === 0) {
    return assignCalculatedPlacements(
      [...(resultsByCompetitionId[competition.competitionId] ?? [])].map((result) => ({
        ...result,
        placement: null,
        placementLabel: "DNF",
        roundBreakdown: [],
      })),
    );
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
      seasonPoints:
        playerResults.find((playerResult) => playerResult.seasonPoints != null)?.seasonPoints ??
        null,
      placement: null,
      placementLabel: "DNF",
      roundBreakdown,
    };
  });

  return assignCalculatedPlacements(aggregatedResults);
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

    const leftPlacement = left.placement ?? Number.MAX_SAFE_INTEGER;
    const rightPlacement = right.placement ?? Number.MAX_SAFE_INTEGER;
    if (sort.field === "placement" && leftPlacement !== rightPlacement) {
      return (leftPlacement - rightPlacement) * direction;
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

    if (leftPlacement !== rightPlacement) {
      return leftPlacement - rightPlacement;
    }

    return resolvePlayerLabel(left).localeCompare(resolvePlayerLabel(right), "ru");
  });
}

export function formatCompetitionPlacement(result: CompetitionResult): string {
  if ("placementLabel" in result && typeof result.placementLabel === "string") {
    return result.placementLabel;
  }

  if ("placement" in result && typeof result.placement === "number") {
    return `${result.placement}`;
  }

  return result.dnf ? "DNF" : "—";
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
  sourcePlayer?: CompetitionResultsSourcePlayer | null;
}

export function CompetitionResultsPageView({
  state,
  onNavigate,
  sourcePlayer,
}: CompetitionResultsPageViewProps) {
  const [sort, setSort] = useState<CompetitionResultsSort>(DEFAULT_SORT);
  const backButton = (
    <button
      className="page-back-link"
      type="button"
      onClick={() => {
        onNavigate("/");
      }}
    >
      К списку соревнований
    </button>
  );

  const currentPageLabel =
    state.status === "ready" ? decodeHtmlEntities(state.competition.competitionName) : "Турнир";
  const playerLabel = sourcePlayer
    ? decodeHtmlEntities(sourcePlayer.playerName.trim()) || sourcePlayer.playerId
    : null;
  const breadcrumbs = sourcePlayer && playerLabel ? (
    <nav className="page-breadcrumbs" aria-label="Хлебные крошки">
      <button
        className="page-breadcrumbs__link"
        type="button"
        onClick={() => {
          onNavigate("/players");
        }}
      >
        Игроки
      </button>
      <span className="page-breadcrumbs__separator" aria-hidden="true">
        /
      </span>
      <button
        className="page-breadcrumbs__link"
        type="button"
        onClick={() => {
          onNavigate(buildPlayerPath(sourcePlayer.playerId));
        }}
      >
        {playerLabel}
      </button>
      <span className="page-breadcrumbs__separator" aria-hidden="true">
        /
      </span>
      <span className="page-breadcrumbs__current">{currentPageLabel}</span>
    </nav>
  ) : null;

  if (state.status === "loading") {
    return (
      <section className="data-page-shell" aria-labelledby="competition-results-title">
        {breadcrumbs}
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
        {breadcrumbs}
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
        {breadcrumbs}
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
  const competitionComment = state.comment ?? null;
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
      {breadcrumbs}
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
          {formatCompetitionRecordType(competition.recordType)} · Игроков:{" "}
          {formatPlayersCount(competition.playersCount)} · Категория: {state.categoryName}
        </p>
        {competitionComment ? (
          <p className="competition-results-page__comment">{competitionComment}</p>
        ) : null}
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
                  <th scope="col">Очки</th>
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
                        <td className="data-table__cell-primary">{playerLabel}</td>
                        <td>{formatSum(result.sum)}</td>
                        <td>{formatDiff(result.diff)}</td>
                        <td>{formatSeasonPoints(result.seasonPoints)}</td>
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
  const [sourcePlayer] = useState<CompetitionResultsSourcePlayer | null>(() =>
    consumeCompetitionResultsSourcePlayerContext(competitionId),
  );

  useEffect(() => {
    let isActive = true;

    void (async () => {
      try {
        const context = await getCompetitionContext(competitionId);

        if (!isActive) {
          return;
        }

        const allCompetitions = context.hierarchy;
        const selectedCompetition = context.competition;
        const courseNamesById = context.courseNamesById;
        const categoryNamesById = context.categoryNamesById;
        const displayContext = resolveCompetitionDisplayContext(
          selectedCompetition,
          allCompetitions,
        );
        const resultCompetitionIds =
          context.resultCompetitionIds.length > 0
            ? context.resultCompetitionIds
            : displayContext.resultCompetitionIds;
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
          competition: displayContext.competition,
          comment: resolveCompetitionComment(selectedCompetition),
          courseName: resolveCompetitionCourseName(
            displayContext.competition,
            courseNamesById,
          ),
          categoryName: resolveCompetitionCategoryName(
            displayContext.competition,
            categoryNamesById,
          ),
          results: resolveCompetitionResults(
            displayContext.competition,
            allCompetitions,
            Object.fromEntries(resultEnvelopes),
          ),
        });
      } catch (error) {
        if (!isActive) {
          return;
        }

        if (error instanceof ApiClientError && error.code === "not_found") {
          setState({
            status: "not-found",
            competitionId,
          });
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

  return (
    <CompetitionResultsPageView
      state={state}
      onNavigate={onNavigate}
      sourcePlayer={sourcePlayer}
    />
  );
}
