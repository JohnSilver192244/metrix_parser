import assert from "node:assert/strict";
import test from "node:test";

import {
  createTournamentCategory,
  deleteTournamentCategory,
  listTournamentCategories,
  resolveTournamentCategoriesTotal,
  updateTournamentCategory,
} from "./tournament-categories";

test("listTournamentCategories reads data and meta from the backend envelope", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    ({
      ok: true,
      text: async () =>
        JSON.stringify({
          data: [
            {
              categoryId: "category-100",
              name: "Парковые турниры",
              description: "Категория для базовых парковых турниров.",
              segmentsCount: 18,
              ratingGte: 72.5,
              ratingLt: 84.3,
              coefficient: 1.15,
            },
          ],
          meta: {
            count: 1,
          },
        }),
    }) as Response) as typeof globalThis.fetch;

  try {
    const envelope = await listTournamentCategories();

    assert.equal(envelope.meta?.count, 1);
    assert.equal(envelope.data[0]?.categoryId, "category-100");
    assert.equal(envelope.data[0]?.segmentsCount, 18);
    assert.equal(envelope.data[0]?.ratingGte, 72.5);
    assert.equal(envelope.data[0]?.ratingLt, 84.3);
    assert.equal(envelope.data[0]?.coefficient, 1.15);
    assert.equal(resolveTournamentCategoriesTotal(envelope.data, envelope.meta), 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("createTournamentCategory sends payload to the backend", async () => {
  const originalFetch = globalThis.fetch;
  let requestInit: RequestInit | undefined;

  globalThis.fetch = (async (_, init) => {
    requestInit = init;

    return {
      ok: true,
      text: async () =>
        JSON.stringify({
          data: {
            categoryId: "category-100",
            name: "Любительские",
            description: "Турниры для любителей.",
            segmentsCount: 18,
            ratingGte: 70,
            ratingLt: 84.3,
            coefficient: 1.1,
          },
        }),
    } as Response;
  }) as typeof globalThis.fetch;

  try {
    const category = await createTournamentCategory({
      name: "Любительские",
      description: "Турниры для любителей.",
      segmentsCount: 18,
      ratingGte: 70,
      ratingLt: 84.3,
      coefficient: 1.1,
    });

    assert.equal(requestInit?.method, "POST");
    assert.equal(
      requestInit?.body,
      JSON.stringify({
        name: "Любительские",
        description: "Турниры для любителей.",
        segmentsCount: 18,
        ratingGte: 70,
        ratingLt: 84.3,
        coefficient: 1.1,
      }),
    );
    assert.equal(category.name, "Любительские");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("updateTournamentCategory sends payload to the backend", async () => {
  const originalFetch = globalThis.fetch;
  let requestInit: RequestInit | undefined;

  globalThis.fetch = (async (_, init) => {
    requestInit = init;

    return {
      ok: true,
      text: async () =>
        JSON.stringify({
          data: {
            categoryId: "category-100",
            name: "Профессиональные",
            description: "Сложные турниры.",
            segmentsCount: 21,
            ratingGte: 84.3,
            ratingLt: 999,
            coefficient: 1.25,
          },
        }),
    } as Response;
  }) as typeof globalThis.fetch;

  try {
    const category = await updateTournamentCategory({
      categoryId: "category-100",
      name: "Профессиональные",
      description: "Сложные турниры.",
      segmentsCount: 21,
      ratingGte: 84.3,
      ratingLt: 999,
      coefficient: 1.25,
    });

    assert.equal(requestInit?.method, "PUT");
    assert.equal(
      requestInit?.body,
      JSON.stringify({
        categoryId: "category-100",
        name: "Профессиональные",
        description: "Сложные турниры.",
        segmentsCount: 21,
        ratingGte: 84.3,
        ratingLt: 999,
        coefficient: 1.25,
      }),
    );
    assert.equal(category.segmentsCount, 21);
    assert.equal(category.ratingGte, 84.3);
    assert.equal(category.ratingLt, 999);
    assert.equal(category.coefficient, 1.25);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("deleteTournamentCategory sends delete request with category id", async () => {
  const originalFetch = globalThis.fetch;
  let requestInit: RequestInit | undefined;

  globalThis.fetch = (async (_, init) => {
    requestInit = init;

    return {
      ok: true,
      text: async () => JSON.stringify({ data: null }),
    } as Response;
  }) as typeof globalThis.fetch;

  try {
    await deleteTournamentCategory("category-300");

    assert.equal(requestInit?.method, "DELETE");
    assert.equal(requestInit?.body, JSON.stringify({ categoryId: "category-300" }));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
