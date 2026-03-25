import React, { useEffect, useMemo, useState } from "react";

import type { Division, Player } from "@metrix-parser/shared-types";

import { useAuth } from "../auth/auth-context";
import { PageHeader } from "../../shared/page-header";
import { listDivisions } from "../../shared/api/divisions";
import {
  listPlayers,
  resolvePlayersErrorMessage,
  resolvePlayersTotal,
  updatePlayer,
} from "../../shared/api/players";
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
      total: number;
    };

type PlayersRdgaFilter = "all" | "rdga" | "non-rdga";

export interface PlayersPageViewProps {
  state: PlayersPageState;
  nameQuery?: string;
  divisionFilter?: string;
  rdgaFilter?: PlayersRdgaFilter;
  canEdit?: boolean;
  divisionDrafts?: Record<string, string>;
  rdgaDrafts?: Record<string, boolean | null>;
  saveState?: {
    status: "idle" | "saving" | "success" | "error";
    playerId: string | null;
    message: string | null;
  };
  onNameQueryChange?: (value: string) => void;
  onDivisionFilterChange?: (value: string) => void;
  onRdgaFilterChange?: (value: PlayersRdgaFilter) => void;
  onDivisionChange?: (playerId: string, value: string) => void;
  onRdgaChange?: (playerId: string, value: boolean) => void;
  onDivisionSave?: (playerId: string) => void;
}

function formatCompetitionsCount(value: number | undefined): string {
  return `${value ?? 0}`;
}

function normalizeDivisionValue(value: string): string | null {
  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function normalizeNameQuery(value: string): string {
  return value.trim().toLowerCase();
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

export function PlayersPageView({
  state,
  nameQuery = "",
  divisionFilter = "",
  rdgaFilter = "all",
  canEdit = false,
  divisionDrafts = {},
  rdgaDrafts = {},
  saveState = {
    status: "idle",
    playerId: null,
    message: null,
  },
  onNameQueryChange,
  onDivisionFilterChange,
  onRdgaFilterChange,
  onDivisionChange,
  onRdgaChange,
  onDivisionSave,
}: PlayersPageViewProps) {
  const divisions = state.status === "ready" ? state.divisions : [];
  const players = state.status === "ready" ? state.players : [];
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

    return filterPlayersByRdga(playersByDivision, rdgaFilter);
  }, [divisionFilter, normalizedNameQuery, players, rdgaFilter]);

  if (state.status === "loading") {
    return (
      <section className="data-page-shell" aria-labelledby="players-page-title">
        <PageHeader
          titleId="players-page-title"
          eyebrow="Данные"
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
          eyebrow="Данные"
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
        eyebrow="Данные"
        title="Список игроков"
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
          <section className="competitions-page__filters" aria-label="Фильтр игроков">
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

          {visiblePlayers.length === 0 ? (
            <section className="state-panel" aria-live="polite">
              <p className="state-panel__eyebrow">filtered</p>
              <h2>По текущему фильтру игроков нет</h2>
              <p>Попробуйте изменить имя, дивизион или фильтр RDGA.</p>
            </section>
          ) : (
            <section className="data-table-panel" aria-label="Сохранённые игроки">
              {!canEdit ? (
                <div className="players-table__notice" role="note">
                  Войдите в систему, чтобы менять дивизион и RDGA. Без авторизации список остаётся только для просмотра.
                </div>
              ) : null}
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Metrix ID</th>
                      <th scope="col">Игрок</th>
                      <th scope="col">Дивизион</th>
                      <th scope="col">RDGA</th>
                      <th scope="col">Соревнований</th>
                      <th scope="col">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePlayers.map((player) => {
                      const draftDivision =
                        divisionDrafts[player.playerId] ?? player.division ?? "";
                      const draftRdga =
                        player.playerId in rdgaDrafts
                          ? (rdgaDrafts[player.playerId] ?? null)
                          : (player.rdga ?? null);
                      const normalizedDraftDivision =
                        normalizeDivisionValue(draftDivision);
                      const isSaving =
                        saveState.status === "saving" &&
                        saveState.playerId === player.playerId;
                      const hasChanges =
                        normalizedDraftDivision !== (player.division ?? null) ||
                        draftRdga !== (player.rdga ?? null);
                      const rowMessage =
                        saveState.playerId === player.playerId ? saveState.message : null;

                      return (
                        <tr key={player.playerId}>
                          <td className="data-table__cell-primary">{player.playerId}</td>
                          <td className="data-table__cell-primary">
                            {decodeHtmlEntities(player.playerName)}
                          </td>
                          <td>
                            <label className="sr-only" htmlFor={`player-division-${player.playerId}`}>
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
                          </td>
                          <td>
                            <label className="sr-only" htmlFor={`player-rdga-${player.playerId}`}>
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
                          </td>
                          <td>{formatCompetitionsCount(player.competitionsCount)}</td>
                          <td>
                            <div className="players-table__actions">
                              <button
                                className="update-card__submit players-table__save-button"
                                type="button"
                                disabled={!canEdit || !hasChanges || isSaving}
                                onClick={() => onDivisionSave?.(player.playerId)}
                              >
                                {isSaving ? "Сохраняем..." : "Сохранить"}
                              </button>
                              {rowMessage ? (
                                <p
                                  className={
                                    saveState.status === "error"
                                      ? "players-table__status players-table__status--error"
                                      : "players-table__status"
                                  }
                                  role={saveState.status === "error" ? "alert" : undefined}
                                >
                                  {rowMessage}
                                </p>
                              ) : null}
                            </div>
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

export function PlayersPage() {
  const { status: authStatus, user } = useAuth();
  const [state, setState] = useState<PlayersPageState>({
    status: "loading",
  });
  const [divisionDrafts, setDivisionDrafts] = useState<Record<string, string>>({});
  const [rdgaDrafts, setRdgaDrafts] = useState<Record<string, boolean | null>>({});
  const [nameQuery, setNameQuery] = useState("");
  const [divisionFilter, setDivisionFilter] = useState("");
  const [rdgaFilter, setRdgaFilter] = useState<PlayersRdgaFilter>("all");
  const [saveState, setSaveState] = useState<{
    status: "idle" | "saving" | "success" | "error";
    playerId: string | null;
    message: string | null;
  }>({
    status: "idle",
    playerId: null,
    message: null,
  });

  useEffect(() => {
    let isActive = true;

    void (async () => {
      try {
        const [playersEnvelope, divisionsEnvelope] = await Promise.all([
          listPlayers(),
          listDivisions(),
        ]);

        if (!isActive) {
          return;
        }

        setState({
          status: "ready",
          divisions: divisionsEnvelope.data,
          players: playersEnvelope.data,
          total: resolvePlayersTotal(playersEnvelope.data, playersEnvelope.meta),
        });
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
      } catch (error) {
        if (!isActive) {
          return;
        }

        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Не удалось загрузить список игроков и справочник дивизионов.",
        });
      }
    })();

    return () => {
      isActive = false;
    };
  }, []);

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

    if (division === (player.division ?? null) && rdga === (player.rdga ?? null)) {
      return;
    }

    setSaveState({
      status: "saving",
      playerId,
      message: "Сохраняем параметры игрока.",
    });

    try {
      const updatedPlayer = await updatePlayer({
        playerId,
        division,
        rdga,
      });

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
      nameQuery={nameQuery}
      divisionFilter={divisionFilter}
      rdgaFilter={rdgaFilter}
      canEdit={authStatus === "authenticated" && Boolean(user)}
      divisionDrafts={divisionDrafts}
      rdgaDrafts={rdgaDrafts}
      saveState={saveState}
      onNameQueryChange={setNameQuery}
      onDivisionFilterChange={setDivisionFilter}
      onRdgaFilterChange={setRdgaFilter}
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
      onDivisionSave={(playerId) => {
        void handleDivisionSave(playerId);
      }}
    />
  );
}
