import type {
  Competition,
  Course,
  TournamentCategory,
} from "@metrix-parser/shared-types";
import { isCompetitionListVisibleRecordType } from "@metrix-parser/shared-types";

import { decodeHtmlEntities } from "../../shared/text";

export const UNCATEGORIZED_COMPETITION_FILTER_VALUE = "__uncategorized__";

const discGolfMetrixBaseUrl =
  import.meta.env?.VITE_DISCGOLFMETRIX_BASE_URL ??
  import.meta.env?.DISCGOLFMETRIX_BASE_URL ??
  "https://discgolfmetrix.com";

export const COMPETITION_COURSE_FALLBACK = "Обновите парки";
export const COMPETITION_RECORD_TYPE_LABELS: Readonly<Record<string, string>> = {
  "1": "Round",
  "2": "Single round event",
  "3": "Pool",
  "4": "Event",
  "5": "Tour",
};

export function formatCompetitionDate(value: string): string {
  const [year, month, day] = value.split("-");

  return `${day}.${month}.${year}`;
}

export function resolveCompetitionExternalUrl(competitionId: string): string {
  return new URL(`/${competitionId}`, discGolfMetrixBaseUrl).toString();
}

export function formatCompetitionRecordType(value: string | null): string {
  if (value === null) {
    return "Не указан";
  }

  return COMPETITION_RECORD_TYPE_LABELS[value] ?? value;
}

export function isVisibleCompetitionRecordType(value: string | null): boolean {
  return isCompetitionListVisibleRecordType(value);
}

export function filterVisibleCompetitions(
  competitions: readonly Competition[],
): Competition[] {
  const competitionsById = new Map(
    competitions.map((competition) => [competition.competitionId, competition] as const),
  );
  const childrenByParentId = new Map<string, Competition[]>();

  for (const competition of competitions) {
    if (!competition.parentId) {
      continue;
    }

    const currentChildren = childrenByParentId.get(competition.parentId) ?? [];
    currentChildren.push(competition);
    childrenByParentId.set(competition.parentId, currentChildren);
  }

  const hasDirectRoundChildren = (competitionId: string): boolean =>
    (childrenByParentId.get(competitionId) ?? []).some(
      (child) => child.recordType === "1",
    );
  const resolvePoolChildrenWithRounds = (competitionId: string): Competition[] =>
    (childrenByParentId.get(competitionId) ?? []).filter(
      (child) => child.recordType === "3" && hasDirectRoundChildren(child.competitionId),
    );

  return competitions.filter((competition) => {
    if (competition.recordType === "2") {
      return true;
    }

    if (competition.recordType === "4") {
      return resolvePoolChildrenWithRounds(competition.competitionId).length <= 1;
    }

    if (competition.recordType !== "3" || !hasDirectRoundChildren(competition.competitionId)) {
      return false;
    }

    const parentCompetition = competition.parentId
      ? competitionsById.get(competition.parentId) ?? null
      : null;
    if (parentCompetition?.recordType !== "4") {
      return false;
    }

    return resolvePoolChildrenWithRounds(parentCompetition.competitionId).length > 1;
  });
}

export function calculateCompetitionCourseRating(course: Course): number | null {
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

export function resolveCompetitionSegmentsCount(
  competition: Competition,
  competitionsByParentId: ReadonlyMap<string, readonly Competition[]>,
  courseById: ReadonlyMap<string, Course>,
): number | null {
  const roundCompetitions = competitionsByParentId.get(competition.competitionId) ?? [];
  const competitionsForSegments =
    roundCompetitions.length > 0 ? roundCompetitions : [competition];

  let totalSegments = 0;
  let hasKnownSegments = false;

  for (const roundCompetition of competitionsForSegments) {
    if (!roundCompetition.courseId) {
      continue;
    }

    const basketsCount = courseById.get(roundCompetition.courseId)?.basketsCount ?? null;
    if (basketsCount === null) {
      continue;
    }

    totalSegments += basketsCount;
    hasKnownSegments = true;
  }

  return hasKnownSegments ? totalSegments : null;
}

function isCategoryMatch(
  category: TournamentCategory,
  competitionSegmentsCount: number,
  competitionCourseRating: number,
): boolean {
  return (
    competitionSegmentsCount >= category.segmentsCount &&
    competitionCourseRating >= category.ratingGte &&
    competitionCourseRating < category.ratingLt
  );
}

export function resolveCompetitionCategoryIdByMetrics(
  categories: readonly TournamentCategory[],
  competitionSegmentsCount: number | null,
  competitionCourseRating: number | null,
): string | null {
  if (competitionSegmentsCount === null || competitionCourseRating === null) {
    return null;
  }

  const matchingCategories = categories
    .filter((category) =>
      isCategoryMatch(category, competitionSegmentsCount, competitionCourseRating),
    )
    .sort((left, right) => {
      if (right.segmentsCount !== left.segmentsCount) {
        return right.segmentsCount - left.segmentsCount;
      }

      if (right.ratingGte !== left.ratingGte) {
        return right.ratingGte - left.ratingGte;
      }

      if (left.ratingLt !== right.ratingLt) {
        return left.ratingLt - right.ratingLt;
      }

      return left.categoryId.localeCompare(right.categoryId, "ru");
    });

  if (matchingCategories.length === 0) {
    return null;
  }

  const [topCategory, secondCategory] = matchingCategories;
  if (
    secondCategory &&
    secondCategory.segmentsCount === topCategory.segmentsCount &&
    secondCategory.ratingGte === topCategory.ratingGte &&
    secondCategory.ratingLt === topCategory.ratingLt
  ) {
    return null;
  }

  return topCategory.categoryId;
}

export interface CompetitionFilters {
  nameQuery: string;
  dateFrom: string;
  dateTo: string;
  courseName: string;
  categoryId: string;
  withoutResultsOnly: boolean;
}

export function createCourseNamesById(
  courses: readonly Course[],
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    courses.map((course) => [course.courseId, decodeHtmlEntities(course.name)]),
  );
}

export function resolveCompetitionCourseName(
  competition: Competition,
  courseNamesById: Readonly<Record<string, string>>,
): string {
  const savedCourseName = decodeHtmlEntities(competition.courseName?.trim());
  if (savedCourseName) {
    return savedCourseName;
  }

  if (!competition.courseId) {
    return COMPETITION_COURSE_FALLBACK;
  }

  return decodeHtmlEntities(courseNamesById[competition.courseId]) || COMPETITION_COURSE_FALLBACK;
}

function resolveCompetitionNameTail(value: string): string {
  const normalizedValue = decodeHtmlEntities(value)
    .split("→")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  return normalizedValue[normalizedValue.length - 1] ?? decodeHtmlEntities(value).trim();
}

function composeParentPoolCompetitionName(
  parentCompetition: Competition,
  poolCompetition: Competition,
): string {
  const parentName = resolveCompetitionNameTail(parentCompetition.competitionName);
  const poolName = resolveCompetitionNameTail(poolCompetition.competitionName);

  if (!parentName) {
    return decodeHtmlEntities(poolCompetition.competitionName);
  }

  if (!poolName || poolName === parentName) {
    return parentName;
  }

  return `${parentName} · ${poolName}`;
}

export function resolveCompetitionDisplayName(
  competition: Competition,
  competitions: readonly Competition[],
): string {
  if (competition.recordType === "3") {
    const parentCompetition = competition.parentId
      ? competitions.find((item) => item.competitionId === competition.parentId) ?? null
      : null;

    if (parentCompetition) {
      return composeParentPoolCompetitionName(parentCompetition, competition);
    }
  }

  const directRoundChildren = competitions.filter((item) => {
    return item.parentId === competition.competitionId && item.recordType === "1";
  });

  if (directRoundChildren.length > 0) {
    return decodeHtmlEntities(competition.competitionName);
  }

  if (competition.recordType === "4") {
    const directPoolChildren = competitions.filter((item) => {
      return item.parentId === competition.competitionId && item.recordType === "3";
    });

    if (directPoolChildren.length === 1) {
      const [poolCompetition] = directPoolChildren;
      if (poolCompetition) {
        const poolRoundChildren = competitions.filter((item) => {
          return item.parentId === poolCompetition.competitionId && item.recordType === "1";
        });

        if (poolRoundChildren.length > 0) {
          return composeParentPoolCompetitionName(competition, poolCompetition);
        }
      }
    }
  }

  return decodeHtmlEntities(competition.competitionName);
}

function normalizeFilterValue(value: string): string {
  return value.trim().toLowerCase();
}

export function filterCompetitions(
  competitions: readonly Competition[],
  courseNamesById: Readonly<Record<string, string>>,
  filters: CompetitionFilters,
): Competition[] {
  const normalizedNameQuery = normalizeFilterValue(filters.nameQuery);

  return competitions.filter((competition) => {
    const competitionName = decodeHtmlEntities(competition.competitionName);
    const courseName = resolveCompetitionCourseName(competition, courseNamesById);

    if (
      normalizedNameQuery &&
      !normalizeFilterValue(competitionName).includes(normalizedNameQuery)
    ) {
      return false;
    }

    if (filters.dateFrom && competition.competitionDate < filters.dateFrom) {
      return false;
    }

    if (filters.dateTo && competition.competitionDate > filters.dateTo) {
      return false;
    }

    if (filters.courseName && courseName !== filters.courseName) {
      return false;
    }

    if (
      filters.categoryId === UNCATEGORIZED_COMPETITION_FILTER_VALUE &&
      competition.categoryId !== null
    ) {
      return false;
    }

    if (
      filters.categoryId &&
      filters.categoryId !== UNCATEGORIZED_COMPETITION_FILTER_VALUE &&
      (competition.categoryId ?? "") !== filters.categoryId
    ) {
      return false;
    }

    if (filters.withoutResultsOnly && competition.hasResults !== false) {
      return false;
    }

    return true;
  });
}
