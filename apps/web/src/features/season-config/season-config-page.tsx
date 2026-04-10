import React, { useEffect, useMemo, useState } from "react";

import type {
  CreateSeasonPointsEntryRequest,
  Season,
  SeasonPointsEntry,
} from "@metrix-parser/shared-types";

import { useAuth } from "../auth/auth-context";
import { PageHeader } from "../../shared/page-header";
import {
  createSeasonPointsEntry,
  deleteSeasonPointsEntry,
  listSeasonPointsTable,
  resolveSeasonPointsTableErrorMessage,
  resolveSeasonPointsTableTotal,
  updateSeasonPointsEntry,
} from "../../shared/api/season-points-table";
import {
  listSeasons,
  resolveSeasonsErrorMessage,
  resolveSeasonsTotal,
} from "../../shared/api/seasons";
import {
  runSeasonPointsAccrual,
  resolveSeasonStandingsErrorMessage,
} from "../../shared/api/season-standings";
import { useSessionStorageState } from "../../shared/session-storage";

type SeasonConfigPageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      seasons: Season[];
      seasonsTotal: number;
      pointsEntries: SeasonPointsEntry[];
      pointsTotal: number;
    };

type SeasonDraft = {
  seasonCode: string;
  name: string;
  dateFrom: string;
  dateTo: string;
  bestLeaguesCount: string;
  bestTournamentsCount: string;
};

type PointsDraft = {
  seasonCode: string;
  playersCount: string;
  placement: string;
  points: string;
};

type SubmitState = {
  status: "idle" | "saving" | "success" | "error";
  targetId: string | "new" | null;
  message: string | null;
};

const seasonConfigSelectedSeasonStorageKey = "season-config-page:selected-season-code";
const seasonConfigSelectedPlayersCountStorageKey =
  "season-config-page:selected-players-count";

function toSeasonDraft(season: Season): SeasonDraft {
  return {
    seasonCode: season.seasonCode,
    name: season.name,
    dateFrom: season.dateFrom,
    dateTo: season.dateTo,
    bestLeaguesCount: String(season.bestLeaguesCount),
    bestTournamentsCount: String(season.bestTournamentsCount),
  };
}

function toPointsDraft(entry: SeasonPointsEntry): PointsDraft {
  return {
    seasonCode: entry.seasonCode,
    playersCount: String(entry.playersCount),
    placement: String(entry.placement),
    points: entry.points.toFixed(2),
  };
}

function normalizePointsDraft(draft: PointsDraft): CreateSeasonPointsEntryRequest {
  const seasonCode = draft.seasonCode.trim();
  const playersCount = Number(draft.playersCount);
  const placement = Number(draft.placement);
  const points = Number(draft.points);

  if (seasonCode.length === 0) {
    throw new Error("Укажите код сезона для таблицы очков.");
  }

  if (!Number.isInteger(playersCount) || playersCount < 8) {
    throw new Error("Количество игроков должно быть целым числом >= 8.");
  }

  if (!Number.isInteger(placement) || placement <= 0) {
    throw new Error("Место должно быть целым положительным числом.");
  }

  if (placement > playersCount) {
    throw new Error("Место не может быть больше количества игроков.");
  }

  if (!Number.isFinite(points) || points < 0) {
    throw new Error("Очки должны быть неотрицательным числом.");
  }

  if (Math.round(points * 100) !== points * 100) {
    throw new Error("Очки должны содержать не более двух знаков после запятой.");
  }

  return {
    seasonCode,
    playersCount,
    placement,
    points,
  };
}

function buildPointsEntryKey(entry: {
  seasonCode: string;
  playersCount: number;
  placement: number;
}): string {
  return `${entry.seasonCode}:${entry.playersCount}:${entry.placement}`;
}

function parsePlayersCount(value: string): number | null {
  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isInteger(parsed) ? parsed : null;
}

function confirmSeasonDeletion(): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  return window.confirm("Удалить сезон? Это также удалит связанные очки сезона.");
}

function confirmPointsEntryDeletion(): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  return window.confirm("Удалить эту строку таблицы очков?");
}

export interface SeasonConfigPageViewProps {
  state: SeasonConfigPageState;
  canEdit?: boolean;
  canRunAccrual?: boolean;
  selectedSeasonCode?: string;
  accrualSeasonCode?: string;
  selectedPlayersCount?: number | null;
  overwriteExistingStandings?: boolean;
  seasonCreateDraft?: SeasonDraft;
  seasonRowDrafts?: Record<string, SeasonDraft>;
  pointsCreateDraft?: PointsDraft;
  pointsRowDrafts?: Record<string, PointsDraft>;
  seasonSubmitState?: SubmitState;
  pointsSubmitState?: SubmitState;
  pointsAccrualSubmitState?: SubmitState;
  onSelectedSeasonCodeChange?: (value: string) => void;
  onAccrualSeasonCodeChange?: (value: string) => void;
  onSelectedPlayersCountChange?: (value: string) => void;
  onOverwriteExistingStandingsChange?: (value: boolean) => void;
  onSeasonCreateFieldChange?: (field: keyof SeasonDraft, value: string) => void;
  onSeasonRowFieldChange?: (
    seasonCode: string,
    field: keyof SeasonDraft,
    value: string,
  ) => void;
  onPointsCreateFieldChange?: (field: keyof PointsDraft, value: string) => void;
  onPointsRowFieldChange?: (
    entryKey: string,
    field: keyof PointsDraft,
    value: string,
  ) => void;
  onSeasonCreateSubmit?: () => void;
  onSeasonRowSave?: (seasonCode: string) => void;
  onSeasonRowDelete?: (seasonCode: string) => void;
  onRunPointsAccrual?: () => void;
  onPointsCreateSubmit?: () => void;
  onPointsRowSave?: (entryKey: string) => void;
  onPointsRowDelete?: (entryKey: string) => void;
}

export function SeasonConfigPageView({
  state,
  canEdit = false,
  canRunAccrual = false,
  selectedSeasonCode,
  accrualSeasonCode = "",
  selectedPlayersCount = null,
  overwriteExistingStandings = false,
  seasonCreateDraft = {
    seasonCode: "",
    name: "",
    dateFrom: "",
    dateTo: "",
    bestLeaguesCount: "4",
    bestTournamentsCount: "4",
  },
  seasonRowDrafts = {},
  pointsCreateDraft = {
    seasonCode: "",
    playersCount: "",
    placement: "",
    points: "",
  },
  pointsRowDrafts = {},
  seasonSubmitState = {
    status: "idle",
    targetId: null,
    message: null,
  },
  pointsSubmitState = {
    status: "idle",
    targetId: null,
    message: null,
  },
  pointsAccrualSubmitState = {
    status: "idle",
    targetId: null,
    message: null,
  },
  onSelectedSeasonCodeChange,
  onAccrualSeasonCodeChange,
  onSelectedPlayersCountChange,
  onOverwriteExistingStandingsChange,
  onSeasonCreateFieldChange,
  onSeasonRowFieldChange,
  onPointsCreateFieldChange,
  onPointsRowFieldChange,
  onSeasonCreateSubmit,
  onSeasonRowSave,
  onSeasonRowDelete,
  onRunPointsAccrual,
  onPointsCreateSubmit,
  onPointsRowSave,
  onPointsRowDelete,
}: SeasonConfigPageViewProps) {
  const seasons = state.status === "ready" ? state.seasons : [];
  const pointsEntries = state.status === "ready" ? state.pointsEntries : [];

  const visibleSeasons = useMemo(
    () =>
      [...seasons].sort((left, right) =>
        right.seasonCode.localeCompare(left.seasonCode, "ru"),
      ),
    [seasons],
  );

  const playersCountOptions = useMemo(() => {
    const filteredBySeason = selectedSeasonCode
      ? pointsEntries.filter((entry) => entry.seasonCode === selectedSeasonCode)
      : pointsEntries;

    return [...new Set(filteredBySeason.map((entry) => entry.playersCount))].sort(
      (left, right) => left - right,
    );
  }, [pointsEntries, selectedSeasonCode]);

  const filteredPointsEntries = useMemo(() => {
    return [...pointsEntries]
      .filter((entry) =>
        selectedSeasonCode ? entry.seasonCode === selectedSeasonCode : true,
      )
      .filter((entry) =>
        typeof selectedPlayersCount === "number"
          ? entry.playersCount === selectedPlayersCount
          : true,
      )
      .sort((left, right) => left.placement - right.placement);
  }, [pointsEntries, selectedSeasonCode, selectedPlayersCount]);
  const canEditSeasons = false && canEdit;
  const canEditPoints = false;

  if (state.status === "loading") {
    return (
      <section className="data-page-shell" aria-labelledby="season-config-page-title">
        <PageHeader
          titleId="season-config-page-title"
          title="Сезоны и таблица очков"
          description="Загружаем конфигурацию сезонов и правила начисления очков."
        />
        <section className="state-panel state-panel--pending" aria-live="polite">
          <p className="state-panel__eyebrow">loading</p>
          <h2>Подтягиваем конфигурацию сезона</h2>
          <p>Собираем данные по сезонам и таблице начисления очков.</p>
        </section>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="data-page-shell" aria-labelledby="season-config-page-title">
        <PageHeader
          titleId="season-config-page-title"
          title="Сезоны и таблица очков"
        />
        <section className="state-panel state-panel--error" role="alert">
          <p className="state-panel__eyebrow">error</p>
          <h2>Не удалось загрузить данные сезона</h2>
          <p>{state.message}</p>
        </section>
      </section>
    );
  }

  return (
    <section className="data-page-shell" aria-labelledby="season-config-page-title">
      <PageHeader
        titleId="season-config-page-title"
        title="Сезоны и таблица очков"
        description="Настройка временного окна сезона и правил начисления очков по месту."
      />

      <section className="data-table-panel season-config-page__panel">
        {canRunAccrual ? (
          <section className="season-config-page__accrual-panel">
            <h2 className="season-config-page__section-title">Начисление очков сезона</h2>
            <p className="season-config-page__section-description">
              Начисляет очки по всем подходящим соревнованиям выбранного сезона и сохраняет их
              по каждому игроку.
            </p>
            <p className="season-config-page__section-description">
              Не забудьте проставить членство и дивизионы игрокам перед начислением.
            </p>
            <div className="season-config-page__accrual-controls">
              <label className="season-config-page__field">
                <span>Сезон для начисления</span>
                <select
                  className="season-config-page__input"
                  value={accrualSeasonCode}
                  onChange={(event) => onAccrualSeasonCodeChange?.(event.target.value)}
                  required
                >
                  {visibleSeasons.map((season) => (
                    <option key={season.seasonCode} value={season.seasonCode}>
                      {season.seasonCode}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="update-card__submit players-table__save-button"
                disabled={
                  pointsAccrualSubmitState.status === "saving" ||
                  !accrualSeasonCode
                }
                onClick={() => onRunPointsAccrual?.()}
              >
                {pointsAccrualSubmitState.status === "saving"
                  ? "Начисляем..."
                  : "Начислить очки"}
              </button>
              <label className="season-config-page__checkbox-label">
                <input
                  type="checkbox"
                  checked={overwriteExistingStandings}
                  onChange={(event) =>
                    onOverwriteExistingStandingsChange?.(event.target.checked)
                  }
                />
                Пересчитать уже начисленные очки
              </label>
            </div>
            {pointsAccrualSubmitState.message ? (
              <p
                className={
                  pointsAccrualSubmitState.status === "error"
                    ? "players-table__status players-table__status--error"
                    : "players-table__status"
                }
                role={pointsAccrualSubmitState.status === "error" ? "alert" : "status"}
              >
                {pointsAccrualSubmitState.message}
              </p>
            ) : null}
          </section>
        ) : null}

        <h2 className="season-config-page__section-title">Раздел «Сезон»</h2>
        <p className="season-config-page__section-description">
          Определяет дату начала и окончания сезона, а также ограничения расчёта.
        </p>
        <p className="season-config-page__section-description">
          Сезоны добавляются и изменяются только миграциями БД, в интерфейсе доступен только просмотр.
        </p>

        {canEditSeasons ? (
          <section className="season-config-page__create-grid">
            <label className="season-config-page__field">
              <span>Код</span>
              <input
                className="season-config-page__input"
                type="text"
                placeholder="2026"
                value={seasonCreateDraft.seasonCode}
                onChange={(event) =>
                  onSeasonCreateFieldChange?.("seasonCode", event.target.value)
                }
              />
            </label>
            <label className="season-config-page__field season-config-page__field--wide">
              <span>Название</span>
              <input
                className="season-config-page__input"
                type="text"
                placeholder="Сезон РДГА 2026"
                value={seasonCreateDraft.name}
                onChange={(event) =>
                  onSeasonCreateFieldChange?.("name", event.target.value)
                }
              />
            </label>
            <label className="season-config-page__field">
              <span>С даты</span>
              <input
                className="season-config-page__input"
                type="date"
                value={seasonCreateDraft.dateFrom}
                onChange={(event) =>
                  onSeasonCreateFieldChange?.("dateFrom", event.target.value)
                }
              />
            </label>
            <label className="season-config-page__field">
              <span>По дату</span>
              <input
                className="season-config-page__input"
                type="date"
                value={seasonCreateDraft.dateTo}
                onChange={(event) =>
                  onSeasonCreateFieldChange?.("dateTo", event.target.value)
                }
              />
            </label>
            <label className="season-config-page__field">
              <span>Лучшие лиги</span>
              <input
                className="season-config-page__input"
                type="number"
                min="0"
                step="1"
                value={seasonCreateDraft.bestLeaguesCount}
                onChange={(event) =>
                  onSeasonCreateFieldChange?.("bestLeaguesCount", event.target.value)
                }
              />
            </label>
            <label className="season-config-page__field">
              <span>Лучшие турниры</span>
              <input
                className="season-config-page__input"
                type="number"
                min="0"
                step="1"
                value={seasonCreateDraft.bestTournamentsCount}
                onChange={(event) =>
                  onSeasonCreateFieldChange?.(
                    "bestTournamentsCount",
                    event.target.value,
                  )
                }
              />
            </label>
            <div className="players-table__actions">
              <button
                type="button"
                className="update-card__submit players-table__save-button"
                disabled={seasonSubmitState.status === "saving"}
                onClick={() => onSeasonCreateSubmit?.()}
              >
                {seasonSubmitState.status === "saving" &&
                seasonSubmitState.targetId === "new"
                  ? "Сохраняем..."
                  : "Добавить сезон"}
              </button>
              {seasonSubmitState.message && seasonSubmitState.targetId === "new" ? (
                <p
                  className={
                    seasonSubmitState.status === "error"
                      ? "players-table__status players-table__status--error"
                      : "players-table__status"
                  }
                  role={seasonSubmitState.status === "error" ? "alert" : "status"}
                >
                  {seasonSubmitState.message}
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        {visibleSeasons.length === 0 ? (
          <section className="state-panel" aria-live="polite">
            <p className="state-panel__eyebrow">empty</p>
            <h2>Пока нет сезонов</h2>
            <p>Добавьте сезон, чтобы привязать к нему таблицу очков.</p>
          </section>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table season-config-page__table">
              <thead>
                <tr>
                  <th scope="col">Код</th>
                  <th scope="col">Название</th>
                  <th scope="col">С даты</th>
                  <th scope="col">По дату</th>
                  <th scope="col">Лучшие лиги</th>
                  <th scope="col">Лучшие турниры</th>
                  {canEditSeasons ? <th scope="col">Действия</th> : null}
                </tr>
              </thead>
              <tbody>
                {visibleSeasons.map((season) => {
                  const draft = seasonRowDrafts[season.seasonCode] ?? toSeasonDraft(season);
                  const isSavingCurrent =
                    seasonSubmitState.status === "saving" &&
                    seasonSubmitState.targetId === season.seasonCode;
                  const isStatusCurrent = seasonSubmitState.targetId === season.seasonCode;

                  return (
                    <tr key={season.seasonCode}>
                      <td className="data-table__cell-primary">
                        {canEditSeasons ? (
                          <input
                            className="season-config-page__input"
                            type="text"
                            value={draft.seasonCode}
                            disabled
                            readOnly
                          />
                        ) : (
                          season.seasonCode
                        )}
                      </td>
                      <td>
                        {canEditSeasons ? (
                          <input
                            className="season-config-page__input"
                            type="text"
                            value={draft.name}
                            onChange={(event) =>
                              onSeasonRowFieldChange?.(
                                season.seasonCode,
                                "name",
                                event.target.value,
                              )
                            }
                          />
                        ) : (
                          season.name
                        )}
                      </td>
                      <td>
                        {canEditSeasons ? (
                          <input
                            className="season-config-page__input"
                            type="date"
                            value={draft.dateFrom}
                            onChange={(event) =>
                              onSeasonRowFieldChange?.(
                                season.seasonCode,
                                "dateFrom",
                                event.target.value,
                              )
                            }
                          />
                        ) : (
                          season.dateFrom
                        )}
                      </td>
                      <td>
                        {canEditSeasons ? (
                          <input
                            className="season-config-page__input"
                            type="date"
                            value={draft.dateTo}
                            onChange={(event) =>
                              onSeasonRowFieldChange?.(
                                season.seasonCode,
                                "dateTo",
                                event.target.value,
                              )
                            }
                          />
                        ) : (
                          season.dateTo
                        )}
                      </td>
                      <td>
                        {canEditSeasons ? (
                          <input
                            className="season-config-page__input"
                            type="number"
                            min="0"
                            step="1"
                            value={draft.bestLeaguesCount}
                            onChange={(event) =>
                              onSeasonRowFieldChange?.(
                                season.seasonCode,
                                "bestLeaguesCount",
                                event.target.value,
                              )
                            }
                          />
                        ) : (
                          season.bestLeaguesCount
                        )}
                      </td>
                      <td>
                        {canEditSeasons ? (
                          <input
                            className="season-config-page__input"
                            type="number"
                            min="0"
                            step="1"
                            value={draft.bestTournamentsCount}
                            onChange={(event) =>
                              onSeasonRowFieldChange?.(
                                season.seasonCode,
                                "bestTournamentsCount",
                                event.target.value,
                              )
                            }
                          />
                        ) : (
                          season.bestTournamentsCount
                        )}
                      </td>
                      {canEditSeasons ? (
                        <td className="season-config-page__actions-cell">
                          <div className="tournament-categories-page__actions">
                            <button
                              type="button"
                              className="tournament-categories-page__icon-button tournament-categories-page__icon-button--save"
                              disabled={isSavingCurrent}
                              aria-label={
                                isSavingCurrent ? "Сохраняем сезон" : "Сохранить сезон"
                              }
                              title={isSavingCurrent ? "Сохраняем" : "Сохранить"}
                              onClick={() => onSeasonRowSave?.(season.seasonCode)}
                            >
                              <span aria-hidden="true">✓</span>
                            </button>
                            <button
                              type="button"
                              className="tournament-categories-page__icon-button tournament-categories-page__icon-button--delete"
                              disabled={isSavingCurrent}
                              aria-label="Удалить сезон"
                              title="Удалить"
                              onClick={() => {
                                if (!confirmSeasonDeletion()) {
                                  return;
                                }

                                onSeasonRowDelete?.(season.seasonCode);
                              }}
                            >
                              <span aria-hidden="true">×</span>
                            </button>
                            {seasonSubmitState.message && isStatusCurrent ? (
                              <p
                                className={`tournament-categories-page__status ${
                                  seasonSubmitState.status === "error"
                                    ? "tournament-categories-page__status--error"
                                    : ""
                                }`}
                                role={seasonSubmitState.status === "error" ? "alert" : "status"}
                              >
                                {seasonSubmitState.message}
                              </p>
                            ) : null}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="data-table-panel season-config-page__panel">
        <h2 className="season-config-page__section-title">Таблица начисления очков</h2>
        <p className="season-config-page__section-description">
          Правила начисления очков по месту для выбранного размера поля игроков.
        </p>
        <p className="season-config-page__section-description">
          Таблица редактируется только миграциями БД, в интерфейсе доступен только просмотр.
        </p>

        <div className="season-config-page__filters">
          <label className="season-config-page__field">
            <span>Сезон</span>
            <select
              className="season-config-page__input"
              value={selectedSeasonCode ?? ""}
              onChange={(event) => onSelectedSeasonCodeChange?.(event.target.value)}
            >
              <option value="">Все сезоны</option>
              {visibleSeasons.map((season) => (
                <option key={season.seasonCode} value={season.seasonCode}>
                  {season.seasonCode}
                </option>
              ))}
            </select>
          </label>
          <label className="season-config-page__field">
            <span>Игроков</span>
            <select
              className="season-config-page__input"
              value={typeof selectedPlayersCount === "number" ? String(selectedPlayersCount) : ""}
              onChange={(event) => onSelectedPlayersCountChange?.(event.target.value)}
            >
              <option value="">Любое</option>
              {playersCountOptions.map((playersCount) => (
                <option key={playersCount} value={String(playersCount)}>
                  {playersCount}
                </option>
              ))}
            </select>
          </label>
        </div>

        {canEditPoints ? (
          <section className="season-config-page__points-create-grid">
            <label className="season-config-page__field">
              <span>Сезон</span>
              <input
                className="season-config-page__input"
                type="text"
                value={pointsCreateDraft.seasonCode}
                placeholder="2026"
                onChange={(event) =>
                  onPointsCreateFieldChange?.("seasonCode", event.target.value)
                }
              />
            </label>
            <label className="season-config-page__field">
              <span>Игроков</span>
              <input
                className="season-config-page__input"
                type="number"
                min="8"
                step="1"
                value={pointsCreateDraft.playersCount}
                placeholder="32"
                onChange={(event) =>
                  onPointsCreateFieldChange?.("playersCount", event.target.value)
                }
              />
            </label>
            <label className="season-config-page__field">
              <span>Место</span>
              <input
                className="season-config-page__input"
                type="number"
                min="1"
                step="1"
                value={pointsCreateDraft.placement}
                placeholder="1"
                onChange={(event) =>
                  onPointsCreateFieldChange?.("placement", event.target.value)
                }
              />
            </label>
            <label className="season-config-page__field">
              <span>Очки</span>
              <input
                className="season-config-page__input"
                type="number"
                min="0"
                step="0.01"
                value={pointsCreateDraft.points}
                placeholder="75.00"
                onChange={(event) =>
                  onPointsCreateFieldChange?.("points", event.target.value)
                }
              />
            </label>
            <div className="players-table__actions">
              <button
                type="button"
                className="update-card__submit players-table__save-button"
                disabled={pointsSubmitState.status === "saving"}
                onClick={() => onPointsCreateSubmit?.()}
              >
                {pointsSubmitState.status === "saving" &&
                pointsSubmitState.targetId === "new"
                  ? "Сохраняем..."
                  : "Добавить строку"}
              </button>
              {pointsSubmitState.message && pointsSubmitState.targetId === "new" ? (
                <p
                  className={
                    pointsSubmitState.status === "error"
                      ? "players-table__status players-table__status--error"
                      : "players-table__status"
                  }
                  role={pointsSubmitState.status === "error" ? "alert" : "status"}
                >
                  {pointsSubmitState.message}
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        {filteredPointsEntries.length === 0 ? (
          <section className="state-panel" aria-live="polite">
            <p className="state-panel__eyebrow">empty</p>
            <h2>Нет строк для выбранного фильтра</h2>
            <p>Измените фильтры или добавьте строку таблицы вручную.</p>
          </section>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table season-config-page__table season-config-page__points-table">
              <thead>
                <tr>
                  <th scope="col">Сезон</th>
                  <th scope="col">Игроков</th>
                  <th scope="col">Место</th>
                  <th scope="col">Очки</th>
                  {canEditPoints ? <th scope="col">Действия</th> : null}
                </tr>
              </thead>
              <tbody>
                {filteredPointsEntries.map((entry) => {
                  const entryKey = buildPointsEntryKey(entry);
                  const draft = pointsRowDrafts[entryKey] ?? toPointsDraft(entry);
                  const isSavingCurrent =
                    pointsSubmitState.status === "saving" &&
                    pointsSubmitState.targetId === entryKey;
                  const isStatusCurrent = pointsSubmitState.targetId === entryKey;

                  return (
                    <tr key={entryKey}>
                      <td className="data-table__cell-primary">{entry.seasonCode}</td>
                      <td>{entry.playersCount}</td>
                      <td>{entry.placement}</td>
                      <td>
                        {canEditPoints ? (
                          <input
                            className="season-config-page__input season-config-page__points-input"
                            type="number"
                            min="0"
                            step="0.01"
                            value={draft.points}
                            onChange={(event) =>
                              onPointsRowFieldChange?.(entryKey, "points", event.target.value)
                            }
                          />
                        ) : (
                          entry.points.toFixed(2)
                        )}
                      </td>
                      {canEditPoints ? (
                        <td className="season-config-page__actions-cell">
                          <div className="tournament-categories-page__actions">
                            <button
                              type="button"
                              className="tournament-categories-page__icon-button tournament-categories-page__icon-button--save"
                              disabled={isSavingCurrent}
                              aria-label={
                                isSavingCurrent ? "Сохраняем строку" : "Сохранить строку"
                              }
                              title={isSavingCurrent ? "Сохраняем" : "Сохранить"}
                              onClick={() => onPointsRowSave?.(entryKey)}
                            >
                              <span aria-hidden="true">✓</span>
                            </button>
                            <button
                              type="button"
                              className="tournament-categories-page__icon-button tournament-categories-page__icon-button--delete"
                              disabled={isSavingCurrent}
                              aria-label="Удалить строку"
                              title="Удалить"
                              onClick={() => {
                                if (!confirmPointsEntryDeletion()) {
                                  return;
                                }

                                onPointsRowDelete?.(entryKey);
                              }}
                            >
                              <span aria-hidden="true">×</span>
                            </button>
                            {pointsSubmitState.message && isStatusCurrent ? (
                              <p
                                className={`tournament-categories-page__status ${
                                  pointsSubmitState.status === "error"
                                    ? "tournament-categories-page__status--error"
                                    : ""
                                }`}
                                role={pointsSubmitState.status === "error" ? "alert" : "status"}
                              >
                                {pointsSubmitState.message}
                              </p>
                            ) : null}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}

export function SeasonConfigPage() {
  const auth = useAuth();
  const [state, setState] = useState<SeasonConfigPageState>({ status: "loading" });
  const [selectedSeasonCode, setSelectedSeasonCode] = useSessionStorageState<string>(
    seasonConfigSelectedSeasonStorageKey,
    "",
  );
  const [accrualSeasonCode, setAccrualSeasonCode] = useState<string>("");
  const [selectedPlayersCount, setSelectedPlayersCount] = useSessionStorageState<number | null>(
    seasonConfigSelectedPlayersCountStorageKey,
    null,
  );
  const [overwriteExistingStandings, setOverwriteExistingStandings] = useState(false);
  const [seasonCreateDraft, setSeasonCreateDraft] = useState<SeasonDraft>({
    seasonCode: "",
    name: "",
    dateFrom: "",
    dateTo: "",
    bestLeaguesCount: "4",
    bestTournamentsCount: "4",
  });
  const [seasonRowDrafts, setSeasonRowDrafts] = useState<Record<string, SeasonDraft>>({});
  const [pointsCreateDraft, setPointsCreateDraft] = useState<PointsDraft>({
    seasonCode: "",
    playersCount: "",
    placement: "",
    points: "",
  });
  const [pointsRowDrafts, setPointsRowDrafts] = useState<Record<string, PointsDraft>>({});
  const [seasonSubmitState] = useState<SubmitState>({
    status: "idle",
    targetId: null,
    message: null,
  });
  const [pointsSubmitState, setPointsSubmitState] = useState<SubmitState>({
    status: "idle",
    targetId: null,
    message: null,
  });
  const [pointsAccrualSubmitState, setPointsAccrualSubmitState] = useState<SubmitState>({
    status: "idle",
    targetId: null,
    message: null,
  });

  useEffect(() => {
    let isActive = true;

    async function loadData() {
      try {
        const [seasonsEnvelope, pointsEnvelope] = await Promise.all([
          listSeasons(),
          listSeasonPointsTable(),
        ]);

        if (!isActive) {
          return;
        }

        const seasons = seasonsEnvelope.data;
        const pointsEntries = pointsEnvelope.data;
        const initialSeasonCode =
          [...seasons]
            .sort((left, right) =>
              right.seasonCode.localeCompare(left.seasonCode, "ru"),
            )
            .at(0)?.seasonCode ?? "";

        const initialPlayersCount =
          [...new Set(
            pointsEntries
              .filter((entry) => entry.seasonCode === initialSeasonCode)
              .map((entry) => entry.playersCount),
          )]
            .sort((left, right) => left - right)
            .at(0) ?? null;

        setState({
          status: "ready",
          seasons,
          seasonsTotal: resolveSeasonsTotal(seasons, seasonsEnvelope.meta),
          pointsEntries,
          pointsTotal: resolveSeasonPointsTableTotal(pointsEntries, pointsEnvelope.meta),
        });
        setSelectedSeasonCode((current) => current || initialSeasonCode);
        setAccrualSeasonCode(initialSeasonCode);
        setSelectedPlayersCount((current) => current ?? initialPlayersCount);
        setSeasonCreateDraft((current) => ({
          ...current,
          seasonCode: initialSeasonCode || current.seasonCode,
        }));
        setSeasonRowDrafts(
          Object.fromEntries(seasons.map((season) => [season.seasonCode, toSeasonDraft(season)])),
        );
        setPointsCreateDraft((current) => ({
          ...current,
          seasonCode: initialSeasonCode || current.seasonCode,
          playersCount:
            typeof initialPlayersCount === "number"
              ? String(initialPlayersCount)
              : current.playersCount,
        }));
        setPointsRowDrafts(
          Object.fromEntries(
            pointsEntries.map((entry) => [buildPointsEntryKey(entry), toPointsDraft(entry)]),
          ),
        );
      } catch (error) {
        if (!isActive) {
          return;
        }

        const message = [
          resolveSeasonsErrorMessage(error),
          resolveSeasonPointsTableErrorMessage(error),
        ][0];

        setState({
          status: "error",
          message,
        });
      }
    }

    void loadData();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (state.status !== "ready") {
      return;
    }

    if (
      selectedSeasonCode.length > 0 &&
      !state.seasons.some((season) => season.seasonCode === selectedSeasonCode)
    ) {
      setSelectedSeasonCode("");
    }
  }, [state, selectedSeasonCode]);

  useEffect(() => {
    if (state.status !== "ready") {
      return;
    }

    if (
      accrualSeasonCode.length > 0 &&
      state.seasons.some((season) => season.seasonCode === accrualSeasonCode)
    ) {
      return;
    }

    const fallbackSeasonCode =
      [...state.seasons]
        .sort((left, right) => right.seasonCode.localeCompare(left.seasonCode, "ru"))
        .at(0)?.seasonCode ?? "";
    setAccrualSeasonCode(fallbackSeasonCode);
  }, [accrualSeasonCode, state]);

  useEffect(() => {
    if (state.status !== "ready") {
      return;
    }

    const playersCountOptions = [
      ...new Set(
        state.pointsEntries
          .filter((entry) =>
            selectedSeasonCode.length > 0
              ? entry.seasonCode === selectedSeasonCode
              : true,
          )
          .map((entry) => entry.playersCount),
      ),
    ].sort((left, right) => left - right);

    if (playersCountOptions.length === 0) {
      if (selectedPlayersCount !== null) {
        setSelectedPlayersCount(null);
      }
      return;
    }

    if (
      selectedPlayersCount !== null &&
      playersCountOptions.includes(selectedPlayersCount)
    ) {
      return;
    }

    setSelectedPlayersCount(playersCountOptions[0] ?? null);
  }, [selectedPlayersCount, selectedSeasonCode, state]);

  async function handlePointsCreate() {
    if (state.status !== "ready") {
      return;
    }

    try {
      setPointsSubmitState({
        status: "saving",
        targetId: "new",
        message: null,
      });

      const payload = normalizePointsDraft(pointsCreateDraft);
      const createdEntry = await createSeasonPointsEntry(payload);
      const createdEntryKey = buildPointsEntryKey(createdEntry);

      setState((current) =>
        current.status !== "ready"
          ? current
          : {
              ...current,
              pointsEntries: [...current.pointsEntries, createdEntry],
              pointsTotal: current.pointsTotal + 1,
            },
      );
      setPointsRowDrafts((current) => ({
        ...current,
        [createdEntryKey]: toPointsDraft(createdEntry),
      }));
      setPointsCreateDraft((current) => ({
        ...current,
        placement: "",
        points: "",
      }));
      setPointsSubmitState({
        status: "success",
        targetId: "new",
        message: "Строка таблицы добавлена.",
      });
    } catch (error) {
      setPointsSubmitState({
        status: "error",
        targetId: "new",
        message: error instanceof Error ? error.message : "Не удалось добавить строку.",
      });
    }
  }

  async function handlePointsSave(entryKey: string) {
    try {
      setPointsSubmitState({
        status: "saving",
        targetId: entryKey,
        message: null,
      });

      const draft = pointsRowDrafts[entryKey];
      if (!draft) {
        throw new Error("Не нашли данные строки очков для сохранения.");
      }

      const payload = normalizePointsDraft(draft);
      const updatedEntry = await updateSeasonPointsEntry(payload);
      const updatedEntryKey = buildPointsEntryKey(updatedEntry);

      setState((current) =>
        current.status !== "ready"
          ? current
          : {
              ...current,
              pointsEntries: current.pointsEntries.map((entry) =>
                buildPointsEntryKey(entry) === entryKey ? updatedEntry : entry,
              ),
            },
      );
      setPointsRowDrafts((current) => {
        const nextDrafts = { ...current };
        delete nextDrafts[entryKey];
        nextDrafts[updatedEntryKey] = toPointsDraft(updatedEntry);

        return nextDrafts;
      });
      setPointsSubmitState({
        status: "success",
        targetId: updatedEntryKey,
        message: "Строка таблицы сохранена.",
      });
    } catch (error) {
      setPointsSubmitState({
        status: "error",
        targetId: entryKey,
        message: error instanceof Error ? error.message : "Не удалось сохранить строку.",
      });
    }
  }

  async function handlePointsDelete(entryKey: string) {
    if (state.status !== "ready") {
      return;
    }

    const [seasonCode, playersCountRaw, placementRaw] = entryKey.split(":");
    const playersCount = Number(playersCountRaw);
    const placement = Number(placementRaw);

    if (
      !seasonCode ||
      !Number.isInteger(playersCount) ||
      !Number.isInteger(placement)
    ) {
      setPointsSubmitState({
        status: "error",
        targetId: entryKey,
        message: "Не удалось распознать ключ строки для удаления.",
      });
      return;
    }

    try {
      setPointsSubmitState({
        status: "saving",
        targetId: entryKey,
        message: null,
      });

      await deleteSeasonPointsEntry({
        seasonCode,
        playersCount,
        placement,
      });

      setState((current) =>
        current.status !== "ready"
          ? current
          : {
              ...current,
              pointsEntries: current.pointsEntries.filter(
                (entry) => buildPointsEntryKey(entry) !== entryKey,
              ),
              pointsTotal: Math.max(0, current.pointsTotal - 1),
            },
      );
      setPointsRowDrafts((current) =>
        Object.fromEntries(
          Object.entries(current).filter(([key]) => key !== entryKey),
        ),
      );
      setPointsSubmitState({
        status: "success",
        targetId: entryKey,
        message: "Строка удалена.",
      });
    } catch (error) {
      setPointsSubmitState({
        status: "error",
        targetId: entryKey,
        message: error instanceof Error ? error.message : "Не удалось удалить строку.",
      });
    }
  }

  async function handleRunPointsAccrual() {
    if (!accrualSeasonCode) {
      setPointsAccrualSubmitState({
        status: "error",
        targetId: "new",
        message: "Выберите конкретный сезон для начисления очков.",
      });
      return;
    }

    try {
      setPointsAccrualSubmitState({
        status: "saving",
        targetId: "new",
        message: null,
      });

      const result = await runSeasonPointsAccrual({
        seasonCode: accrualSeasonCode,
        overwriteExisting: overwriteExistingStandings,
      });

      setPointsAccrualSubmitState({
        status: "success",
        targetId: "new",
        message: `Готово: начислено ${result.rowsPersisted} строк, турниров с очками ${result.competitionsWithPoints} из ${result.competitionsEligible}.`,
      });
    } catch (error) {
      setPointsAccrualSubmitState({
        status: "error",
        targetId: "new",
        message: resolveSeasonStandingsErrorMessage(error),
      });
    }
  }

  return (
    <SeasonConfigPageView
      state={state}
      canEdit={auth.status === "authenticated"}
      canRunAccrual={auth.status === "authenticated"}
      selectedSeasonCode={selectedSeasonCode}
      accrualSeasonCode={accrualSeasonCode}
      selectedPlayersCount={selectedPlayersCount}
      overwriteExistingStandings={overwriteExistingStandings}
      seasonCreateDraft={seasonCreateDraft}
      seasonRowDrafts={seasonRowDrafts}
      pointsCreateDraft={pointsCreateDraft}
      pointsRowDrafts={pointsRowDrafts}
      seasonSubmitState={seasonSubmitState}
      pointsSubmitState={pointsSubmitState}
      pointsAccrualSubmitState={pointsAccrualSubmitState}
      onSelectedSeasonCodeChange={(value) => {
        setSelectedSeasonCode(value.trim());
        setPointsCreateDraft((current) => ({
          ...current,
          seasonCode: value.trim(),
        }));
      }}
      onAccrualSeasonCodeChange={(value) => {
        setAccrualSeasonCode(value.trim());
      }}
      onSelectedPlayersCountChange={(value) => {
        const parsed = parsePlayersCount(value);
        setSelectedPlayersCount(parsed);
        setPointsCreateDraft((current) => ({
          ...current,
          playersCount: value,
        }));
      }}
      onOverwriteExistingStandingsChange={setOverwriteExistingStandings}
      onPointsCreateFieldChange={(field, value) => {
        setPointsCreateDraft((current) => ({
          ...current,
          [field]: value,
        }));
      }}
      onPointsRowFieldChange={(entryKey, field, value) => {
        setPointsRowDrafts((current) => ({
          ...current,
          [entryKey]: {
            ...(current[entryKey] ?? {
              seasonCode: "",
              playersCount: "",
              placement: "",
              points: "",
            }),
            [field]: value,
          },
        }));
      }}
      onRunPointsAccrual={handleRunPointsAccrual}
      onPointsCreateSubmit={handlePointsCreate}
      onPointsRowSave={handlePointsSave}
      onPointsRowDelete={handlePointsDelete}
    />
  );
}
