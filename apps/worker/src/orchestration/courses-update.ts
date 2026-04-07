import type { WorkerEnv } from "../config/env";
import { runCoursesUpdateJob } from "../jobs/courses-update-job";

export async function executeCoursesUpdate(
  overwriteExisting: boolean,
  env: Pick<WorkerEnv, "discGolfMetrixBaseUrl" | "discGolfMetrixCountryCode" | "discGolfMetrixApiCode">,
) {
  return runCoursesUpdateJob({
    baseUrl: env.discGolfMetrixBaseUrl,
    countryCode: env.discGolfMetrixCountryCode,
    apiCode: env.discGolfMetrixApiCode,
    overwriteExisting,
  });
}
