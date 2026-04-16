import type {
  AcceptedUpdateOperation,
  TriggerUpdateRequestBody,
  UpdateOperation,
  UpdateJobStatusResponse,
  UpdatePeriod,
} from "@metrix-parser/shared-types";

import { sendSuccess, readJsonBody } from "../../lib/http";
import { invalidateApiReadCacheAfterBackgroundRecompute } from "../../lib/api-read-cache";
import { HttpError } from "../../lib/http-errors";
import type { RouteDefinition } from "../../lib/router";
import {
  readSessionToken,
  requireAuthenticatedUser,
  type AuthGuardDependencies,
} from "../auth/runtime";
import {
  executeUpdateOperation,
  type UpdatesExecutionDependencies,
} from "./execution";

const PERIOD_OPERATIONS = new Set<UpdateOperation>(["competitions", "players", "results"]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_UPDATE_PERIOD_DAYS = 14;

function isRealCalendarDate(value: string): boolean {
  const [yearToken, monthToken, dayToken] = value.split("-");
  const year = Number(yearToken);
  const month = Number(monthToken);
  const day = Number(dayToken);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function validateDate(value: string, fieldName: keyof UpdatePeriod): string {
  if (!DATE_PATTERN.test(value) || !isRealCalendarDate(value)) {
    throw new HttpError(400, "invalid_period", `Field ${fieldName} must use YYYY-MM-DD format`);
  }

  return value;
}

function countInclusiveUtcDays(period: UpdatePeriod): number {
  const dateFrom = Date.parse(`${period.dateFrom}T00:00:00.000Z`);
  const dateTo = Date.parse(`${period.dateTo}T00:00:00.000Z`);

  return Math.floor((dateTo - dateFrom) / 86_400_000) + 1;
}

function resolvePeriod(body: TriggerUpdateRequestBody): UpdatePeriod {
  const dateFrom = body.dateFrom?.trim();
  const dateTo = body.dateTo?.trim();

  if (!dateFrom || !dateTo) {
    throw new HttpError(
      400,
      "invalid_period",
      "Both dateFrom and dateTo are required for this update scenario",
    );
  }

  const period = {
    dateFrom: validateDate(dateFrom, "dateFrom"),
    dateTo: validateDate(dateTo, "dateTo"),
  };

  if (period.dateFrom > period.dateTo) {
    throw new HttpError(400, "invalid_period", "dateFrom must be earlier than or equal to dateTo");
  }

  if (countInclusiveUtcDays(period) > MAX_UPDATE_PERIOD_DAYS) {
    throw new HttpError(
      400,
      "invalid_period",
      `Update period must not exceed ${MAX_UPDATE_PERIOD_DAYS} days`,
    );
  }

  return period;
}

function resolveOverwriteExisting(body: TriggerUpdateRequestBody): boolean {
  return body.overwriteExisting === true;
}

export interface AcceptedUpdateCommand {
  operation: UpdateOperation;
  period?: UpdatePeriod;
  overwriteExisting: boolean;
  userLogin: string;
}

export interface UpdatesRouteDependencies extends UpdatesExecutionDependencies {
  enqueueAcceptedUpdate?: (
    command: AcceptedUpdateCommand,
  ) => Promise<AcceptedUpdateOperation>;
  readAcceptedUpdateStatus?: (
    jobId: string,
    userLogin: string,
  ) => Promise<UpdateJobStatusResponse | null>;
  touchAcceptedUpdate?: (jobId: string, userLogin: string) => Promise<void>;
}

function createUpdateRoute(
  operation: UpdateOperation,
  dependencies: UpdatesRouteDependencies,
  authDependencies: AuthGuardDependencies,
): RouteDefinition {
  return {
    method: "POST",
    path: `/updates/${operation}`,
    handler: async ({ req, res }) => {
      const user = await requireAuthenticatedUser(readSessionToken(req), authDependencies);

      const body = await readJsonBody<TriggerUpdateRequestBody>(req);
      const period = PERIOD_OPERATIONS.has(operation) ? resolvePeriod(body) : undefined;
      const overwriteExisting = resolveOverwriteExisting(body);

      if (dependencies.enqueueAcceptedUpdate) {
        const accepted = await dependencies.enqueueAcceptedUpdate({
          operation,
          period,
          overwriteExisting,
          userLogin: user.login,
        });
        sendSuccess(res, accepted, undefined, 202);
        return;
      }

      const result = await executeUpdateOperation(operation, period, overwriteExisting, dependencies);

      invalidateApiReadCacheAfterBackgroundRecompute({});

      sendSuccess(res, result, undefined, 202);
    },
  };
}

function createUpdateStatusRoute(
  dependencies: UpdatesRouteDependencies,
  authDependencies: AuthGuardDependencies,
): RouteDefinition {
  return {
    method: "GET",
    path: "/updates/jobs/:jobId",
    handler: async ({ req, res, params }) => {
      const user = await requireAuthenticatedUser(readSessionToken(req), authDependencies);

      if (!dependencies.readAcceptedUpdateStatus) {
        throw new HttpError(
          404,
          "update_job_not_found",
          "Accepted update jobs are not enabled for this runtime.",
        );
      }

      const jobId = params.jobId?.trim();
      if (!jobId) {
        throw new HttpError(400, "invalid_job_id", "A jobId path parameter is required");
      }

      if (dependencies.touchAcceptedUpdate) {
        await dependencies.touchAcceptedUpdate(jobId, user.login);
      }

      const status = await dependencies.readAcceptedUpdateStatus(jobId, user.login);
      if (!status) {
        throw new HttpError(404, "update_job_not_found", "Update job was not found");
      }

      sendSuccess(res, status);
    },
  };
}

export function getUpdatesRoutes(
  dependencies: UpdatesRouteDependencies = {},
  authDependencies: AuthGuardDependencies = {},
): RouteDefinition[] {
  return [
    createUpdateStatusRoute(dependencies, authDependencies),
    createUpdateRoute("competitions", dependencies, authDependencies),
    createUpdateRoute("courses", dependencies, authDependencies),
    createUpdateRoute("players", dependencies, authDependencies),
    createUpdateRoute("results", dependencies, authDependencies),
  ];
}
