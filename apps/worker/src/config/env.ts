export interface WorkerEnv {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  discGolfMetrixBaseUrl: string;
  discGolfMetrixCountryCode: string;
  discGolfMetrixApiCode: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function loadWorkerEnv(): WorkerEnv {
  return {
    supabaseUrl: requireEnv("SUPABASE_URL"),
    supabaseServiceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    discGolfMetrixBaseUrl: process.env.DISCGOLFMETRIX_BASE_URL ?? "https://discgolfmetrix.com",
    discGolfMetrixCountryCode: requireEnv("DISCGOLFMETRIX_COUNTRY_CODE"),
    discGolfMetrixApiCode: requireEnv("DISCGOLFMETRIX_API_CODE"),
  };
}
