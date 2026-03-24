import React, { useEffect, useState } from "react";

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

export function CoursesPageView({ state }: CoursesPageViewProps) {
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

  const { courses, total } = state;

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
                {courses.map((course) => {
                  return (
                    <tr key={course.courseId}>
                      <td className="data-table__cell-primary">{course.courseId}</td>
                      <td className="data-table__cell-primary">{decodeHtmlEntities(course.name)}</td>
                      <td>{decodeHtmlEntities(course.fullname) || "Не указано"}</td>
                      <td>{decodeHtmlEntities(course.area) || "Не указан"}</td>
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
