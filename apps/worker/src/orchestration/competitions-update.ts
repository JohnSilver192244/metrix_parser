import type { UpdatePeriod } from "@metrix-parser/shared-types";

import type { WorkerEnv } from "../config/env";
import { runCompetitionsUpdateJob } from "../jobs/competitions-update-job";

export async function executeCompetitionsUpdate(
  period: UpdatePeriod,
  overwriteExisting: boolean,
  env: Pick<WorkerEnv, "discGolfMetrixBaseUrl" | "discGolfMetrixCountryCode" | "discGolfMetrixApiCode">,
) {
  return runCompetitionsUpdateJob(period, {
    baseUrl: env.discGolfMetrixBaseUrl,
    countryCode: env.discGolfMetrixCountryCode,
    apiCode: env.discGolfMetrixApiCode,
    overwriteExisting,
  });
}
