import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveRecordAction,
  type UpdateRecordResult,
} from "@metrix-parser/shared-types";

import { executeUpdatePlan } from "./update-execution";

test("resolveRecordAction distinguishes create vs update semantics", () => {
  assert.equal(resolveRecordAction(false), "created");
  assert.equal(resolveRecordAction(true), "updated");
});

test("executeUpdatePlan keeps processing valid records after a bad record", async () => {
  const result = await executeUpdatePlan({
    operation: "players",
    message: "demo",
    requestedAt: "2026-03-21T10:00:00.000Z",
    items: [
      { recordKey: "player-1", payload: { matchedExisting: false } },
      { recordKey: "player-bad", payload: { matchedExisting: false, invalid: true } },
      { recordKey: "player-2", payload: { matchedExisting: true } },
    ],
    processItem: (item): UpdateRecordResult => {
      if (item.payload.invalid) {
        throw new Error(`Cannot process ${item.recordKey}`);
      }

      return {
        action: resolveRecordAction(item.payload.matchedExisting),
        matchedExisting: item.payload.matchedExisting,
      };
    },
  });

  assert.equal(result.finalStatus, "completed_with_issues");
  assert.deepEqual(result.summary, {
    found: 3,
    created: 1,
    updated: 1,
    skipped: 1,
    errors: 1,
  });
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0]?.recordKey, "player-bad");
});

test("executeUpdatePlan supports bounded concurrency without changing summary accounting", async () => {
  const started: string[] = [];
  const completed: string[] = [];

  const result = await executeUpdatePlan({
    operation: "players",
    message: "demo",
    requestedAt: "2026-03-21T10:00:00.000Z",
    concurrency: 2,
    items: [
      { recordKey: "player-1", payload: { matchedExisting: false, delayMs: 20 } },
      { recordKey: "player-2", payload: { matchedExisting: true, delayMs: 5 } },
      { recordKey: "player-3", payload: { matchedExisting: false, delayMs: 0 } },
    ],
    processItem: async (item): Promise<UpdateRecordResult> => {
      started.push(item.recordKey);
      await new Promise((resolve) => setTimeout(resolve, item.payload.delayMs));
      completed.push(item.recordKey);

      return {
        action: resolveRecordAction(item.payload.matchedExisting),
        matchedExisting: item.payload.matchedExisting,
      };
    },
  });

  assert.deepEqual(result.summary, {
    found: 3,
    created: 2,
    updated: 1,
    skipped: 0,
    errors: 0,
  });
  assert.deepEqual(started.slice(0, 2), ["player-1", "player-2"]);
  assert.equal(completed.includes("player-3"), true);
});
