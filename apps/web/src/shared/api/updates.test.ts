import assert from "node:assert/strict";
import test from "node:test";

import type { UpdateJobStatusResponse } from "@metrix-parser/shared-types";

import { startUpdateJobStatusPolling } from "./updates";

test("startUpdateJobStatusPolling clears the latest recursive timer on cleanup", async () => {
  const timers = new Map<number, () => void>();
  let nextTimerId = 1;
  let requestCount = 0;

  const flushTimer = async (timerId: number) => {
    const callback = timers.get(timerId);
    if (!callback) {
      return;
    }

    timers.delete(timerId);
    callback();
    await Promise.resolve();
    await Promise.resolve();
  };

  const stop = startUpdateJobStatusPolling("job-100", {
    requestStatus: async () => {
      requestCount += 1;

      return {
        jobId: "job-100",
        operation: "players",
        state: "running",
        source: "runtime",
        message: "running",
        requestedAt: "2026-04-16T10:00:00.000Z",
        startedAt: "2026-04-16T10:00:01.000Z",
        pollPath: "/updates/jobs/job-100",
      } satisfies UpdateJobStatusResponse;
    },
    onStatus: () => {},
    onError: () => {
      assert.fail("polling should not fail");
    },
    schedule: (callback) => {
      const timerId = nextTimerId++;
      timers.set(timerId, callback);
      return timerId as unknown as ReturnType<typeof setTimeout>;
    },
    clear: (timerId) => {
      timers.delete(timerId as unknown as number);
    },
  });

  assert.deepEqual([...timers.keys()], [1]);
  await flushTimer(1);
  assert.equal(requestCount, 1);
  assert.deepEqual([...timers.keys()], [2]);

  stop();
  assert.equal(timers.has(2), false);
  await flushTimer(2);
  assert.equal(requestCount, 1);
});
