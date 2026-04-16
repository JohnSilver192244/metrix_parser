import { AsyncLocalStorage } from "node:async_hooks";

export interface WorkerEnv {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  discGolfMetrixBaseUrl: string;
  discGolfMetrixCountryCode: string;
  discGolfMetrixApiCode: string;
}

export type WorkerEnvOverride = Partial<WorkerEnv>;

const workerEnvOverrideStorage = new AsyncLocalStorage<WorkerEnvOverride>();

function requireEnv(name: string): string {
  const override = workerEnvOverrideStorage.getStore();
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

export function loadWorkerEnv(): WorkerEnv {
  const override = workerEnvOverrideStorage.getStore();

  return {
    supabaseUrl: requireEnv("SUPABASE_URL"),
    supabaseServiceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    discGolfMetrixBaseUrl:
      override?.discGolfMetrixBaseUrl ??
      process.env.DISCGOLFMETRIX_BASE_URL ??
      "https://discgolfmetrix.com",
    discGolfMetrixCountryCode: requireEnv("DISCGOLFMETRIX_COUNTRY_CODE"),
    discGolfMetrixApiCode: requireEnv("DISCGOLFMETRIX_API_CODE"),
  };
}

export function runWithWorkerEnv<T>(
  env: WorkerEnvOverride,
  callback: () => T,
): T {
  return workerEnvOverrideStorage.run(env, callback);
}

export function loadWorkerExecutionEnv(): Pick<
  WorkerEnv,
  "discGolfMetrixBaseUrl" | "discGolfMetrixCountryCode" | "discGolfMetrixApiCode"
> {
  const env = loadWorkerEnv();

  return {
    discGolfMetrixBaseUrl: env.discGolfMetrixBaseUrl,
    discGolfMetrixCountryCode: env.discGolfMetrixCountryCode,
    discGolfMetrixApiCode: env.discGolfMetrixApiCode,
  };
}

function toOverrideKey(name: string): keyof WorkerEnvOverride {
  switch (name) {
    case "SUPABASE_URL":
      return "supabaseUrl";
    case "SUPABASE_SERVICE_ROLE_KEY":
      return "supabaseServiceRoleKey";
    case "DISCGOLFMETRIX_COUNTRY_CODE":
      return "discGolfMetrixCountryCode";
    case "DISCGOLFMETRIX_API_CODE":
      return "discGolfMetrixApiCode";
    default:
      throw new Error(`Unsupported worker runtime env key: ${name}`);
  }
}
