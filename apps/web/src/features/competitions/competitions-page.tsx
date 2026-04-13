import React, { useEffect, useMemo, useState } from "react";

import type { Competition, Course } from "@metrix-parser/shared-types";

import { useAuth } from "../auth/auth-context";
import {
  UpdatePeriodPicker,
  type PeriodPreset,
} from "../admin-updates/update-period-picker";
import { buildCompetitionResultsPath } from "../../app/route-paths";
import { PageHeader } from "../../shared/page-header";
import { FloatingInfoTooltip } from "../../shared/floating-info-tooltip";
import {
  listCompetitionsPage,
  updateCompetitionCategory,
  resolveCompetitionsErrorMessage,
  resolveCompetitionsTotal,
} from "../../shared/api/competitions";
import { listCourses } from "../../shared/api/courses";
import {
  listTournamentCategories,
} from "../../shared/api/tournament-categories";
import { useSessionStorageState } from "../../shared/session-storage";
import { decodeHtmlEntities } from "../../shared/text";
import { clearCompetitionResultsSourcePlayerContext } from "../../shared/navigation-context";
import {
  COMPETITION_RECORD_TYPE_LABELS,
  UNCATEGORIZED_COMPETITION_FILTER_VALUE,
  calculateCompetitionCourseRating,
  filterCompetitions,
  createCourseNamesById,
  filterVisibleCompetitions,
  formatCompetitionDate,
  formatCompetitionRecordType,
  resolveCompetitionCategoryIdByMetrics,
  resolveCompetitionCourseName,
  resolveCompetitionDisplayName,
  resolveCompetitionExternalUrl,
  resolveCompetitionSegmentsCount,
} from "./competition-presenters";
import type { TournamentCategory, UpdatePeriod } from "@metrix-parser/shared-types";

const visibleCompetitionRecordTypes = ["2", "4"] as const;
const hiddenCompetitionRecordTypes = ["1", "3", "5"] as const;

type CompetitionsPageState =
  | {
      status: "loading";
    }
  | {
      status: "error";
      message: string;
    }
  | {
      status: "ready";
      competitions: Competition[];
      allCompetitions?: Competition[];
      courses: Course[];
      categories: TournamentCategory[];
      courseNamesById: Readonly<Record<string, string>>;
      total: number;
    };

type CompetitionCategorySubmitState = {
  status: "idle" | "saving" | "success" | "error";
  competitionId: string | null;
  message: string | null;
};

type CompetitionsSortField =
  | "competitionName"
  | "competitionDate"
  | "courseName"
  | "categoryName"
  | "rating"
  | "segmentsCount"
  | "playersCount"
  | "seasonPoints"
  | "recordType";

interface CompetitionsSort {
  field: CompetitionsSortField;
  direction: "asc" | "desc";
}

const DEFAULT_COMPETITIONS_SORT: CompetitionsSort = {
  field: "competitionDate",
  direction: "desc",
};
const COMPETITIONS_PAGE_SIZE = 25;
const MAX_PAGINATION_BUTTONS = 7;

function buildYearDateRange(year: number): UpdatePeriod {
  return {
    dateFrom: `${year}-01-01`,
    dateTo: `${year}-12-31`,
  };
}

function resolveCurrentYear(): number {
  return new Date().getFullYear();
}

export function hasCompetitionsWithoutResults(
  competitions: readonly Competition[],
): boolean {
  return competitions.some((competition) => competition.hasResults === false);
}

export function confirmAutoAssignCategories(
  competitions: readonly Competition[],
  confirmImplementation: (message: string) => boolean = (message) =>
    window.confirm(message),
): boolean {
  if (!hasCompetitionsWithoutResults(competitions)) {
    return true;
  }

  return confirmImplementation("есть соревнования без результатов. Продолжить?");
}

function formatPlayersCount(value: number | null): string {
  return value === null ? "Не указан" : `${value}`;
}

function formatCompetitionSegmentsCount(value: number | null): string {
  return value === null ? "Нет данных" : `${value}`;
}

function formatCompetitionSeasonPoints(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }

  return value.toFixed(2);
}

function resolveCompetitionComment(competition: Competition): string | null {
  const value = (competition as Competition & { comment?: string | null }).comment;
  const normalized = value?.trim() ?? "";

  return normalized.length > 0 ? normalized : null;
}

function formatRatingValue(value: number | null): string {
  return value === null ? "Нет данных" : value.toFixed(1);
}

function resolveSortIndicator(
  sort: CompetitionsSort,
  field: CompetitionsSortField,
): string {
  if (sort.field !== field) {
    return "";
  }

  return sort.direction === "asc" ? " ↑" : " ↓";
}

function resolveAriaSort(
  sort: CompetitionsSort,
  field: CompetitionsSortField,
): "ascending" | "descending" | "none" {
  if (sort.field !== field) {
    return "none";
  }

  return sort.direction === "asc" ? "ascending" : "descending";
}

function compareNullableNumbers(
  left: number | null,
  right: number | null,
  direction: "asc" | "desc",
): number {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return direction === "asc" ? left - right : right - left;
}

function compareNullableStrings(
  left: string | null,
  right: string | null,
  direction: "asc" | "desc",
): number {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  const comparison = left.localeCompare(right, "ru");
  return direction === "asc" ? comparison : comparison * -1;
}

function resolveInitialSortDirection(
  field: CompetitionsSortField,
): "asc" | "desc" {
  if (
    field === "competitionDate" ||
    field === "rating" ||
    field === "segmentsCount" ||
    field === "playersCount" ||
    field === "seasonPoints"
  ) {
    return "desc";
  }

  return "asc";
}

function resolveEmptyAutoAssignMessage(
  competitionsWithoutCategoryCount: number,
): string {
  if (competitionsWithoutCategoryCount === 0) {
    return "Все соревнования уже имеют категорию.";
  }

  return "Не удалось определить категорию ни для одного соревнования. Проверьте, что у парков заполнено количество корзин, а диапазоны категорий покрывают эти соревнования.";
}

function renderCompetitionRatingCell(course: Course | null): React.ReactNode {
  if (course === null) {
    return "Нет данных";
  }

  const rating = calculateCompetitionCourseRating(course);
  if (rating === null) {
    return "Нет данных";
  }

  return (
    <FloatingInfoTooltip
      value={rating.toFixed(1)}
      ariaLabel={`Показать исходные значения рейтинга для ${decodeHtmlEntities(course.name)}`}
      title="Исходные значения рейтинга"
      items={[
        `Рейтинг 1: ${formatRatingValue(course.ratingValue1)}`,
        `Рейтинг 2: ${formatRatingValue(course.ratingValue2)}`,
      ]}
      anchorClassName="competitions-page__rating-anchor"
      tooltipClassName="competitions-page__rating-tooltip"
    />
  );
}

export interface CompetitionsPageViewProps {
  state: CompetitionsPageState;
  canEditCategory?: boolean;
  submitState?: CompetitionCategorySubmitState;
  currentPage?: number;
  onCategoryChange?: (competitionId: string, categoryId: string | null) => void;
  onPageChange?: (page: number) => void;
  onAutoAssignCategories?: (competitions: Competition[]) => void;
  isAutoAssigningCategories?: boolean;
  onNavigate: (pathname: string) => void;
}

function resolvePaginationPages(
  currentPage: number,
  totalPages: number,
): Array<number | "ellipsis"> {
  if (totalPages <= MAX_PAGINATION_BUTTONS) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages]);
  const windowRadius = 1;

  for (
    let page = Math.max(2, currentPage - windowRadius);
    page <= Math.min(totalPages - 1, currentPage + windowRadius);
    page += 1
  ) {
    pages.add(page);
  }

  const ordered = [...pages].sort((left, right) => left - right);
  const result: Array<number | "ellipsis"> = [];
  let previousPage = 0;

  for (const page of ordered) {
    if (previousPage > 0 && page - previousPage > 1) {
      result.push("ellipsis");
    }
    result.push(page);
    previousPage = page;
  }

  return result;
}

function resolveCompetitionCategoryName(
  competition: Competition,
  categoryNamesById: Readonly<Record<string, string>>,
): string {
  if (!competition.categoryId) {
    return "Не задана";
  }

  return categoryNamesById[competition.categoryId] ?? "Не задана";
}

const defaultCompetitionFilters = {
  nameQuery: "",
  ...buildYearDateRange(resolveCurrentYear()),
  courseName: "",
  categoryId: "",
  withoutResultsOnly: false,
};

const competitionsNameFilterStorageKey = "competitions-page:name-query";
const competitionsPeriodFilterStorageKey = "competitions-page:period-filter";
const competitionsCourseFilterStorageKey = "competitions-page:course-filter";
const competitionsCategoryFilterStorageKey = "competitions-page:category-filter";
const competitionsWithoutResultsFilterStorageKey =
  "competitions-page:without-results-filter";
const competitionsSortStorageKey = "competitions-page:sort";

interface CompetitionSortValues {
  competitionName: string;
  competitionDate: string;
  courseName: string;
  categoryName: string;
  rating: number | null;
  segmentsCount: number | null;
  playersCount: number | null;
  seasonPoints: number | null;
  recordType: string;
}

export function CompetitionsPageView({
  state,
  canEditCategory = false,
  currentPage = 1,
  onAutoAssignCategories,
  onPageChange,
  isAutoAssigningCategories = false,
  submitState = {
    status: "idle",
    competitionId: null,
    message: null,
  },
  onCategoryChange,
  onNavigate,
}: CompetitionsPageViewProps) {
  const [nameQuery, setNameQuery] = useSessionStorageState(
    competitionsNameFilterStorageKey,
    defaultCompetitionFilters.nameQuery,
  );
  const [periodFilter, setPeriodFilter] = useSessionStorageState<UpdatePeriod>(
    competitionsPeriodFilterStorageKey,
    {
      dateFrom: defaultCompetitionFilters.dateFrom,
      dateTo: defaultCompetitionFilters.dateTo,
    },
  );
  const [courseFilter, setCourseFilter] = useSessionStorageState(
    competitionsCourseFilterStorageKey,
    defaultCompetitionFilters.courseName,
  );
  const [categoryFilter, setCategoryFilter] = useSessionStorageState(
    competitionsCategoryFilterStorageKey,
    defaultCompetitionFilters.categoryId,
  );
  const [withoutResultsOnly, setWithoutResultsOnly] = useSessionStorageState(
    competitionsWithoutResultsFilterStorageKey,
    defaultCompetitionFilters.withoutResultsOnly,
  );
  const [sort, setSort] = useSessionStorageState<CompetitionsSort>(
    competitionsSortStorageKey,
    DEFAULT_COMPETITIONS_SORT,
  );
  const competitions = state.status === "ready" ? state.competitions : [];
  const allCompetitions =
    state.status === "ready" ? state.allCompetitions ?? state.competitions : [];
  const courses = state.status === "ready" ? state.courses : [];
  const categories = state.status === "ready" ? state.categories : [];
  const courseNamesById = state.status === "ready" ? state.courseNamesById : {};
  const total = state.status === "ready" ? state.total : 0;
  const courseById = useMemo(
    () => new Map(courses.map((course) => [course.courseId, course])),
    [courses],
  );
  const competitionsByParentId = useMemo(() => {
    const grouped = new Map<string, Competition[]>();

    for (const competition of allCompetitions) {
      if (!competition.parentId) {
        continue;
      }

      const current = grouped.get(competition.parentId) ?? [];
      current.push(competition);
      grouped.set(competition.parentId, current);
    }

    return grouped;
  }, [allCompetitions]);
  const sortedCategories = useMemo(
    () => [...categories].sort((left, right) => left.name.localeCompare(right.name, "ru")),
    [categories],
  );
  const categoryNamesById = useMemo<Readonly<Record<string, string>>>(
    () =>
      Object.fromEntries(
        categories.map((category) => [category.categoryId, category.name]),
      ),
    [categories],
  );
  const currentYear = resolveCurrentYear();
  const periodPresets = useMemo<PeriodPreset[]>(
    () => [
      {
        id: "current-year",
        label: "Текущий год",
        resolve: () => buildYearDateRange(currentYear),
      },
      {
        id: "previous-year",
        label: "Прошлый год",
        resolve: () => buildYearDateRange(currentYear - 1),
      },
    ],
    [currentYear],
  );
  const visibleCompetitions = useMemo(
    () => {
      const sortValuesByCompetitionId = new Map<string, CompetitionSortValues>(
        competitions.map((competition) => {
          const competitionCourse =
            competition.courseId
              ? courseById.get(competition.courseId) ?? null
              : null;
          const segmentsCount = resolveCompetitionSegmentsCount(
            competition,
            competitionsByParentId,
            courseById,
          );
          const categoryName = resolveCompetitionCategoryName(
            competition,
            categoryNamesById,
          );

          return [
            competition.competitionId,
            {
              competitionName: decodeHtmlEntities(competition.competitionName),
              competitionDate: competition.competitionDate,
              courseName: resolveCompetitionCourseName(competition, courseNamesById),
              categoryName,
              rating:
                competitionCourse === null
                  ? null
                  : calculateCompetitionCourseRating(competitionCourse),
              segmentsCount,
              playersCount: competition.playersCount,
              seasonPoints: competition.seasonPoints ?? null,
              recordType: formatCompetitionRecordType(competition.recordType),
            },
          ];
        }),
      );

      return [...filterCompetitions(competitions, courseNamesById, {
        nameQuery,
        dateFrom: periodFilter.dateFrom,
        dateTo: periodFilter.dateTo,
        courseName: courseFilter,
        categoryId: categoryFilter,
        withoutResultsOnly,
      })].sort((left, right) => {
        const leftValues = sortValuesByCompetitionId.get(left.competitionId);
        const rightValues = sortValuesByCompetitionId.get(right.competitionId);

        if (!leftValues || !rightValues) {
          return 0;
        }

        let primaryComparison = 0;

        if (
          sort.field === "competitionDate" ||
          sort.field === "competitionName" ||
          sort.field === "courseName" ||
          sort.field === "categoryName" ||
          sort.field === "recordType"
        ) {
          primaryComparison = compareNullableStrings(
            leftValues[sort.field],
            rightValues[sort.field],
            sort.direction,
          );
        } else {
          primaryComparison = compareNullableNumbers(
            leftValues[sort.field],
            rightValues[sort.field],
            sort.direction,
          );
        }

        if (primaryComparison !== 0) {
          return primaryComparison;
        }

        const dateComparison = compareNullableStrings(
          leftValues.competitionDate,
          rightValues.competitionDate,
          "desc",
        );
        if (dateComparison !== 0) {
          return dateComparison;
        }

        return compareNullableStrings(
          leftValues.competitionName,
          rightValues.competitionName,
          "asc",
        );
      });
    },
    [
      competitions,
      courseNamesById,
      courseById,
      competitionsByParentId,
      categoryNamesById,
      nameQuery,
      periodFilter,
      courseFilter,
      categoryFilter,
      withoutResultsOnly,
      sort,
    ],
  );
  const courseOptions = useMemo(
    () =>
      [
        ...new Set(
          competitions.map((competition) =>
            resolveCompetitionCourseName(competition, courseNamesById),
          ),
        ),
      ].sort((left, right) => left.localeCompare(right)),
    [competitions, courseNamesById],
  );
  const totalPages = Math.max(1, Math.ceil(total / COMPETITIONS_PAGE_SIZE));
  const normalizedCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const paginationPages = resolvePaginationPages(normalizedCurrentPage, totalPages);
  const toggleSort = (field: CompetitionsSortField) => {
    setSort((currentSort) => {
      if (currentSort.field === field) {
        return {
          field,
          direction: currentSort.direction === "asc" ? "desc" : "asc",
        };
      }

      return {
        field,
        direction: resolveInitialSortDirection(field),
      };
    });
  };

  if (state.status === "loading") {
    return (
      <section className="data-page-shell" aria-labelledby="competitions-page-title">
        <PageHeader
          titleId="competitions-page-title"
          title="Список соревнований"
          description="Загружаем сохранённые соревнования через backend API."
        />

        <section className="state-panel state-panel--pending" aria-live="polite">
          <p className="state-panel__eyebrow">loading</p>
          <h2>Подтягиваем соревнования</h2>
          <p>Подождите немного, данные загружаются с серверного read-side.</p>
        </section>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="data-page-shell" aria-labelledby="competitions-page-title">
        <PageHeader
          titleId="competitions-page-title"
          title="Список соревнований"
          description="Страница использует backend API и показывает только сохранённые записи."
        />

        <section className="state-panel state-panel--error" role="alert">
          <p className="state-panel__eyebrow">error</p>
          <h2>Не удалось загрузить соревнования</h2>
          <p>{state.message}</p>
        </section>
      </section>
    );
  }

  return (
    <section className="data-page-shell" aria-labelledby="competitions-page-title">
      <PageHeader
        titleId="competitions-page-title"
        title="Список соревнований"
        titleAction={
          <span className="update-card__tooltip-anchor update-card__tooltip-anchor--info">
            <button
              type="button"
              className="update-launcher__info-button"
              aria-label="Правила отображения record_type на странице соревнований"
            >
              ?
            </button>
            <span
              role="tooltip"
              className="update-card__tooltip update-card__tooltip--info"
            >
              <strong>Правила record_type</strong>
              <ul className="update-card__tooltip-list">
                <li>
                  Показываем:
                  {" "}
                  {visibleCompetitionRecordTypes
                    .map((value) => `${value} (${COMPETITION_RECORD_TYPE_LABELS[value]})`)
                    .join(", ")}
                  , а также 3 (Pool), если Event разбит на несколько pool с раундами.
                </li>
                <li>
                  Скрываем:
                  {" "}
                  {hiddenCompetitionRecordTypes
                    .map((value) => `${value} (${COMPETITION_RECORD_TYPE_LABELS[value]})`)
                    .join(", ")}
                  , а также записи без `record_type`.
                </li>
              </ul>
            </span>
          </span>
        }
        description={
          total > 0
            ? `В системе доступно ${total} соревнований для дальнейшей работы.`
            : "Сохранённые соревнования появятся здесь после успешного обновления данных."
        }
      />

      {competitions.length === 0 ? (
        <section className="state-panel" aria-live="polite">
          <p className="state-panel__eyebrow">empty</p>
          <h2>Пока нет сохранённых соревнований</h2>
          <p>Сначала запустите обновление соревнований в административном разделе.</p>
        </section>
      ) : (
        <>
          {canEditCategory ? (
            <section className="competitions-page__bulk-actions" aria-label="Массовые действия">
              <span className="update-card__tooltip-anchor update-card__tooltip-anchor--button competitions-page__bulk-action-group">
                <button
                  className="update-card__submit"
                  type="button"
                  disabled={isAutoAssigningCategories}
                  onClick={() => {
                    onAutoAssignCategories?.(visibleCompetitions);
                  }}
                >
                  {isAutoAssigningCategories
                    ? "Подбираем и сохраняем категории..."
                    : "Расставить категории соревнований"}
                </button>
                <span className="update-card__tooltip-anchor update-card__tooltip-anchor--info">
                  <button
                    type="button"
                    className="update-launcher__info-button"
                    aria-label="Что делает массовая расстановка категорий"
                  >
                    ?
                  </button>
                  <span
                    role="tooltip"
                    className="update-card__tooltip update-card__tooltip--info"
                  >
                    Расставит категории турнирам, которые попадают в текущие фильтры этой страницы
                  </span>
                </span>
              </span>
              {submitState.message ? (
                <p
                  className={
                    submitState.status === "error"
                      ? "tournament-categories-page__status tournament-categories-page__status--error"
                      : "tournament-categories-page__status"
                  }
                  role={submitState.status === "error" ? "alert" : "status"}
                >
                  {submitState.message}
                </p>
              ) : null}
            </section>
          ) : null}

          <section className="competitions-page__filters" aria-label="Фильтры соревнований">
            <label className="competitions-page__filter">
              <span>Название</span>
              <input
                className="competitions-page__filter-control"
                type="search"
                value={nameQuery}
                placeholder="Поиск по названию"
                onChange={(event) => {
                  setNameQuery(event.target.value);
                  onPageChange?.(1);
                }}
              />
            </label>
            <div className="competitions-page__filter">
              <span>Период</span>
              <UpdatePeriodPicker
                value={periodFilter}
                onChange={(period) => {
                  setPeriodFilter(period);
                  onPageChange?.(1);
                }}
                presets={periodPresets}
                inputNames={{
                  dateFrom: "competitions-date-from",
                  dateTo: "competitions-date-to",
                }}
                hideTriggerLabel
              />
            </div>
            <label className="competitions-page__filter">
              <span>Парк</span>
              <select
                className="competitions-page__filter-control"
                value={courseFilter}
                onChange={(event) => {
                  setCourseFilter(event.target.value);
                  onPageChange?.(1);
                }}
              >
                <option value="">Все парки</option>
                {courseOptions.map((courseName) => (
                  <option key={courseName} value={courseName}>
                    {courseName}
                  </option>
                ))}
              </select>
            </label>
            <label className="competitions-page__filter">
              <span>Категория</span>
              <select
                className="competitions-page__filter-control"
                value={categoryFilter}
                onChange={(event) => {
                  setCategoryFilter(event.target.value);
                  onPageChange?.(1);
                }}
              >
                <option value="">Все категории</option>
                <option value={UNCATEGORIZED_COMPETITION_FILTER_VALUE}>
                  Не указано
                </option>
                {sortedCategories.map((category) => (
                  <option key={category.categoryId} value={category.categoryId}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="competitions-page__filter competitions-page__filter--checkbox">
              <span>Статус результатов</span>
              <span className="competitions-page__checkbox-control">
                <input
                  type="checkbox"
                  checked={withoutResultsOnly}
                  onChange={(event) => {
                    setWithoutResultsOnly(event.target.checked);
                    onPageChange?.(1);
                  }}
                />
                <span>Нет результатов</span>
              </span>
            </label>
          </section>

          {visibleCompetitions.length === 0 ? (
            <section className="state-panel" aria-live="polite">
              <p className="state-panel__eyebrow">filtered</p>
              <h2>По текущим фильтрам соревнований нет</h2>
              <p>Попробуйте изменить название, период, парк, категорию или фильтр по результатам.</p>
            </section>
          ) : (
            <section
              className="data-table-panel competitions-page__table-panel"
              aria-label="Сохранённые соревнования"
            >
              <div className="data-table-wrap competitions-page__table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col" aria-sort={resolveAriaSort(sort, "competitionName")}>
                        <button
                          className="data-table__sort-button"
                          type="button"
                          onClick={() => {
                            toggleSort("competitionName");
                          }}
                        >
                          Название{resolveSortIndicator(sort, "competitionName")}
                        </button>
                      </th>
                      <th scope="col" aria-sort={resolveAriaSort(sort, "competitionDate")}>
                        <button
                          className="data-table__sort-button"
                          type="button"
                          onClick={() => {
                            toggleSort("competitionDate");
                          }}
                        >
                          Дата{resolveSortIndicator(sort, "competitionDate")}
                        </button>
                      </th>
                      <th scope="col" aria-sort={resolveAriaSort(sort, "courseName")}>
                        <button
                          className="data-table__sort-button"
                          type="button"
                          onClick={() => {
                            toggleSort("courseName");
                          }}
                        >
                          Парк / курс{resolveSortIndicator(sort, "courseName")}
                        </button>
                      </th>
                      <th scope="col" aria-sort={resolveAriaSort(sort, "categoryName")}>
                        <button
                          className="data-table__sort-button"
                          type="button"
                          onClick={() => {
                            toggleSort("categoryName");
                          }}
                        >
                          Категория{resolveSortIndicator(sort, "categoryName")}
                        </button>
                      </th>
                      <th scope="col" aria-sort={resolveAriaSort(sort, "rating")}>
                        <button
                          className="data-table__sort-button"
                          type="button"
                          onClick={() => {
                            toggleSort("rating");
                          }}
                        >
                          Рейтинг парка{resolveSortIndicator(sort, "rating")}
                        </button>
                      </th>
                      <th scope="col" aria-sort={resolveAriaSort(sort, "segmentsCount")}>
                        <button
                          className="data-table__sort-button"
                          type="button"
                          onClick={() => {
                            toggleSort("segmentsCount");
                          }}
                        >
                          Отрезков{resolveSortIndicator(sort, "segmentsCount")}
                        </button>
                      </th>
                      <th scope="col" aria-sort={resolveAriaSort(sort, "playersCount")}>
                        <button
                          className="data-table__sort-button"
                          type="button"
                          onClick={() => {
                            toggleSort("playersCount");
                          }}
                        >
                          Игроков{resolveSortIndicator(sort, "playersCount")}
                        </button>
                      </th>
                      <th scope="col" aria-sort={resolveAriaSort(sort, "seasonPoints")}>
                        <button
                          className="data-table__sort-button"
                          type="button"
                          onClick={() => {
                            toggleSort("seasonPoints");
                          }}
                        >
                          Очки сезона{resolveSortIndicator(sort, "seasonPoints")}
                        </button>
                      </th>
                      <th scope="col" aria-sort={resolveAriaSort(sort, "recordType")}>
                        <button
                          className="data-table__sort-button"
                          type="button"
                          onClick={() => {
                            toggleSort("recordType");
                          }}
                        >
                          Тип записи{resolveSortIndicator(sort, "recordType")}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCompetitions.map((competition) => {
                      const competitionName = resolveCompetitionDisplayName(
                        competition,
                        allCompetitions,
                      );
                      const competitionComment = resolveCompetitionComment(competition);
                      const externalUrl = resolveCompetitionExternalUrl(competition.competitionId);
                      const isSavingCategory =
                        submitState.status === "saving" &&
                        submitState.competitionId === competition.competitionId;
                      const competitionCourse =
                        competition.courseId
                          ? courseById.get(competition.courseId) ?? null
                          : null;
                      const segmentsCount = resolveCompetitionSegmentsCount(
                        competition,
                        competitionsByParentId,
                        courseById,
                      );

                      return (
                        <tr key={competition.competitionId}>
                          <td className="data-table__cell-primary">
                            <span className="data-table__primary-actions">
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
                              <button
                                className="data-table__link-button"
                                type="button"
                                onClick={() => {
                                  clearCompetitionResultsSourcePlayerContext();
                                  onNavigate(buildCompetitionResultsPath(competition.competitionId));
                                }}
                                aria-label={`Открыть результаты соревнования ${competitionName}`}
                              >
                                {competitionName}
                              </button>
                            </span>
                            {competitionComment ? (
                              <div className="competitions-page__comment">
                                {competitionComment}
                              </div>
                            ) : null}
                          </td>
                          <td>{formatCompetitionDate(competition.competitionDate)}</td>
                          <td>{resolveCompetitionCourseName(competition, courseNamesById)}</td>
                          <td>
                            {canEditCategory ? (
                              <select
                                className="competitions-page__filter-control"
                                value={competition.categoryId ?? ""}
                                disabled={isSavingCategory}
                                aria-label={`Категория соревнования ${competitionName}`}
                                onChange={(event) => {
                                  onCategoryChange?.(
                                    competition.competitionId,
                                    event.target.value || null,
                                  );
                                }}
                              >
                                <option value="">Не задана</option>
                                {sortedCategories.map((category) => (
                                  <option
                                    key={category.categoryId}
                                    value={category.categoryId}
                                  >
                                    {category.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              resolveCompetitionCategoryName(
                                competition,
                                categoryNamesById,
                              )
                            )}
                          </td>
                          <td>{renderCompetitionRatingCell(competitionCourse)}</td>
                          <td>{formatCompetitionSegmentsCount(segmentsCount)}</td>
                          <td>{formatPlayersCount(competition.playersCount)}</td>
                          <td>{formatCompetitionSeasonPoints(competition.seasonPoints)}</td>
                          <td>{formatCompetitionRecordType(competition.recordType)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="competitions-page__pagination-summary" aria-live="polite">
                Показано {visibleCompetitions.length} из {total} соревнований.
                Страница {normalizedCurrentPage} из {totalPages}.
              </div>
              {totalPages > 1 ? (
                <nav className="competitions-page__pagination" aria-label="Пагинация соревнований">
                  <button
                    className="competitions-page__pagination-button"
                    type="button"
                    disabled={normalizedCurrentPage === 1}
                    onClick={() => {
                      onPageChange?.(normalizedCurrentPage - 1);
                    }}
                  >
                    Назад
                  </button>
                  <div className="competitions-page__pagination-pages">
                    {paginationPages.map((item, index) =>
                      item === "ellipsis" ? (
                        <span
                          key={`ellipsis-${index}`}
                          className="competitions-page__pagination-ellipsis"
                          aria-hidden="true"
                        >
                          ...
                        </span>
                      ) : (
                        <button
                          key={item}
                          className={`competitions-page__pagination-button${item === normalizedCurrentPage ? " competitions-page__pagination-button--active" : ""}`}
                          type="button"
                          aria-current={item === normalizedCurrentPage ? "page" : undefined}
                          onClick={() => {
                            onPageChange?.(item);
                          }}
                        >
                          {item}
                        </button>
                      ),
                    )}
                  </div>
                  <button
                    className="competitions-page__pagination-button"
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
        </>
      )}
    </section>
  );
}

export interface CompetitionsPageProps {
  onNavigate: (pathname: string) => void;
}

export function CompetitionsPage({ onNavigate }: CompetitionsPageProps) {
  const auth = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [state, setState] = useState<CompetitionsPageState>({
    status: "loading",
  });
  const [submitState, setSubmitState] = useState<CompetitionCategorySubmitState>({
    status: "idle",
    competitionId: null,
    message: null,
  });
  const [isAutoAssigningCategories, setIsAutoAssigningCategories] = useState(false);

  useEffect(() => {
    let isActive = true;

    void (async () => {
      try {
        const [competitionsResult, coursesResult, categoriesResult] = await Promise.allSettled([
          listCompetitionsPage({
            limit: COMPETITIONS_PAGE_SIZE,
            offset: (currentPage - 1) * COMPETITIONS_PAGE_SIZE,
          }),
          listCourses(),
          listTournamentCategories(),
        ]);

        if (!isActive) {
          return;
        }

        if (competitionsResult.status === "rejected") {
          setState({
            status: "error",
            message: resolveCompetitionsErrorMessage(competitionsResult.reason),
          });

          return;
        }

        const competitionsEnvelope = competitionsResult.value;
        const courseNamesById =
          coursesResult.status === "fulfilled"
            ? createCourseNamesById(coursesResult.value.data)
            : {};
        const categories =
          categoriesResult.status === "fulfilled"
            ? categoriesResult.value.data
            : [];

        const visibleCompetitions = filterVisibleCompetitions(competitionsEnvelope.data);

        setState({
          status: "ready",
          competitions: visibleCompetitions,
          allCompetitions: competitionsEnvelope.data,
          courses: coursesResult.status === "fulfilled" ? coursesResult.value.data : [],
          categories,
          courseNamesById,
          total: resolveCompetitionsTotal(competitionsEnvelope.data, competitionsEnvelope.meta),
        });
      } catch (error) {
        if (!isActive) {
          return;
        }

        setState({
          status: "error",
          message: resolveCompetitionsErrorMessage(error),
        });
      }
    })();

    return () => {
      isActive = false;
    };
  }, [currentPage]);

  return (
    <CompetitionsPageView
      state={state}
      canEditCategory={auth.status === "authenticated"}
      isAutoAssigningCategories={isAutoAssigningCategories}
      submitState={submitState}
      currentPage={currentPage}
      onPageChange={(page) => {
        setCurrentPage(page);
      }}
      onAutoAssignCategories={(filteredCompetitions) => {
        try {
          if (state.status !== "ready" || isAutoAssigningCategories) {
            console.debug("Auto-assign skipped before start", {
              stateStatus: state.status,
              isAutoAssigningCategories,
            });
            return;
          }

          if (!confirmAutoAssignCategories(filteredCompetitions)) {
            console.debug("Auto-assign cancelled by confirmation dialog", {
              competitionsWithoutResults: filteredCompetitions.filter(
                (competition) => competition.hasResults === false,
              ).map((competition) => ({
                competitionId: competition.competitionId,
                competitionName: competition.competitionName,
              })),
            });
            return;
          }

          const competitionsByParentId = new Map<string, Competition[]>();
          const courseById = new Map(
            state.courses.map((course) => [course.courseId, course]),
          );

          for (const competition of state.allCompetitions ?? state.competitions) {
            if (!competition.parentId) {
              continue;
            }

            const current = competitionsByParentId.get(competition.parentId) ?? [];
            current.push(competition);
            competitionsByParentId.set(competition.parentId, current);
          }

          const assignmentPlan = filteredCompetitions
            .filter((competition) => !competition.categoryId)
            .map((competition) => {
              const competitionCourse =
                competition.courseId
                  ? courseById.get(competition.courseId) ?? null
                  : null;
              const segmentsCount = resolveCompetitionSegmentsCount(
                competition,
                competitionsByParentId,
                courseById,
              );
              const courseRating =
                competitionCourse === null
                  ? null
                  : calculateCompetitionCourseRating(competitionCourse);
              const categoryId = resolveCompetitionCategoryIdByMetrics(
                state.categories,
                segmentsCount,
                courseRating,
              );

              console.debug("Auto-assign category candidate", {
                competitionId: competition.competitionId,
                competitionName: competition.competitionName,
                currentCategoryId: competition.categoryId ?? null,
                courseId: competition.courseId ?? null,
                segmentsCount,
                courseRating,
                categoryId,
              });

              return {
                competition,
                categoryId,
              };
            })
            .filter((entry) => entry.categoryId !== null) as Array<{
              competition: Competition;
              categoryId: string;
            }>;

          if (assignmentPlan.length === 0) {
            const competitionsWithoutCategoryCount = filteredCompetitions.filter(
              (competition) => !competition.categoryId,
            ).length;

            console.debug("Auto-assign produced empty assignment plan", {
              competitionsWithoutCategoryCount,
              categories: state.categories.map((category) => ({
                categoryId: category.categoryId,
                name: category.name,
                segmentsCount: category.segmentsCount,
                ratingGte: category.ratingGte,
                ratingLt: category.ratingLt,
              })),
            });

            setSubmitState({
              status: "success",
              competitionId: null,
              message: resolveEmptyAutoAssignMessage(
                competitionsWithoutCategoryCount,
              ),
            });
            return;
          }

          setIsAutoAssigningCategories(true);
          setSubmitState({
            status: "saving",
            competitionId: null,
            message: "Расставляем категории соревнований...",
          });

          void (async () => {
            const updatedByCompetitionId = new Map<string, Competition>();
            let failedUpdatesCount = 0;

            for (const entry of assignmentPlan) {
              try {
                const updatedCompetition = await updateCompetitionCategory({
                  competitionId: entry.competition.competitionId,
                  categoryId: entry.categoryId,
                });

                updatedByCompetitionId.set(
                  updatedCompetition.competitionId,
                  updatedCompetition,
                );
              } catch {
                failedUpdatesCount += 1;
              }
            }

            setState((currentState) => {
              if (currentState.status !== "ready" || updatedByCompetitionId.size === 0) {
                return currentState;
              }

              return {
                ...currentState,
                competitions: currentState.competitions.map((competition) =>
                  updatedByCompetitionId.get(competition.competitionId) ?? competition,
                ),
                allCompetitions: (
                  currentState.allCompetitions ?? currentState.competitions
                ).map(
                  (competition) =>
                    updatedByCompetitionId.get(competition.competitionId) ?? competition,
                ),
              };
            });

            const skippedByRulesCount = Math.max(
              filteredCompetitions.filter((competition) => !competition.categoryId).length -
                assignmentPlan.length,
              0,
            );

            if (updatedByCompetitionId.size === 0) {
              setSubmitState({
                status: "error",
                competitionId: null,
                message: "Не удалось сохранить категории соревнований.",
              });
              setIsAutoAssigningCategories(false);
              return;
            }

            const messageParts = [
              `Обновлено: ${updatedByCompetitionId.size}.`,
              `Пропущено (не удалось определить): ${skippedByRulesCount}.`,
            ];
            if (failedUpdatesCount > 0) {
              messageParts.push(`Ошибок сохранения: ${failedUpdatesCount}.`);
            }

            setSubmitState({
              status: failedUpdatesCount > 0 ? "error" : "success",
              competitionId: null,
              message: messageParts.join(" "),
            });
            setIsAutoAssigningCategories(false);
          })();
        } catch (error) {
          console.error("Auto-assign categories failed before request", error);
          setIsAutoAssigningCategories(false);
          setSubmitState({
            status: "error",
            competitionId: null,
            message:
              "Не удалось запустить автоматическую расстановку категорий. Проверьте данные соревнований и парков.",
          });
        }
      }}
      onCategoryChange={(competitionId, categoryId) => {
        if (state.status !== "ready") {
          return;
        }

        const competition = state.competitions.find(
          (entry) => entry.competitionId === competitionId,
        );

        if (!competition || competition.categoryId === categoryId) {
          return;
        }

        setSubmitState({
          status: "saving",
          competitionId,
          message: "Сохраняем категорию соревнования...",
        });

        void updateCompetitionCategory({
          competitionId,
          categoryId,
        })
          .then((updatedCompetition) => {
            setState((currentState) => {
              if (currentState.status !== "ready") {
                return currentState;
              }

              return {
                ...currentState,
                competitions: currentState.competitions.map((entry) =>
                  entry.competitionId === updatedCompetition.competitionId
                    ? updatedCompetition
                    : entry,
                ),
                allCompetitions: (
                  currentState.allCompetitions ?? currentState.competitions
                ).map((entry) =>
                  entry.competitionId === updatedCompetition.competitionId
                    ? updatedCompetition
                    : entry,
                ),
              };
            });

            setSubmitState({
              status: "success",
              competitionId,
              message: "Категория соревнования сохранена.",
            });
          })
          .catch((error: unknown) => {
            setSubmitState({
              status: "error",
              competitionId,
              message: resolveCompetitionsErrorMessage(error),
            });
          });
      }}
      onNavigate={onNavigate}
    />
  );
}
