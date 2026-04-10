import React, { useMemo, useState } from "react";

import type {
  Competition,
  Course,
  TournamentCategory,
  UpdateLifecyclePhase,
  UpdateOperationResult,
  UpdatePeriod,
} from "@metrix-parser/shared-types";

import {
  calculateCompetitionCourseRating,
  resolveCompetitionCategoryIdByMetrics,
  resolveCompetitionSegmentsCount,
} from "../competitions/competition-presenters";
import { listCompetitions, updateCompetitionCategory } from "../../shared/api/competitions";
import { listCourses } from "../../shared/api/courses";
import { listTournamentCategories } from "../../shared/api/tournament-categories";
import { mapUpdateError, triggerUpdate } from "../../shared/api/updates";
import { UpdateActionCard } from "./update-action-card";
import { UpdatePeriodPicker } from "./update-period-picker";
import type { UpdateScenarioDefinition } from "./update-scenarios";
import { updateScenarios } from "./update-scenarios";
import { UpdateOperationStatus } from "./update-operation-status";

const updateSkipConditions = [
  "Соревнования не импортируются, если запись не из РФ. Такие записи отфильтровываются и не попадают в импорт.",
  "Соревнования пропускаются, если у записи нет competitionId, competitionName, competitionDate или courseId.",
  "Соревнования пропускаются, если в записи меньше 8 игроков.",
  "Соревнования не импортируются, если в названии есть «мастер-класс», «master class», «даблс» или «doubles» без учёта регистра.",
  "Парки пропускаются, если у сохранённого соревнования нельзя определить courseId.",
  "Парки пропускаются, если в payload курса нет courseId, name или course_par.",
  "Игроки пропускаются, если во фрагменте результата нет playerId или playerName.",
  "Игроки пропускаются при сохранении, если playerId или playerName пустые.",
  "Результаты пропускаются, если во фрагменте результата нет playerId.",
  "Результаты пропускаются, если запись не DNF и в ней нет sum или diff.",
  "Результаты пропускаются при сохранении, если пусты competitionId или playerId, либо для не-DNF записи отсутствуют sum или diff.",
] as const;

function PendingStatus({ scenario, period }: { scenario: UpdateScenarioDefinition; period: UpdatePeriod }) {
  return (
    <div className="update-card__status update-card__status--pending" role="status">
      <div className="update-card__status-heading">
        <strong>Выполняется обновление: {scenario.title}</strong>
        <span>Остальные кнопки временно заблокированы</span>
      </div>
      <p>Команда отправлена в backend API. Как только запрос завершится, здесь появится итоговая статистика.</p>
      <p>
        Период: {period.dateFrom} - {period.dateTo}
      </p>
      <dl className="update-card__summary-grid">
        <div>
          <dt>Найдено</dt>
          <dd>...</dd>
        </div>
        <div>
          <dt>Создано</dt>
          <dd>...</dd>
        </div>
        <div>
          <dt>Обновлено</dt>
          <dd>...</dd>
        </div>
        <div>
          <dt>Пропущено</dt>
          <dd>...</dd>
        </div>
        <div>
          <dt>Ошибок</dt>
          <dd>...</dd>
        </div>
      </dl>
    </div>
  );
}

export function AdminUpdatesPage() {
  const skipConditionsTooltipId = "admin-updates-skip-conditions-tooltip";
  const scenarios = useMemo(
    () =>
      updateScenarios.filter((scenario) =>
        ["competitions", "courses", "players"].includes(scenario.operation),
      ),
    [],
  );
  const [period, setPeriod] = useState<UpdatePeriod>(() => ({
    dateFrom: "",
    dateTo: "",
  }));
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [phase, setPhase] = useState<UpdateLifecyclePhase>("idle");
  const [activeScenario, setActiveScenario] = useState<UpdateScenarioDefinition | null>(null);
  const [result, setResult] = useState<UpdateOperationResult | null>(null);
  const [isAssigningCategories, setIsAssigningCategories] = useState(false);
  const [categoryAssignmentMessage, setCategoryAssignmentMessage] = useState<string | null>(null);
  const [categoryAssignmentError, setCategoryAssignmentError] = useState(false);
  const isSubmitting = phase === "submitting";
  const hasSelectedPeriod = period.dateFrom.trim() !== "" && period.dateTo.trim() !== "";
  const isBusy = isSubmitting || isAssigningCategories;
  const disabledReason = isSubmitting
    ? "Данные обновляются"
    : isAssigningCategories
      ? "Категории пересчитываются"
    : !hasSelectedPeriod
      ? "Сначала выберите диапазон дат (максимум 14 дней)"
      : null;

  async function handleScenarioSubmit(scenario: UpdateScenarioDefinition) {
    if (!hasSelectedPeriod) {
      return;
    }

    const submittedPeriod = { ...period };

    setActiveScenario(scenario);
    setPhase("submitting");
    setResult(null);

    try {
      const response = await triggerUpdate(scenario.operation, {
        ...submittedPeriod,
        overwriteExisting,
      });
      setPhase(response.finalStatus === "failed" ? "error" : "success");
      setResult(response);
    } catch (error) {
      setPhase("error");
      setResult(mapUpdateError(scenario.operation, error, submittedPeriod));
    }
  }

  async function handleAssignCategoriesByPeriod() {
    if (!hasSelectedPeriod || isBusy) {
      return;
    }

    setIsAssigningCategories(true);
    setCategoryAssignmentError(false);
    setCategoryAssignmentMessage("Расставляем категории соревнований...");

    try {
      const [competitionsEnvelope, coursesEnvelope, categoriesEnvelope] = await Promise.all([
        listCompetitions(),
        listCourses(),
        listTournamentCategories(),
      ]);

      const competitions = competitionsEnvelope.data;
      const courses = coursesEnvelope.data;
      const categories = categoriesEnvelope.data;

      const filteredCompetitions = competitions.filter((competition) => {
        return (
          competition.competitionDate >= period.dateFrom &&
          competition.competitionDate <= period.dateTo
        );
      });

      const competitionsByParentId = new Map<string, Competition[]>();
      for (const competition of competitions) {
        if (!competition.parentId) {
          continue;
        }

        const current = competitionsByParentId.get(competition.parentId) ?? [];
        current.push(competition);
        competitionsByParentId.set(competition.parentId, current);
      }

      const courseById = new Map<string, Course>(courses.map((course) => [course.courseId, course]));

      const assignmentPlan = filteredCompetitions
        .filter((competition) => !competition.categoryId)
        .map((competition) => {
          const competitionCourse = competition.courseId
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
            categories as readonly TournamentCategory[],
            segmentsCount,
            courseRating,
          );

          return {
            competitionId: competition.competitionId,
            categoryId,
          };
        })
        .filter((entry): entry is { competitionId: string; categoryId: string } => entry.categoryId !== null);

      if (assignmentPlan.length === 0) {
        setCategoryAssignmentMessage("Нет соревнований без категории за выбранный период.");
        setCategoryAssignmentError(false);
        setIsAssigningCategories(false);
        return;
      }

      let updatedCount = 0;
      let failedCount = 0;

      for (const entry of assignmentPlan) {
        try {
          await updateCompetitionCategory(entry);
          updatedCount += 1;
        } catch {
          failedCount += 1;
        }
      }

      const messageParts = [
        `Обновлено категорий: ${updatedCount}.`,
        `Пропущено (не определилось): ${Math.max(
          filteredCompetitions.filter((competition) => !competition.categoryId).length -
            assignmentPlan.length,
          0,
        )}.`,
      ];
      if (failedCount > 0) {
        messageParts.push(`Ошибок сохранения: ${failedCount}.`);
      }

      setCategoryAssignmentMessage(messageParts.join(" "));
      setCategoryAssignmentError(failedCount > 0);
    } catch {
      setCategoryAssignmentError(true);
      setCategoryAssignmentMessage(
        "Не удалось запустить массовую расстановку категорий по периоду.",
      );
    } finally {
      setIsAssigningCategories(false);
    }
  }

  return (
    <section className="admin-shell" aria-labelledby="admin-updates-title">
      <section className="update-launcher" aria-label="Запуск обновлений">
        <div className="update-launcher__panel">
          <div className="update-launcher__intro">
            <div className="update-launcher__title-row">
              <h1 id="admin-updates-title">Обновление данных</h1>
              <span className="update-card__tooltip-anchor update-card__tooltip-anchor--info">
                <button
                  type="button"
                  className="update-launcher__info-button"
                  aria-label="Причины пропуска записей при обновлении"
                  aria-describedby={skipConditionsTooltipId}
                >
                  ?
                </button>
                <span
                  id={skipConditionsTooltipId}
                  role="tooltip"
                  className="update-card__tooltip update-card__tooltip--info"
                >
                  <strong>Что может быть пропущено при обновлении</strong>
                  <ul className="update-card__tooltip-list">
                    {updateSkipConditions.map((condition) => (
                      <li key={condition}>{condition}</li>
                    ))}
                  </ul>
                </span>
              </span>
            </div>
            <p>Выберите период и запустите нужные операции обновления.</p>
          </div>
          <div className="update-launcher__controls">
            <UpdatePeriodPicker value={period} onChange={setPeriod} maxRangeDays={14} />
            <label className="update-launcher__checkbox">
              <input
                type="checkbox"
                checked={overwriteExisting}
                onChange={(event) => {
                  setOverwriteExisting(event.target.checked);
                }}
              />
              <span>Перезаписать имеющиеся данные</span>
            </label>
          </div>
          <div className="update-launcher__actions" aria-label="Сценарии обновления">
            {scenarios.map((scenario) => {
              return (
                <UpdateActionCard
                  key={scenario.operation}
                  scenario={scenario}
                  disabled={isBusy || !hasSelectedPeriod}
                  isActive={activeScenario?.operation === scenario.operation}
                  disabledReason={disabledReason}
                  onSubmit={handleScenarioSubmit}
                />
              );
            })}
            <span className="update-card__tooltip-anchor update-card__tooltip-anchor--button">
              <button
                type="button"
                className="update-card__submit update-card__submit--action"
                disabled={isBusy || !hasSelectedPeriod}
                onClick={() => {
                  void handleAssignCategoriesByPeriod();
                }}
              >
                {isAssigningCategories ? "Назначаем категории..." : "Категории"}
              </button>
              {disabledReason ? (
                <span role="tooltip" className="update-card__tooltip update-card__tooltip--button">
                  {disabledReason}
                </span>
              ) : null}
            </span>
          </div>
          {categoryAssignmentMessage ? (
            <p
              className={
                categoryAssignmentError
                  ? "tournament-categories-page__status tournament-categories-page__status--error"
                  : "tournament-categories-page__status"
              }
              role={categoryAssignmentError ? "alert" : "status"}
            >
              {categoryAssignmentMessage}
            </p>
          ) : null}
        </div>
      </section>

      <section className="update-launcher__status" aria-live="polite" aria-label="Статус обновления">
        {phase === "submitting" && activeScenario ? (
          <PendingStatus scenario={activeScenario} period={period} />
        ) : null}
        {phase !== "submitting" && result ? <UpdateOperationStatus result={result} /> : null}
        {phase === "idle" && !result ? (
          <div className="update-card__status update-card__status--idle">
            <div className="update-card__status-heading">
              <strong>Статистика появится здесь</strong>
              <span>После запуска одного из обновлений</span>
            </div>
            <p>Выберите общий период и нажмите нужную кнопку. Новый запуск скроет предыдущую статистику до завершения запроса.</p>
          </div>
        ) : null}
      </section>
    </section>
  );
}
