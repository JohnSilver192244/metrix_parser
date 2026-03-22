import type { UpdatePeriod } from "@metrix-parser/shared-types";

import type { WorkerEnv } from "../config/env";
import { runResultsUpdateJob } from "../jobs/results-update-job";

export async function executeResultsUpdate(
  period: UpdatePeriod,
  env: Pick<WorkerEnv, "discGolfMetrixBaseUrl" | "discGolfMetrixCountryCode" | "discGolfMetrixApiCode">,
) {
  return runResultsUpdateJob(period, {
    baseUrl: env.discGolfMetrixBaseUrl,
    countryCode: env.discGolfMetrixCountryCode,
    apiCode: env.discGolfMetrixApiCode,
  });
}
