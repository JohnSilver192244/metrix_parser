import React, { useEffect, useMemo, useState } from "react";

import type { Competition } from "@metrix-parser/shared-types";

import { buildCompetitionResultsPath } from "../../app/route-paths";
import { PageHeader } from "../../shared/page-header";
import {
  listCompetitions,
  resolveCompetitionsErrorMessage,
  resolveCompetitionsTotal,
} from "../../shared/api/competitions";
import { listCourses } from "../../shared/api/courses";
import { decodeHtmlEntities } from "../../shared/text";
import {
  COMPETITION_RECORD_TYPE_LABELS,
  filterCompetitions,
  createCourseNamesById,
  filterVisibleCompetitions,
  formatCompetitionDate,
  formatCompetitionRecordType,
  resolveCompetitionCourseName,
} from "./competition-presenters";

const discGolfMetrixBaseUrl =
  import.meta.env?.VITE_DISCGOLFMETRIX_BASE_URL ??
  import.meta.env?.DISCGOLFMETRIX_BASE_URL ??
  "https://discgolfmetrix.com";
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
      courseNamesById: Readonly<Record<string, string>>;
      total: number;
    };

function formatPlayersCount(value: number | null): string {
  return value === null ? "Не указан" : `${value}`;
}

export function resolveCompetitionExternalUrl(competitionId: string): string {
  return new URL(`/${competitionId}`, discGolfMetrixBaseUrl).toString();
}

export interface CompetitionsPageViewProps {
  state: CompetitionsPageState;
  onNavigate: (pathname: string) => void;
}

const defaultCompetitionFilters = {
  nameQuery: "",
  date: "",
  courseName: "",
};

export function CompetitionsPageView({
  state,
  onNavigate,
}: CompetitionsPageViewProps) {
  const [nameQuery, setNameQuery] = useState(defaultCompetitionFilters.nameQuery);
  const [dateFilter, setDateFilter] = useState(defaultCompetitionFilters.date);
  const [courseFilter, setCourseFilter] = useState(defaultCompetitionFilters.courseName);
  const competitions = state.status === "ready" ? state.competitions : [];
  const courseNamesById = state.status === "ready" ? state.courseNamesById : {};
  const total = state.status === "ready" ? state.total : 0;
  const visibleCompetitions = useMemo(
    () =>
      filterCompetitions(competitions, courseNamesById, {
        nameQuery,
        date: dateFilter,
        courseName: courseFilter,
      }),
    [competitions, courseNamesById, nameQuery, dateFilter, courseFilter],
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

  if (state.status === "loading") {
    return (
      <section className="data-page-shell" aria-labelledby="competitions-page-title">
        <PageHeader
          titleId="competitions-page-title"
          eyebrow="Данные"
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
          eyebrow="Данные"
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
        eyebrow="Данные"
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
                }}
              />
            </label>
            <label className="competitions-page__filter">
              <span>Дата</span>
              <input
                className="competitions-page__filter-control"
                type="date"
                value={dateFilter}
                onChange={(event) => {
                  setDateFilter(event.target.value);
                }}
              />
            </label>
            <label className="competitions-page__filter">
              <span>Парк</span>
              <select
                className="competitions-page__filter-control"
                value={courseFilter}
                onChange={(event) => {
                  setCourseFilter(event.target.value);
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
          </section>

          {visibleCompetitions.length === 0 ? (
            <section className="state-panel" aria-live="polite">
              <p className="state-panel__eyebrow">filtered</p>
              <h2>По текущим фильтрам соревнований нет</h2>
              <p>Попробуйте изменить название, дату или парк.</p>
            </section>
          ) : (
            <section className="data-table-panel" aria-label="Сохранённые соревнования">
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Название</th>
                      <th scope="col">Дата</th>
                      <th scope="col">Парк / курс</th>
                      <th scope="col">Игроков</th>
                      <th scope="col">Тип записи</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCompetitions.map((competition) => {
                      const competitionName = decodeHtmlEntities(competition.competitionName);
                      const externalUrl = resolveCompetitionExternalUrl(competition.competitionId);

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
                                  onNavigate(buildCompetitionResultsPath(competition.competitionId));
                                }}
                                aria-label={`Открыть результаты соревнования ${competitionName}`}
                              >
                                {competitionName}
                              </button>
                            </span>
                          </td>
                          <td>{formatCompetitionDate(competition.competitionDate)}</td>
                          <td>{resolveCompetitionCourseName(competition, courseNamesById)}</td>
                          <td>{formatPlayersCount(competition.playersCount)}</td>
                          <td>{formatCompetitionRecordType(competition.recordType)}</td>
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

export interface CompetitionsPageProps {
  onNavigate: (pathname: string) => void;
}

export function CompetitionsPage({ onNavigate }: CompetitionsPageProps) {
  const [state, setState] = useState<CompetitionsPageState>({
    status: "loading",
  });

  useEffect(() => {
    let isActive = true;

    void (async () => {
      try {
        const [competitionsResult, coursesResult] = await Promise.allSettled([
          listCompetitions(),
          listCourses(),
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

        const visibleCompetitions = filterVisibleCompetitions(competitionsEnvelope.data);

        setState({
          status: "ready",
          competitions: visibleCompetitions,
          courseNamesById,
          total: resolveCompetitionsTotal(visibleCompetitions),
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
  }, []);

  return <CompetitionsPageView state={state} onNavigate={onNavigate} />;
}
