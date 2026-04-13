import { createClient } from "@supabase/supabase-js";
import {
  Agent,
  fetch as undiciFetch,
  Headers as UndiciHeaders,
  Request as UndiciRequest,
  Response as UndiciResponse,
} from "undici";

import { loadApiEnv } from "../config/env";
import { recordSqlCall } from "./performance";

function ensureFetchGlobals() {
  if (typeof globalThis.fetch !== "function") {
    globalThis.fetch = undiciFetch as typeof globalThis.fetch;
  }

  if (typeof globalThis.Headers === "undefined") {
    globalThis.Headers = UndiciHeaders as typeof globalThis.Headers;
  }

  if (typeof globalThis.Request === "undefined") {
    globalThis.Request = UndiciRequest as typeof globalThis.Request;
  }

  if (typeof globalThis.Response === "undefined") {
    globalThis.Response = UndiciResponse as typeof globalThis.Response;
  }
}

const supabaseHttpAgent = new Agent({
  connectTimeout: 10_000,
  keepAliveTimeout: 60_000,
  keepAliveMaxTimeout: 120_000,
  pipelining: 1,
});

let cachedApiSupabaseClient: ReturnType<typeof createClient<any>> | null = null;

export function createApiSupabaseAdminClient() {
  if (cachedApiSupabaseClient) {
    return cachedApiSupabaseClient;
  }

  const env = loadApiEnv();
  ensureFetchGlobals();
  const originalFetch = globalThis.fetch.bind(globalThis);

  cachedApiSupabaseClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: async (input, init) => {
        const startedAtMs = performance.now();
        const sqlSignature = resolveSqlSignature(input, init);
        try {
          const response = await originalFetch(input, {
            ...init,
            dispatcher: supabaseHttpAgent as never,
          });
          const durationMs = performance.now() - startedAtMs;
          const rows = resolveRowsCount(response);

          recordSqlCall(sqlSignature, durationMs, rows);

          return response;
        } catch (error) {
          const durationMs = performance.now() - startedAtMs;
          recordSqlCall(`${sqlSignature} [error]`, durationMs, null);
          throw error;
        }
      },
    },
  });

  return cachedApiSupabaseClient;
}

function resolveSqlSignature(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
): string {
  const resolvedUrl =
    typeof input === "string" || input instanceof URL
      ? new URL(input.toString())
      : new URL(input.url);
  const method =
    init?.method ??
    (typeof input === "string" || input instanceof URL ? "GET" : input.method ?? "GET");
  const queryKeys = Array.from(new Set(resolvedUrl.searchParams.keys()))
    .sort()
    .join("&");

  return queryKeys
    ? `${method.toUpperCase()} ${resolvedUrl.pathname}?${queryKeys}`
    : `${method.toUpperCase()} ${resolvedUrl.pathname}`;
}

function resolveRowsCount(response: Response): number | null {
  if (response.status === 204) {
    return 0;
  }

  const contentRange = response.headers.get("content-range");
  if (contentRange) {
    const parsedRange = contentRange.match(/^(\d+)-(\d+)\/(\*|\d+)$/);
    if (parsedRange) {
      const start = Number(parsedRange[1]);
      const end = Number(parsedRange[2]);
      return end >= start ? end - start + 1 : 0;
    }

    const parsedTotalOnly = contentRange.match(/^\*\/(\d+)$/);
    if (parsedTotalOnly) {
      return Number(parsedTotalOnly[1]);
    }
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength === "0") {
    return 0;
  }

  return null;
}
