import { createClient } from "@supabase/supabase-js";

import { loadWorkerEnv } from "../config/env";

export function createWorkerSupabaseAdminClient() {
  const env = loadWorkerEnv();

  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
