import type { UpdateOperationResult, UpdatePeriod } from "@metrix-parser/shared-types";

import { createWorkerSupabaseAdminClient } from "../lib/supabase-admin";

const APP_PUBLIC_SCHEMA = "app_public";
const ACTIVE_JOB_STATUSES = ["accepted", "running"] as const;

export type PersistedUpdateJobStatus =
  | "accepted"
  | "running"
  | "completed"
  | "completed_with_issues"
  | "failed";

export interface PersistedUpdateJobCursor {
  offset?: number;
}

export interface PersistedUpdateJobRecord {
  jobId: string;
  userLogin: string | null;
  operation: "competitions" | "courses" | "players" | "results";
  status: PersistedUpdateJobStatus;
  message: string;
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  period?: UpdatePeriod;
  overwriteExisting: boolean;
  pollPath: string;
  continuationCursor: PersistedUpdateJobCursor | null;
  result: UpdateOperationResult | null;
  processingLeaseToken: string | null;
}

interface UpdateJobsRow {
  job_id: string;
  user_login: string | null;
  operation: PersistedUpdateJobRecord["operation"];
  status: PersistedUpdateJobStatus;
  message: string;
  requested_at: string;
  started_at: string | null;
  finished_at: string | null;
  period_date_from: string | null;
  period_date_to: string | null;
  overwrite_existing: boolean;
  poll_path: string;
  continuation_cursor: PersistedUpdateJobCursor | null;
  result_payload: UpdateOperationResult | null;
  processing_lease_token: string | null;
}

function toPersistedRecord(row: UpdateJobsRow): PersistedUpdateJobRecord {
  return {
    jobId: row.job_id,
    userLogin: row.user_login,
    operation: row.operation,
    status: row.status,
    message: row.message,
    requestedAt: row.requested_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    period:
      row.period_date_from && row.period_date_to
        ? {
            dateFrom: row.period_date_from,
            dateTo: row.period_date_to,
          }
        : undefined,
    overwriteExisting: row.overwrite_existing,
    pollPath: row.poll_path,
    continuationCursor: row.continuation_cursor,
    result: row.result_payload,
    processingLeaseToken: row.processing_lease_token,
  };
}

function toRowPatch(
  patch: Partial<PersistedUpdateJobRecord>,
): Partial<UpdateJobsRow> {
  const rowPatch: Partial<UpdateJobsRow> = {};

  if ("userLogin" in patch) {
    rowPatch.user_login = patch.userLogin ?? null;
  }

  if ("operation" in patch) {
    rowPatch.operation = patch.operation;
  }

  if ("status" in patch) {
    rowPatch.status = patch.status;
  }

  if ("message" in patch) {
    rowPatch.message = patch.message;
  }

  if ("requestedAt" in patch) {
    rowPatch.requested_at = patch.requestedAt;
  }

  if ("startedAt" in patch) {
    rowPatch.started_at = patch.startedAt ?? null;
  }

  if ("finishedAt" in patch) {
    rowPatch.finished_at = patch.finishedAt ?? null;
  }

  if ("period" in patch) {
    rowPatch.period_date_from = patch.period?.dateFrom ?? null;
    rowPatch.period_date_to = patch.period?.dateTo ?? null;
  }

  if ("overwriteExisting" in patch) {
    rowPatch.overwrite_existing = patch.overwriteExisting;
  }

  if ("pollPath" in patch) {
    rowPatch.poll_path = patch.pollPath;
  }

  if ("continuationCursor" in patch) {
    rowPatch.continuation_cursor = patch.continuationCursor ?? null;
  }

  if ("result" in patch) {
    rowPatch.result_payload = patch.result ?? null;
  }

  if ("processingLeaseToken" in patch) {
    rowPatch.processing_lease_token = patch.processingLeaseToken ?? null;
  }

  return rowPatch;
}

export function createUpdateJobsRepository() {
  const supabase = createWorkerSupabaseAdminClient();

  return {
    async insertJob(record: PersistedUpdateJobRecord): Promise<void> {
      const { error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("update_jobs")
        .insert({
          job_id: record.jobId,
          user_login: record.userLogin,
          operation: record.operation,
          status: record.status,
          message: record.message,
          requested_at: record.requestedAt,
          started_at: record.startedAt,
          finished_at: record.finishedAt,
          period_date_from: record.period?.dateFrom ?? null,
          period_date_to: record.period?.dateTo ?? null,
          overwrite_existing: record.overwriteExisting,
          poll_path: record.pollPath,
          continuation_cursor: record.continuationCursor,
          result_payload: record.result,
          processing_lease_token: record.processingLeaseToken,
        } satisfies UpdateJobsRow);

      if (error) {
        throw new Error(`Не удалось создать запись update job: ${error.message}`);
      }
    },

    async getJob(jobId: string): Promise<PersistedUpdateJobRecord | null> {
      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("update_jobs")
        .select("*")
        .eq("job_id", jobId)
        .maybeSingle();

      if (error) {
        throw new Error(`Не удалось загрузить update job: ${error.message}`);
      }

      return data ? toPersistedRecord(data as UpdateJobsRow) : null;
    },

    async getUserJob(
      jobId: string,
      userLogin: string,
    ): Promise<PersistedUpdateJobRecord | null> {
      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("update_jobs")
        .select("*")
        .eq("job_id", jobId)
        .eq("user_login", userLogin)
        .maybeSingle();

      if (error) {
        throw new Error(`Не удалось загрузить update job пользователя: ${error.message}`);
      }

      return data ? toPersistedRecord(data as UpdateJobsRow) : null;
    },

    async updateJob(
      jobId: string,
      patch: Partial<PersistedUpdateJobRecord>,
    ): Promise<PersistedUpdateJobRecord> {
      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("update_jobs")
        .update(toRowPatch(patch))
        .eq("job_id", jobId)
        .select("*")
        .single();

      if (error) {
        throw new Error(`Не удалось обновить update job: ${error.message}`);
      }

      return toPersistedRecord(data as UpdateJobsRow);
    },

    async updateClaimedJob(
      jobId: string,
      leaseToken: string,
      patch: Partial<PersistedUpdateJobRecord>,
    ): Promise<PersistedUpdateJobRecord> {
      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("update_jobs")
        .update(toRowPatch(patch))
        .eq("job_id", jobId)
        .eq("processing_lease_token", leaseToken)
        .select("*")
        .single();

      if (error) {
        throw new Error(`Не удалось обновить claimed update job: ${error.message}`);
      }

      return toPersistedRecord(data as UpdateJobsRow);
    },

    async claimJob(
      jobId: string,
      leaseToken: string,
    ): Promise<PersistedUpdateJobRecord | null> {
      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("update_jobs")
        .update({
          processing_lease_token: leaseToken,
        } satisfies Partial<UpdateJobsRow>)
        .eq("job_id", jobId)
        .is("processing_lease_token", null)
        .in("status", [...ACTIVE_JOB_STATUSES])
        .select("*")
        .maybeSingle();

      if (error) {
        throw new Error(`Не удалось claim update job: ${error.message}`);
      }

      return data ? toPersistedRecord(data as UpdateJobsRow) : null;
    },

    async findLatestActiveSystemJob(
      operation: PersistedUpdateJobRecord["operation"],
      period?: UpdatePeriod,
    ): Promise<PersistedUpdateJobRecord | null> {
      let query = supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("update_jobs")
        .select("*")
        .eq("operation", operation)
        .is("user_login", null)
        .in("status", [...ACTIVE_JOB_STATUSES])
        .order("requested_at", { ascending: false })
        .limit(1);

      query = period
        ? query
            .eq("period_date_from", period.dateFrom)
            .eq("period_date_to", period.dateTo)
        : query.is("period_date_from", null).is("period_date_to", null);

      const { data, error } = await query.maybeSingle();

      if (error) {
        throw new Error(`Не удалось загрузить системный update job: ${error.message}`);
      }

      return data ? toPersistedRecord(data as UpdateJobsRow) : null;
    },
  };
}
