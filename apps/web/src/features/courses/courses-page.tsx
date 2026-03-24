import React, { useEffect, useMemo, useState } from "react";

import type { Course } from "@metrix-parser/shared-types";

import { PageHeader } from "../../shared/page-header";
import {
  listCourses,
  resolveCoursesErrorMessage,
  resolveCoursesTotal,
} from "../../shared/api/courses";
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

function formatRating(value: number | null, votes: number | null): string {
  if (value === null || votes === null) {
    return "Нет данных";
  }

  return `${value.toFixed(1)} (${votes})`;
}

export interface CoursesPageViewProps {
  state: CoursesPageState;
}

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

export function CoursesPageView({ state }: CoursesPageViewProps) {
  const [nameFilter, setNameFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
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

  if (state.status === "loading") {
    return (
      <section className="data-page-shell" aria-labelledby="courses-page-title">
        <PageHeader
          titleId="courses-page-title"
          eyebrow="Данные"
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
          eyebrow="Данные"
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
        eyebrow="Данные"
        title="Список парков"
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
          <section className="courses-page__filters" aria-label="Фильтры парков">
            <label className="courses-page__filter">
              <span>Название парка</span>
              <select
                className="courses-page__filter-control"
                value={nameFilter}
                onChange={(event) => {
                  setNameFilter(event.target.value);
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
                  setRegionFilter(event.target.value);
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

          {visibleCourses.length === 0 ? (
            <section className="state-panel" aria-live="polite">
              <p className="state-panel__eyebrow">filtered</p>
              <h2>По текущим фильтрам парков ничего нет</h2>
              <p>Попробуйте выбрать другой парк или регион.</p>
            </section>
          ) : (
            <section className="data-table-panel" aria-label="Сохранённые парки">
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
                      <th scope="col">Рейтинг 1</th>
                      <th scope="col">Рейтинг 2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCourses.map((course) => {
                      return (
                        <tr key={course.courseId}>
                          <td className="data-table__cell-primary">{course.courseId}</td>
                          <td className="data-table__cell-primary">{resolveCourseName(course)}</td>
                          <td>{decodeHtmlEntities(course.fullname) || "Не указано"}</td>
                          <td>{resolveCourseArea(course)}</td>
                          <td>{decodeHtmlEntities(course.type) || "Не указан"}</td>
                          <td>{course.countryCode ?? "Не указана"}</td>
                          <td>{formatCoursePar(course.coursePar)}</td>
                          <td>{formatRating(course.ratingValue1, course.ratingResult1)}</td>
                          <td>{formatRating(course.ratingValue2, course.ratingResult2)}</td>
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
