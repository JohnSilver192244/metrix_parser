import assert from "node:assert/strict";
import test from "node:test";

import { listCourses, resolveCoursesTotal } from "./courses";

test("listCourses reads data and meta from the backend envelope", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    ({
      ok: true,
      text: async () =>
        JSON.stringify({
          data: [
            {
              courseId: "course-900",
              name: "Luzhniki Park",
              fullname: "Luzhniki Disc Golf Park",
              type: "18 holes",
              countryCode: "RU",
              area: "Moscow",
              ratingValue1: 4.8,
              ratingResult1: 16,
              ratingValue2: 4.6,
              ratingResult2: 11,
              coursePar: 63,
            },
          ],
          meta: {
            count: 1,
          },
        }),
    }) as Response) as typeof globalThis.fetch;

  try {
    const envelope = await listCourses();

    assert.equal(envelope.meta?.count, 1);
    assert.equal(envelope.data[0]?.courseId, "course-900");
    assert.equal(envelope.data[0]?.coursePar, 63);
    assert.equal(resolveCoursesTotal(envelope.data, envelope.meta), 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
