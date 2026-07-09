import type { UpdateOperationResult } from "@metrix-parser/shared-types";

import type { WorkerEnv } from "../config/env";
import { runSingleCourseUpdateJob } from "../jobs/courses-update-job";

export async function executeSingleCourseUpdate(
  courseId: string,
  env: Pick<WorkerEnv, "discGolfMetrixBaseUrl" | "discGolfMetrixCountryCode" | "discGolfMetrixApiCode">,
): Promise<UpdateOperationResult> {
  return runSingleCourseUpdateJob(courseId, {
    baseUrl: env.discGolfMetrixBaseUrl,
    countryCode: env.discGolfMetrixCountryCode,
    apiCode: env.discGolfMetrixApiCode,
  });
}
