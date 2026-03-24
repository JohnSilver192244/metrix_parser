import type { RouteDefinition } from "../lib/router";

import {
  getCoursesRoutes,
  type CoursesRouteDependencies,
} from "./courses";
import {
  getDivisionsRoutes,
  type DivisionsRouteDependencies,
} from "./divisions";
import {
  getCompetitionsRoutes,
  type CompetitionsRouteDependencies,
} from "./competitions";
import { healthRoutes } from "./health";
import {
  getPlayersRoutes,
  type PlayersRouteDependencies,
} from "./players";
import {
  getResultsRoutes,
  type ResultsRouteDependencies,
} from "./results";
import {
  getUpdatesRoutes,
  type UpdatesRouteDependencies,
} from "./updates";

export interface ApiModuleDependencies {
  competitions?: CompetitionsRouteDependencies;
  courses?: CoursesRouteDependencies;
  divisions?: DivisionsRouteDependencies;
  players?: PlayersRouteDependencies;
  results?: ResultsRouteDependencies;
  updates?: UpdatesRouteDependencies;
}

export function getRegisteredRoutes(
  dependencies: ApiModuleDependencies = {},
): RouteDefinition[] {
  return [
    ...healthRoutes,
    ...getUpdatesRoutes(dependencies.updates),
    ...getCompetitionsRoutes(dependencies.competitions),
    ...getCoursesRoutes(dependencies.courses),
    ...getDivisionsRoutes(dependencies.divisions),
    ...getPlayersRoutes(dependencies.players),
    ...getResultsRoutes(dependencies.results),
  ];
}
