import React, { useEffect, useMemo, useState } from "react";

import type { CompetitionClass, Division, Player, Season } from "@metrix-parser/shared-types";

import { useAuth } from "../auth/auth-context";
import { buildPlayerPath } from "../../app/route-paths";
import { PageHeader } from "../../shared/page-header";
import { ActionToast } from "../../shared/action-toast";
import { FloatingInfoTooltip } from "../../shared/floating-info-tooltip";
import { SideDrawer } from "../../shared/side-drawer";
import { listDivisions } from "../../shared/api/divisions";
import {
  listPlayers,
  resolvePlayersErrorMessage,
  resolvePlayersTotal,
  updatePlayer,
} from "../../shared/api/players";
import { listSeasons, resolveSeasonsErrorMessage } from "../../shared/api/seasons";
import { useSessionStorageState } from "../../shared/session-storage";
import { decodeHtmlEntities } from "../../shared/text";

type PlayersPageState =
  | {
      status: "loading";
    }
  | {
      status: "error";
      message: string;
    }
    | {
      status: "ready";
      divisions: Division[];
      players: Player[];
      seasons: Season[];
      total: number;
    };

type PlayersRdgaFilter = "all" | "rdga" | "non-rdga";
type PlayersSortField = "playerId" | "playerName" | "seasonPoints" | "seasonCreditPoints";

interface PlayersSort {
  field: PlayersSortField;
  direction: "asc" | "desc";
}

const DEFAULT_PLAYERS_SORT: PlayersSort = {
  field: "seasonCreditPoints",
  direction: "desc",
};

const playersNameQueryStorageKey = "players-page:name-query";
const playersDivisionFilterStorageKey = "players-page:division-filter";
const playersRdgaFilterStorageKey = "players-page:rdga-filter";
const playersSeasonFilterStorageKey = "players-page:season-filter";
const PLAYERS_PAGE_SIZE = 25;
const discGolfMetrixBaseUrl =
  import.meta.env?.VITE_DISCGOLFMETRIX_BASE_URL ??
  import.meta.env?.DISCGOLFMETRIX_BASE_URL ??
  "https://discgolfmetrix.com";

export interface PlayersPageViewProps {
  state: PlayersPageState;
  onNavigate?: (pathname: string) => void;
  pageTitleAction?: React.ReactNode;
  mobileFiltersOpen?: boolean;
  nameQuery?: string;
  divisionFilter?: string;
  rdgaFilter?: PlayersRdgaFilter;
  seasonFilter?: string;
  sort?: PlayersSort;
  currentPage?: number;
  canEdit?: boolean;
  divisionDrafts?: Record<string, string>;
  rdgaDrafts?: Record<string, boolean | null>;
  rdgaSinceDrafts?: Record<string, string>;
  seasonDivisionDrafts?: Record<string, string>;
  saveState?: {
    status: "idle" | "saving" | "success" | "error";
    playerId: string | null;
    message: string | null;
  };
  onNameQueryChange?: (value: string) => void;
  onDivisionFilterChange?: (value: string) => void;
  onRdgaFilterChange?: (value: PlayersRdgaFilter) => void;
  onSeasonFilterChange?: (value: string) => void;
  onSortChange?: (field: PlayersSortField) => void;
  onPageChange?: (nextPage: number) => void;
  onDivisionChange?: (playerId: string, value: string) => void;
  onRdgaChange?: (playerId: string, value: boolean) => void;
  onRdgaSinceChange?: (playerId: string, value: string) => void;
  onSeasonDivisionChange?: (playerId: string, value: string) => void;
  onDivisionSave?: (playerId: string) => void;
  onToastClose?: () => void;
  onMobileFiltersClose?: () => void;
}

function formatCompetitionsCount(value: number | undefined): string {
  return `${value ?? 0}`;
}

function normalizeDivisionValue(value: string): string | null {
  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function normalizeRdgaSinceValue(value: string): string | null {
  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function normalizeNameQuery(value: string): string {
  return value.trim().toLowerCase();
}

function resolvePlayerExternalUrl(playerId: string): string {
  return new URL(`/player/${playerId}`, discGolfMetrixBaseUrl).toString();
}

function resolveSeasonCreditCompetitionPrefix(
  competitionClass: CompetitionClass | null | undefined,
): string {
  return competitionClass === "league" ? "Л" : "Т";
}

function filterPlayersByRdga(
  players: Player[],
  rdgaFilter: PlayersRdgaFilter,
): Player[] {
  if (rdgaFilter === "rdga") {
    return players.filter((player) => player.rdga === true);
  }

  if (rdgaFilter === "non-rdga") {
    return players.filter((player) => player.rdga !== true);
  }

  return players;
}

function formatDivisionValue(value: string | null | undefined): string {
  return value && value.trim().length > 0 ? value : "Не выбран";
}

function formatRdgaValue(value: boolean | null | undefined): string {
  if (value === true) {
    return "✓";
  }

  return "—";
}

function formatRdgaSinceValue(value: string | null | undefined): string {
  return value && value.trim().length > 0 ? value : "—";
}

function formatSeasonPointsValue(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }

  return value.toFixed(2);
}

function formatPlacementValue(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }

  return String(value);
}

function formatPlayersTablePlacement(value: number): string {
  return String(value);
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

function comparePlayersByField(
  left: Player,
  right: Player,
  field: PlayersSortField,
): number {
  if (field === "seasonPoints") {
    const leftValue = left.seasonPoints ?? Number.NEGATIVE_INFINITY;
    const rightValue = right.seasonPoints ?? Number.NEGATIVE_INFINITY;

    if (leftValue !== rightValue) {
      return leftValue - rightValue;
    }
  }

  if (field === "seasonCreditPoints") {
    const leftValue = left.seasonCreditPoints ?? Number.NEGATIVE_INFINITY;
    const rightValue = right.seasonCreditPoints ?? Number.NEGATIVE_INFINITY;

    if (leftValue !== rightValue) {
      return leftValue - rightValue;
    }
  }

  if (field === "playerId") {
    return left.playerId.localeCompare(right.playerId, "ru");
  }

  return decodeHtmlEntities(left.playerName).localeCompare(
    decodeHtmlEntities(right.playerName),
    "ru",
  );
}

function formatSeasonCreditCompetitionRows(
  competitions: ReadonlyArray<NonNullable<Player["seasonCreditCompetitions"]>[number]>,
): React.ReactNode[] {
  const classCounters: Record<CompetitionClass, number> = {
    league: 0,
    tournament: 0,
  };

  return competitions.map((competition) => {
    const competitionClass = competition.competitionClass ?? "tournament";
    classCounters[competitionClass] += 1;
    const label = `${resolveSeasonCreditCompetitionPrefix(competition.competitionClass)}${
      classCounters[competitionClass]
    }`;

    return (
      <span key={competition.competitionId} className="players-page__credit-tooltip-row">
        <span className="players-page__credit-tooltip-row-label">{label}</span>
        <span className="players-page__credit-tooltip-row-placement">
          {formatPlacementValue(competition.placement)}
        </span>
        <span className="players-page__credit-tooltip-row-points">
          {formatSeasonPointsValue(competition.seasonPoints)}
        </span>
        <span className="players-page__credit-tooltip-row-name">
          {decodeHtmlEntities(competition.competitionName)}
        </span>
      </span>
    );
  });
}

function resolvePatchedPlayerField<T>(
  nextValue: T | undefined,
  currentValue: T,
): T {
  return nextValue === undefined ? currentValue : nextValue;
}

export function mergeUpdatedPlayer(
  currentPlayer: Player,
  updatedPlayerResponse: Player,
): Player {
  return {
    ...currentPlayer,
    ...updatedPlayerResponse,
    seasonPoints: resolvePatchedPlayerField(
      updatedPlayerResponse.seasonPoints,
      currentPlayer.seasonPoints ?? null,
    ),
    seasonCreditPoints: resolvePatchedPlayerField(
      updatedPlayerResponse.seasonCreditPoints,
      currentPlayer.seasonCreditPoints ?? null,
    ),
    competitionsCount: resolvePatchedPlayerField(
      updatedPlayerResponse.competitionsCount,
      currentPlayer.competitionsCount ?? 0,
    ),
    seasonCreditCompetitions: resolvePatchedPlayerField(
      updatedPlayerResponse.seasonCreditCompetitions,
      currentPlayer.seasonCreditCompetitions,
    ),
  };
}

function resolveSortIndicator(
  sort: PlayersSort,
  field: PlayersSortField,
): string {
  if (sort.field !== field) {
    return "";
  }

  return sort.direction === "asc" ? " ↑" : " ↓";
}

function resolveAriaSort(
  sort: PlayersSort,
  field: PlayersSortField,
): "ascending" | "descending" | "none" {
  if (sort.field !== field) {
    return "none";
  }

  return sort.direction === "asc" ? "ascending" : "descending";
}

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

interface PlayersFiltersSectionProps {
  nameQuery: string;
  divisionFilter: string;
  rdgaFilter: PlayersRdgaFilter;
  seasonFilter: string;
  divisionOptions: string[];
  seasons: Season[];
  onNameQueryChange?: (value: string) => void;
  onDivisionFilterChange?: (value: string) => void;
  onRdgaFilterChange?: (value: PlayersRdgaFilter) => void;
  onSeasonFilterChange?: (value: string) => void;
}

function PlayersFiltersSection({
  nameQuery,
  divisionFilter,
  rdgaFilter,
  seasonFilter,
  divisionOptions,
  seasons,
  onNameQueryChange,
  onDivisionFilterChange,
  onRdgaFilterChange,
  onSeasonFilterChange,
}: PlayersFiltersSectionProps) {
  return (
    <section className="players-page__filters" aria-label="Фильтр игроков">
      <label className="competitions-page__filter">
        <span>Имя игрока</span>
        <input
          className="competitions-page__filter-control"
          type="search"
          value={nameQuery}
          placeholder="Поиск по имени"
          onChange={(event) => {
            onNameQueryChange?.(event.target.value);
          }}
        />
      </label>
      <label className="competitions-page__filter">
        <span>Дивизион</span>
        <select
          className="competitions-page__filter-control"
          value={divisionFilter}
          onChange={(event) => {
            onDivisionFilterChange?.(event.target.value);
          }}
        >
          <option value="">Все дивизионы</option>
          {divisionOptions.map((divisionCode) => (
            <option key={divisionCode} value={divisionCode}>
              {divisionCode}
            </option>
          ))}
        </select>
      </label>
      <label className="competitions-page__filter">
        <span>Сезон</span>
        <select
          className="competitions-page__filter-control"
          value={seasonFilter}
          onChange={(event) => {
            onSeasonFilterChange?.(event.target.value);
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
        <span>RDGA</span>
        <select
          className="competitions-page__filter-control"
          value={rdgaFilter}
          onChange={(event) => {
            onRdgaFilterChange?.(event.target.value as PlayersRdgaFilter);
          }}
        >
          <option value="all">Все</option>
          <option value="rdga">Только RDGA</option>
          <option value="non-rdga">Без RDGA</option>
        </select>
      </label>
    </section>
  );
}

export function PlayersPageView({
  state,
  onNavigate,
  pageTitleAction,
  mobileFiltersOpen = false,
  nameQuery = "",
  divisionFilter = "",
  rdgaFilter = "all",
  seasonFilter = "",
  sort = DEFAULT_PLAYERS_SORT,
  currentPage = 1,
  canEdit = false,
  divisionDrafts = {},
  rdgaDrafts = {},
  rdgaSinceDrafts = {},
  seasonDivisionDrafts = {},
  saveState = {
    status: "idle",
    playerId: null,
    message: null,
  },
  onNameQueryChange,
  onDivisionFilterChange,
  onRdgaFilterChange,
  onSeasonFilterChange,
  onSortChange,
  onPageChange,
  onDivisionChange,
  onRdgaChange,
  onRdgaSinceChange,
  onSeasonDivisionChange,
  onDivisionSave,
  onToastClose,
  onMobileFiltersClose,
}: PlayersPageViewProps) {
  const divisions = state.status === "ready" ? state.divisions : [];
  const players = state.status === "ready" ? state.players : [];
  const seasons = state.status === "ready" ? state.seasons : [];
  const total = state.status === "ready" ? state.total : 0;
  const normalizedNameQuery = normalizeNameQuery(nameQuery);
  const divisionOptions = useMemo(
    () =>
      [
        ...new Set([
          ...divisions.map((division) => division.code),
          ...players
            .map((player) => player.division)
            .filter((division): division is string => Boolean(division)),
        ]),
      ].sort((left, right) => left.localeCompare(right)),
    [divisions, players],
  );
  const visiblePlayers = useMemo(() => {
    const playersByName = players.filter((player) =>
      decodeHtmlEntities(player.playerName).toLowerCase().includes(normalizedNameQuery),
    );
    const playersByDivision =
      divisionFilter === ""
        ? playersByName
        : playersByName.filter((player) => player.division === divisionFilter);

    const playersByRdga = filterPlayersByRdga(playersByDivision, rdgaFilter);
    const sortedPlayers = [...playersByRdga].sort((left, right) => {
      const primaryComparison = comparePlayersByField(left, right, sort.field);

      if (primaryComparison !== 0) {
        return sort.direction === "asc" ? primaryComparison : -primaryComparison;
      }

      return decodeHtmlEntities(left.playerName).localeCompare(
        decodeHtmlEntities(right.playerName),
        "ru",
      );
    });

    return sortedPlayers;
  }, [divisionFilter, normalizedNameQuery, players, rdgaFilter, sort]);
  const totalPages = Math.max(1, Math.ceil(visiblePlayers.length / PLAYERS_PAGE_SIZE));
  const normalizedCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const pageStartIndex = (normalizedCurrentPage - 1) * PLAYERS_PAGE_SIZE;
  const paginatedVisiblePlayers = visiblePlayers.slice(
    pageStartIndex,
    pageStartIndex + PLAYERS_PAGE_SIZE,
  );

  if (state.status === "loading") {
    return (
      <section className="data-page-shell" aria-labelledby="players-page-title">
        <PageHeader
          titleId="players-page-title"
          title="Список игроков"
          description="Загружаем сохранённых игроков через backend API."
        />

        <section className="state-panel state-panel--pending" aria-live="polite">
          <p className="state-panel__eyebrow">loading</p>
          <h2>Подтягиваем игроков и дивизионы</h2>
          <p>Подождите немного, данные загружаются с серверного read-side и из справочника.</p>
        </section>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="data-page-shell" aria-labelledby="players-page-title">
        <PageHeader
          titleId="players-page-title"
          title="Список игроков"
          description="Страница использует backend API и показывает отдельную player model."
        />

        <section className="state-panel state-panel--error" role="alert">
          <p className="state-panel__eyebrow">error</p>
          <h2>Не удалось загрузить данные страницы игроков</h2>
          <p>{state.message}</p>
        </section>
      </section>
    );
  }

  return (
    <section className="data-page-shell" aria-labelledby="players-page-title">
      <PageHeader
        titleId="players-page-title"
        title="Список игроков"
        titleAction={pageTitleAction}
        description={
          total > 0
            ? `В системе доступно ${total} игроков для дальнейшей статистической работы.`
            : "Сохранённые игроки появятся здесь после обновления результатов и player sync."
        }
      />

      {players.length === 0 ? (
        <section className="state-panel" aria-live="polite">
          <p className="state-panel__eyebrow">empty</p>
          <h2>Пока нет сохранённых игроков</h2>
          <p>Сначала выполните обновление игроков или результатов в административном разделе.</p>
        </section>
      ) : (
        <>
          {visiblePlayers.length === 0 ? (
            <section className="state-panel" aria-live="polite">
              <p className="state-panel__eyebrow">filtered</p>
              <h2>По текущему фильтру игроков нет</h2>
              <p>Попробуйте изменить имя, дивизион или фильтр RDGA.</p>
            </section>
          ) : (
            <section
              className="data-table-panel players-page__table-panel"
              aria-label="Сохранённые игроки"
            >
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Место</th>
                      <th scope="col" aria-sort={resolveAriaSort(sort, "playerName")}>
                        <button
                          className="data-table__sort-button"
                          type="button"
                          onClick={() => {
                            onSortChange?.("playerName");
                          }}
                        >
                          Игрок{resolveSortIndicator(sort, "playerName")}
                        </button>
                      </th>
                      <th scope="col" aria-sort={resolveAriaSort(sort, "seasonCreditPoints")}>
                        <button
                          className="data-table__sort-button"
                          type="button"
                          onClick={() => {
                            onSortChange?.("seasonCreditPoints");
                          }}
                        >
                          Очки зачета{resolveSortIndicator(sort, "seasonCreditPoints")}
                        </button>
                      </th>
                      <th scope="col" aria-sort={resolveAriaSort(sort, "seasonPoints")}>
                        <button
                          className="data-table__sort-button"
                          type="button"
                          onClick={() => {
                            onSortChange?.("seasonPoints");
                          }}
                        >
                          Очки сезона{resolveSortIndicator(sort, "seasonPoints")}
                        </button>
                      </th>
                      <th scope="col">Дивизион</th>
                      <th scope="col">RDGA</th>
                      <th scope="col">RDGA с</th>
                      <th scope="col">Соревнований</th>
                      {canEdit ? <th scope="col">Действия</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedVisiblePlayers.map((player, index) => {
                      const draftDivision =
                        divisionDrafts[player.playerId] ?? player.division ?? "";
                      const draftRdga =
                        player.playerId in rdgaDrafts
                          ? (rdgaDrafts[player.playerId] ?? null)
                          : (player.rdga ?? null);
                      const draftRdgaSince =
                        rdgaSinceDrafts[player.playerId] ?? player.rdgaSince ?? "";
                      const draftSeasonDivision =
                        seasonDivisionDrafts[player.playerId] ??
                        player.seasonDivision ??
                        "";
                      const normalizedDraftDivision =
                        normalizeDivisionValue(draftDivision);
                      const normalizedDraftRdgaSince =
                        normalizeRdgaSinceValue(draftRdgaSince);
                      const normalizedDraftSeasonDivision =
                        normalizeDivisionValue(draftSeasonDivision);
                      const isSaving =
                        saveState.status === "saving" &&
                        saveState.playerId === player.playerId;
                      const hasChanges =
                        normalizedDraftDivision !== (player.division ?? null) ||
                        draftRdga !== (player.rdga ?? null) ||
                        normalizedDraftRdgaSince !== (player.rdgaSince ?? null) ||
                        normalizedDraftSeasonDivision !==
                          (player.seasonDivision ?? null);

                      return (
                        <tr key={player.playerId}>
                          <td>{formatPlayersTablePlacement(pageStartIndex + index + 1)}</td>
                          <td className="data-table__cell-primary">
                            <span className="data-table__primary-actions">
                              <a
                                className="data-table__external-link"
                                href={resolvePlayerExternalUrl(player.playerId)}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`Открыть профиль игрока ${decodeHtmlEntities(player.playerName)} на Disc Golf Metrix в новой вкладке`}
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
                              {onNavigate ? (
                                <button
                                  className="data-table__link-button"
                                  type="button"
                                  onClick={() => {
                                    onNavigate(buildPlayerPath(player.playerId));
                                  }}
                                  aria-label={`Открыть страницу игрока ${decodeHtmlEntities(player.playerName)}`}
                                >
                                  {decodeHtmlEntities(player.playerName)}
                                </button>
                              ) : (
                                decodeHtmlEntities(player.playerName)
                              )}
                            </span>
                          </td>
                          <td>
                            {(player.seasonCreditCompetitions?.length ?? 0) > 0 ? (
                              <FloatingInfoTooltip
                                value={formatSeasonPointsValue(player.seasonCreditPoints)}
                                ariaLabel={`Показать список зачетных соревнований игрока ${decodeHtmlEntities(player.playerName)}`}
                                title="Соревнования в зачете"
                                items={formatSeasonCreditCompetitionRows(
                                  [...(player.seasonCreditCompetitions ?? [])].sort(
                                    (left, right) => right.seasonPoints - left.seasonPoints,
                                  ),
                                )}
                                anchorClassName="players-page__credit-tooltip-anchor"
                                tooltipClassName="players-page__credit-tooltip"
                                listClassName="players-page__credit-tooltip-list"
                                showTriggerButton={false}
                              />
                            ) : (
                              formatSeasonPointsValue(player.seasonCreditPoints)
                            )}
                          </td>
                          <td>{formatSeasonPointsValue(player.seasonPoints)}</td>
                          <td>
                            {canEdit ? (
                              <>
                                <label
                                  className="sr-only"
                                  htmlFor={`player-division-${player.playerId}`}
                                >
                                  Дивизион игрока {decodeHtmlEntities(player.playerName)}
                                </label>
                                <select
                                  id={`player-division-${player.playerId}`}
                                  className="players-table__division-select"
                                  value={draftDivision}
                                  disabled={!canEdit}
                                  onChange={(event) =>
                                    onDivisionChange?.(player.playerId, event.target.value)
                                  }
                                >
                                  <option value="">Не выбран</option>
                                  {divisions.map((division) => (
                                    <option key={division.code} value={division.code}>
                                      {division.code}
                                    </option>
                                  ))}
                                </select>
                              </>
                            ) : (
                              <span className="players-table__readonly-value">
                                {formatDivisionValue(player.division)}
                              </span>
                            )}
                          </td>
                          <td>
                            {canEdit ? (
                              <>
                                <label
                                  className="sr-only"
                                  htmlFor={`player-rdga-${player.playerId}`}
                                >
                                  Признак RDGA для игрока {decodeHtmlEntities(player.playerName)}
                                </label>
                                <input
                                  id={`player-rdga-${player.playerId}`}
                                  className="players-table__checkbox"
                                  type="checkbox"
                                  checked={draftRdga === true}
                                  disabled={!canEdit}
                                  ref={(input) => {
                                    if (input) {
                                      input.indeterminate = draftRdga === null;
                                    }
                                  }}
                                  onChange={(event) =>
                                    onRdgaChange?.(player.playerId, event.target.checked)
                                  }
                                />
                              </>
                            ) : (
                              <span className="players-table__readonly-value">
                                {formatRdgaValue(player.rdga)}
                              </span>
                            )}
                          </td>
                          <td>
                            {canEdit ? (
                              <>
                                <label
                                  className="sr-only"
                                  htmlFor={`player-rdga-since-${player.playerId}`}
                                >
                                  Дата вступления в RDGA для игрока{" "}
                                  {decodeHtmlEntities(player.playerName)}
                                </label>
                                <input
                                  id={`player-rdga-since-${player.playerId}`}
                                  className="players-table__date-input"
                                  type="date"
                                  value={draftRdgaSince}
                                  disabled={!canEdit}
                                  onChange={(event) =>
                                    onRdgaSinceChange?.(player.playerId, event.target.value)
                                  }
                                />
                              </>
                            ) : (
                              <span className="players-table__readonly-value">
                                {formatRdgaSinceValue(player.rdgaSince)}
                              </span>
                            )}
                          </td>
                          <td>
                            {formatCompetitionsCount(player.competitionsCount)}
                          </td>
                          {canEdit ? (
                            <td>
                              <div className="players-table__actions">
                                <button
                                  className="update-card__submit players-table__save-button"
                                  type="button"
                                  disabled={!hasChanges || isSaving}
                                  onClick={() => onDivisionSave?.(player.playerId)}
                                >
                                  {isSaving ? "Сохраняем..." : "Сохранить"}
                                </button>
                              </div>
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="players-page__pagination-summary" aria-live="polite">
                Показано {paginatedVisiblePlayers.length} из {visiblePlayers.length} игроков.
                Страница {normalizedCurrentPage} из {totalPages}.
              </div>
              {totalPages > 1 ? (
                <nav className="players-page__pagination" aria-label="Пагинация игроков">
                  <button
                    className="players-page__pagination-button"
                    type="button"
                    disabled={normalizedCurrentPage === 1}
                    onClick={() => {
                      onPageChange?.(normalizedCurrentPage - 1);
                    }}
                  >
                    Назад
                  </button>
                  <div className="players-page__pagination-pages">
                    {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                      <button
                        key={page}
                        className={`players-page__pagination-button${page === normalizedCurrentPage ? " players-page__pagination-button--active" : ""}`}
                        type="button"
                        aria-current={page === normalizedCurrentPage ? "page" : undefined}
                        onClick={() => {
                          onPageChange?.(page);
                        }}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  <button
                    className="players-page__pagination-button"
                    type="button"
                    disabled={normalizedCurrentPage === totalPages}
                    onClick={() => {
                      onPageChange?.(normalizedCurrentPage + 1);
                    }}
                  >
                    Вперед
                  </button>
                </nav>
              ) : null}
            </section>
          )}
          <SideDrawer
            open={mobileFiltersOpen}
            title="Фильтры игроков"
            className="side-drawer--filters"
            onClose={() => {
              onMobileFiltersClose?.();
            }}
          >
            <PlayersFiltersSection
              nameQuery={nameQuery}
              divisionFilter={divisionFilter}
              rdgaFilter={rdgaFilter}
              seasonFilter={seasonFilter}
              divisionOptions={divisionOptions}
              seasons={seasons}
              onNameQueryChange={onNameQueryChange}
              onDivisionFilterChange={onDivisionFilterChange}
              onRdgaFilterChange={onRdgaFilterChange}
              onSeasonFilterChange={onSeasonFilterChange}
            />
          </SideDrawer>
        </>
      )}

      <ActionToast
        message={saveState.status === "saving" ? null : saveState.message}
        tone={saveState.status === "error" ? "error" : "success"}
        onClose={onToastClose}
      />
    </section>
  );
}

export interface PlayersPageProps {
  onNavigate: (pathname: string) => void;
  forceCanEdit?: boolean;
}

export function PlayersPage({ onNavigate, forceCanEdit }: PlayersPageProps) {
  const { status: authStatus, user } = useAuth();
  const isAuthenticated = authStatus === "authenticated" && Boolean(user);
  const [isEditModeEnabled, setIsEditModeEnabled] = useState(false);
  const [state, setState] = useState<PlayersPageState>({
    status: "loading",
  });
  const [divisionDrafts, setDivisionDrafts] = useState<Record<string, string>>({});
  const [rdgaDrafts, setRdgaDrafts] = useState<Record<string, boolean | null>>({});
  const [rdgaSinceDrafts, setRdgaSinceDrafts] = useState<Record<string, string>>({});
  const [seasonDivisionDrafts, setSeasonDivisionDrafts] = useState<
    Record<string, string>
  >({});
  const [nameQuery, setNameQuery] = useSessionStorageState(
    playersNameQueryStorageKey,
    "",
  );
  const [divisionFilter, setDivisionFilter] = useSessionStorageState(
    playersDivisionFilterStorageKey,
    "",
  );
  const [rdgaFilter, setRdgaFilter] = useSessionStorageState<PlayersRdgaFilter>(
    playersRdgaFilterStorageKey,
    "all",
  );
  const [seasonFilter, setSeasonFilter] = useSessionStorageState(
    playersSeasonFilterStorageKey,
    "",
  );
  const [sort, setSort] = useState<PlayersSort>(DEFAULT_PLAYERS_SORT);
  const [currentPage, setCurrentPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [saveState, setSaveState] = useState<{
    status: "idle" | "saving" | "success" | "error";
    playerId: string | null;
    message: string | null;
  }>({
    status: "idle",
    playerId: null,
    message: null,
  });

  function resetSaveState() {
    setSaveState((currentState) =>
      currentState.status === "saving" || currentState.message === null
        ? currentState
        : {
            status: "idle",
            playerId: null,
            message: null,
          },
    );
  }

  const editToggleButton =
    isAuthenticated && forceCanEdit === undefined ? (
      <button
        type="button"
        className="update-card__submit settings-page__edit-toggle"
        onClick={() => {
          setIsEditModeEnabled((current) => !current);
        }}
      >
        {isEditModeEnabled ? "Просмотр" : "Редактировать"}
      </button>
    ) : null;

  const pageTitleAction = (
    <>
      <button
        type="button"
        className="page-header__icon-button page-header__icon-button--filters"
        aria-label={mobileFiltersOpen ? "Закрыть фильтры" : "Открыть фильтры"}
        aria-expanded={mobileFiltersOpen}
        onClick={() => {
          setMobileFiltersOpen((currentValue) => !currentValue);
        }}
      >
        <FiltersIcon />
      </button>
      {editToggleButton}
    </>
  );

  useEffect(() => {
    let isActive = true;

    void (async () => {
      try {
        const seasonsEnvelope = await listSeasons();
        const seasons = [...seasonsEnvelope.data].sort(compareSeasonsByPeriod);
        const effectiveSeasonCode =
          seasons.some((season) => season.seasonCode === seasonFilter)
            ? seasonFilter
            : (seasons[0]?.seasonCode ?? "");
        const [playersEnvelope, divisionsEnvelope] = await Promise.all([
          listPlayers(
            effectiveSeasonCode.length > 0
              ? { seasonCode: effectiveSeasonCode }
              : {},
          ),
          listDivisions(),
        ]);

        if (!isActive) {
          return;
        }

        setState({
          status: "ready",
          divisions: divisionsEnvelope.data,
          players: playersEnvelope.data,
          seasons,
          total: resolvePlayersTotal(playersEnvelope.data, playersEnvelope.meta),
        });
        if (effectiveSeasonCode !== seasonFilter) {
          setSeasonFilter(effectiveSeasonCode);
        }
        setDivisionDrafts(
          Object.fromEntries(
            playersEnvelope.data.map((player) => [player.playerId, player.division ?? ""]),
          ),
        );
        setRdgaDrafts(
          Object.fromEntries(
            playersEnvelope.data.map((player) => [player.playerId, player.rdga ?? null]),
          ),
        );
        setRdgaSinceDrafts(
          Object.fromEntries(
            playersEnvelope.data.map((player) => [player.playerId, player.rdgaSince ?? ""]),
          ),
        );
        setSeasonDivisionDrafts(
          Object.fromEntries(
            playersEnvelope.data.map((player) => [
              player.playerId,
              player.seasonDivision ?? "",
            ]),
          ),
        );
      } catch (error) {
        if (!isActive) {
          return;
        }

        setState({
          status: "error",
          message: [
            resolvePlayersErrorMessage(error),
            resolveSeasonsErrorMessage(error),
          ][0],
        });
      }
    })();

    return () => {
      isActive = false;
    };
  }, [seasonFilter, setSeasonFilter]);

  async function handleDivisionSave(playerId: string) {
    if (state.status !== "ready") {
      return;
    }

    const player = state.players.find((candidate) => candidate.playerId === playerId);
    if (!player) {
      return;
    }

    const division = normalizeDivisionValue(
      divisionDrafts[playerId] ?? player.division ?? "",
    );
    const rdga =
      playerId in rdgaDrafts ? (rdgaDrafts[playerId] ?? null) : (player.rdga ?? null);
    const rdgaSince = normalizeRdgaSinceValue(
      rdgaSinceDrafts[playerId] ?? player.rdgaSince ?? "",
    );
    const seasonDivision = normalizeDivisionValue(
      seasonDivisionDrafts[playerId] ?? player.seasonDivision ?? "",
    );

    if (
      division === (player.division ?? null) &&
      rdga === (player.rdga ?? null) &&
      rdgaSince === (player.rdgaSince ?? null) &&
      seasonDivision === (player.seasonDivision ?? null)
    ) {
      return;
    }

    setSaveState({
      status: "saving",
      playerId,
      message: "Сохраняем параметры игрока.",
    });

    try {
      const updatedPlayerResponse = await updatePlayer({
        playerId,
        division,
        rdga,
        rdgaSince,
        seasonDivision,
      });
      const updatedPlayer = mergeUpdatedPlayer(player, updatedPlayerResponse);

      setState((currentState) => {
        if (currentState.status !== "ready") {
          return currentState;
        }

        return {
          ...currentState,
          players: currentState.players.map((currentPlayer) =>
            currentPlayer.playerId === playerId ? updatedPlayer : currentPlayer,
          ),
        };
      });
      setDivisionDrafts((currentDrafts) => ({
        ...currentDrafts,
        [playerId]: updatedPlayer.division ?? "",
      }));
      setRdgaDrafts((currentDrafts) => ({
        ...currentDrafts,
        [playerId]: updatedPlayer.rdga ?? null,
      }));
      setRdgaSinceDrafts((currentDrafts) => ({
        ...currentDrafts,
        [playerId]: updatedPlayer.rdgaSince ?? "",
      }));
      setSeasonDivisionDrafts((currentDrafts) => ({
        ...currentDrafts,
        [playerId]: updatedPlayer.seasonDivision ?? "",
      }));
      setSaveState({
        status: "success",
        playerId,
        message: "Параметры игрока сохранены.",
      });
    } catch (error) {
      setSaveState({
        status: "error",
        playerId,
        message: resolvePlayersErrorMessage(error),
      });
    }
  }

  return (
    <PlayersPageView
      state={state}
      onNavigate={onNavigate}
      nameQuery={nameQuery}
      divisionFilter={divisionFilter}
      rdgaFilter={rdgaFilter}
      seasonFilter={seasonFilter}
      sort={sort}
      canEdit={forceCanEdit ?? (isAuthenticated && isEditModeEnabled)}
      pageTitleAction={pageTitleAction}
      mobileFiltersOpen={mobileFiltersOpen}
      divisionDrafts={divisionDrafts}
      rdgaDrafts={rdgaDrafts}
      rdgaSinceDrafts={rdgaSinceDrafts}
      seasonDivisionDrafts={seasonDivisionDrafts}
      saveState={saveState}
      onDivisionFilterChange={(value) => {
        setDivisionFilter(value);
        setCurrentPage(1);
      }}
      onRdgaFilterChange={(value) => {
        setRdgaFilter(value);
        setCurrentPage(1);
      }}
      onSeasonFilterChange={(value) => {
        setSeasonFilter(value);
        setCurrentPage(1);
      }}
      onSortChange={(field) => {
        setSort((currentSort) => {
          if (currentSort.field === field) {
            return {
              field,
              direction: currentSort.direction === "asc" ? "desc" : "asc",
            };
          }

          return {
            field,
            direction:
              field === "seasonPoints" || field === "seasonCreditPoints"
                ? "desc"
                : "asc",
          };
        });
      }}
      currentPage={currentPage}
      onPageChange={(nextPage) => {
        setCurrentPage(nextPage);
      }}
      onNameQueryChange={(value) => {
        setNameQuery(value);
        setCurrentPage(1);
      }}
      onDivisionChange={(playerId, value) => {
        setDivisionDrafts((currentDrafts) => ({
          ...currentDrafts,
          [playerId]: value,
        }));
        setSaveState((currentState) =>
          currentState.playerId === playerId
            ? {
                status: "idle",
                playerId: null,
                message: null,
              }
            : currentState,
        );
      }}
      onRdgaChange={(playerId, value) => {
        setRdgaDrafts((currentDrafts) => ({
          ...currentDrafts,
          [playerId]: value,
        }));
        setSaveState((currentState) =>
          currentState.playerId === playerId
            ? {
                status: "idle",
                playerId: null,
                message: null,
              }
            : currentState,
        );
      }}
      onRdgaSinceChange={(playerId, value) => {
        setRdgaSinceDrafts((currentDrafts) => ({
          ...currentDrafts,
          [playerId]: value,
        }));
        setSaveState((currentState) =>
          currentState.playerId === playerId
            ? {
                status: "idle",
                playerId: null,
                message: null,
              }
            : currentState,
        );
      }}
      onSeasonDivisionChange={(playerId, value) => {
        setSeasonDivisionDrafts((currentDrafts) => ({
          ...currentDrafts,
          [playerId]: value,
        }));
        setSaveState((currentState) =>
          currentState.playerId === playerId
            ? {
                status: "idle",
                playerId: null,
                message: null,
              }
            : currentState,
        );
      }}
      onDivisionSave={(playerId) => {
        void handleDivisionSave(playerId);
      }}
      onToastClose={resetSaveState}
      onMobileFiltersClose={() => {
        setMobileFiltersOpen(false);
      }}
    />
  );
}
