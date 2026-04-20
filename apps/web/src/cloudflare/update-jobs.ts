import {
  createEmptyUpdateSummary,
  createUpdateIssue,
  resolveUpdateFinalStatus,
  type AcceptedUpdateOperation,
  type UpdateJobProgress,
  type UpdateDiagnostics,
  type UpdateDiagnosticsSection,
  type UpdateJobStatusResponse,
  type UpdateOperation,
  type UpdateOperationResult,
  type UpdatePeriod,
  type UpdateResultSource,
} from "@metrix-parser/shared-types";

import { invalidateApiReadCacheAfterBackgroundRecompute } from "../../../api/src/lib/api-read-cache";
import type {
  AcceptedUpdateCommand,
  UpdatesRouteDependencies,
} from "../../../api/src/modules/updates";
import { executeCompetitionsUpdate } from "../../../worker/src/orchestration/competitions-update";
import { runCoursesUpdateJob } from "../../../worker/src/jobs/courses-update-job";
import { runPlayersUpdateJob } from "../../../worker/src/jobs/players-update-job";
import { runResultsPipelineUpdateJob } from "../../../worker/src/jobs/results-pipeline-update-job";
import { runWithWorkerEnv } from "../../../worker/src/config/env";
import {
  createUpdateJobsRepository,
  type PersistedUpdateJobCursor,
  type PersistedUpdateJobRecord,
} from "../../../worker/src/persistence/update-jobs-repository";

const UPDATE_JOB_POLL_PATH_PREFIX = "/updates/jobs";
const SCHEDULED_MAX_BATCHES_PER_INVOCATION = 25;
const OPERATION_PROGRESS_TITLES: Record<UpdateOperation, string> = {
  competitions: "Соревнования",
  courses: "Парки",
  players: "Игроки и результаты",
  results: "Результаты",
};

export const CLOUDFLARE_UPDATE_CRON_SPECS = [
  { cron: "0 1 * * *", operation: "competitions" as const },
  { cron: "30 1 * * *", operation: "courses" as const },
  { cron: "0 2 * * *", operation: "players" as const },
] as const;

export interface UpdateJobsRuntimeEnv {
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  discGolfMetrixBaseUrl?: string;
  discGolfMetrixCountryCode?: string;
  discGolfMetrixApiCode?: string;
}

export interface UpdateExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
}

export interface ScheduledControllerLike {
  cron: string;
  scheduledTime: number;
}

interface ResolvedUpdateJobsRuntimeEnv {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  discGolfMetrixBaseUrl: string;
  discGolfMetrixCountryCode: string;
  discGolfMetrixApiCode: string;
}

interface BatchExecutionResult {
  result: UpdateOperationResult;
  nextCursor?: PersistedUpdateJobCursor;
}

interface UpdateJobsRepository {
  insertJob(record: PersistedUpdateJobRecord): Promise<void>;
  getJob(jobId: string): Promise<PersistedUpdateJobRecord | null>;
  getUserJob(jobId: string, userLogin: string): Promise<PersistedUpdateJobRecord | null>;
  updateJob(
    jobId: string,
    patch: Partial<PersistedUpdateJobRecord>,
  ): Promise<PersistedUpdateJobRecord>;
  updateClaimedJob(
    jobId: string,
    leaseToken: string,
    patch: Partial<PersistedUpdateJobRecord>,
  ): Promise<PersistedUpdateJobRecord>;
  claimJob(jobId: string, leaseToken: string): Promise<PersistedUpdateJobRecord | null>;
  findLatestActiveSystemJob(
    operation: PersistedUpdateJobRecord["operation"],
    period?: UpdatePeriod,
  ): Promise<PersistedUpdateJobRecord | null>;
}

interface UpdateJobsServiceDependencies {
  withRepository?: (
    env: UpdateJobsRuntimeEnv,
    callback: (
      repository: UpdateJobsRepository,
      executionEnv: ResolvedUpdateJobsRuntimeEnv,
    ) => Promise<unknown>,
  ) => Promise<unknown>;
  runOperationBatch?: (
    command: AcceptedUpdateCommand,
    env: ResolvedUpdateJobsRuntimeEnv,
    cursor: PersistedUpdateJobCursor | null,
  ) => Promise<BatchExecutionResult>;
  invalidateReadCache?: () => void;
  createId?: (prefix?: string) => string;
}

function createPollPath(jobId: string): string {
  return `${UPDATE_JOB_POLL_PATH_PREFIX}/${jobId}`;
}

function createJobId(prefix = "update-job"): string {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}`;
}

function createJobProgress(
  phase: UpdateJobProgress["phase"],
  message: string,
  batchIndex?: number,
  cursorOffset?: number,
): UpdateJobProgress {
  return {
    phase,
    message,
    batchIndex,
    cursorOffset,
    updatedAt: new Date().toISOString(),
  };
}

function describeBatchProgress(
  operation: UpdateOperation,
  phase: UpdateJobProgress["phase"],
  batchIndex: number,
  cursorOffset?: number,
): string {
  const title = OPERATION_PROGRESS_TITLES[operation];

  if (phase === "queued") {
    return `${title}: операция принята в очередь.`;
  }

  if (phase === "running") {
    const offsetSuffix =
      typeof cursorOffset === "number" ? `, смещение ${cursorOffset}` : "";
    return `${title}: обрабатываем batch ${batchIndex}${offsetSuffix}.`;
  }

  if (phase === "continuing") {
    const offsetSuffix =
      typeof cursorOffset === "number" ? ` со смещения ${cursorOffset}` : "";
    return `${title}: batch ${batchIndex} завершён, продолжаем${offsetSuffix}.`;
  }

  if (phase === "finalizing") {
    return `${title}: завершаем обновление после batch ${batchIndex}.`;
  }

  return `${title}: обновление завершилось с ошибкой.`;
}

function requireExecutionEnv(env: UpdateJobsRuntimeEnv): ResolvedUpdateJobsRuntimeEnv {
  if (
    !env.supabaseUrl ||
    !env.supabaseServiceRoleKey ||
    !env.discGolfMetrixBaseUrl ||
    !env.discGolfMetrixCountryCode ||
    !env.discGolfMetrixApiCode
  ) {
    throw new Error("Unified Cloudflare update runtime env is incomplete.");
  }

  return {
    supabaseUrl: env.supabaseUrl,
    supabaseServiceRoleKey: env.supabaseServiceRoleKey,
    discGolfMetrixBaseUrl: env.discGolfMetrixBaseUrl,
    discGolfMetrixCountryCode: env.discGolfMetrixCountryCode,
    discGolfMetrixApiCode: env.discGolfMetrixApiCode,
  };
}

function withRepository<T>(
  env: UpdateJobsRuntimeEnv,
  callback: (
    repository: ReturnType<typeof createUpdateJobsRepository>,
    executionEnv: ResolvedUpdateJobsRuntimeEnv,
  ) => Promise<T>,
): Promise<T> {
  const executionEnv = requireExecutionEnv(env);

  return runWithWorkerEnv(executionEnv, async () => {
    const repository = createUpdateJobsRepository();
    return callback(repository, executionEnv);
  });
}

function toAcceptedResponse(record: PersistedUpdateJobRecord): AcceptedUpdateOperation {
  return {
    jobId: record.jobId,
    operation: record.operation,
    state: "accepted",
    source: "runtime",
    message: record.message,
    requestedAt: record.requestedAt,
    period: record.period,
    pollPath: record.pollPath,
    progress: record.progress ?? undefined,
  };
}

function toStatusResponse(record: PersistedUpdateJobRecord): UpdateJobStatusResponse {
  const base = {
    jobId: record.jobId,
    operation: record.operation,
    source: "runtime" as UpdateResultSource,
    message: record.message,
    requestedAt: record.requestedAt,
    period: record.period,
    pollPath: record.pollPath,
    progress: record.progress ?? undefined,
  };

  if (record.status === "accepted") {
    return {
      ...base,
      state: "accepted",
    };
  }

  if (record.status === "running") {
    return {
      ...base,
      state: "running",
      startedAt: record.startedAt ?? record.requestedAt,
    };
  }

  return {
    ...base,
    state: record.status,
    startedAt: record.startedAt ?? record.requestedAt,
    finishedAt: record.finishedAt ?? record.requestedAt,
    result: record.result ?? createUnexpectedFailure(record.operation, record.requestedAt),
    progress: record.progress ?? undefined,
  };
}

function createUnexpectedFailure(
  operation: UpdateOperation,
  requestedAt: string,
): UpdateOperationResult {
  const finishedAt = new Date().toISOString();

  return {
    operation,
    finalStatus: "failed",
    source: "runtime",
    message: "Фоновое обновление завершилось с необработанной ошибкой.",
    requestedAt,
    finishedAt,
    issues: [
      createUpdateIssue({
        code: "background_update_failed",
        message: "Фоновое обновление завершилось с необработанной ошибкой.",
        recoverable: true,
        stage: "persistence",
      }),
    ],
  };
}

function mergeDiagnosticsSection(
  previous?: UpdateDiagnosticsSection,
  next?: UpdateDiagnosticsSection,
): UpdateDiagnosticsSection | undefined {
  if (!previous) {
    return next;
  }

  if (!next) {
    return previous;
  }

  return {
    summary: {
      found: previous.summary.found + next.summary.found,
      created: previous.summary.created + next.summary.created,
      updated: previous.summary.updated + next.summary.updated,
      skipped: previous.summary.skipped + next.summary.skipped,
      errors: previous.summary.errors + next.summary.errors,
    },
    issues: [...previous.issues, ...next.issues],
  };
}

function mergeDiagnostics(
  previous?: UpdateDiagnostics,
  next?: UpdateDiagnostics,
): UpdateDiagnostics | undefined {
  if (!previous) {
    return next;
  }

  if (!next) {
    return previous;
  }

  return {
    transport: mergeDiagnosticsSection(previous.transport, next.transport),
    players: mergeDiagnosticsSection(previous.players, next.players),
    results: mergeDiagnosticsSection(previous.results, next.results),
  };
}

function mergeResults(
  previous: UpdateOperationResult | null,
  next: UpdateOperationResult,
): UpdateOperationResult {
  if (!previous) {
    return next;
  }

  const mergedSummary = {
    ...(previous.summary ?? createEmptyUpdateSummary()),
  };
  const nextSummary = next.summary ?? createEmptyUpdateSummary();
  mergedSummary.found += nextSummary.found;
  mergedSummary.created += nextSummary.created;
  mergedSummary.updated += nextSummary.updated;
  mergedSummary.skipped += nextSummary.skipped;
  mergedSummary.errors += nextSummary.errors;

  return {
    operation: next.operation,
    finalStatus: resolveUpdateFinalStatus(mergedSummary),
    source: "runtime",
    message: next.message,
    requestedAt: previous.requestedAt,
    finishedAt: next.finishedAt,
    summary: mergedSummary,
    issues: [...previous.issues, ...next.issues],
    skipReasons: [...(previous.skipReasons ?? []), ...(next.skipReasons ?? [])],
    diagnostics: mergeDiagnostics(previous.diagnostics, next.diagnostics),
    period: next.period ?? previous.period,
  };
}

function forceFailedResult(result: UpdateOperationResult): UpdateOperationResult {
  return result.finalStatus === "failed" ? result : { ...result, finalStatus: "failed" };
}

async function executeRuntimeOperationBatch(
  command: AcceptedUpdateCommand,
  env: ResolvedUpdateJobsRuntimeEnv,
  cursor: PersistedUpdateJobCursor | null,
): Promise<BatchExecutionResult> {
  if (command.operation === "competitions") {
    return {
      result: await executeCompetitionsUpdate(
        command.period as UpdatePeriod,
        command.overwriteExisting,
        env,
      ),
    };
  }

  if (command.operation === "courses") {
    const result = await runCoursesUpdateJob({
      baseUrl: env.discGolfMetrixBaseUrl,
      countryCode: env.discGolfMetrixCountryCode,
      apiCode: env.discGolfMetrixApiCode,
      overwriteExisting: command.overwriteExisting,
      courseIdOffset: cursor?.offset ?? 0,
    });

    return {
      result,
      nextCursor:
        typeof result.nextCourseIdOffset === "number"
          ? { offset: result.nextCourseIdOffset }
          : undefined,
    };
  }

  if (command.operation === "players") {
    const result = await runPlayersUpdateJob(command.period as UpdatePeriod, {
      baseUrl: env.discGolfMetrixBaseUrl,
      countryCode: env.discGolfMetrixCountryCode,
      apiCode: env.discGolfMetrixApiCode,
      overwriteExisting: command.overwriteExisting,
      selectionOffset: cursor?.offset ?? 0,
    });

    return {
      result,
      nextCursor:
        typeof result.nextSelectionOffset === "number"
          ? { offset: result.nextSelectionOffset }
          : undefined,
    };
  }

  const result = await runResultsPipelineUpdateJob(command.period as UpdatePeriod, {
    baseUrl: env.discGolfMetrixBaseUrl,
    countryCode: env.discGolfMetrixCountryCode,
    apiCode: env.discGolfMetrixApiCode,
    overwriteExisting: command.overwriteExisting,
    selectionOffset: cursor?.offset ?? 0,
  });

  return {
    result,
    nextCursor:
      typeof result.nextSelectionOffset === "number"
        ? { offset: result.nextSelectionOffset }
        : undefined,
  };
}

function scheduleBackground(
  promise: Promise<void>,
  ctx?: UpdateExecutionContextLike,
): void {
  if (ctx) {
    ctx.waitUntil(promise);
    return;
  }

  void promise;
}

function createAcceptedMessage(operation: UpdateOperation): string {
  return `Операция ${operation} принята в Cloudflare background queue. Используйте polling status вместо ожидания полного ответа запроса.`;
}

function toUtcDate(value: number): string {
  return new Date(value).toISOString().slice(0, 10);
}

function resolvePreviousUtcDayPeriod(scheduledTime: number): UpdatePeriod {
  const dayMs = 24 * 60 * 60 * 1000;
  const previousDay = scheduledTime - dayMs;
  const date = toUtcDate(previousDay);

  return {
    dateFrom: date,
    dateTo: date,
  };
}

export function createUpdateJobsService(
  dependencies: UpdateJobsServiceDependencies = {},
) {
  const runBatch = dependencies.runOperationBatch ?? executeRuntimeOperationBatch;
  const createId = dependencies.createId ?? createJobId;
  const invalidateReadCache =
    dependencies.invalidateReadCache ?? (() => invalidateApiReadCacheAfterBackgroundRecompute({}));
  const useWithRepository =
    dependencies.withRepository ??
    (async (
      env: UpdateJobsRuntimeEnv,
      callback: (
        repository: UpdateJobsRepository,
        executionEnv: ResolvedUpdateJobsRuntimeEnv,
      ) => Promise<unknown>,
    ) =>
      withRepository(env, (repository, executionEnv) =>
        callback(repository, executionEnv),
      ));

  async function processPersistedJob(
    record: PersistedUpdateJobRecord,
    env: UpdateJobsRuntimeEnv,
  ): Promise<void> {
    let currentRecord = record;

    for (let batchIndex = 0; batchIndex < SCHEDULED_MAX_BATCHES_PER_INVOCATION; batchIndex += 1) {
      const nextRecord = (await useWithRepository(env, async (repository, executionEnv) => {
        const leaseToken = createId("lease");
        const claimedRecord = await repository.claimJob(currentRecord.jobId, leaseToken);

        if (!claimedRecord) {
          return null;
        }

        if (
          claimedRecord.status !== "accepted" &&
          !(claimedRecord.status === "running" && claimedRecord.continuationCursor)
        ) {
          await repository.updateClaimedJob(currentRecord.jobId, leaseToken, {
            processingLeaseToken: null,
          });
          return null;
        }

        const command: AcceptedUpdateCommand = {
          operation: claimedRecord.operation,
          period: claimedRecord.period,
          overwriteExisting: claimedRecord.overwriteExisting,
          userLogin: claimedRecord.userLogin ?? "",
        };

        const runningRecord =
          claimedRecord.status === "running" && claimedRecord.startedAt
            ? claimedRecord
            : await repository.updateClaimedJob(currentRecord.jobId, leaseToken, {
                status: "running",
                startedAt: claimedRecord.startedAt ?? new Date().toISOString(),
                message: `Фоновое обновление ${claimedRecord.operation} выполняется в unified Cloudflare runtime.`,
              });

        const nextBatchIndex = (runningRecord.progress?.batchIndex ?? 0) + 1;
        const runningProgress = createJobProgress(
          "running",
          describeBatchProgress(
            claimedRecord.operation,
            "running",
            nextBatchIndex,
            runningRecord.continuationCursor?.offset,
          ),
          nextBatchIndex,
          runningRecord.continuationCursor?.offset,
        );
        const activeRecord = await repository.updateClaimedJob(currentRecord.jobId, leaseToken, {
          message: runningProgress.message,
          progress: runningProgress,
        });

        try {
          const batch = await runBatch(
            command,
            executionEnv,
            activeRecord.continuationCursor,
          );
          const mergedResult = mergeResults(activeRecord.result, batch.result);

          if (batch.nextCursor) {
            const continuationProgress = createJobProgress(
              "continuing",
              describeBatchProgress(
                claimedRecord.operation,
                "continuing",
                nextBatchIndex,
                batch.nextCursor.offset,
              ),
              nextBatchIndex,
              batch.nextCursor.offset,
            );
            await repository.updateClaimedJob(currentRecord.jobId, leaseToken, {
              status: "running",
              continuationCursor: batch.nextCursor,
              message: continuationProgress.message,
              result: mergedResult,
              progress: continuationProgress,
              processingLeaseToken: null,
            });

            return repository.getJob(currentRecord.jobId);
          }

          const finalizingProgress = createJobProgress(
            "finalizing",
            describeBatchProgress(claimedRecord.operation, "finalizing", nextBatchIndex),
            nextBatchIndex,
          );
          await repository.updateClaimedJob(currentRecord.jobId, leaseToken, {
            status: mergedResult.finalStatus,
            continuationCursor: null,
            message: mergedResult.message,
            finishedAt: mergedResult.finishedAt,
            result: mergedResult,
            progress: finalizingProgress,
            processingLeaseToken: null,
          });
          invalidateReadCache();
          return null;
        } catch {
          const failedProgress = createJobProgress(
            "failed",
            describeBatchProgress(claimedRecord.operation, "failed", nextBatchIndex),
            nextBatchIndex,
          );
          const failure = forceFailedResult(
            mergeResults(
              activeRecord.result,
              createUnexpectedFailure(record.operation, activeRecord.requestedAt),
            ),
          );
          await repository.updateClaimedJob(currentRecord.jobId, leaseToken, {
            status: "failed",
            continuationCursor: null,
            message: failure.message,
            finishedAt: failure.finishedAt,
            result: failure,
            progress: failedProgress,
            processingLeaseToken: null,
          });
          return null;
        }
      })) as PersistedUpdateJobRecord | null;

      if (!nextRecord || nextRecord.status !== "running" || !nextRecord.continuationCursor) {
        return;
      }

      currentRecord = nextRecord;
    }
  }

  async function ensureScheduledJob(
    operation: UpdateOperation,
    scheduledTime: number,
    env: UpdateJobsRuntimeEnv,
  ): Promise<PersistedUpdateJobRecord> {
    const scheduledPeriod = resolvePreviousUtcDayPeriod(scheduledTime);

    return useWithRepository(env, async (repository) => {
      const existing = await repository.findLatestActiveSystemJob(operation, scheduledPeriod);
      if (existing) {
        return existing;
      }

      const requestedAt = new Date().toISOString();
      const jobId = createId(`scheduled-${operation}`);
      const record: PersistedUpdateJobRecord = {
        jobId,
        userLogin: null,
        operation,
        status: "accepted",
        message: `Scheduled ${operation} update is queued in the unified Cloudflare runtime.`,
        requestedAt,
        startedAt: null,
        finishedAt: null,
        period: scheduledPeriod,
        overwriteExisting: false,
        pollPath: createPollPath(jobId),
        continuationCursor: null,
        result: null,
        processingLeaseToken: null,
        progress: createJobProgress(
          "queued",
          describeBatchProgress(operation, "queued", 0),
        ),
      };

      await repository.insertJob(record);
      return record;
    }) as Promise<PersistedUpdateJobRecord>;
  }

  return {
    async enqueueAcceptedUpdate(
      command: AcceptedUpdateCommand,
      env: UpdateJobsRuntimeEnv,
      ctx?: UpdateExecutionContextLike,
    ): Promise<AcceptedUpdateOperation> {
      const requestedAt = new Date().toISOString();
      const jobId = createId();

      const record: PersistedUpdateJobRecord = {
        jobId,
        userLogin: command.userLogin,
        operation: command.operation,
        status: "accepted",
        message: createAcceptedMessage(command.operation),
        requestedAt,
        startedAt: null,
        finishedAt: null,
        period: command.period,
        overwriteExisting: command.overwriteExisting,
        pollPath: createPollPath(jobId),
        continuationCursor: null,
        result: null,
        processingLeaseToken: null,
        progress: createJobProgress(
          "queued",
          describeBatchProgress(command.operation, "queued", 0),
        ),
      };

      await useWithRepository(env, async (repository) => {
        await repository.insertJob(record);
      });
      scheduleBackground(processPersistedJob(record, env), ctx);

      return toAcceptedResponse(record);
    },

    async touchAcceptedUpdate(
      jobId: string,
      userLogin: string,
      env: UpdateJobsRuntimeEnv,
      ctx?: UpdateExecutionContextLike,
    ): Promise<void> {
      const job = (await useWithRepository(env, async (repository) =>
        repository.getUserJob(jobId, userLogin),
      )) as PersistedUpdateJobRecord | null;

      if (!job) {
        return;
      }

      if (job.status !== "accepted" && !(job.status === "running" && job.continuationCursor)) {
        return;
      }

      scheduleBackground(processPersistedJob(job, env), ctx);
    },

    async readAcceptedUpdateStatus(
      jobId: string,
      userLogin: string,
      env: UpdateJobsRuntimeEnv,
    ): Promise<UpdateJobStatusResponse | null> {
      const job = (await useWithRepository(env, async (repository) =>
        repository.getUserJob(jobId, userLogin),
      )) as PersistedUpdateJobRecord | null;

      return job ? toStatusResponse(job) : null;
    },

    async runScheduledUpdate(
      controller: ScheduledControllerLike,
      env: UpdateJobsRuntimeEnv,
    ): Promise<boolean> {
      const scheduledSpec = CLOUDFLARE_UPDATE_CRON_SPECS.find(
        (spec) => spec.cron === controller.cron,
      );

      if (!scheduledSpec) {
        return false;
      }

      const record = await ensureScheduledJob(
        scheduledSpec.operation,
        controller.scheduledTime,
        env,
      );

      await processPersistedJob(record, env);

      return true;
    },
  };
}
const defaultUpdateJobsService = createUpdateJobsService();

export const enqueueAcceptedUpdate = defaultUpdateJobsService.enqueueAcceptedUpdate;
export const touchAcceptedUpdate = defaultUpdateJobsService.touchAcceptedUpdate;
export const readAcceptedUpdateStatus = defaultUpdateJobsService.readAcceptedUpdateStatus;
export const runScheduledUpdate = defaultUpdateJobsService.runScheduledUpdate;

export function createAcceptedUpdateRouteDependencies(
  getRuntime: () =>
    | {
        env: UpdateJobsRuntimeEnv;
        ctx?: UpdateExecutionContextLike;
      }
    | undefined,
): Pick<
  UpdatesRouteDependencies,
  "enqueueAcceptedUpdate" | "readAcceptedUpdateStatus" | "touchAcceptedUpdate"
> {
  return {
    enqueueAcceptedUpdate: async (command) => {
      const runtime = getRuntime();
      if (!runtime) {
        throw new Error("Cloudflare update runtime is not available for accepted jobs.");
      }

      return enqueueAcceptedUpdate(command, runtime.env, runtime.ctx);
    },
    readAcceptedUpdateStatus: async (jobId, userLogin) => {
      const runtime = getRuntime();
      if (!runtime) {
        throw new Error("Cloudflare update runtime is not available for accepted jobs.");
      }

      return readAcceptedUpdateStatus(jobId, userLogin, runtime.env);
    },
    touchAcceptedUpdate: async (jobId, userLogin) => {
      const runtime = getRuntime();
      if (!runtime) {
        throw new Error("Cloudflare update runtime is not available for accepted jobs.");
      }

      return touchAcceptedUpdate(jobId, userLogin, runtime.env, runtime.ctx);
    },
  };
}
