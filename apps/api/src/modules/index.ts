import type { RouteDefinition } from "../lib/router";

import { competitionsRoutes } from "./competitions";
import { coursesRoutes } from "./courses";
import { healthRoutes } from "./health";
import { playersRoutes } from "./players";
import { resultsRoutes } from "./results";
import {
  getUpdatesRoutes,
  type UpdatesRouteDependencies,
} from "./updates";

export interface ApiModuleDependencies {
  updates?: UpdatesRouteDependencies;
}

export function getRegisteredRoutes(
  dependencies: ApiModuleDependencies = {},
): RouteDefinition[] {
  return [
    ...healthRoutes,
    ...getUpdatesRoutes(dependencies.updates),
    ...competitionsRoutes,
    ...coursesRoutes,
    ...playersRoutes,
    ...resultsRoutes,
  ];
}
