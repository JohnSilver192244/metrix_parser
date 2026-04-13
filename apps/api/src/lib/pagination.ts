import { HttpError } from "./http-errors";

export interface ListPagination {
  limit: number;
  offset: number;
}

export const DEFAULT_LIST_LIMIT = 200;
export const MAX_LIST_LIMIT = 1000;

function normalizePaginationNumber(
  rawValue: string | null,
  fallbackValue: number,
  fieldName: "limit" | "offset",
): number {
  if (rawValue == null || rawValue.trim().length === 0) {
    return fallbackValue;
  }

  if (!/^\d+$/.test(rawValue.trim())) {
    throw new HttpError(400, "invalid_pagination", `${fieldName} must be a non-negative integer`);
  }

  return Number(rawValue);
}

export function resolveListPagination(
  url: URL,
  defaults: { limit?: number; maxLimit?: number; offset?: number } = {},
): ListPagination {
  const limitFallback = defaults.limit ?? DEFAULT_LIST_LIMIT;
  const maxLimit = defaults.maxLimit ?? MAX_LIST_LIMIT;
  const offsetFallback = defaults.offset ?? 0;
  const rawLimit = normalizePaginationNumber(url.searchParams.get("limit"), limitFallback, "limit");
  const rawOffset = normalizePaginationNumber(
    url.searchParams.get("offset"),
    offsetFallback,
    "offset",
  );

  return {
    limit: Math.min(rawLimit, maxLimit),
    offset: rawOffset,
  };
}
