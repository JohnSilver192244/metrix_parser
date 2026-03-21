import { createClient } from "@supabase/supabase-js";

import { loadApiEnv } from "../config/env";

export function createApiSupabaseAdminClient() {
  const env = loadApiEnv();

  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
