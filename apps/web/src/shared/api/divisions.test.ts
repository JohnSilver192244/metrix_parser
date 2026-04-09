import assert from "node:assert/strict";
import test from "node:test";

import {
  createDivision,
  deleteDivision,
  listDivisions,
  resolveDivisionsTotal,
  updateDivision,
} from "./divisions";

test("listDivisions reads data and meta from the backend envelope", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    ({
      ok: true,
      text: async () =>
        JSON.stringify({
          data: [
            {
              code: "MPO",
            },
            {
              code: "FPO",
            },
          ],
          meta: {
            count: 2,
          },
        }),
    }) as Response) as typeof globalThis.fetch;

  try {
    const envelope = await listDivisions();

    assert.equal(envelope.meta?.count, 2);
    assert.equal(envelope.data[0]?.code, "MPO");
    assert.equal(resolveDivisionsTotal(envelope.data, envelope.meta), 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("createDivision sends POST payload and returns created division", async () => {
  const originalFetch = globalThis.fetch;
  let capturedMethod = "";
  let capturedBody = "";

  globalThis.fetch = (async (_input, init) => {
    capturedMethod = String(init?.method ?? "");
    capturedBody = String(init?.body ?? "");

    return {
      ok: true,
      text: async () =>
        JSON.stringify({
          data: {
            code: "MA3",
          },
        }),
    } as Response;
  }) as typeof globalThis.fetch;

  try {
    const division = await createDivision({
      code: "MA3",
    });

    assert.equal(division.code, "MA3");
    assert.equal(capturedMethod, "POST");
    assert.equal(capturedBody, "{\"code\":\"MA3\"}");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("updateDivision sends PUT payload and returns updated division", async () => {
  const originalFetch = globalThis.fetch;
  let capturedMethod = "";
  let capturedBody = "";

  globalThis.fetch = (async (_input, init) => {
    capturedMethod = String(init?.method ?? "");
    capturedBody = String(init?.body ?? "");

    return {
      ok: true,
      text: async () =>
        JSON.stringify({
          data: {
            code: "MP50",
          },
        }),
    } as Response;
  }) as typeof globalThis.fetch;

  try {
    const division = await updateDivision({
      code: "MP40",
      nextCode: "MP50",
    });

    assert.equal(capturedMethod, "PUT");
    assert.equal(capturedBody, "{\"code\":\"MP40\",\"nextCode\":\"MP50\"}");
    assert.equal(division.code, "MP50");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("deleteDivision sends DELETE payload", async () => {
  const originalFetch = globalThis.fetch;
  let capturedMethod = "";
  let capturedBody = "";

  globalThis.fetch = (async (_input, init) => {
    capturedMethod = String(init?.method ?? "");
    capturedBody = String(init?.body ?? "");

    return {
      ok: true,
      text: async () => JSON.stringify({ data: null }),
    } as Response;
  }) as typeof globalThis.fetch;

  try {
    await deleteDivision("MA4");

    assert.equal(capturedMethod, "DELETE");
    assert.equal(capturedBody, "{\"code\":\"MA4\"}");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
