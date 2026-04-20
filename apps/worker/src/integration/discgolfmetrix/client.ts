import type { UpdatePeriod } from "@metrix-parser/shared-types";

import { DiscGolfMetrixClientError } from "./errors";
import {
  parseDiscGolfMetrixCompetitionsPayload,
  parseDiscGolfMetrixCoursePayload,
  parseDiscGolfMetrixResultsPayload,
} from "./parser";
import type {
  DiscGolfMetrixCompetitionQueryParams,
  DiscGolfMetrixCompetitionsRequest,
  DiscGolfMetrixCompetitionsResponse,
  DiscGolfMetrixCourseQueryParams,
  DiscGolfMetrixCourseRequest,
  DiscGolfMetrixCourseResponse,
  DiscGolfMetrixResultsQueryParams,
  DiscGolfMetrixResultsRequest,
  DiscGolfMetrixResultsResponse,
} from "./types";

export interface DiscGolfMetrixClientDependencies {
  baseUrl: string;
  countryCode: string;
  apiCode: string;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
}

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

class DiscGolfMetrixRequestTimeoutError extends Error {
  constructor(requestTimeoutMs: number) {
    super(`DiscGolfMetrix request timed out after ${requestTimeoutMs}ms.`);
    this.name = "DiscGolfMetrixRequestTimeoutError";
  }
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  input: string,
  init: RequestInit,
  requestTimeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);
  const timeoutError = new DiscGolfMetrixRequestTimeoutError(requestTimeoutMs);

  try {
    return await fetchImpl(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildCompetitionQueryParams(
  period: UpdatePeriod,
  countryCode: string,
  apiCode: string,
): DiscGolfMetrixCompetitionQueryParams {
  return {
    content: "competitions",
    countryCode,
    apiCode,
    date1: period.dateFrom,
    date2: period.dateTo,
  };
}

function buildCourseQueryParams(
  courseId: string,
  apiCode: string,
): DiscGolfMetrixCourseQueryParams {
  return {
    content: "course",
    courseId,
    apiCode,
  };
}

function buildResultsQueryParams(
  request: DiscGolfMetrixResultsRequest,
  apiCode: string,
): DiscGolfMetrixResultsQueryParams {
  return {
    content: "result",
    competitionId: request.competitionId,
    metrixId: request.metrixId ?? null,
    apiCode,
  };
}

export function buildCompetitionsRequestUrl(
  baseUrl: string,
  countryCode: string,
  apiCode: string,
  request: DiscGolfMetrixCompetitionsRequest,
): string {
  const url = new URL("/api.php", baseUrl);
  const params = buildCompetitionQueryParams(request.period, countryCode, apiCode);

  url.searchParams.set("content", params.content);
  url.searchParams.set("country_code", params.countryCode);
  url.searchParams.set("date1", params.date1);
  url.searchParams.set("date2", params.date2);
  url.searchParams.set("code", params.apiCode);

  return url.toString();
}

export function buildCourseRequestUrl(
  baseUrl: string,
  apiCode: string,
  request: DiscGolfMetrixCourseRequest,
): string {
  const url = new URL("/api.php", baseUrl);
  const params = buildCourseQueryParams(request.courseId, apiCode);

  url.searchParams.set("content", params.content);
  url.searchParams.set("id", params.courseId);
  url.searchParams.set("code", params.apiCode);

  return url.toString();
}

export function buildResultsRequestUrl(
  baseUrl: string,
  apiCode: string,
  request: DiscGolfMetrixResultsRequest,
): string {
  const url = new URL("/api.php", baseUrl);
  const params = buildResultsQueryParams(request, apiCode);

  url.searchParams.set("content", params.content);
  url.searchParams.set("id", params.competitionId);

  url.searchParams.set("code", params.apiCode);

  return url.toString();
}

export function createDiscGolfMetrixClient({
  baseUrl,
  countryCode,
  apiCode,
  fetchImpl = fetch,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
}: DiscGolfMetrixClientDependencies) {
  async function performRequest(sourceUrl: string): Promise<Response> {
    return fetchWithTimeout(
      fetchImpl,
      sourceUrl,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      },
      requestTimeoutMs,
    );
  }

  return {
    async fetchCompetitions(
      request: DiscGolfMetrixCompetitionsRequest,
    ): Promise<DiscGolfMetrixCompetitionsResponse> {
      const sourceUrl = buildCompetitionsRequestUrl(baseUrl, countryCode, apiCode, request);

      let response: Response;

      try {
        response = await performRequest(sourceUrl);
      } catch (error) {
        throw new DiscGolfMetrixClientError(
          error instanceof DiscGolfMetrixRequestTimeoutError
            ? error.message
            : error instanceof Error
              ? `DiscGolfMetrix request failed: ${error.message}`
              : "DiscGolfMetrix request failed.",
          "discgolfmetrix_network_error",
          { sourceUrl },
        );
      }

      if (!response.ok) {
        throw new DiscGolfMetrixClientError(
          `DiscGolfMetrix returned HTTP ${response.status} for competitions request.`,
          "discgolfmetrix_http_error",
          { status: response.status, sourceUrl },
        );
      }

      let responseBody: string;

      try {
        responseBody = await response.text();
      } catch (error) {
        throw new DiscGolfMetrixClientError(
          error instanceof Error
            ? `DiscGolfMetrix payload could not be read: ${error.message}`
            : "DiscGolfMetrix payload could not be read.",
          "discgolfmetrix_network_error",
          { sourceUrl },
        );
      }

      let payload: unknown;

      try {
        payload = JSON.parse(responseBody);
      } catch (error) {
        const responsePreview = responseBody.slice(0, 120).replace(/\s+/g, " ").trim();

        throw new DiscGolfMetrixClientError(
          error instanceof Error
            ? `DiscGolfMetrix payload is not valid JSON: ${error.message}. Response preview: ${responsePreview}`
            : `DiscGolfMetrix payload is not valid JSON. Response preview: ${responsePreview}`,
          "discgolfmetrix_parse_error",
          { sourceUrl },
        );
      }

      const parsedPayload = parseDiscGolfMetrixCompetitionsPayload(payload);
      const fetchedAt = new Date().toISOString();

      return {
        sourceUrl,
        fetchedAt,
        records: parsedPayload.competitions,
        rawPayload: parsedPayload,
      };
    },

    async fetchCourse(
      request: DiscGolfMetrixCourseRequest,
    ): Promise<DiscGolfMetrixCourseResponse> {
      const sourceUrl = buildCourseRequestUrl(baseUrl, apiCode, request);

      let response: Response;

      try {
        response = await performRequest(sourceUrl);
      } catch (error) {
        throw new DiscGolfMetrixClientError(
          error instanceof DiscGolfMetrixRequestTimeoutError
            ? error.message
            : error instanceof Error
              ? `DiscGolfMetrix request failed: ${error.message}`
              : "DiscGolfMetrix request failed.",
          "discgolfmetrix_network_error",
          { sourceUrl },
        );
      }

      if (!response.ok) {
        throw new DiscGolfMetrixClientError(
          `DiscGolfMetrix returned HTTP ${response.status} for course request ${request.courseId}.`,
          "discgolfmetrix_http_error",
          { status: response.status, sourceUrl },
        );
      }

      let responseBody: string;

      try {
        responseBody = await response.text();
      } catch (error) {
        throw new DiscGolfMetrixClientError(
          error instanceof Error
            ? `DiscGolfMetrix payload could not be read: ${error.message}`
            : "DiscGolfMetrix payload could not be read.",
          "discgolfmetrix_network_error",
          { sourceUrl },
        );
      }

      let payload: unknown;

      try {
        payload = JSON.parse(responseBody);
      } catch (error) {
        const responsePreview = responseBody.slice(0, 120).replace(/\s+/g, " ").trim();

        throw new DiscGolfMetrixClientError(
          error instanceof Error
            ? `DiscGolfMetrix payload is not valid JSON: ${error.message}. Response preview: ${responsePreview}`
            : `DiscGolfMetrix payload is not valid JSON. Response preview: ${responsePreview}`,
          "discgolfmetrix_parse_error",
          { sourceUrl },
        );
      }

      const parsedPayload = parseDiscGolfMetrixCoursePayload(payload);
      const fetchedAt = new Date().toISOString();

      return {
        sourceUrl,
        fetchedAt,
        courseId: request.courseId,
        record: parsedPayload,
        rawPayload: parsedPayload,
      };
    },

    async fetchResults(
      request: DiscGolfMetrixResultsRequest,
    ): Promise<DiscGolfMetrixResultsResponse> {
      const sourceUrl = buildResultsRequestUrl(baseUrl, apiCode, request);

      let response: Response;

      try {
        response = await performRequest(sourceUrl);
      } catch (error) {
        throw new DiscGolfMetrixClientError(
          error instanceof DiscGolfMetrixRequestTimeoutError
            ? error.message
            : error instanceof Error
              ? `DiscGolfMetrix request failed: ${error.message}`
              : "DiscGolfMetrix request failed.",
          "discgolfmetrix_network_error",
          { sourceUrl },
        );
      }

      if (!response.ok) {
        throw new DiscGolfMetrixClientError(
          `DiscGolfMetrix returned HTTP ${response.status} for results request ${request.competitionId}.`,
          "discgolfmetrix_http_error",
          { status: response.status, sourceUrl },
        );
      }

      let responseBody: string;

      try {
        responseBody = await response.text();
      } catch (error) {
        throw new DiscGolfMetrixClientError(
          error instanceof Error
            ? `DiscGolfMetrix payload could not be read: ${error.message}`
            : "DiscGolfMetrix payload could not be read.",
          "discgolfmetrix_network_error",
          { sourceUrl },
        );
      }

      let payload: unknown;

      try {
        payload = JSON.parse(responseBody);
      } catch (error) {
        const responsePreview = responseBody.slice(0, 120).replace(/\s+/g, " ").trim();

        throw new DiscGolfMetrixClientError(
          error instanceof Error
            ? `DiscGolfMetrix payload is not valid JSON: ${error.message}. Response preview: ${responsePreview}`
            : `DiscGolfMetrix payload is not valid JSON. Response preview: ${responsePreview}`,
          "discgolfmetrix_parse_error",
          { sourceUrl },
        );
      }

      const parsedPayload = parseDiscGolfMetrixResultsPayload(payload);
      const fetchedAt = new Date().toISOString();

      return {
        sourceUrl,
        fetchedAt,
        competitionId: request.competitionId,
        metrixId: request.metrixId ?? null,
        record: parsedPayload,
        rawPayload: parsedPayload,
      };
    },
  };
}
