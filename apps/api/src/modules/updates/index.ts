import type {
  TriggerUpdateRequestBody,
  UpdateOperation,
  UpdatePeriod,
} from "@metrix-parser/shared-types";

import { sendSuccess, readJsonBody } from "../../lib/http";
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

  return period;
}

function resolveOverwriteExisting(body: TriggerUpdateRequestBody): boolean {
  return body.overwriteExisting === true;
}

export interface UpdatesRouteDependencies extends UpdatesExecutionDependencies {}

function createUpdateRoute(
  operation: UpdateOperation,
  dependencies: UpdatesRouteDependencies,
  authDependencies: AuthGuardDependencies,
): RouteDefinition {
  return {
    method: "POST",
    path: `/updates/${operation}`,
    handler: async ({ req, res }) => {
      await requireAuthenticatedUser(readSessionToken(req), authDependencies);

      const body = await readJsonBody<TriggerUpdateRequestBody>(req);
      const period = PERIOD_OPERATIONS.has(operation) ? resolvePeriod(body) : undefined;
      const result = await executeUpdateOperation(
        operation,
        period,
        resolveOverwriteExisting(body),
        dependencies,
      );

      sendSuccess(res, result, undefined, 202);
    },
  };
}

export function getUpdatesRoutes(
  dependencies: UpdatesRouteDependencies = {},
  authDependencies: AuthGuardDependencies = {},
): RouteDefinition[] {
  return [
    createUpdateRoute("competitions", dependencies, authDependencies),
    createUpdateRoute("courses", dependencies, authDependencies),
    createUpdateRoute("players", dependencies, authDependencies),
    createUpdateRoute("results", dependencies, authDependencies),
  ];
}
