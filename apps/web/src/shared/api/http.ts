import type {
  ApiEnvelope,
  ApiErrorEnvelope,
  ApiMeta,
} from "@metrix-parser/shared-types";

const apiBaseUrl = import.meta.env?.VITE_API_BASE_URL ?? "http://localhost:3001";

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
  const response = await fetch(new URL(path, apiBaseUrl), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
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
  const response = await fetch(new URL(path, apiBaseUrl), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
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
