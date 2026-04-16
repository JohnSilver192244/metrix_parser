import type {
  ApiEnvelope,
  ApiErrorEnvelope,
  ApiMeta,
} from "@metrix-parser/shared-types";

import { getStoredSessionToken } from "../../features/auth/auth-storage";
import { observeApiCallPerformance } from "../performance/route-performance";

const apiBaseUrl = resolveApiBaseUrl();

function resolveApiBaseUrl(): string {
  const configuredBaseUrl = import.meta.env?.VITE_API_BASE_URL?.trim();
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  if (import.meta.env?.DEV) {
    return "http://localhost:3001";
  }

  return "http://localhost:3001";
}

export class ApiClientError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
  }
}

export async function requestJson<TResponse>(
  path: string,
  init: RequestInit,
): Promise<TResponse> {
  const method = init.method ?? "GET";
  const requestStartedAt = performance.now();
  const response = await fetch(new URL(path, apiBaseUrl), withAuthHeaders(init));
  const ttfbMs = performance.now() - requestStartedAt;
  const text = await response.text();
  const durationMs = performance.now() - requestStartedAt;
  observeApiCallPerformance({
    apiPath: path,
    method,
    status: response.status,
    ttfbMs,
    durationMs,
  });
  const payload = parseJsonPayload<TResponse>(text);

  if (!response.ok) {
    const apiError = payload as ApiErrorEnvelope | null;
    throw new ApiClientError(
      apiError?.error.code ?? "request_failed",
      apiError?.error.message ?? "Request failed",
    );
  }

  return (payload as ApiEnvelope<TResponse>).data;
}

export async function requestEnvelope<TResponse, TMeta extends ApiMeta = ApiMeta>(
  path: string,
  init: RequestInit,
): Promise<ApiEnvelope<TResponse, TMeta>> {
  const method = init.method ?? "GET";
  const requestStartedAt = performance.now();
  const response = await fetch(new URL(path, apiBaseUrl), withAuthHeaders(init));
  const ttfbMs = performance.now() - requestStartedAt;
  const text = await response.text();
  const durationMs = performance.now() - requestStartedAt;
  observeApiCallPerformance({
    apiPath: path,
    method,
    status: response.status,
    ttfbMs,
    durationMs,
  });
  const payload = parseJsonPayload<TResponse>(text);

  if (!response.ok) {
    const apiError = payload as ApiErrorEnvelope | null;
    throw new ApiClientError(
      apiError?.error.code ?? "request_failed",
      apiError?.error.message ?? "Request failed",
    );
  }

  if (!payload || !("data" in payload)) {
    throw new ApiClientError("invalid_response", "Server returned an invalid JSON envelope");
  }

  return payload as ApiEnvelope<TResponse, TMeta>;
}

function withAuthHeaders(init: RequestInit): RequestInit {
  const sessionToken = getStoredSessionToken();

  return {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(sessionToken
        ? {
            Authorization: `Bearer ${sessionToken}`,
          }
        : {}),
      ...(init.headers ?? {}),
    },
  };
}

function parseJsonPayload<TResponse>(
  text: string,
): ApiEnvelope<TResponse> | ApiErrorEnvelope | null {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as ApiEnvelope<TResponse> | ApiErrorEnvelope;
  } catch {
    return null;
  }
}
