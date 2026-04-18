import React, { useEffect, useMemo, useState } from "react";

import type {
  Player,
  PlayerCompetitionResult,
  Season,
  UpdatePeriod,
} from "@metrix-parser/shared-types";

import { buildCompetitionResultsPath } from "../../app/route-paths";
import { UpdatePeriodPicker } from "../admin-updates/update-period-picker";
import {
  formatCompetitionDate,
  resolveCompetitionExternalUrl,
} from "../competitions/competition-presenters";
import { PageHeader } from "../../shared/page-header";
import { SideDrawer } from "../../shared/side-drawer";
import {
  getPlayer,
  listPlayerResults,
  resolvePlayerResultsTotal,
  resolvePlayersErrorMessage,
} from "../../shared/api/players";
import { listSeasons, resolveSeasonsErrorMessage } from "../../shared/api/seasons";
import { ApiClientError } from "../../shared/api/http";
import { useSessionStorageState } from "../../shared/session-storage";
import { decodeHtmlEntities } from "../../shared/text";
import { setCompetitionResultsSourcePlayerContext } from "../../shared/navigation-context";

type PlayerHeaderState =
  | {
      status: "loading";
    }
  | {
      status: "error";
      message: string;
    }
  | {
      status: "not-found";
      playerId: string;
    }
  | {
      status: "ready";
      player: Player;
      seasons: Season[];
    };

type PlayerResultsState =
  | {
      status: "loading";
    }
  | {
      status: "error";
      message: string;
    }
  | {
      status: "ready";
      rows: PlayerCompetitionResult[];
      total: number;
    };

const playersSeasonFilterStorageKey = "players-page:season-filter";
const discGolfMetrixBaseUrl =
  import.meta.env?.VITE_DISCGOLFMETRIX_BASE_URL ??
  import.meta.env?.DISCGOLFMETRIX_BASE_URL ??
  "https://discgolfmetrix.com";

export type PlayerResultsSortField =
  | "competitionName"
  | "competitionDate"
  | "category"
  | "placement"
  | "seasonPoints";

export interface PlayerResultsSort {
  field: PlayerResultsSortField;
  direction: "asc" | "desc";
}

export const DEFAULT_PLAYER_RESULTS_SORT: PlayerResultsSort = {
  field: "seasonPoints",
  direction: "desc",
};

const SORT_DEFAULT_DIRECTION_BY_FIELD: Readonly<Record<PlayerResultsSortField, "asc" | "desc">> = {
  competitionName: "asc",
  competitionDate: "desc",
  category: "asc",
  placement: "asc",
  seasonPoints: "desc",
};

function FiltersIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M4 6h16M7 12h10M10 18h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface PlayerResultsFiltersSectionProps {
  seasonCode: string;
  period: UpdatePeriod;
  seasons: Season[];
  onSeasonCodeChange?: (value: string) => void;
  onPeriodChange?: (period: UpdatePeriod) => void;
}

function PlayerResultsFiltersSection({
  seasonCode,
  period,
  seasons,
  onSeasonCodeChange,
  onPeriodChange,
}: PlayerResultsFiltersSectionProps) {
  return (
    <section className="competitions-page__filters" aria-label="Фильтры результатов игрока">
      <label className="competitions-page__filter">
        <span>Сезон</span>
        <select
          className="competitions-page__filter-control"
          value={seasonCode}
          onChange={(event) => {
            onSeasonCodeChange?.(event.target.value);
          }}
        >
          {seasons.map((season) => (
            <option key={season.seasonCode} value={season.seasonCode}>
              {season.name}
            </option>
          ))}
        </select>
      </label>

      <label className="competitions-page__filter">
        <span>Период</span>
        <UpdatePeriodPicker
          value={period}
          onChange={(nextPeriod) => {
            onPeriodChange?.(nextPeriod);
          }}
          label="Период"
          hideTriggerLabel={true}
          inputNames={{
            dateFrom: "player-page-date-from",
            dateTo: "player-page-date-to",
          }}
        />
      </label>
    </section>
  );
}

export interface PlayerPageViewProps {
  headerState: PlayerHeaderState;
  resultsState: PlayerResultsState;
  seasonCode: string;
  period: UpdatePeriod;
  mobileFiltersOpen?: boolean;
  onSeasonCodeChange?: (value: string) => void;
  onPeriodChange?: (period: UpdatePeriod) => void;
  onNavigate: (pathname: string) => void;
}

function compareSeasonsByPeriod(left: Season, right: Season): number {
  const dateToDiff = right.dateTo.localeCompare(left.dateTo, "ru");
  if (dateToDiff !== 0) {
    return dateToDiff;
  }

  const dateFromDiff = right.dateFrom.localeCompare(left.dateFrom, "ru");
  if (dateFromDiff !== 0) {
    return dateFromDiff;
  }

  return right.seasonCode.localeCompare(left.seasonCode, "ru");
}

function formatCategory(value: string | null): string {
  return value && value.trim().length > 0 ? value : "Не указана";
}

function formatPlacement(value: number | null, dnf: boolean): string {
  if (dnf || value == null) {
    return "DNF";
  }

  return String(value);
}

function formatPoints(value: number | null): string {
  return value == null ? "—" : value.toFixed(2);
}

function resolvePlayerName(player: Player): string {
  return decodeHtmlEntities(player.playerName) || player.playerId;
}

function resolvePlayerExternalUrl(playerId: string): string {
  return new URL(`/player/${playerId}`, discGolfMetrixBaseUrl).toString();
}

function compareOptionalNumber(
  left: number | null,
  right: number | null,
): number {
  if (left === right) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return left - right;
}

function compareOptionalNumberWithDirection(
  left: number | null,
  right: number | null,
  direction: "asc" | "desc",
): number {
  const valueDiff = compareOptionalNumber(left, right);
  if (valueDiff === 0) {
    return 0;
  }

  if (left === null || right === null) {
    return valueDiff;
  }

  return direction === "asc" ? valueDiff : -valueDiff;
}

function resolveRowPlacementValue(row: PlayerCompetitionResult): number | null {
  return row.dnf ? null : row.placement;
}

function comparePlayerResultRowsByField(
  left: PlayerCompetitionResult,
  right: PlayerCompetitionResult,
  field: PlayerResultsSortField,
): number {
  if (field === "competitionName") {
    return decodeHtmlEntities(left.competitionName).localeCompare(
      decodeHtmlEntities(right.competitionName),
      "ru",
    );
  }

  if (field === "competitionDate") {
    return left.competitionDate.localeCompare(right.competitionDate, "ru");
  }

  if (field === "category") {
    return formatCategory(left.category).localeCompare(formatCategory(right.category), "ru");
  }

  return 0;
}

function resolvePlayerResultsSortIndicator(
  sort: PlayerResultsSort,
  field: PlayerResultsSortField,
): string {
  if (sort.field !== field) {
    return "";
  }

  return sort.direction === "asc" ? " ↑" : " ↓";
}

function resolvePlayerResultsAriaSort(
  sort: PlayerResultsSort,
  field: PlayerResultsSortField,
): "ascending" | "descending" | "none" {
  if (sort.field !== field) {
    return "none";
  }

  return sort.direction === "asc" ? "ascending" : "descending";
}

export function sortPlayerResultsRows(
  rows: readonly PlayerCompetitionResult[],
  sort: PlayerResultsSort,
): PlayerCompetitionResult[] {
  return [...rows].sort((left, right) => {
    let fieldDiff = 0;

    if (sort.field === "competitionName") {
      fieldDiff = comparePlayerResultRowsByField(left, right, sort.field);
      if (sort.direction === "desc") {
        fieldDiff *= -1;
      }
    } else if (sort.field === "competitionDate") {
      fieldDiff = comparePlayerResultRowsByField(left, right, sort.field);
      if (sort.direction === "desc") {
        fieldDiff *= -1;
      }
    } else if (sort.field === "category") {
      fieldDiff = comparePlayerResultRowsByField(left, right, sort.field);
      if (sort.direction === "desc") {
        fieldDiff *= -1;
      }
    } else if (sort.field === "placement") {
      fieldDiff = compareOptionalNumberWithDirection(
        resolveRowPlacementValue(left),
        resolveRowPlacementValue(right),
        sort.direction,
      );
    } else {
      fieldDiff = compareOptionalNumberWithDirection(
        left.seasonPoints,
        right.seasonPoints,
        sort.direction,
      );
    }

    if (fieldDiff !== 0) {
      return fieldDiff;
    }

    const dateDiff = right.competitionDate.localeCompare(left.competitionDate, "ru");
    if (dateDiff !== 0) {
      return dateDiff;
    }

    const nameDiff = decodeHtmlEntities(left.competitionName).localeCompare(
      decodeHtmlEntities(right.competitionName),
      "ru",
    );
    if (nameDiff !== 0) {
      return nameDiff;
    }

    return left.competitionId.localeCompare(right.competitionId, "ru");
  });
}

export function PlayerPageView({
  headerState,
  resultsState,
  seasonCode,
  period,
  mobileFiltersOpen = false,
  onSeasonCodeChange,
  onPeriodChange,
  onNavigate,
}: PlayerPageViewProps) {
  const [sort, setSort] = useState<PlayerResultsSort>(DEFAULT_PLAYER_RESULTS_SORT);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(mobileFiltersOpen);
  const backButton = (
    <button
      className="page-back-link"
      type="button"
      onClick={() => {
        onNavigate("/players");
      }}
    >
      К списку игроков
    </button>
  );

  if (headerState.status === "loading") {
    return (
      <section className="data-page-shell" aria-labelledby="player-page-title">
        {backButton}

        <PageHeader
          titleId="player-page-title"
          title="Карточка игрока"
          description="Загружаем профиль игрока и его результаты."
        />

        <section className="state-panel state-panel--pending" aria-live="polite">
          <p className="state-panel__eyebrow">loading</p>
          <h2>Подтягиваем данные игрока</h2>
          <p>Подождите немного, загружаем профиль и историю выступлений.</p>
        </section>
      </section>
    );
  }

  if (headerState.status === "error") {
    return (
      <section className="data-page-shell" aria-labelledby="player-page-title">
        {backButton}

        <PageHeader
          titleId="player-page-title"
          title="Карточка игрока"
          description="Не удалось загрузить данные выбранного игрока."
        />

        <section className="state-panel state-panel--error" role="alert">
          <p className="state-panel__eyebrow">error</p>
          <h2>Ошибка загрузки игрока</h2>
          <p>{headerState.message}</p>
        </section>
      </section>
    );
  }

  if (headerState.status === "not-found") {
    return (
      <section className="data-page-shell" aria-labelledby="player-page-title">
        {backButton}

        <PageHeader
          titleId="player-page-title"
          title="Игрок не найден"
          description={`Игрок с id ${headerState.playerId} отсутствует в базе.`}
        />
      </section>
    );
  }

  const { player, seasons } = headerState;
  const playerName = resolvePlayerName(player);
  const playerExternalUrl = resolvePlayerExternalUrl(player.playerId);
  const orderedRows =
    resultsState.status === "ready"
      ? sortPlayerResultsRows(resultsState.rows, sort)
      : [];
  const hasSeasonContext =
    seasonCode.length > 0 && period.dateFrom.length > 0 && period.dateTo.length > 0;
  const filtersAction = hasSeasonContext ? (
    <button
      type="button"
      className="page-header__icon-button page-header__icon-button--filters"
      aria-label={isMobileFiltersOpen ? "Закрыть фильтры" : "Открыть фильтры"}
      aria-expanded={isMobileFiltersOpen}
      onClick={() => {
        setIsMobileFiltersOpen((currentValue) => !currentValue);
      }}
    >
      <FiltersIcon />
    </button>
  ) : null;

  return (
    <section className="data-page-shell" aria-labelledby="player-page-title">
      {backButton}

      <PageHeader
        titleId="player-page-title"
        title={playerName}
        titleAction={
          <>
            {filtersAction}
            <a
              className="data-table__external-link"
              href={playerExternalUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`Открыть профиль игрока ${playerName} на Disc Golf Metrix в новой вкладке`}
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
          </>
        }
        description={`Metrix ID: ${player.playerId}`}
      />

      {hasSeasonContext ? null : (
        <section className="state-panel" aria-live="polite">
          <p className="state-panel__eyebrow">empty</p>
          <h2>Нет активного сезона</h2>
          <p>Добавьте сезон в разделе «Сезоны и очки», чтобы открыть историю игрока.</p>
        </section>
      )}

      {!hasSeasonContext ? null : resultsState.status === "loading" ? (
        <section className="state-panel state-panel--pending" aria-live="polite">
          <p className="state-panel__eyebrow">loading</p>
          <h2>Загружаем результаты игрока</h2>
          <p>Собираем турниры, места и начисленные очки за выбранный период.</p>
        </section>
      ) : resultsState.status === "error" ? (
        <section className="state-panel state-panel--error" role="alert">
          <p className="state-panel__eyebrow">error</p>
          <h2>Не удалось загрузить результаты игрока</h2>
          <p>{resultsState.message}</p>
        </section>
      ) : resultsState.rows.length === 0 ? (
        <section className="state-panel" aria-live="polite">
          <p className="state-panel__eyebrow">empty</p>
          <h2>Нет результатов за выбранный период</h2>
          <p>Измените сезон или период, чтобы посмотреть другие соревнования.</p>
        </section>
      ) : (
        <section className="data-table-panel" aria-label="Результаты игрока по соревнованиям">
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th
                    scope="col"
                    aria-sort={resolvePlayerResultsAriaSort(sort, "competitionName")}
                  >
                    <button
                      className="data-table__sort-button"
                      type="button"
                      onClick={() => {
                        setSort((currentSort) => {
                          if (currentSort.field === "competitionName") {
                            return {
                              field: "competitionName",
                              direction: currentSort.direction === "asc" ? "desc" : "asc",
                            };
                          }

                          return {
                            field: "competitionName",
                            direction: SORT_DEFAULT_DIRECTION_BY_FIELD.competitionName,
                          };
                        });
                      }}
                    >
                      Соревнование
                      {resolvePlayerResultsSortIndicator(sort, "competitionName")}
                    </button>
                  </th>
                  <th
                    scope="col"
                    aria-sort={resolvePlayerResultsAriaSort(sort, "competitionDate")}
                  >
                    <button
                      className="data-table__sort-button"
                      type="button"
                      onClick={() => {
                        setSort((currentSort) => {
                          if (currentSort.field === "competitionDate") {
                            return {
                              field: "competitionDate",
                              direction: currentSort.direction === "asc" ? "desc" : "asc",
                            };
                          }

                          return {
                            field: "competitionDate",
                            direction: SORT_DEFAULT_DIRECTION_BY_FIELD.competitionDate,
                          };
                        });
                      }}
                    >
                      Дата{resolvePlayerResultsSortIndicator(sort, "competitionDate")}
                    </button>
                  </th>
                  <th scope="col" aria-sort={resolvePlayerResultsAriaSort(sort, "category")}>
                    <button
                      className="data-table__sort-button"
                      type="button"
                      onClick={() => {
                        setSort((currentSort) => {
                          if (currentSort.field === "category") {
                            return {
                              field: "category",
                              direction: currentSort.direction === "asc" ? "desc" : "asc",
                            };
                          }

                          return {
                            field: "category",
                            direction: SORT_DEFAULT_DIRECTION_BY_FIELD.category,
                          };
                        });
                      }}
                    >
                      Категория{resolvePlayerResultsSortIndicator(sort, "category")}
                    </button>
                  </th>
                  <th scope="col" aria-sort={resolvePlayerResultsAriaSort(sort, "placement")}>
                    <button
                      className="data-table__sort-button"
                      type="button"
                      onClick={() => {
                        setSort((currentSort) => {
                          if (currentSort.field === "placement") {
                            return {
                              field: "placement",
                              direction: currentSort.direction === "asc" ? "desc" : "asc",
                            };
                          }

                          return {
                            field: "placement",
                            direction: SORT_DEFAULT_DIRECTION_BY_FIELD.placement,
                          };
                        });
                      }}
                    >
                      Место{resolvePlayerResultsSortIndicator(sort, "placement")}
                    </button>
                  </th>
                  <th scope="col" aria-sort={resolvePlayerResultsAriaSort(sort, "seasonPoints")}>
                    <button
                      className="data-table__sort-button"
                      type="button"
                      onClick={() => {
                        setSort((currentSort) => {
                          if (currentSort.field === "seasonPoints") {
                            return {
                              field: "seasonPoints",
                              direction: currentSort.direction === "asc" ? "desc" : "asc",
                            };
                          }

                          return {
                            field: "seasonPoints",
                            direction: SORT_DEFAULT_DIRECTION_BY_FIELD.seasonPoints,
                          };
                        });
                      }}
                    >
                      Очки{resolvePlayerResultsSortIndicator(sort, "seasonPoints")}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {orderedRows.map((row) => (
                  <tr key={`${row.competitionId}-${player.playerId}`}>
                    <td className="data-table__cell-primary">
                      <span className="data-table__primary-actions">
                        <a
                          className="data-table__external-link"
                          href={resolveCompetitionExternalUrl(row.competitionId)}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Открыть соревнование ${decodeHtmlEntities(row.competitionName)} на Disc Golf Metrix в новой вкладке`}
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
                        <button
                          className="data-table__link-button"
                          type="button"
                          onClick={() => {
                            setCompetitionResultsSourcePlayerContext(row.competitionId, {
                              playerId: player.playerId,
                              playerName,
                            });
                            onNavigate(buildCompetitionResultsPath(row.competitionId));
                          }}
                          aria-label={`Открыть результаты соревнования ${decodeHtmlEntities(row.competitionName)}`}
                        >
                          {decodeHtmlEntities(row.competitionName)}
                        </button>
                      </span>
                    </td>
                    <td>{formatCompetitionDate(row.competitionDate)}</td>
                    <td>{formatCategory(row.category)}</td>
                    <td>{formatPlacement(row.placement, row.dnf)}</td>
                    <td>{formatPoints(row.seasonPoints)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>всего строк: {resultsState.total}</p>
        </section>
      )}

      <SideDrawer
        open={isMobileFiltersOpen}
        title="Фильтры результатов игрока"
        className="side-drawer--filters"
        onClose={() => {
          setIsMobileFiltersOpen(false);
        }}
      >
        {hasSeasonContext ? (
          <PlayerResultsFiltersSection
            seasonCode={seasonCode}
            period={period}
            seasons={seasons}
            onSeasonCodeChange={onSeasonCodeChange}
            onPeriodChange={onPeriodChange}
          />
        ) : null}
      </SideDrawer>
    </section>
  );
}

export interface PlayerPageProps {
  playerId: string;
  onNavigate: (pathname: string) => void;
}

export function PlayerPage({ playerId, onNavigate }: PlayerPageProps) {
  const [headerState, setHeaderState] = useState<PlayerHeaderState>({
    status: "loading",
  });
  const [resultsState, setResultsState] = useState<PlayerResultsState>({
    status: "loading",
  });
  const [seasonCode, setSeasonCode] = useState("");
  const [playersListSeasonFilter, setPlayersListSeasonFilter] = useSessionStorageState(
    playersSeasonFilterStorageKey,
    "",
  );
  const [period, setPeriod] = useState<UpdatePeriod>({
    dateFrom: "",
    dateTo: "",
  });

  useEffect(() => {
    let isActive = true;

    void (async () => {
      try {
        const [player, seasonsEnvelope] = await Promise.all([
          getPlayer(playerId),
          listSeasons(),
        ]);

        if (!isActive) {
          return;
        }

        const seasons = [...seasonsEnvelope.data].sort(compareSeasonsByPeriod);
        const initialSeasonCode =
          seasons.find((season) => season.seasonCode === playersListSeasonFilter)
            ?.seasonCode ??
          seasons[0]?.seasonCode ??
          "";
        const initialSeason = seasons.find((season) => season.seasonCode === initialSeasonCode);

        setSeasonCode(initialSeasonCode);
        if (initialSeasonCode !== playersListSeasonFilter) {
          setPlayersListSeasonFilter(initialSeasonCode);
        }
        setPeriod({
          dateFrom: initialSeason?.dateFrom ?? "",
          dateTo: initialSeason?.dateTo ?? "",
        });

        setHeaderState({
          status: "ready",
          player,
          seasons,
        });
      } catch (error) {
        if (!isActive) {
          return;
        }

        if (error instanceof ApiClientError && error.code === "not_found") {
          setHeaderState({
            status: "not-found",
            playerId,
          });
          return;
        }

        setHeaderState({
          status: "error",
          message: [resolvePlayersErrorMessage(error), resolveSeasonsErrorMessage(error)][0],
        });
      }
    })();

    return () => {
      isActive = false;
    };
  }, [playerId, playersListSeasonFilter, setPlayersListSeasonFilter]);

  useEffect(() => {
    if (headerState.status !== "ready" || !seasonCode || !period.dateFrom || !period.dateTo) {
      return;
    }

    let isActive = true;
    setResultsState({ status: "loading" });

    void (async () => {
      try {
        const envelope = await listPlayerResults({
          playerId,
          seasonCode,
          dateFrom: period.dateFrom,
          dateTo: period.dateTo,
        });

        if (!isActive) {
          return;
        }

        setResultsState({
          status: "ready",
          rows: envelope.data,
          total: resolvePlayerResultsTotal(envelope.data, envelope.meta),
        });
      } catch (error) {
        if (!isActive) {
          return;
        }

        setResultsState({
          status: "error",
          message: resolvePlayersErrorMessage(error),
        });
      }
    })();

    return () => {
      isActive = false;
    };
  }, [headerState, period.dateFrom, period.dateTo, playerId, seasonCode]);

  const seasonByCode = useMemo(() => {
    return headerState.status === "ready"
      ? new Map(headerState.seasons.map((season) => [season.seasonCode, season]))
      : new Map<string, Season>();
  }, [headerState]);

  return (
    <PlayerPageView
      headerState={headerState}
      resultsState={resultsState}
      seasonCode={seasonCode}
      period={period}
      onNavigate={onNavigate}
      onSeasonCodeChange={(nextSeasonCode) => {
        setSeasonCode(nextSeasonCode);
        setPlayersListSeasonFilter(nextSeasonCode);
        const nextSeason = seasonByCode.get(nextSeasonCode);
        if (nextSeason) {
          setPeriod({
            dateFrom: nextSeason.dateFrom,
            dateTo: nextSeason.dateTo,
          });
        }
      }}
      onPeriodChange={setPeriod}
    />
  );
}
