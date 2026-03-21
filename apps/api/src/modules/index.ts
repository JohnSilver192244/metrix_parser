import type { RouteDefinition } from "../lib/router";

import { competitionsRoutes } from "./competitions";
import { coursesRoutes } from "./courses";
import { healthRoutes } from "./health";
import { playersRoutes } from "./players";
import { resultsRoutes } from "./results";
import { updatesRoutes } from "./updates";

export function getRegisteredRoutes(): RouteDefinition[] {
  return [
    ...healthRoutes,
    ...updatesRoutes,
    ...competitionsRoutes,
    ...coursesRoutes,
    ...playersRoutes,
    ...resultsRoutes,
  ];
}
