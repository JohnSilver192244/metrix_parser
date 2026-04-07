import type { UpdatePeriod } from "@metrix-parser/shared-types";

import type { WorkerEnv } from "../config/env";
import { runPlayersUpdateJob } from "../jobs/players-update-job";

export async function executePlayersUpdate(
  period: UpdatePeriod,
  overwriteExisting: boolean,
  env: Pick<
    WorkerEnv,
    "discGolfMetrixBaseUrl" | "discGolfMetrixCountryCode" | "discGolfMetrixApiCode"
  >,
) {
  return runPlayersUpdateJob(period, {
    baseUrl: env.discGolfMetrixBaseUrl,
    countryCode: env.discGolfMetrixCountryCode,
    apiCode: env.discGolfMetrixApiCode,
    overwriteExisting,
  });
}
