import React, { useEffect, useMemo, useState } from "react";

import type {
  CreateTournamentCategoryRequest,
  TournamentCategory,
} from "@metrix-parser/shared-types";

import { useAuth } from "../auth/auth-context";
import { PageHeader } from "../../shared/page-header";
import { LoadingStatePanel } from "../../shared/loading-state-panel";
import { ActionToast } from "../../shared/action-toast";
import {
  createTournamentCategory,
  deleteTournamentCategory,
  listTournamentCategories,
  resolveTournamentCategoriesErrorMessage,
  resolveTournamentCategoriesTotal,
  updateTournamentCategory,
} from "../../shared/api/tournament-categories";

type TournamentCategoriesPageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; categories: TournamentCategory[]; total: number };

type CategoryDraft = {
  name: string;
  description: string;
  competitionClass: string;
  segmentsCount: string;
  ratingGte: string;
  ratingLt: string;
  coefficient: string;
};

type SubmitState = {
  status: "idle" | "saving" | "success" | "error";
  categoryId: string | "new" | null;
  message: string | null;
};

const COMPETITION_CLASS_OPTIONS = [
  { value: "tournament", label: "Турнир" },
  { value: "league", label: "Лига" },
  { value: "championship", label: "ЧР" },
] as const;

function toDraft(category: TournamentCategory): CategoryDraft {
  return {
    name: category.name,
    description: category.description,
    competitionClass: category.competitionClass,
    segmentsCount: String(category.segmentsCount),
    ratingGte: String(category.ratingGte),
    ratingLt: String(category.ratingLt),
    coefficient: category.coefficient.toFixed(2),
  };
}

function parseDraftNumber(value: string): number {
  return Number(value.trim().replaceAll(",", "."));
}

export function normalizeDraft(draft: CategoryDraft): CreateTournamentCategoryRequest {
  const name = draft.name.trim();
  const description = draft.description.trim();
  const competitionClass = draft.competitionClass.trim();
  const segmentsCount = Number(draft.segmentsCount);
  const ratingGte = parseDraftNumber(draft.ratingGte);
  const ratingLt = parseDraftNumber(draft.ratingLt);
  const coefficient = parseDraftNumber(draft.coefficient);

  if (name.length === 0) {
    throw new Error("Укажите название категории.");
  }

  if (description.length === 0) {
    throw new Error("Укажите описание категории.");
  }

  if (
    competitionClass !== "league" &&
    competitionClass !== "tournament" &&
    competitionClass !== "championship"
  ) {
    throw new Error("Выберите тип категории: лига, турнир или ЧР.");
  }

  if (!Number.isInteger(segmentsCount) || segmentsCount <= 0) {
    throw new Error("Количество отрезков должно быть целым положительным числом.");
  }

  if (!Number.isFinite(ratingGte) || ratingGte < 0) {
    throw new Error("Рейтинг >= должен быть неотрицательным числом.");
  }

  if (!Number.isFinite(ratingLt) || ratingLt < 0) {
    throw new Error("Рейтинг < должен быть неотрицательным числом.");
  }

  if (ratingLt <= ratingGte) {
    throw new Error("Значение 'Рейтинг <' должно быть больше, чем 'Рейтинг >='.");
  }

  if (!Number.isFinite(coefficient) || coefficient < 0) {
    throw new Error("Коэффициент должен быть неотрицательным числом.");
  }

  const roundedCoefficient = Math.round(coefficient * 100) / 100;
  if (Math.abs(coefficient - roundedCoefficient) > 1e-9) {
    throw new Error("Коэффициент должен содержать не более двух знаков после запятой.");
  }

  return {
    name,
    description,
    competitionClass,
    segmentsCount,
    ratingGte,
    ratingLt,
    coefficient,
  };
}

function formatRatingValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatCoefficient(value: number): string {
  return value.toFixed(2);
}

function resolveCompetitionClassLabel(competitionClass: string): string {
  const option = COMPETITION_CLASS_OPTIONS.find((entry) => entry.value === competitionClass);
  return option?.label ?? "Турнир";
}

function confirmCategoryDeletion(): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  return window.confirm("Точно удаляем категорию?");
}

const TOURNAMENT_CATEGORY_COLUMN_WIDTHS = {
  name: "90px",
  competitionClass: "125px",
  segmentsCount: "145px",
  ratingGte: "120px",
  ratingLt: "120px",
  coefficient: "160px",
  actions: "112px",
} as const;

export interface TournamentCategoriesPageViewProps {
  state: TournamentCategoriesPageState;
  canEdit?: boolean;
  pageTitleAction?: React.ReactNode;
  createDraft?: CategoryDraft;
  rowDrafts?: Record<string, CategoryDraft>;
  submitState?: SubmitState;
  onCreateFieldChange?: (field: keyof CategoryDraft, value: string) => void;
  onRowFieldChange?: (
    categoryId: string,
    field: keyof CategoryDraft,
    value: string,
  ) => void;
  onCreateSubmit?: () => void;
  onRowSave?: (categoryId: string) => void;
  onRowDelete?: (categoryId: string) => void;
  onToastClose?: () => void;
}

export function TournamentCategoriesPageView({
  state,
  canEdit = false,
  pageTitleAction,
  createDraft = {
    name: "",
    description: "",
    competitionClass: "tournament",
    segmentsCount: "",
    ratingGte: "",
    ratingLt: "",
    coefficient: "",
  },
  rowDrafts = {},
  submitState = {
    status: "idle",
    categoryId: null,
    message: null,
  },
  onCreateFieldChange,
  onRowFieldChange,
  onCreateSubmit,
  onRowSave,
  onRowDelete,
  onToastClose,
}: TournamentCategoriesPageViewProps) {
  const categories = state.status === "ready" ? state.categories : [];
  const total = state.status === "ready" ? state.total : 0;
  const visibleCategories = useMemo(
    () =>
      [...categories].sort((left, right) =>
        left.name.localeCompare(right.name, "ru"),
      ),
    [categories],
  );
  const toastTone = submitState.status === "error" ? "error" : "success";

  if (state.status === "loading") {
    return (
      <section className="data-page-shell" aria-labelledby="tournament-categories-page-title">
        <PageHeader
          titleId="tournament-categories-page-title"
          title="Категории турниров"
          description="Загружаем сохранённые категории турниров через backend API."
        />
        <LoadingStatePanel label="Подтягиваем категории турниров" rows={3} />
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="data-page-shell" aria-labelledby="tournament-categories-page-title">
        <PageHeader
          titleId="tournament-categories-page-title"
          title="Категории турниров"
          description="Страница показывает справочник категорий с параметрами отрезков и диапазона рейтинга."
        />
        <section className="state-panel state-panel--error" role="alert">
          <p className="state-panel__eyebrow">error</p>
          <h2>Не удалось загрузить категории турниров</h2>
          <p>{state.message}</p>
        </section>
      </section>
    );
  }

  return (
    <section className="data-page-shell" aria-labelledby="tournament-categories-page-title">
      <PageHeader
        titleId="tournament-categories-page-title"
        title="Категории турниров"
        titleAction={pageTitleAction}
      />

      {canEdit ? (
        <section className="data-table-panel tournament-categories-page__create-panel">
          <div className="tournament-categories-page__create-grid">
            <label className="tournament-categories-page__field tournament-categories-page__field--name">
              <span>Название</span>
              <input
                className="tournament-categories-page__input tournament-categories-page__input--name"
                type="text"
                value={createDraft.name}
                placeholder="Например, Любительские"
                onChange={(event) => onCreateFieldChange?.("name", event.target.value)}
              />
            </label>
            <label className="tournament-categories-page__field tournament-categories-page__field--description">
              <span>Описание</span>
              <input
                className="tournament-categories-page__input tournament-categories-page__input--description"
                type="text"
                value={createDraft.description}
                placeholder="Короткое описание категории"
                onChange={(event) =>
                  onCreateFieldChange?.("description", event.target.value)
                }
              />
            </label>
            <label className="tournament-categories-page__field tournament-categories-page__field--coefficient">
              <span>Коэффициент</span>
              <input
                className="tournament-categories-page__input tournament-categories-page__input--number tournament-categories-page__input--coefficient"
                type="number"
                min="0"
                step="0.01"
                value={createDraft.coefficient}
                placeholder="1.00"
                onChange={(event) =>
                  onCreateFieldChange?.("coefficient", event.target.value)
                }
              />
            </label>
            <label className="tournament-categories-page__field">
              <span>Тип</span>
              <select
                className="tournament-categories-page__input"
                value={createDraft.competitionClass}
                onChange={(event) =>
                  onCreateFieldChange?.("competitionClass", event.target.value)
                }
              >
                {COMPETITION_CLASS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="tournament-categories-page__field tournament-categories-page__field--segments">
              <span>Кол-во отрезков</span>
              <input
                className="tournament-categories-page__input tournament-categories-page__input--number tournament-categories-page__input--segments"
                type="number"
                min="1"
                step="1"
                value={createDraft.segmentsCount}
                placeholder="18"
                onChange={(event) =>
                  onCreateFieldChange?.("segmentsCount", event.target.value)
                }
              />
            </label>
            <label className="tournament-categories-page__field tournament-categories-page__field--rating-gte">
              <span>Рейтинг &gt;=</span>
              <input
                className="tournament-categories-page__input tournament-categories-page__input--number tournament-categories-page__input--rating-gte"
                type="number"
                min="0"
                step="0.1"
                value={createDraft.ratingGte}
                placeholder="72.5"
                onChange={(event) =>
                  onCreateFieldChange?.("ratingGte", event.target.value)
                }
              />
            </label>
            <label className="tournament-categories-page__field tournament-categories-page__field--rating-lt">
              <span>Рейтинг &lt;</span>
              <input
                className="tournament-categories-page__input tournament-categories-page__input--number tournament-categories-page__input--rating-lt"
                type="number"
                min="0"
                step="0.1"
                value={createDraft.ratingLt}
                placeholder="84.3"
                onChange={(event) =>
                  onCreateFieldChange?.("ratingLt", event.target.value)
                }
              />
            </label>
          </div>
          <div className="players-table__actions">
            <button
              type="button"
              className="update-card__submit players-table__save-button"
              disabled={submitState.status === "saving"}
              onClick={() => onCreateSubmit?.()}
            >
              {submitState.status === "saving" && submitState.categoryId === "new"
                ? "Сохраняем..."
                : "Добавить категорию"}
            </button>
          </div>
        </section>
      ) : null}

      {visibleCategories.length === 0 ? (
        <section className="state-panel" aria-live="polite">
          <p className="state-panel__eyebrow">empty</p>
          <h2>Пока нет категорий турниров</h2>
          <p>Добавьте первую категорию, чтобы использовать её как справочник.</p>
        </section>
      ) : (
        <section className="data-table-panel" aria-label="Категории турниров">
          <div className="data-table-wrap">
            <table className="data-table tournament-categories-page__table">
              <colgroup>
                <col style={{ width: TOURNAMENT_CATEGORY_COLUMN_WIDTHS.name }} />
                <col />
                <col style={{ width: TOURNAMENT_CATEGORY_COLUMN_WIDTHS.competitionClass }} />
                <col style={{ width: TOURNAMENT_CATEGORY_COLUMN_WIDTHS.segmentsCount }} />
                <col style={{ width: TOURNAMENT_CATEGORY_COLUMN_WIDTHS.ratingGte }} />
                <col style={{ width: TOURNAMENT_CATEGORY_COLUMN_WIDTHS.ratingLt }} />
                <col style={{ width: TOURNAMENT_CATEGORY_COLUMN_WIDTHS.coefficient }} />
                {canEdit ? (
                  <col style={{ width: TOURNAMENT_CATEGORY_COLUMN_WIDTHS.actions }} />
                ) : null}
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Название</th>
                  <th scope="col">Описание</th>
                  <th scope="col">Тип</th>
                  <th scope="col">Кол-во отрезков</th>
                  <th scope="col">Рейтинг &gt;=</th>
                  <th scope="col">Рейтинг &lt;</th>
                  <th scope="col">Коэффициент</th>
                  {canEdit ? <th scope="col">Действия</th> : null}
                </tr>
              </thead>
              <tbody>
                {visibleCategories.map((category) => {
                  const draft = rowDrafts[category.categoryId] ?? toDraft(category);
                  const isSavingCurrent =
                    submitState.status === "saving" &&
                    submitState.categoryId === category.categoryId;

                  return (
                    <tr key={category.categoryId}>
                      <td className="data-table__cell-primary">
                        {canEdit ? (
                          <input
                            className="tournament-categories-page__input"
                            type="text"
                            value={draft.name}
                            onChange={(event) =>
                              onRowFieldChange?.(
                                category.categoryId,
                                "name",
                                event.target.value,
                              )
                            }
                          />
                        ) : (
                          category.name
                        )}
                      </td>
                      <td>
                        {canEdit ? (
                          <input
                            className="tournament-categories-page__input"
                            type="text"
                            value={draft.description}
                            onChange={(event) =>
                              onRowFieldChange?.(
                                category.categoryId,
                                "description",
                                event.target.value,
                              )
                            }
                          />
                        ) : (
                          category.description
                        )}
                      </td>
                      <td>
                        {canEdit ? (
                          <select
                            className="tournament-categories-page__input"
                            value={draft.competitionClass}
                            onChange={(event) =>
                              onRowFieldChange?.(
                                category.categoryId,
                                "competitionClass",
                                event.target.value,
                              )
                            }
                          >
                            {COMPETITION_CLASS_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          resolveCompetitionClassLabel(category.competitionClass)
                        )}
                      </td>
                      <td>
                        {canEdit ? (
                          <input
                            className="tournament-categories-page__input tournament-categories-page__input--number"
                            type="number"
                            min="1"
                            step="1"
                            value={draft.segmentsCount}
                            onChange={(event) =>
                              onRowFieldChange?.(
                                category.categoryId,
                                "segmentsCount",
                                event.target.value,
                              )
                            }
                          />
                        ) : (
                          category.segmentsCount
                        )}
                      </td>
                      <td>
                        {canEdit ? (
                          <input
                            className="tournament-categories-page__input tournament-categories-page__input--number"
                            type="number"
                            min="0"
                            step="0.1"
                            value={draft.ratingGte}
                            onChange={(event) =>
                              onRowFieldChange?.(
                                category.categoryId,
                                "ratingGte",
                                event.target.value,
                              )
                            }
                          />
                        ) : (
                          formatRatingValue(category.ratingGte)
                        )}
                      </td>
                      <td>
                        {canEdit ? (
                          <input
                            className="tournament-categories-page__input tournament-categories-page__input--number"
                            type="number"
                            min="0"
                            step="0.1"
                            value={draft.ratingLt}
                            onChange={(event) =>
                              onRowFieldChange?.(
                                category.categoryId,
                                "ratingLt",
                                event.target.value,
                              )
                            }
                          />
                        ) : (
                          formatRatingValue(category.ratingLt)
                        )}
                      </td>
                      <td>
                        {canEdit ? (
                          <input
                            className="tournament-categories-page__input tournament-categories-page__input--number"
                            type="number"
                            min="0"
                            step="0.01"
                            value={draft.coefficient}
                            onChange={(event) =>
                              onRowFieldChange?.(
                                category.categoryId,
                                "coefficient",
                                event.target.value,
                              )
                            }
                          />
                        ) : (
                          formatCoefficient(category.coefficient)
                        )}
                      </td>
                      {canEdit ? (
                        <td className="tournament-categories-page__actions-cell">
                          <div className="tournament-categories-page__actions">
                            <button
                              type="button"
                              className="tournament-categories-page__icon-button tournament-categories-page__icon-button--save"
                              disabled={isSavingCurrent}
                              aria-label={
                                isSavingCurrent ? "Сохраняем категорию" : "Сохранить категорию"
                              }
                              title={isSavingCurrent ? "Сохраняем" : "Сохранить"}
                              onClick={() => onRowSave?.(category.categoryId)}
                            >
                              <span aria-hidden="true">✓</span>
                              <span className="sr-only">
                                {isSavingCurrent ? "Сохраняем..." : "Сохранить"}
                              </span>
                            </button>
                            <button
                              type="button"
                              className="tournament-categories-page__icon-button tournament-categories-page__icon-button--delete"
                              disabled={isSavingCurrent}
                              aria-label="Удалить категорию"
                              title="Удалить"
                              onClick={() => {
                                if (!confirmCategoryDeletion()) {
                                  return;
                                }

                                onRowDelete?.(category.categoryId);
                              }}
                            >
                              <span aria-hidden="true">×</span>
                              <span className="sr-only">Удалить</span>
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
        </section>
      )}

      <ActionToast
        message={submitState.status === "saving" ? null : submitState.message}
        tone={toastTone}
        onClose={onToastClose}
      />
    </section>
  );
}

export interface TournamentCategoriesPageProps {
  forceCanEdit?: boolean;
  pageTitleAction?: React.ReactNode;
}

export function TournamentCategoriesPage({
  forceCanEdit,
  pageTitleAction,
}: TournamentCategoriesPageProps = {}) {
  const auth = useAuth();
  const [state, setState] = useState<TournamentCategoriesPageState>({
    status: "loading",
  });
  const [createForm, setCreateForm] = useState<CategoryDraft>({
    name: "",
    description: "",
    competitionClass: "tournament",
    segmentsCount: "",
    ratingGte: "",
    ratingLt: "",
    coefficient: "",
  });
  const [rowDrafts, setRowDrafts] = useState<Record<string, CategoryDraft>>({});
  const [submitState, setSubmitState] = useState<SubmitState>({
    status: "idle",
    categoryId: null,
    message: null,
  });

  function resetSubmitState() {
    setSubmitState((current) =>
      current.status === "saving" || current.message === null
        ? current
        : {
            status: "idle",
            categoryId: null,
            message: null,
          },
    );
  }

  useEffect(() => {
    let isActive = true;

    async function loadCategories() {
      try {
        const envelope = await listTournamentCategories();

        if (!isActive) {
          return;
        }

        setState({
          status: "ready",
          categories: envelope.data,
          total: resolveTournamentCategoriesTotal(envelope.data, envelope.meta),
        });
        setRowDrafts(
          Object.fromEntries(
            envelope.data.map((category) => [category.categoryId, toDraft(category)]),
          ),
        );
      } catch (error) {
        if (!isActive) {
          return;
        }

        setState({
          status: "error",
          message: resolveTournamentCategoriesErrorMessage(error),
        });
      }
    }

    void loadCategories();

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
        categoryId: "new",
        message: null,
      });

      const payload = normalizeDraft(createForm);
      const createdCategory = await createTournamentCategory(payload);

      setState((current) =>
        current.status !== "ready"
          ? current
          : {
              status: "ready",
              categories: [...current.categories, createdCategory],
              total: current.total + 1,
            },
      );
      setRowDrafts((current) => ({
        ...current,
        [createdCategory.categoryId]: toDraft(createdCategory),
      }));
      setCreateForm({
        name: "",
        description: "",
        competitionClass: "tournament",
        segmentsCount: "",
        ratingGte: "",
        ratingLt: "",
        coefficient: "",
      });
      setSubmitState({
        status: "success",
        categoryId: "new",
        message: "Категория добавлена.",
      });
    } catch (error) {
      setSubmitState({
        status: "error",
        categoryId: "new",
        message:
          error instanceof Error ? error.message : "Не удалось добавить категорию.",
      });
    }
  }

  async function handleSave(categoryId: string) {
    try {
      setSubmitState({
        status: "saving",
        categoryId,
        message: null,
      });

      const draft = rowDrafts[categoryId];
      if (!draft) {
        throw new Error("Не нашли данные строки для сохранения.");
      }

      const payload = normalizeDraft(draft);
      const updatedCategory = await updateTournamentCategory({
        categoryId,
        ...payload,
      });

      setState((current) =>
        current.status !== "ready"
          ? current
          : {
              status: "ready",
              categories: current.categories.map((category) =>
                category.categoryId === categoryId ? updatedCategory : category,
              ),
              total: current.total,
            },
      );
      setRowDrafts((current) => ({
        ...current,
        [categoryId]: toDraft(updatedCategory),
      }));
      setSubmitState({
        status: "success",
        categoryId,
        message: "Изменения сохранены.",
      });
    } catch (error) {
      setSubmitState({
        status: "error",
        categoryId,
        message:
          error instanceof Error ? error.message : "Не удалось сохранить категорию.",
      });
    }
  }

  async function handleDelete(categoryId: string) {
    try {
      setSubmitState({
        status: "saving",
        categoryId,
        message: null,
      });

      await deleteTournamentCategory(categoryId);

      setState((current) =>
        current.status !== "ready"
          ? current
          : {
              status: "ready",
              categories: current.categories.filter(
                (category) => category.categoryId !== categoryId,
              ),
              total: Math.max(0, current.total - 1),
            },
      );
      setRowDrafts((current) => {
        const nextDrafts = { ...current };
        delete nextDrafts[categoryId];
        return nextDrafts;
      });
      setSubmitState({
        status: "success",
        categoryId,
        message: "Категория удалена.",
      });
    } catch (error) {
      setSubmitState({
        status: "error",
        categoryId,
        message:
          error instanceof Error ? error.message : "Не удалось удалить категорию.",
      });
    }
  }

  return (
    <TournamentCategoriesPageView
      state={state}
      canEdit={forceCanEdit ?? auth.status === "authenticated"}
      pageTitleAction={pageTitleAction}
      createDraft={createForm}
      rowDrafts={rowDrafts}
      submitState={submitState}
      onCreateFieldChange={(field, value) => {
        setCreateForm((current) => ({ ...current, [field]: value }));
      }}
      onRowFieldChange={(categoryId, field, value) => {
        setRowDrafts((current) => ({
          ...current,
          [categoryId]: {
            ...(current[categoryId] ?? {
              name: "",
              description: "",
              segmentsCount: "",
              ratingGte: "",
              ratingLt: "",
              coefficient: "",
            }),
            [field]: value,
          },
        }));
      }}
      onCreateSubmit={() => {
        void handleCreate();
      }}
      onRowSave={(categoryId) => {
        void handleSave(categoryId);
      }}
      onRowDelete={(categoryId) => {
        void handleDelete(categoryId);
      }}
      onToastClose={resetSubmitState}
    />
  );
}
