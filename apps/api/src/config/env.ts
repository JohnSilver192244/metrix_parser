import { AsyncLocalStorage } from "node:async_hooks";

interface ApiRuntimeEnv {
  apiPort: number;
}

export interface ApiSupabaseEnv extends ApiRuntimeEnv {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
}

export type ApiRuntimeEnvOverride = Partial<ApiSupabaseEnv>;

const apiEnvOverrideStorage = new AsyncLocalStorage<ApiRuntimeEnvOverride>();

function requireEnv(name: string): string {
  const override = apiEnvOverrideStorage.getStore();
  const overrideValue = override?.[toOverrideKey(name)];
  if (typeof overrideValue === "string" && overrideValue.length > 0) {
    return overrideValue;
  }

  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function loadApiRuntimeEnv(): ApiRuntimeEnv {
  const override = apiEnvOverrideStorage.getStore();

  return {
    apiPort: Number(override?.apiPort ?? process.env.API_PORT ?? 3001),
  };
}

export function loadApiEnv(): ApiSupabaseEnv {
  return {
    ...loadApiRuntimeEnv(),
    supabaseUrl: requireEnv("SUPABASE_URL"),
    supabaseServiceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

export function runWithApiRuntimeEnv<T>(
  env: ApiRuntimeEnvOverride,
  callback: () => T,
): T {
  return apiEnvOverrideStorage.run(env, callback);
}

function toOverrideKey(name: string): keyof ApiRuntimeEnvOverride {
  switch (name) {
    case "SUPABASE_URL":
      return "supabaseUrl";
    case "SUPABASE_SERVICE_ROLE_KEY":
      return "supabaseServiceRoleKey";
    default:
      throw new Error(`Unsupported API runtime env key: ${name}`);
  }
}
