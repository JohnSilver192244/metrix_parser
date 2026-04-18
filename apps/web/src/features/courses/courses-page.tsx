import React, { useEffect, useMemo, useState } from "react";

import type { Course } from "@metrix-parser/shared-types";

import { PageHeader } from "../../shared/page-header";
import { FloatingInfoTooltip } from "../../shared/floating-info-tooltip";
import { SideDrawer } from "../../shared/side-drawer";
import {
  listCourses,
  resolveCoursesErrorMessage,
  resolveCoursesTotal,
} from "../../shared/api/courses";
import { useSessionStorageState } from "../../shared/session-storage";
import { decodeHtmlEntities } from "../../shared/text";

type CoursesPageState =
  | {
      status: "loading";
    }
  | {
      status: "error";
      message: string;
    }
  | {
      status: "ready";
      courses: Course[];
      total: number;
    };

function formatCoursePar(value: number): string {
  return `Par ${value}`;
}

function formatBasketsCount(value: number | null): string {
  return value == null ? "Нет данных" : `${value}`;
}

function formatRatingValue(value: number | null): string {
  return value === null ? "Нет данных" : value.toFixed(1);
}

function calculateRating(course: Course): number | null {
  const {
    ratingValue1,
    ratingValue2,
    ratingResult1,
    ratingResult2,
  } = course;

  if (
    ratingValue1 === null ||
    ratingValue2 === null ||
    ratingResult1 === null ||
    ratingResult2 === null ||
    ratingResult1 === ratingResult2
  ) {
    return null;
  }

  return (
    ((ratingValue2 - ratingValue1) * (course.coursePar - ratingResult1)) /
      (ratingResult2 - ratingResult1) +
    ratingValue1
  );
}

function renderRatingCell(course: Course, rating: number | null): React.ReactNode {
  if (rating === null) {
    return "Нет данных";
  }

  return (
    <FloatingInfoTooltip
      value={rating.toFixed(1)}
      ariaLabel={`Показать исходные значения рейтинга для ${resolveCourseName(course)}`}
      title="Исходные значения рейтинга"
      items={[
        `Рейтинг 1: ${formatRatingValue(course.ratingValue1)}`,
        `Рейтинг 2: ${formatRatingValue(course.ratingValue2)}`,
      ]}
      anchorClassName="courses-page__rating-anchor"
      tooltipClassName="courses-page__rating-tooltip"
    />
  );
}

export interface CoursesPageViewProps {
  state: CoursesPageState;
  mobileFiltersOpen?: boolean;
}

const coursesNameFilterStorageKey = "courses-page:name-filter";
const coursesRegionFilterStorageKey = "courses-page:region-filter";

function resolveCourseName(course: Course): string {
  return decodeHtmlEntities(course.name);
}

function resolveCourseArea(course: Course): string {
  return decodeHtmlEntities(course.area) || "Не указан";
}

function collectCourseFilterOptions(
  courses: readonly Course[],
  resolver: (course: Course) => string,
): string[] {
  return [...new Set(courses.map(resolver))].sort((left, right) =>
    left.localeCompare(right),
  );
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

interface CoursesFiltersSectionProps {
  nameFilter: string;
  regionFilter: string;
  nameOptions: string[];
  regionOptions: string[];
  onNameFilterChange?: (value: string) => void;
  onRegionFilterChange?: (value: string) => void;
}

function CoursesFiltersSection({
  nameFilter,
  regionFilter,
  nameOptions,
  regionOptions,
  onNameFilterChange,
  onRegionFilterChange,
}: CoursesFiltersSectionProps) {
  return (
    <section className="courses-page__filters" aria-label="Фильтры парков">
      <label className="courses-page__filter">
        <span>Название парка</span>
        <select
          className="courses-page__filter-control"
          value={nameFilter}
          onChange={(event) => {
            onNameFilterChange?.(event.target.value);
          }}
        >
          <option value="">Все парки</option>
          {nameOptions.map((courseName) => (
            <option key={courseName} value={courseName}>
              {courseName}
            </option>
          ))}
        </select>
      </label>
      <label className="courses-page__filter">
        <span>Регион</span>
        <select
          className="courses-page__filter-control"
          value={regionFilter}
          onChange={(event) => {
            onRegionFilterChange?.(event.target.value);
          }}
        >
          <option value="">Все регионы</option>
          {regionOptions.map((regionName) => (
            <option key={regionName} value={regionName}>
              {regionName}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}

export function CoursesPageView({
  state,
  mobileFiltersOpen = false,
}: CoursesPageViewProps) {
  const [nameFilter, setNameFilter] = useSessionStorageState(
    coursesNameFilterStorageKey,
    "",
  );
  const [regionFilter, setRegionFilter] = useSessionStorageState(
    coursesRegionFilterStorageKey,
    "",
  );
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(mobileFiltersOpen);
  const courses = state.status === "ready" ? state.courses : [];
  const total = state.status === "ready" ? state.total : 0;
  const nameOptions = useMemo(
    () => collectCourseFilterOptions(courses, resolveCourseName),
    [courses],
  );
  const regionOptions = useMemo(
    () => collectCourseFilterOptions(courses, resolveCourseArea),
    [courses],
  );
  const visibleCourses = useMemo(
    () =>
      courses.filter((course) => {
        if (nameFilter && resolveCourseName(course) !== nameFilter) {
          return false;
        }

        if (regionFilter && resolveCourseArea(course) !== regionFilter) {
          return false;
        }

        return true;
      }),
    [courses, nameFilter, regionFilter],
  );
  const filtersAction = (
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
  );

  if (state.status === "loading") {
    return (
      <section className="data-page-shell" aria-labelledby="courses-page-title">
        <PageHeader
          titleId="courses-page-title"
          title="Список парков"
          description="Загружаем сохранённые парки через backend API."
        />

        <section className="state-panel state-panel--pending" aria-live="polite">
          <p className="state-panel__eyebrow">loading</p>
          <h2>Подтягиваем парки</h2>
          <p>Подождите немного, данные загружаются с серверного read-side.</p>
        </section>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="data-page-shell" aria-labelledby="courses-page-title">
        <PageHeader
          titleId="courses-page-title"
          title="Список парков"
          description="Страница использует backend API и показывает сохранённые park records."
        />

        <section className="state-panel state-panel--error" role="alert">
          <p className="state-panel__eyebrow">error</p>
          <h2>Не удалось загрузить парки</h2>
          <p>{state.message}</p>
        </section>
      </section>
    );
  }

  return (
    <section className="data-page-shell" aria-labelledby="courses-page-title">
      <PageHeader
        titleId="courses-page-title"
        title="Список парков"
        titleAction={filtersAction}
        description={
          total > 0
            ? `В системе доступно ${total} парков с уже рассчитанным coursePar.`
            : "Сохранённые парки появятся здесь после синхронизации парков и расчёта coursePar."
        }
      />

      {courses.length === 0 ? (
        <section className="state-panel" aria-live="polite">
          <p className="state-panel__eyebrow">empty</p>
          <h2>Пока нет сохранённых парков</h2>
          <p>Сначала запустите обновление парков в административном разделе.</p>
        </section>
      ) : (
        <>
          {visibleCourses.length === 0 ? (
            <section className="state-panel" aria-live="polite">
              <p className="state-panel__eyebrow">filtered</p>
              <h2>По текущим фильтрам парков ничего нет</h2>
              <p>Попробуйте выбрать другой парк или регион.</p>
            </section>
          ) : (
            <section className="data-table-panel courses-page__table-panel" aria-label="Сохранённые парки">
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">ID</th>
                      <th scope="col">Название</th>
                      <th scope="col">Полное имя</th>
                      <th scope="col">Регион</th>
                      <th scope="col">Тип</th>
                      <th scope="col">Страна</th>
                      <th scope="col">Par</th>
                      <th scope="col">Корзин</th>
                      <th scope="col">Рейтинг</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCourses.map((course) => {
                      const rating = calculateRating(course);

                      return (
                        <tr key={course.courseId}>
                          <td className="data-table__cell-primary">{course.courseId}</td>
                          <td className="data-table__cell-primary">{resolveCourseName(course)}</td>
                          <td>{decodeHtmlEntities(course.fullname) || "Не указано"}</td>
                          <td>{resolveCourseArea(course)}</td>
                          <td>{decodeHtmlEntities(course.type) || "Не указан"}</td>
                          <td>{course.countryCode ?? "Не указана"}</td>
                          <td>{formatCoursePar(course.coursePar)}</td>
                          <td>{formatBasketsCount(course.basketsCount)}</td>
                          <td>{renderRatingCell(course, rating)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <SideDrawer
            open={isMobileFiltersOpen}
            title="Фильтры парков"
            className="side-drawer--filters"
            onClose={() => {
              setIsMobileFiltersOpen(false);
            }}
          >
            <CoursesFiltersSection
              nameFilter={nameFilter}
              regionFilter={regionFilter}
              nameOptions={nameOptions}
              regionOptions={regionOptions}
              onNameFilterChange={(value) => {
                setNameFilter(value);
              }}
              onRegionFilterChange={(value) => {
                setRegionFilter(value);
              }}
            />
          </SideDrawer>
        </>
      )}
    </section>
  );
}

export function CoursesPage() {
  const [state, setState] = useState<CoursesPageState>({
    status: "loading",
  });

  useEffect(() => {
    let isActive = true;

    void (async () => {
      try {
        const envelope = await listCourses();

        if (!isActive) {
          return;
        }

        setState({
          status: "ready",
          courses: envelope.data,
          total: resolveCoursesTotal(envelope.data, envelope.meta),
        });
      } catch (error) {
        if (!isActive) {
          return;
        }

        setState({
          status: "error",
          message: resolveCoursesErrorMessage(error),
        });
      }
    })();

    return () => {
      isActive = false;
    };
  }, []);

  return <CoursesPageView state={state} />;
}
