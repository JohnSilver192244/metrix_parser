import { createClient } from "@supabase/supabase-js";
import {
  fetch as undiciFetch,
  Headers as UndiciHeaders,
  Request as UndiciRequest,
  Response as UndiciResponse,
} from "undici";

import { loadWorkerEnv } from "../config/env";

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

export function createWorkerSupabaseAdminClient() {
  const env = loadWorkerEnv();
  ensureFetchGlobals();

  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: globalThis.fetch.bind(globalThis),
    },
  });
}
