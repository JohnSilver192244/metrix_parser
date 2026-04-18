import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  confirmAutoAssignCategories,
  CompetitionsPageView,
  hasCompetitionsWithoutResults,
} from "./competitions-page";
import {
  resolveCompetitionExternalUrl,
  UNCATEGORIZED_COMPETITION_FILTER_VALUE,
} from "./competition-presenters";

const currentYear = new Date().getFullYear();
const competitionsCategoryFilterStorageKey =
  "competitions-page:category-filter";
const competitionsPeriodFilterStorageKey = "competitions-page:period-filter";
const competitionsWithoutResultsFilterStorageKey =
  "competitions-page:without-results-filter";
const competitionsSortStorageKey = "competitions-page:sort";

function createStorage() {
  const store = new Map<string, string>();

  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key) ?? null : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

test("CompetitionsPageView renders the empty state when there is no data", () => {
  const markup = renderToStaticMarkup(
    <CompetitionsPageView
      state={{
        status: "ready",
        competitions: [],
        courses: [],
        categories: [],
        courseNamesById: {},
        total: 0,
      }}
      onNavigate={() => {}}
    />,
  );

  assert.match(markup, /Пока нет сохранённых соревнований/);
  assert.match(markup, /административном разделе/);
});

test("CompetitionsPageView renders saved competitions with key fields", () => {
  const markup = renderToStaticMarkup(
    <CompetitionsPageView
      state={{
        status: "ready",
        total: 1,
        categories: [
          {
            categoryId: "category-701",
            name: "Про",
            description: "Профессиональная категория",
            competitionClass: "tournament",
            segmentsCount: 18,
            ratingGte: 900,
            ratingLt: 1000,
            coefficient: 1,
          },
        ],
        courses: [
          {
            courseId: "course-701",
            name: "Yaroslavl &rarr; Park",
            fullname: null,
            type: null,
            countryCode: "RU",
            area: "Yaroslavl",
            ratingValue1: 840,
            ratingResult1: 50,
            ratingValue2: 900,
            ratingResult2: 44,
            coursePar: 54,
            basketsCount: 18,
          },
        ],
        courseNamesById: {
          "course-701": "Yaroslavl &rarr; Park",
        },
        competitions: [
          {
            competitionId: "competition-701",
            competitionName: "RDGA Spring &rarr; Tour",
            competitionDate: "2026-05-10",
            courseId: "course-701",
            courseName: null,
            categoryId: "category-701",
            recordType: "4",
            playersCount: 52,
            metrixId: "metrix-701",
            seasonPoints: 143.75,
          },
        ],
      }}
      onNavigate={() => {}}
    />,
  );

  assert.match(markup, /<table/);
  assert.match(markup, /Фильтры соревнований/);
  assert.match(markup, /Правила отображения record_type на странице соревнований/);
  assert.match(markup, /Правила record_type/);
  assert.match(markup, /Показываем:[\s\S]*2 \(Single round event\), 4 \(Event\)/);
  assert.match(markup, /а также 3 \(Pool\), если Event разбит на несколько pool с раундами/);
  assert.match(markup, /Скрываем:[\s\S]*1 \(Round\), 3 \(Pool\), 5 \(Tour\)/);
  assert.match(markup, /Поиск по названию/);
  assert.match(markup, /Все парки/);
  assert.match(markup, /Все категории/);
  assert.match(markup, /Не указано/);
  assert.match(markup, /Нет результатов/);
  assert.match(markup, /Период/);
  assert.match(markup, /name="competitions-date-from"/);
  assert.match(markup, /name="competitions-date-to"/);
  assert.doesNotMatch(markup, /type="date"/);
  assert.match(markup, new RegExp(`value=\"${currentYear}-01-01\"`));
  assert.match(markup, new RegExp(`value=\"${currentYear}-12-31\"`));
  assert.match(markup, /data-table__link-button/);
  assert.match(markup, /data-table__external-link/);
  assert.match(markup, new RegExp(resolveCompetitionExternalUrl("competition-701")));
  assert.match(markup, /target="_blank"/);
  assert.match(markup, /RDGA Spring → Tour/);
  assert.match(markup, /10\.05\.2026/);
  assert.match(markup, /Yaroslavl → Park/);
  assert.match(markup, /Про/);
  assert.match(markup, /800\.0/);
  assert.match(markup, /18/);
  assert.match(markup, /52/);
  assert.match(markup, /Очки сезона/);
  assert.match(markup, /143\.75/);
  assert.match(markup, /Event/);
  assert.match(markup, /Название/);
  assert.match(markup, /Дата ↓/);
  assert.match(markup, /Парк \/ курс/);
  assert.match(markup, /Категория/);
  assert.match(markup, /Рейтинг парка/);
  assert.match(markup, /Отрезков/);
  assert.match(markup, /Игроков/);
  assert.match(markup, /Тип записи/);
  assert.doesNotMatch(markup, /Metrix ID/);
  assert.doesNotMatch(markup, /metrix-701/);
});

test("CompetitionsPageView renders visible pagination with 25 competitions per page", () => {
  const competitions = Array.from({ length: 30 }, (_, index) => {
    const number = String(index + 1).padStart(3, "0");
    return {
      competitionId: `competition-${number}`,
      competitionName: `Competition ${number}`,
      competitionDate: `${currentYear}-05-10`,
      courseId: null,
      courseName: null,
      categoryId: null,
      recordType: "4",
      playersCount: 20,
      metrixId: null,
    } satisfies import("@metrix-parser/shared-types").Competition;
  });

  const markup = renderToStaticMarkup(
    <CompetitionsPageView
      state={{
        status: "ready",
        total: competitions.length,
        categories: [],
        courses: [],
        courseNamesById: {},
        competitions,
      }}
      currentPage={1}
      onNavigate={() => {}}
    />,
  );

  assert.match(markup, /aria-label="Пагинация соревнований"/);
  assert.match(markup, /Показано 25 из 30 соревнований\. Страница 1 из 2\./);
  assert.match(markup, /Competition 025/);
  assert.doesNotMatch(markup, /Competition 026/);
});

test("CompetitionsPageView applies period filter across the full loaded dataset, not only the current page slice", () => {
  const sessionStorage = createStorage();
  const previousWindow = globalThis.window;

  Object.defineProperty(globalThis, "window", {
    value: { sessionStorage },
    configurable: true,
    writable: true,
  });
  sessionStorage.setItem(
    competitionsPeriodFilterStorageKey,
    JSON.stringify({
      dateFrom: `${currentYear - 1}-01-01`,
      dateTo: `${currentYear - 1}-12-31`,
    }),
  );

  const currentYearCompetitions = Array.from({ length: 30 }, (_, index) => ({
    competitionId: `competition-current-${index + 1}`,
    competitionName: `Current Year ${index + 1}`,
    competitionDate: `${currentYear}-05-10`,
    courseId: null,
    courseName: null,
    categoryId: null,
    recordType: "4",
    playersCount: 20,
    metrixId: null,
  })) satisfies import("@metrix-parser/shared-types").Competition[];

  const previousYearCompetition = {
    competitionId: "competition-previous-year",
    competitionName: "Previous Year Open",
    competitionDate: `${currentYear - 1}-09-21`,
    courseId: null,
    courseName: null,
    categoryId: null,
    recordType: "4",
    playersCount: 18,
    metrixId: null,
  } satisfies import("@metrix-parser/shared-types").Competition;

  const markup = renderToStaticMarkup(
    <CompetitionsPageView
      state={{
        status: "ready",
        total: currentYearCompetitions.length + 1,
        categories: [],
        courses: [],
        courseNamesById: {},
        competitions: [...currentYearCompetitions, previousYearCompetition],
      }}
      currentPage={1}
      onNavigate={() => {}}
    />,
  );

  try {
    assert.match(markup, /Previous Year Open/);
    assert.doesNotMatch(markup, /По текущим фильтрам соревнований нет/);
    assert.match(markup, /Показано 1 из 1 соревнований\. Страница 1 из 1\./);
  } finally {
    Object.defineProperty(globalThis, "window", {
      value: previousWindow,
      configurable: true,
      writable: true,
    });
  }
});

test("CompetitionsPageView renders event titles with pool names when a pool exists", () => {
  const markup = renderToStaticMarkup(
    <CompetitionsPageView
      state={{
        status: "ready",
        total: 1,
        categories: [],
        courses: [],
        courseNamesById: {},
        competitions: [
          {
            competitionId: "event-801",
            competitionName: "Tour 2026 &rarr; Stage 1",
            competitionDate: "2026-04-26",
            courseId: null,
            courseName: null,
            categoryId: null,
            recordType: "4",
            playersCount: 28,
            metrixId: null,
          },
        ],
        allCompetitions: [
          {
            competitionId: "event-801",
            competitionName: "Tour 2026 &rarr; Stage 1",
            competitionDate: "2026-04-26",
            courseId: null,
            courseName: null,
            categoryId: null,
            recordType: "4",
            playersCount: 28,
            metrixId: null,
          },
          {
            competitionId: "pool-801",
            competitionName: "Tour 2026 &rarr; Stage 1 &rarr; Experienced",
            competitionDate: "2026-04-26",
            parentId: "event-801",
            courseId: null,
            courseName: null,
            categoryId: null,
            recordType: "3",
            playersCount: null,
            metrixId: null,
          },
          {
            competitionId: "round-801",
            competitionName: "Round 1",
            competitionDate: "2026-04-26",
            parentId: "pool-801",
            courseId: null,
            courseName: null,
            categoryId: null,
            recordType: "1",
            playersCount: null,
            metrixId: null,
          },
        ],
      }}
      onNavigate={() => {}}
    />,
  );

  assert.match(markup, /Stage 1 · Experienced/);
  assert.doesNotMatch(markup, /Tour 2026 → Stage 1/);
});

test("CompetitionsPageView renders competition comment under the visible competition name", () => {
  const visibleCompetition = {
    competitionId: "event-901",
    competitionName: "ЭКО 2025 Лига-Б → 10 Этап",
    competitionDate: "2026-04-26",
    courseId: null,
    courseName: null,
    categoryId: null,
    recordType: "4",
    playersCount: 8,
    metrixId: null,
    comment: "Нельзя сохранить результаты: в пулах меньше 8 игроков.",
  } as import("@metrix-parser/shared-types").Competition & {
    comment?: string | null;
  };

  const markup = renderToStaticMarkup(
    <CompetitionsPageView
      state={{
        status: "ready",
        total: 1,
        categories: [],
        courses: [],
        courseNamesById: {},
        competitions: [visibleCompetition],
        allCompetitions: [
          visibleCompetition,
          {
            competitionId: "pool-901-pro",
            competitionName: "ЭКО 2025 Лига-Б → 10 Этап → Pro",
            competitionDate: "2026-04-26",
            parentId: "event-901",
            courseId: null,
            courseName: null,
            categoryId: null,
            recordType: "3",
            playersCount: 3,
            metrixId: null,
          },
        ],
      }}
      onNavigate={() => {}}
    />,
  );

  assert.match(markup, /ЭКО 2025 Лига-Б → 10 Этап/);
  assert.match(markup, /Нельзя сохранить результаты: в пулах меньше 8 игроков\./);
});

test("CompetitionsPageView does not wrap the period picker in a label", () => {
  const markup = renderToStaticMarkup(
    <CompetitionsPageView
      state={{
        status: "ready",
        total: 1,
        categories: [],
        courses: [],
        courseNamesById: {},
        competitions: [
          {
            competitionId: "competition-703",
            competitionName: "Label Regression Open",
            competitionDate: `${currentYear}-05-10`,
            courseId: null,
            courseName: "Course C",
            categoryId: null,
            recordType: "4",
            playersCount: 16,
            metrixId: null,
          },
        ],
      }}
      onNavigate={() => {}}
    />,
  );

  assert.doesNotMatch(markup, /<label class="competitions-page__filter"><span>Период<\/span>/);
  assert.match(markup, /<div class="competitions-page__filter"><span>Период<\/span>/);
});

test("CompetitionsPageView prompts to update parks when course is missing in parks table", () => {
  const markup = renderToStaticMarkup(
    <CompetitionsPageView
      state={{
        status: "ready",
        total: 1,
        categories: [],
        courses: [],
        courseNamesById: {},
        competitions: [
          {
            competitionId: "competition-702",
            competitionName: "RDGA Autumn Tour",
            competitionDate: "2026-09-21",
            courseId: "course-missing",
            courseName: null,
            categoryId: null,
            recordType: "2",
            playersCount: 18,
            metrixId: "metrix-702",
          },
        ],
      }}
      onNavigate={() => {}}
    />,
  );

  assert.match(markup, /Обновите парки/);
});

test("CompetitionsPageView applies the current year preset by default", () => {
  const previousYearCompetitionDate = `${currentYear - 1}-09-21`;
  const currentYearCompetitionDate = `${currentYear}-05-10`;
  const markup = renderToStaticMarkup(
    <CompetitionsPageView
      state={{
        status: "ready",
        total: 2,
        categories: [],
        courses: [],
        courseNamesById: {},
        competitions: [
          {
            competitionId: "competition-current-year",
            competitionName: "Current Year Open",
            competitionDate: currentYearCompetitionDate,
            courseId: null,
            courseName: "Course A",
            categoryId: null,
            recordType: "4",
            playersCount: 24,
            metrixId: null,
          },
          {
            competitionId: "competition-previous-year",
            competitionName: "Previous Year Open",
            competitionDate: previousYearCompetitionDate,
            courseId: null,
            courseName: "Course B",
            categoryId: null,
            recordType: "4",
            playersCount: 20,
            metrixId: null,
          },
        ],
      }}
      onNavigate={() => {}}
    />,
  );

  assert.match(markup, /Current Year Open/);
  assert.doesNotMatch(markup, /Previous Year Open/);
});

test("CompetitionsPageView applies the missing-results filter together with the current date range", () => {
  const sessionStorage = createStorage();
  const previousWindow = globalThis.window;

  Object.defineProperty(globalThis, "window", {
    value: { sessionStorage },
    configurable: true,
    writable: true,
  });
  sessionStorage.setItem(
    competitionsWithoutResultsFilterStorageKey,
    JSON.stringify(true),
  );

  const markup = renderToStaticMarkup(
    <CompetitionsPageView
      state={{
        status: "ready",
        total: 3,
        categories: [],
        courses: [],
        courseNamesById: {},
        competitions: [
          {
            competitionId: "competition-current-without-results",
            competitionName: "Current Missing Results",
            competitionDate: `${currentYear}-05-10`,
            courseId: null,
            courseName: "Course A",
            categoryId: null,
            recordType: "4",
            playersCount: 24,
            metrixId: null,
            hasResults: false,
          },
          {
            competitionId: "competition-current-with-results",
            competitionName: "Current With Results",
            competitionDate: `${currentYear}-05-11`,
            courseId: null,
            courseName: "Course B",
            categoryId: null,
            recordType: "4",
            playersCount: 20,
            metrixId: null,
            hasResults: true,
          },
          {
            competitionId: "competition-previous-without-results",
            competitionName: "Previous Missing Results",
            competitionDate: `${currentYear - 1}-05-12`,
            courseId: null,
            courseName: "Course C",
            categoryId: null,
            recordType: "4",
            playersCount: 22,
            metrixId: null,
            hasResults: false,
          },
        ],
      }}
      onNavigate={() => {}}
    />,
  );

  try {
    assert.match(markup, /Current Missing Results/);
    assert.doesNotMatch(markup, /Current With Results/);
    assert.doesNotMatch(markup, /Previous Missing Results/);
    assert.match(markup, /type="checkbox"/);
    assert.match(markup, /checked=""/);
  } finally {
    Object.defineProperty(globalThis, "window", {
      value: previousWindow,
      configurable: true,
      writable: true,
    });
  }
});

test("CompetitionsPageView applies the category filter from session storage", () => {
  const sessionStorage = createStorage();
  const previousWindow = globalThis.window;

  Object.defineProperty(globalThis, "window", {
    value: { sessionStorage },
    configurable: true,
    writable: true,
  });
  sessionStorage.setItem(
    competitionsCategoryFilterStorageKey,
    JSON.stringify("category-pro"),
  );

  const markup = renderToStaticMarkup(
    <CompetitionsPageView
      state={{
        status: "ready",
        total: 2,
        categories: [
          {
            categoryId: "category-pro",
            name: "Про",
            description: "Профессиональная категория",
            competitionClass: "tournament",
            segmentsCount: 18,
            ratingGte: 900,
            ratingLt: 1000,
            coefficient: 1,
          },
          {
            categoryId: "category-am",
            name: "Любители",
            description: "Любительская категория",
            competitionClass: "league",
            segmentsCount: 18,
            ratingGte: 0,
            ratingLt: 899,
            coefficient: 1,
          },
        ],
        courses: [],
        courseNamesById: {},
        competitions: [
          {
            competitionId: "competition-pro",
            competitionName: "Pro Event",
            competitionDate: `${currentYear}-05-10`,
            courseId: null,
            courseName: "Course A",
            categoryId: "category-pro",
            recordType: "4",
            playersCount: 24,
            metrixId: null,
          },
          {
            competitionId: "competition-am",
            competitionName: "Am Event",
            competitionDate: `${currentYear}-05-11`,
            courseId: null,
            courseName: "Course B",
            categoryId: "category-am",
            recordType: "4",
            playersCount: 20,
            metrixId: null,
          },
        ],
      }}
      onNavigate={() => {}}
    />,
  );

  try {
    assert.match(markup, /Pro Event/);
    assert.doesNotMatch(markup, /Am Event/);
    assert.match(markup, /<option value="">Все категории<\/option>/);
    assert.match(markup, /<option value="category-pro" selected="">Про<\/option>/);
  } finally {
    Object.defineProperty(globalThis, "window", {
      value: previousWindow,
      configurable: true,
      writable: true,
    });
  }
});

test("CompetitionsPageView applies the uncategorized filter from session storage", () => {
  const sessionStorage = createStorage();
  const previousWindow = globalThis.window;

  Object.defineProperty(globalThis, "window", {
    value: { sessionStorage },
    configurable: true,
    writable: true,
  });
  sessionStorage.setItem(
    competitionsCategoryFilterStorageKey,
    JSON.stringify(UNCATEGORIZED_COMPETITION_FILTER_VALUE),
  );

  const markup = renderToStaticMarkup(
    <CompetitionsPageView
      state={{
        status: "ready",
        total: 2,
        categories: [
          {
            categoryId: "category-pro",
            name: "Про",
            description: "Профессиональная категория",
            competitionClass: "tournament",
            segmentsCount: 18,
            ratingGte: 900,
            ratingLt: 1000,
            coefficient: 1,
          },
        ],
        courses: [],
        courseNamesById: {},
        competitions: [
          {
            competitionId: "competition-uncategorized",
            competitionName: "No Category Event",
            competitionDate: `${currentYear}-05-10`,
            courseId: null,
            courseName: "Course A",
            categoryId: null,
            recordType: "4",
            playersCount: 24,
            metrixId: null,
          },
          {
            competitionId: "competition-pro",
            competitionName: "Pro Event",
            competitionDate: `${currentYear}-05-11`,
            courseId: null,
            courseName: "Course B",
            categoryId: "category-pro",
            recordType: "4",
            playersCount: 20,
            metrixId: null,
          },
        ],
      }}
      onNavigate={() => {}}
    />,
  );

  try {
    assert.match(markup, /No Category Event/);
    assert.doesNotMatch(markup, /Pro Event/);
    assert.match(markup, /<option value="__uncategorized__" selected="">Не указано<\/option>/);
  } finally {
    Object.defineProperty(globalThis, "window", {
      value: previousWindow,
      configurable: true,
      writable: true,
    });
  }
});

test("CompetitionsPageView renders human-readable record type labels", () => {
  const markup = renderToStaticMarkup(
    <CompetitionsPageView
      state={{
        status: "ready",
        total: 2,
        categories: [],
        courses: [],
        courseNamesById: {},
        competitions: [
          {
            competitionId: "competition-801",
            competitionName: "Single Round Event",
            competitionDate: "2026-06-01",
            courseId: null,
            courseName: "Course A",
            categoryId: null,
            recordType: "2",
            playersCount: 10,
            metrixId: null,
          },
          {
            competitionId: "competition-802",
            competitionName: "Main Event",
            competitionDate: "2026-06-02",
            courseId: null,
            courseName: "Course B",
            categoryId: null,
            recordType: "4",
            playersCount: 20,
            metrixId: null,
          },
        ],
      }}
      onNavigate={() => {}}
    />,
  );

  assert.match(markup, /Single round event/);
  assert.match(markup, /Event/);
});

test("CompetitionsPageView applies descending sort by season points from session storage", () => {
  const sessionStorage = createStorage();
  const previousWindow = globalThis.window;

  Object.defineProperty(globalThis, "window", {
    value: { sessionStorage },
    configurable: true,
    writable: true,
  });
  sessionStorage.setItem(
    competitionsSortStorageKey,
    JSON.stringify({
      field: "seasonPoints",
      direction: "desc",
    }),
  );

  const markup = renderToStaticMarkup(
    <CompetitionsPageView
      state={{
        status: "ready",
        total: 3,
        categories: [],
        courses: [],
        courseNamesById: {},
        competitions: [
          {
            competitionId: "competition-low",
            competitionName: "Low Points Open",
            competitionDate: `${currentYear}-05-10`,
            courseId: null,
            courseName: "Course A",
            categoryId: null,
            recordType: "4",
            playersCount: 30,
            metrixId: null,
            seasonPoints: 12.5,
          },
          {
            competitionId: "competition-none",
            competitionName: "No Points Open",
            competitionDate: `${currentYear}-05-11`,
            courseId: null,
            courseName: "Course B",
            categoryId: null,
            recordType: "4",
            playersCount: 30,
            metrixId: null,
            seasonPoints: null,
          },
          {
            competitionId: "competition-high",
            competitionName: "High Points Open",
            competitionDate: `${currentYear}-05-12`,
            courseId: null,
            courseName: "Course C",
            categoryId: null,
            recordType: "4",
            playersCount: 30,
            metrixId: null,
            seasonPoints: 98.25,
          },
        ],
      }}
      onNavigate={() => {}}
    />,
  );

  try {
    assert.match(markup, /Очки сезона ↓/);
    assert.ok(markup.indexOf("High Points Open") < markup.indexOf("Low Points Open"));
    assert.ok(markup.indexOf("Low Points Open") < markup.indexOf("No Points Open"));
  } finally {
    Object.defineProperty(globalThis, "window", {
      value: previousWindow,
      configurable: true,
      writable: true,
    });
  }
});

test("CompetitionsPageView applies ascending sort by course name from session storage", () => {
  const sessionStorage = createStorage();
  const previousWindow = globalThis.window;

  Object.defineProperty(globalThis, "window", {
    value: { sessionStorage },
    configurable: true,
    writable: true,
  });
  sessionStorage.setItem(
    competitionsSortStorageKey,
    JSON.stringify({
      field: "courseName",
      direction: "asc",
    }),
  );

  const markup = renderToStaticMarkup(
    <CompetitionsPageView
      state={{
        status: "ready",
        total: 3,
        categories: [],
        courses: [],
        courseNamesById: {},
        competitions: [
          {
            competitionId: "competition-z",
            competitionName: "Z Event",
            competitionDate: `${currentYear}-05-10`,
            courseId: null,
            courseName: "Zen Park",
            categoryId: null,
            recordType: "4",
            playersCount: 20,
            metrixId: null,
          },
          {
            competitionId: "competition-a",
            competitionName: "A Event",
            competitionDate: `${currentYear}-05-11`,
            courseId: null,
            courseName: "Alpha Park",
            categoryId: null,
            recordType: "4",
            playersCount: 20,
            metrixId: null,
          },
          {
            competitionId: "competition-m",
            competitionName: "M Event",
            competitionDate: `${currentYear}-05-12`,
            courseId: null,
            courseName: "Metro Park",
            categoryId: null,
            recordType: "4",
            playersCount: 20,
            metrixId: null,
          },
        ],
      }}
      onNavigate={() => {}}
    />,
  );

  try {
    assert.match(markup, /Парк \/ курс ↑/);
    assert.ok(markup.indexOf("A Event") < markup.indexOf("M Event"));
    assert.ok(markup.indexOf("M Event") < markup.indexOf("Z Event"));
  } finally {
    Object.defineProperty(globalThis, "window", {
      value: previousWindow,
      configurable: true,
      writable: true,
    });
  }
});

test("CompetitionsPageView renders category selector for authenticated user", () => {
  const markup = renderToStaticMarkup(
    <CompetitionsPageView
      state={{
        status: "ready",
        total: 1,
        categories: [
          {
            categoryId: "category-901",
            name: "Любители",
            description: "Любительская категория",
            competitionClass: "league",
            segmentsCount: 18,
            ratingGte: 0,
            ratingLt: 899,
            coefficient: 1,
          },
        ],
        courses: [],
        courseNamesById: {},
        competitions: [
          {
            competitionId: "competition-901",
            competitionName: "Winter Open",
            competitionDate: "2026-01-10",
            courseId: null,
            courseName: "Course A",
            categoryId: "category-901",
            recordType: "4",
            playersCount: 15,
            metrixId: null,
          },
        ],
      }}
      canEditCategory
      onNavigate={() => {}}
    />,
  );

  assert.match(markup, /<select/);
  assert.match(markup, /Не задана/);
  assert.match(markup, /Любители/);
  assert.match(markup, /Расставить категории соревнований/);
  assert.match(
    markup,
    /Расставит категории турнирам, которые попадают в текущие фильтры этой страницы/,
  );
});

test("CompetitionsPageView calculates segments from child rounds for event competitions", () => {
  const markup = renderToStaticMarkup(
    <CompetitionsPageView
      state={{
        status: "ready",
        total: 3,
        categories: [],
        courses: [
          {
            courseId: "course-parent",
            name: "Main Event Park",
            fullname: null,
            type: null,
            countryCode: "RU",
            area: "Moscow",
            ratingValue1: 900,
            ratingResult1: 60,
            ratingValue2: 930,
            ratingResult2: 57,
            coursePar: 58,
            basketsCount: 21,
          },
          {
            courseId: "course-round-1",
            name: "Round Park 1",
            fullname: null,
            type: null,
            countryCode: "RU",
            area: "Moscow",
            ratingValue1: null,
            ratingResult1: null,
            ratingValue2: null,
            ratingResult2: null,
            coursePar: 54,
            basketsCount: 18,
          },
          {
            courseId: "course-round-2",
            name: "Round Park 2",
            fullname: null,
            type: null,
            countryCode: "RU",
            area: "Moscow",
            ratingValue1: null,
            ratingResult1: null,
            ratingValue2: null,
            ratingResult2: null,
            coursePar: 60,
            basketsCount: 27,
          },
        ],
        courseNamesById: {
          "course-parent": "Main Event Park",
          "course-round-1": "Round Park 1",
          "course-round-2": "Round Park 2",
        },
        competitions: [
          {
            competitionId: "competition-parent",
            competitionName: "Main Event",
            competitionDate: "2026-07-12",
            courseId: "course-parent",
            courseName: null,
            categoryId: null,
            recordType: "4",
            playersCount: 48,
            metrixId: null,
          },
          {
            competitionId: "competition-round-1",
            competitionName: "Main Event Round 1",
            competitionDate: "2026-07-12",
            parentId: "competition-parent",
            courseId: "course-round-1",
            courseName: null,
            categoryId: null,
            recordType: "2",
            playersCount: 48,
            metrixId: null,
          },
          {
            competitionId: "competition-round-2",
            competitionName: "Main Event Round 2",
            competitionDate: "2026-07-12",
            parentId: "competition-parent",
            courseId: "course-round-2",
            courseName: null,
            categoryId: null,
            recordType: "2",
            playersCount: 48,
            metrixId: null,
          },
        ],
      }}
      onNavigate={() => {}}
    />,
  );

  assert.match(markup, /920\.0/);
  assert.match(markup, /45/);
});

test("CompetitionsPageView calculates segments from round children hidden in the table", () => {
  const markup = renderToStaticMarkup(
    <CompetitionsPageView
      state={{
        status: "ready",
        total: 1,
        categories: [],
        courses: [
          {
            courseId: "course-dunes",
            name: "Dunes 12, 9+ДР",
            fullname: null,
            type: null,
            countryCode: "RU",
            area: "Moscow",
            ratingValue1: null,
            ratingResult1: null,
            ratingValue2: null,
            ratingResult2: null,
            coursePar: 36,
            basketsCount: 12,
          },
        ],
        courseNamesById: {
          "course-dunes": "Dunes 12, 9+ДР",
        },
        competitions: [
          {
            competitionId: "competition-parent",
            competitionName: "League Event",
            competitionDate: "2026-07-12",
            courseId: "course-dunes",
            courseName: null,
            categoryId: null,
            recordType: "4",
            playersCount: 47,
            metrixId: null,
          },
        ],
        allCompetitions: [
          {
            competitionId: "competition-parent",
            competitionName: "League Event",
            competitionDate: "2026-07-12",
            courseId: "course-dunes",
            courseName: null,
            categoryId: null,
            recordType: "4",
            playersCount: 47,
            metrixId: null,
          },
          {
            competitionId: "competition-round-1",
            competitionName: "League Event Round 1",
            competitionDate: "2026-07-12",
            parentId: "competition-parent",
            courseId: "course-dunes",
            courseName: null,
            categoryId: null,
            recordType: "1",
            playersCount: 47,
            metrixId: null,
          },
          {
            competitionId: "competition-round-2",
            competitionName: "League Event Round 2",
            competitionDate: "2026-07-12",
            parentId: "competition-parent",
            courseId: "course-dunes",
            courseName: null,
            categoryId: null,
            recordType: "1",
            playersCount: 47,
            metrixId: null,
          },
        ],
      }}
      onNavigate={() => {}}
    />,
  );

  assert.match(markup, /24/);
});

test("hasCompetitionsWithoutResults detects competitions with missing results", () => {
  assert.equal(
    hasCompetitionsWithoutResults([
      {
        competitionId: "competition-with-results",
        competitionName: "Competition With Results",
        competitionDate: "2026-05-10",
        courseId: null,
        courseName: "Course A",
        categoryId: null,
        recordType: "4",
        playersCount: 24,
        metrixId: null,
        hasResults: true,
      },
      {
        competitionId: "competition-without-results",
        competitionName: "Competition Without Results",
        competitionDate: "2026-05-11",
        courseId: null,
        courseName: "Course B",
        categoryId: null,
        recordType: "4",
        playersCount: null,
        metrixId: null,
        hasResults: false,
      },
    ]),
    true,
  );
});

test("confirmAutoAssignCategories skips confirmation when all competitions have results", () => {
  let confirmCallsCount = 0;

  const isConfirmed = confirmAutoAssignCategories(
    [
      {
        competitionId: "competition-1001",
        competitionName: "Competition With Results",
        competitionDate: "2026-06-01",
        courseId: null,
        courseName: "Course A",
        categoryId: null,
        recordType: "4",
        playersCount: 32,
        metrixId: null,
        hasResults: true,
      },
    ],
    () => {
      confirmCallsCount += 1;
      return false;
    },
  );

  assert.equal(isConfirmed, true);
  assert.equal(confirmCallsCount, 0);
});

test("confirmAutoAssignCategories asks for confirmation when competitions without results exist", () => {
  let receivedMessage: string | null = null;

  const isConfirmed = confirmAutoAssignCategories(
    [
      {
        competitionId: "competition-1002",
        competitionName: "Competition Without Results",
        competitionDate: "2026-06-02",
        courseId: null,
        courseName: "Course A",
        categoryId: null,
        recordType: "4",
        playersCount: null,
        metrixId: null,
        hasResults: false,
      },
    ],
    (message) => {
      receivedMessage = message;
      return false;
    },
  );

  assert.equal(isConfirmed, false);
  assert.equal(
    receivedMessage,
    "есть соревнования без результатов. Продолжить?",
  );
});
