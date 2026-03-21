interface ApiRuntimeEnv {
  apiPort: number;
}

interface ApiSupabaseEnv extends ApiRuntimeEnv {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function loadApiRuntimeEnv(): ApiRuntimeEnv {
  return {
    apiPort: Number(process.env.API_PORT ?? 3001),
  };
}

export function loadApiEnv(): ApiSupabaseEnv {
  return {
    ...loadApiRuntimeEnv(),
    supabaseUrl: requireEnv("SUPABASE_URL"),
    supabaseServiceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}
