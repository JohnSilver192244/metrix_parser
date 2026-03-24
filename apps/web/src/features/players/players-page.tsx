import React, { useEffect, useState } from "react";

import type { Division, Player } from "@metrix-parser/shared-types";

import { PageHeader } from "../../shared/page-header";
import {
  listDivisions,
} from "../../shared/api/divisions";
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

export interface PlayersPageViewProps {
  state: PlayersPageState;
  divisionDrafts?: Record<string, string>;
  rdgaDrafts?: Record<string, boolean | null>;
  saveState?: {
    status: "idle" | "saving" | "success" | "error";
    playerId: string | null;
    message: string | null;
  };
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

export function PlayersPageView({
  state,
  divisionDrafts = {},
  rdgaDrafts = {},
  saveState = {
    status: "idle",
    playerId: null,
    message: null,
  },
  onDivisionChange,
  onRdgaChange,
  onDivisionSave,
}: PlayersPageViewProps) {
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

  const { divisions, players, total } = state;

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
        <section className="data-table-panel" aria-label="Сохранённые игроки">
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
                {players.map((player) => {
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
                            disabled={!hasChanges || isSaving}
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
    </section>
  );
}

export function PlayersPage() {
  const [state, setState] = useState<PlayersPageState>({
    status: "loading",
  });
  const [divisionDrafts, setDivisionDrafts] = useState<Record<string, string>>({});
  const [rdgaDrafts, setRdgaDrafts] = useState<Record<string, boolean | null>>({});
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
      divisionDrafts={divisionDrafts}
      rdgaDrafts={rdgaDrafts}
      saveState={saveState}
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
