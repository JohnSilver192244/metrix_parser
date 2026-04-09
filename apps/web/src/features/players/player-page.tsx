import React, { useEffect, useMemo, useState } from "react";

import type {
  Player,
  PlayerCompetitionResult,
  Season,
  UpdatePeriod,
} from "@metrix-parser/shared-types";

import { buildCompetitionResultsPath } from "../../app/route-paths";
import { UpdatePeriodPicker } from "../admin-updates/update-period-picker";
import { formatCompetitionDate } from "../competitions/competition-presenters";
import { PageHeader } from "../../shared/page-header";
import {
  listPlayerResults,
  listPlayers,
  resolvePlayerResultsTotal,
  resolvePlayersErrorMessage,
} from "../../shared/api/players";
import { listSeasons, resolveSeasonsErrorMessage } from "../../shared/api/seasons";
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

export interface PlayerPageViewProps {
  headerState: PlayerHeaderState;
  resultsState: PlayerResultsState;
  seasonCode: string;
  period: UpdatePeriod;
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

export function PlayerPageView({
  headerState,
  resultsState,
  seasonCode,
  period,
  onSeasonCodeChange,
  onPeriodChange,
  onNavigate,
}: PlayerPageViewProps) {
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
          eyebrow="Игроки"
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
          eyebrow="Игроки"
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
          eyebrow="Игроки"
          title="Игрок не найден"
          description={`Игрок с id ${headerState.playerId} отсутствует в базе.`}
        />
      </section>
    );
  }

  const { player, seasons } = headerState;
  const hasSeasonContext =
    seasonCode.length > 0 && period.dateFrom.length > 0 && period.dateTo.length > 0;

  return (
    <section className="data-page-shell" aria-labelledby="player-page-title">
      {backButton}

      <PageHeader
        titleId="player-page-title"
        eyebrow="Игрок"
        title={resolvePlayerName(player)}
        description={`Metrix ID: ${player.playerId}`}
      />

      {hasSeasonContext ? (
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
      ) : (
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
                  <th scope="col">Соревнование</th>
                  <th scope="col">Дата</th>
                  <th scope="col">Категория</th>
                  <th scope="col">Место</th>
                  <th scope="col">Очки</th>
                </tr>
              </thead>
              <tbody>
                {resultsState.rows.map((row) => (
                  <tr key={`${row.competitionId}-${player.playerId}`}>
                    <td className="data-table__cell-primary">
                      <button
                        className="data-table__link-button"
                        type="button"
                        onClick={() => {
                          setCompetitionResultsSourcePlayerContext(row.competitionId, {
                            playerId: player.playerId,
                            playerName: resolvePlayerName(player),
                          });
                          onNavigate(buildCompetitionResultsPath(row.competitionId));
                        }}
                        aria-label={`Открыть результаты соревнования ${decodeHtmlEntities(row.competitionName)}`}
                      >
                        {decodeHtmlEntities(row.competitionName)}
                      </button>
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
          <p>Всего строк: {resultsState.total}</p>
        </section>
      )}
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
        const [playersEnvelope, seasonsEnvelope] = await Promise.all([
          listPlayers(),
          listSeasons(),
        ]);

        if (!isActive) {
          return;
        }

        const player = playersEnvelope.data.find((item) => item.playerId === playerId);
        if (!player) {
          setHeaderState({
            status: "not-found",
            playerId,
          });
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
