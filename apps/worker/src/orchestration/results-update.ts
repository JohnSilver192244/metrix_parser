import type { UpdatePeriod } from "@metrix-parser/shared-types";

import type { WorkerEnv } from "../config/env";
import { runResultsPipelineUpdateJob } from "../jobs/results-pipeline-update-job";

export async function executeResultsUpdate(
  period: UpdatePeriod,
  env: Pick<WorkerEnv, "discGolfMetrixBaseUrl" | "discGolfMetrixCountryCode" | "discGolfMetrixApiCode">,
) {
  return runResultsPipelineUpdateJob(period, {
    baseUrl: env.discGolfMetrixBaseUrl,
    countryCode: env.discGolfMetrixCountryCode,
    apiCode: env.discGolfMetrixApiCode,
  });
}
