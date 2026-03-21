import type {
  TriggerUpdateRequestBody,
  TriggerUpdateResponse,
  UpdateOperation,
  UpdatePeriod,
  UpdateSummary,
} from "@metrix-parser/shared-types";

import { sendSuccess, readJsonBody } from "../../lib/http";
import { HttpError } from "../../lib/http-errors";
import type { RouteDefinition } from "../../lib/router";

const PERIOD_OPERATIONS = new Set<UpdateOperation>(["competitions", "players", "results"]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UPDATE_SUMMARY_BY_OPERATION: Record<UpdateOperation, UpdateSummary> = {
  competitions: {
    found: 24,
    created: 8,
    updated: 14,
    skipped: 2,
  },
  courses: {
    found: 12,
    created: 3,
    updated: 7,
    skipped: 2,
  },
  players: {
    found: 40,
    created: 18,
    updated: 20,
    skipped: 2,
  },
  results: {
    found: 118,
    created: 36,
    updated: 77,
    skipped: 5,
  },
};

function createAcceptedResponse(
  operation: UpdateOperation,
  period?: UpdatePeriod,
): TriggerUpdateResponse {
  const requestedAt = new Date().toISOString();

  return {
    operation,
    finalStatus: "completed",
    source: "stub",
    message: `Сценарий ${operation} вернул демонстрационный stub-результат до подключения реального update pipeline.`,
    requestedAt,
    finishedAt: requestedAt,
    summary: UPDATE_SUMMARY_BY_OPERATION[operation],
    period,
  };
}

function validateDate(value: string, fieldName: keyof UpdatePeriod): string {
  if (!DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
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

function createUpdateRoute(operation: UpdateOperation): RouteDefinition {
  return {
    method: "POST",
    path: `/updates/${operation}`,
    handler: async ({ req, res }) => {
      const body = await readJsonBody<TriggerUpdateRequestBody>(req);
      const period = PERIOD_OPERATIONS.has(operation) ? resolvePeriod(body) : undefined;

      sendSuccess(res, createAcceptedResponse(operation, period), undefined, 202);
    },
  };
}

export const updatesRoutes: RouteDefinition[] = [
  createUpdateRoute("competitions"),
  createUpdateRoute("courses"),
  createUpdateRoute("players"),
  createUpdateRoute("results"),
];
