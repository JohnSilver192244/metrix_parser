import React, { useEffect, useMemo, useState } from "react";

import type { Division } from "@metrix-parser/shared-types";

import { useAuth } from "../auth/auth-context";
import { ActionToast } from "../../shared/action-toast";
import { PageHeader } from "../../shared/page-header";
import { LoadingStatePanel } from "../../shared/loading-state-panel";
import {
  createDivision,
  deleteDivision,
  listDivisions,
  resolveDivisionsErrorMessage,
  resolveDivisionsTotal,
  updateDivision,
} from "../../shared/api/divisions";

type DivisionsPageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; divisions: Division[]; total: number };

type SubmitState = {
  status: "idle" | "saving" | "success" | "error";
  code: string | "new" | null;
  message: string | null;
};

function normalizeCode(value: string): string {
  return value.trim();
}

function confirmDivisionDeletion(): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  return window.confirm(
    "Удалить дивизион? У игроков с этим дивизионом значение будет очищено.",
  );
}

const DIVISIONS_COLUMN_WIDTHS = {
  code: "320px",
} as const;

export interface DivisionsPageViewProps {
  state: DivisionsPageState;
  canEdit?: boolean;
  showReadonlyNotice?: boolean;
  pageTitleAction?: React.ReactNode;
  createDraft?: string;
  rowDrafts?: Record<string, string>;
  submitState?: SubmitState;
  onCreateDraftChange?: (value: string) => void;
  onRowDraftChange?: (code: string, value: string) => void;
  onCreateSubmit?: () => void;
  onRowSave?: (code: string) => void;
  onRowDelete?: (code: string) => void;
  onToastClose?: () => void;
}

export function DivisionsPageView({
  state,
  canEdit = false,
  showReadonlyNotice = true,
  pageTitleAction,
  createDraft = "",
  rowDrafts = {},
  submitState = {
    status: "idle",
    code: null,
    message: null,
  },
  onCreateDraftChange,
  onRowDraftChange,
  onCreateSubmit,
  onRowSave,
  onRowDelete,
  onToastClose,
}: DivisionsPageViewProps) {
  const divisions = state.status === "ready" ? state.divisions : [];
  const total = state.status === "ready" ? state.total : 0;
  const visibleDivisions = useMemo(
    () => [...divisions].sort((left, right) => left.code.localeCompare(right.code, "ru")),
    [divisions],
  );

  if (state.status === "loading") {
    return (
      <section className="data-page-shell" aria-labelledby="divisions-page-title">
        <PageHeader
          titleId="divisions-page-title"
          title="Дивизионы"
          description="Загружаем справочник дивизионов через backend API."
        />
        <LoadingStatePanel label="Подтягиваем дивизионы" rows={3} />
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="data-page-shell" aria-labelledby="divisions-page-title">
        <PageHeader
          titleId="divisions-page-title"
          title="Дивизионы"
          description="Страница управления справочником дивизионов."
        />
        <section className="state-panel state-panel--error" role="alert">
          <p className="state-panel__eyebrow">error</p>
          <h2>Не удалось загрузить дивизионы</h2>
          <p>{state.message}</p>
        </section>
      </section>
    );
  }

  return (
    <section className="data-page-shell" aria-labelledby="divisions-page-title">
      <PageHeader
        titleId="divisions-page-title"
        title="Дивизионы"
        titleAction={pageTitleAction}
        description={
          total > 0
            ? `В справочнике ${total} дивизионов.`
            : "Добавьте первый дивизион, чтобы использовать его в карточках игроков."
        }
      />

      {canEdit ? (
        <section className="data-table-panel tournament-categories-page__create-panel">
          <label className="competitions-page__filter">
            <span>Код дивизиона</span>
            <input
              className="tournament-categories-page__input"
              type="text"
              value={createDraft}
              placeholder="Например, MA3"
              onChange={(event) => onCreateDraftChange?.(event.target.value)}
            />
          </label>
          <div className="players-table__actions">
            <button
              type="button"
              className="update-card__submit players-table__save-button update-card__submit--action"
              disabled={submitState.status === "saving"}
              onClick={() => onCreateSubmit?.()}
            >
              {submitState.status === "saving" && submitState.code === "new"
                ? "Сохраняем..."
                : "Добавить дивизион"}
            </button>
          </div>
        </section>
      ) : null}

      {!canEdit && showReadonlyNotice ? (
        <div className="players-table__notice" role="note">
          Войдите в систему, чтобы добавлять, редактировать и удалять дивизионы.
        </div>
      ) : null}

      {visibleDivisions.length === 0 ? (
        <section className="state-panel" aria-live="polite">
          <p className="state-panel__eyebrow">empty</p>
          <h2>Пока нет дивизионов</h2>
          <p>Добавьте первый дивизион для игроков.</p>
        </section>
      ) : !canEdit ? (
        <section className="data-table-panel" aria-label="Дивизионы">
          <div className="data-table-wrap">
            <table className="data-table tournament-categories-page__table">
              <colgroup>
                <col style={{ width: DIVISIONS_COLUMN_WIDTHS.code }} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Код</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <span className="players-table__readonly-value">
                      {visibleDivisions.map((division) => division.code).join(", ")}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="data-table-panel" aria-label="Дивизионы">
          <div className="data-table-wrap">
            <table className="data-table tournament-categories-page__table">
              <colgroup>
                <col style={{ width: DIVISIONS_COLUMN_WIDTHS.code }} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Код</th>
                </tr>
              </thead>
              <tbody>
                {visibleDivisions.map((division) => {
                  const draftCode = rowDrafts[division.code] ?? division.code;
                  const normalizedDraftCode = normalizeCode(draftCode);
                  const isSaving =
                    submitState.status === "saving" && submitState.code === division.code;
                  const hasChanges = normalizedDraftCode !== division.code;

                  return (
                    <tr key={division.code}>
                      <td>
                        {canEdit ? (
                          <div className="divisions-page__code-row">
                            <label className="sr-only" htmlFor={`division-code-${division.code}`}>
                              Код дивизиона {division.code}
                            </label>
                            <input
                              id={`division-code-${division.code}`}
                              className="tournament-categories-page__input"
                              type="text"
                              value={draftCode}
                              onChange={(event) =>
                                onRowDraftChange?.(division.code, event.target.value)
                              }
                            />
                            <div className="tournament-categories-page__actions">
                              <button
                                type="button"
                                className="tournament-categories-page__icon-button tournament-categories-page__icon-button--save"
                                disabled={!hasChanges || isSaving}
                                aria-label={
                                  isSaving ? "Сохраняем дивизион" : "Сохранить дивизион"
                                }
                                title={isSaving ? "Сохраняем" : "Сохранить"}
                                onClick={() => onRowSave?.(division.code)}
                              >
                                <span aria-hidden="true">✓</span>
                                <span className="sr-only">
                                  {isSaving ? "Сохраняем..." : "Сохранить"}
                                </span>
                              </button>
                              <button
                                type="button"
                                className="tournament-categories-page__icon-button tournament-categories-page__icon-button--delete"
                                disabled={isSaving}
                                aria-label="Удалить дивизион"
                                title="Удалить"
                                onClick={() => onRowDelete?.(division.code)}
                              >
                                <span aria-hidden="true">×</span>
                                <span className="sr-only">Удалить</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span className="players-table__readonly-value">{division.code}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <ActionToast
        message={submitState.status === "saving" ? null : submitState.message}
        tone={submitState.status === "error" ? "error" : "success"}
        onClose={onToastClose}
      />
    </section>
  );
}

export interface DivisionsPageProps {
  forceCanEdit?: boolean;
  showReadonlyNotice?: boolean;
  pageTitleAction?: React.ReactNode;
}

export function DivisionsPage({
  forceCanEdit,
  showReadonlyNotice,
  pageTitleAction,
}: DivisionsPageProps = {}) {
  const auth = useAuth();
  const [state, setState] = useState<DivisionsPageState>({
    status: "loading",
  });
  const [createDraft, setCreateDraft] = useState("");
  const [rowDrafts, setRowDrafts] = useState<Record<string, string>>({});
  const [submitState, setSubmitState] = useState<SubmitState>({
    status: "idle",
    code: null,
    message: null,
  });

  function resetSubmitState() {
    setSubmitState((currentState) =>
      currentState.status === "saving" || currentState.message === null
        ? currentState
        : {
            status: "idle",
            code: null,
            message: null,
          },
    );
  }

  useEffect(() => {
    let isActive = true;

    async function loadDivisions() {
      try {
        const envelope = await listDivisions();

        if (!isActive) {
          return;
        }

        setState({
          status: "ready",
          divisions: envelope.data,
          total: resolveDivisionsTotal(envelope.data, envelope.meta),
        });
        setRowDrafts(Object.fromEntries(envelope.data.map((division) => [division.code, division.code])));
      } catch (error) {
        if (!isActive) {
          return;
        }

        setState({
          status: "error",
          message: resolveDivisionsErrorMessage(error),
        });
      }
    }

    void loadDivisions();

    return () => {
      isActive = false;
    };
  }, []);

  async function handleCreate() {
    if (state.status !== "ready") {
      return;
    }

    try {
      setSubmitState({
        status: "saving",
        code: "new",
        message: null,
      });

      const code = normalizeCode(createDraft);
      if (code.length === 0) {
        throw new Error("Укажите код дивизиона.");
      }

      const createdDivision = await createDivision({ code });

      setState((current) =>
        current.status !== "ready"
          ? current
          : {
              status: "ready",
              divisions: [...current.divisions, createdDivision],
              total: current.total + 1,
            },
      );
      setRowDrafts((current) => ({
        ...current,
        [createdDivision.code]: createdDivision.code,
      }));
      setCreateDraft("");
      setSubmitState({
        status: "success",
        code: "new",
        message: "Дивизион добавлен.",
      });
    } catch (error) {
      setSubmitState({
        status: "error",
        code: "new",
        message: error instanceof Error ? error.message : "Не удалось добавить дивизион.",
      });
    }
  }

  async function handleSave(code: string) {
    if (state.status !== "ready") {
      return;
    }

    try {
      setSubmitState({
        status: "saving",
        code,
        message: null,
      });

      const draftCode = rowDrafts[code] ?? code;
      const nextCode = normalizeCode(draftCode);
      if (nextCode.length === 0) {
        throw new Error("Код дивизиона не может быть пустым.");
      }

      const updatedDivision = await updateDivision({
        code,
        nextCode,
      });

      setState((current) =>
        current.status !== "ready"
          ? current
          : {
              status: "ready",
              divisions: current.divisions.map((division) =>
                division.code === code ? updatedDivision : division,
              ),
              total: current.total,
            },
      );
      setRowDrafts((current) => {
        const next = { ...current };
        delete next[code];
        next[updatedDivision.code] = updatedDivision.code;
        return next;
      });
      setSubmitState({
        status: "success",
        code: updatedDivision.code,
        message: "Изменения сохранены.",
      });
    } catch (error) {
      setSubmitState({
        status: "error",
        code,
        message:
          error instanceof Error ? error.message : "Не удалось обновить дивизион.",
      });
    }
  }

  async function handleDelete(code: string) {
    if (!confirmDivisionDeletion()) {
      return;
    }

    try {
      setSubmitState({
        status: "saving",
        code,
        message: null,
      });

      await deleteDivision(code);

      setState((current) =>
        current.status !== "ready"
          ? current
          : {
              status: "ready",
              divisions: current.divisions.filter((division) => division.code !== code),
              total: Math.max(0, current.total - 1),
            },
      );
      setRowDrafts((current) => {
        const next = { ...current };
        delete next[code];
        return next;
      });
      setSubmitState({
        status: "success",
        code,
        message: "Дивизион удален.",
      });
    } catch (error) {
      setSubmitState({
        status: "error",
        code,
        message: error instanceof Error ? error.message : "Не удалось удалить дивизион.",
      });
    }
  }

  return (
    <DivisionsPageView
      state={state}
      canEdit={forceCanEdit ?? auth.status === "authenticated"}
      showReadonlyNotice={showReadonlyNotice ?? forceCanEdit === undefined}
      pageTitleAction={pageTitleAction}
      createDraft={createDraft}
      rowDrafts={rowDrafts}
      submitState={submitState}
      onCreateDraftChange={setCreateDraft}
      onRowDraftChange={(code, value) => {
        setRowDrafts((current) => ({
          ...current,
          [code]: value,
        }));
      }}
      onCreateSubmit={() => {
        void handleCreate();
      }}
      onRowSave={(code) => {
        void handleSave(code);
      }}
      onRowDelete={(code) => {
        void handleDelete(code);
      }}
      onToastClose={resetSubmitState}
    />
  );
}
