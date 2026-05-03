import assert from "node:assert/strict";
import test from "node:test";

import type {
  UpdateJobProgress,
  UpdateOperationResult,
  UpdatePeriod,
} from "@metrix-parser/shared-types";

import { createUpdateJobsService, type UpdateJobsRuntimeEnv } from "./update-jobs";
import type {
  PersistedUpdateJobCursor,
  PersistedUpdateJobRecord,
} from "../../../worker/src/persistence/update-jobs-repository";

class InMemoryUpdateJobsRepository {
  private records = new Map<string, PersistedUpdateJobRecord>();

  async insertJob(record: PersistedUpdateJobRecord): Promise<void> {
    this.records.set(record.jobId, { ...record });
  }

  async getJob(jobId: string): Promise<PersistedUpdateJobRecord | null> {
    return this.clone(this.records.get(jobId));
  }

  async getUserJob(jobId: string, userLogin: string): Promise<PersistedUpdateJobRecord | null> {
    const record = this.records.get(jobId);

    if (!record || record.userLogin !== userLogin) {
      return null;
    }

    return this.clone(record);
  }

  async updateJob(
    jobId: string,
    patch: Partial<PersistedUpdateJobRecord>,
  ): Promise<PersistedUpdateJobRecord> {
    return this.applyPatch(jobId, patch);
  }

  async updateClaimedJob(
    jobId: string,
    leaseToken: string,
    patch: Partial<PersistedUpdateJobRecord>,
  ): Promise<PersistedUpdateJobRecord> {
    const record = this.records.get(jobId);

    if (!record || record.processingLeaseToken !== leaseToken) {
      throw new Error("claim mismatch");
    }

    return this.applyPatch(jobId, patch);
  }

  async claimJob(
    jobId: string,
    leaseToken: string,
  ): Promise<PersistedUpdateJobRecord | null> {
    const record = this.records.get(jobId);

    if (
      !record ||
      record.processingLeaseToken !== null ||
      (record.status !== "accepted" && record.status !== "running")
    ) {
      return null;
    }

    const claimed = {
      ...record,
      processingLeaseToken: leaseToken,
    };
    this.records.set(jobId, claimed);

    return this.clone(claimed);
  }

  async findLatestActiveSystemJob(
    operation: PersistedUpdateJobRecord["operation"],
    period?: UpdatePeriod,
  ): Promise<PersistedUpdateJobRecord | null> {
    const matching = [...this.records.values()]
      .filter(
        (record) =>
          record.userLogin === null &&
          record.operation === operation &&
          (record.status === "accepted" || record.status === "running") &&
          this.hasSamePeriod(record.period, period),
      )
      .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt));

    return this.clone(matching[0]);
  }

  listJobs(): PersistedUpdateJobRecord[] {
    return [...this.records.values()].map((record) => this.clone(record)!);
  }

  private applyPatch(
    jobId: string,
    patch: Partial<PersistedUpdateJobRecord>,
  ): PersistedUpdateJobRecord {
    const current = this.records.get(jobId);
    if (!current) {
      throw new Error(`missing job ${jobId}`);
    }

    const next = {
      ...current,
      ...patch,
    };
    this.records.set(jobId, next);

    return this.clone(next)!;
  }

  private clone(
    record: PersistedUpdateJobRecord | undefined,
  ): PersistedUpdateJobRecord | null {
    if (!record) {
      return null;
    }

    return {
      ...record,
      period: record.period ? { ...record.period } : undefined,
      continuationCursor: record.continuationCursor
        ? ({ ...record.continuationCursor } as PersistedUpdateJobCursor)
        : null,
      result: record.result ? JSON.parse(JSON.stringify(record.result)) : null,
      progress: record.progress ? { ...record.progress } : null,
    };
  }

  private hasSamePeriod(left?: UpdatePeriod, right?: UpdatePeriod): boolean {
    if (!left && !right) {
      return true;
    }

    if (!left || !right) {
      return false;
    }

    return left.dateFrom === right.dateFrom && left.dateTo === right.dateTo;
  }
}

function createRuntimeEnv(): UpdateJobsRuntimeEnv {
  return {
    supabaseUrl: "https://supabase.example",
    supabaseServiceRoleKey: "service-role-key",
    discGolfMetrixBaseUrl: "https://discgolfmetrix.com",
    discGolfMetrixCountryCode: "RU",
    discGolfMetrixApiCode: "secret",
  };
}

function createExecutionEnv() {
  return {
    supabaseUrl: "https://supabase.example",
    supabaseServiceRoleKey: "service-role-key",
    discGolfMetrixBaseUrl: "https://discgolfmetrix.com",
    discGolfMetrixCountryCode: "RU",
    discGolfMetrixApiCode: "secret",
  };
}

function createResult(
  operation: PersistedUpdateJobRecord["operation"],
  finalStatus: UpdateOperationResult["finalStatus"] = "completed",
): UpdateOperationResult {
  return {
    operation,
    finalStatus,
    source: "runtime",
    message: `${operation} done`,
    requestedAt: "2026-04-16T10:00:00.000Z",
    finishedAt: "2026-04-16T10:00:01.000Z",
    summary: {
      found: 1,
      created: 1,
      updated: 0,
      skipped: 0,
      errors: 0,
    },
    issues: [],
    skipReasons: [],
  };
}

function createRecord(
  overrides: Partial<PersistedUpdateJobRecord> = {},
): PersistedUpdateJobRecord {
  return {
    jobId: overrides.jobId ?? "job-100",
    userLogin: overrides.userLogin ?? "admin",
    operation: overrides.operation ?? "players",
    status: overrides.status ?? "accepted",
    message: overrides.message ?? "accepted",
    requestedAt: overrides.requestedAt ?? "2026-04-16T10:00:00.000Z",
    startedAt: overrides.startedAt ?? null,
    finishedAt: overrides.finishedAt ?? null,
    period:
      overrides.period ??
      ({
        dateFrom: "2026-04-01",
        dateTo: "2026-04-14",
      } satisfies UpdatePeriod),
    overwriteExisting: overrides.overwriteExisting ?? false,
    pollPath: overrides.pollPath ?? "/updates/jobs/job-100",
    continuationCursor: overrides.continuationCursor ?? null,
    result: overrides.result ?? null,
    processingLeaseToken: overrides.processingLeaseToken ?? null,
    progress: overrides.progress ?? null,
  };
}

test("touchAcceptedUpdate claims a job so overlapping polls do not execute the same batch twice", async () => {
  const repository = new InMemoryUpdateJobsRepository();
  await repository.insertJob(createRecord());
  const waitUntilPromises: Promise<void>[] = [];
  let batchCalls = 0;
  let nextId = 1;
  const service = createUpdateJobsService({
    withRepository: async (_env, callback) =>
      callback(repository, createExecutionEnv()),
    runOperationBatch: async (command) => {
      batchCalls += 1;
      return {
        result: createResult(command.operation),
      };
    },
    createId: () => `lease-${nextId++}`,
  });

  await Promise.all([
    service.touchAcceptedUpdate("job-100", "admin", createRuntimeEnv(), {
      waitUntil(promise) {
        waitUntilPromises.push(promise as Promise<void>);
      },
    }),
    service.touchAcceptedUpdate("job-100", "admin", createRuntimeEnv(), {
      waitUntil(promise) {
        waitUntilPromises.push(promise as Promise<void>);
      },
    }),
  ]);
  await Promise.all(waitUntilPromises);

  const persisted = await repository.getJob("job-100");
  assert.equal(batchCalls, 1);
  assert.equal(persisted?.status, "completed");
  assert.equal(persisted?.processingLeaseToken, null);
});

test("background batch failures force the stored result to failed", async () => {
  const repository = new InMemoryUpdateJobsRepository();
  await repository.insertJob(
    createRecord({
      status: "running",
      startedAt: "2026-04-16T10:00:01.000Z",
      continuationCursor: { offset: 50 },
      result: createResult("players"),
    }),
  );
  const waitUntilPromises: Promise<void>[] = [];
  let nextId = 1;
  const service = createUpdateJobsService({
    withRepository: async (_env, callback) =>
      callback(repository, createExecutionEnv()),
    runOperationBatch: async () => {
      throw new Error("boom");
    },
    createId: () => `lease-${nextId++}`,
  });

  await service.touchAcceptedUpdate("job-100", "admin", createRuntimeEnv(), {
    waitUntil(promise) {
      waitUntilPromises.push(promise as Promise<void>);
    },
  });
  await Promise.all(waitUntilPromises);

  const persisted = await repository.getJob("job-100");
  assert.equal(persisted?.status, "failed");
  assert.equal(persisted?.result?.finalStatus, "failed");
  assert.equal(persisted?.processingLeaseToken, null);
});

test("touchAcceptedUpdate advances continuation jobs by one batch per poll", async () => {
  const repository = new InMemoryUpdateJobsRepository();
  await repository.insertJob(createRecord());
  const waitUntilPromises: Promise<void>[] = [];
  let batchCalls = 0;
  let nextId = 1;
  const service = createUpdateJobsService({
    withRepository: async (_env, callback) =>
      callback(repository, createExecutionEnv()),
    runOperationBatch: async (command, _env, cursor) => {
      batchCalls += 1;

      if (cursor?.offset === 250) {
        return {
          result: createResult(command.operation),
        };
      }

      return {
        result: createResult(command.operation),
        nextCursor: {
          offset: (cursor?.offset ?? 0) + 50,
        },
      };
    },
    createId: () => `lease-${nextId++}`,
  });

  await service.touchAcceptedUpdate("job-100", "admin", createRuntimeEnv(), {
    waitUntil(promise) {
      waitUntilPromises.push(promise as Promise<void>);
    },
  });
  await Promise.all(waitUntilPromises);

  const persisted = await repository.getJob("job-100");
  assert.equal(batchCalls, 1);
  assert.equal(persisted?.status, "running");
  assert.deepEqual(persisted?.continuationCursor, { offset: 50 });
  assert.equal(persisted?.processingLeaseToken, null);
  assert.equal(persisted?.result?.finalStatus, "completed");
});

test("touchAcceptedUpdate completes a continuation job across multiple polls", async () => {
  const repository = new InMemoryUpdateJobsRepository();
  await repository.insertJob(createRecord());
  let batchCalls = 0;
  let nextId = 1;
  const service = createUpdateJobsService({
    withRepository: async (_env, callback) =>
      callback(repository, createExecutionEnv()),
    runOperationBatch: async (command, _env, cursor) => {
      batchCalls += 1;

      if (cursor?.offset === 250) {
        return {
          result: createResult(command.operation),
        };
      }

      return {
        result: createResult(command.operation),
        nextCursor: {
          offset: (cursor?.offset ?? 0) + 50,
        },
      };
    },
    createId: () => `lease-${nextId++}`,
  });

  for (let index = 0; index < 6; index += 1) {
    const waitUntilPromises: Promise<void>[] = [];

    await service.touchAcceptedUpdate("job-100", "admin", createRuntimeEnv(), {
      waitUntil(promise) {
        waitUntilPromises.push(promise as Promise<void>);
      },
    });
    await Promise.all(waitUntilPromises);
  }

  const persisted = await repository.getJob("job-100");
  assert.equal(batchCalls, 6);
  assert.equal(persisted?.status, "completed");
  assert.equal(persisted?.continuationCursor, null);
  assert.equal(persisted?.processingLeaseToken, null);
  assert.equal(persisted?.result?.finalStatus, "completed");
});

test("touchAcceptedUpdate reclaims a stale continuation lease and resumes the job", async () => {
  const repository = new InMemoryUpdateJobsRepository();
  await repository.insertJob(
    createRecord({
      status: "running",
      startedAt: "2026-04-16T10:00:01.000Z",
      continuationCursor: { offset: 15 },
      processingLeaseToken: "stale-lease",
      progress: {
        phase: "running",
        message: "Игроки и результаты: обрабатываем batch 4, смещение 15.",
        batchIndex: 4,
        cursorOffset: 15,
        updatedAt: "2026-04-16T10:05:00.000Z",
      } satisfies UpdateJobProgress,
      result: createResult("players"),
    }),
  );
  const waitUntilPromises: Promise<void>[] = [];
  let batchCalls = 0;
  let nextId = 1;
  const realDateNow = Date.now;
  Date.now = () => Date.parse("2026-04-16T10:20:01.000Z");

  try {
    const service = createUpdateJobsService({
      withRepository: async (_env, callback) =>
        callback(repository, createExecutionEnv()),
      runOperationBatch: async (command, _env, cursor) => {
        batchCalls += 1;
        assert.equal(cursor?.offset, 15);

        return {
          result: createResult(command.operation),
        };
      },
      createId: () => `lease-${nextId++}`,
    });

    await service.touchAcceptedUpdate("job-100", "admin", createRuntimeEnv(), {
      waitUntil(promise) {
        waitUntilPromises.push(promise as Promise<void>);
      },
    });
    await Promise.all(waitUntilPromises);
  } finally {
    Date.now = realDateNow;
  }

  const persisted = await repository.getJob("job-100");
  assert.equal(batchCalls, 1);
  assert.equal(persisted?.status, "completed");
  assert.equal(persisted?.continuationCursor, null);
  assert.equal(persisted?.processingLeaseToken, null);
});

test("runScheduledUpdate creates a new job when an older active job belongs to a different day", async () => {
  const repository = new InMemoryUpdateJobsRepository();
  await repository.insertJob(
    createRecord({
      jobId: "job-old",
      userLogin: null,
      operation: "competitions",
      status: "running",
      startedAt: "2026-04-15T01:00:00.000Z",
      period: {
        dateFrom: "2026-04-14",
        dateTo: "2026-04-14",
      },
      continuationCursor: { offset: 100 },
      pollPath: "/updates/jobs/job-old",
    }),
  );
  let nextId = 1;
  const service = createUpdateJobsService({
    withRepository: async (_env, callback) =>
      callback(repository, createExecutionEnv()),
    runOperationBatch: async (command) => ({
      result: createResult(command.operation),
    }),
    createId: (prefix = "job") => `${prefix}-${nextId++}`,
  });

  const handled = await service.runScheduledUpdate(
    {
      cron: "0 1 * * *",
      scheduledTime: Date.UTC(2026, 3, 16, 1, 0, 0),
    },
    createRuntimeEnv(),
  );

  const jobs = repository.listJobs();
  const todaysJobs = jobs.filter(
    (record) =>
      record.period?.dateFrom === "2026-04-15" && record.period?.dateTo === "2026-04-15",
  );

  assert.equal(handled, true);
  assert.equal(jobs.length, 2);
  assert.equal(todaysJobs.length, 1);
  assert.equal(todaysJobs[0]?.jobId.startsWith("scheduled-competitions"), true);
});
