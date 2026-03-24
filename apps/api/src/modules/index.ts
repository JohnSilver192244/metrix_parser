import {
  getAuthRoutes,
  type AuthRouteDependencies,
} from "./auth";
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
import {
  getUsersRoutes,
  type UsersRouteDependencies,
} from "./users";

export interface ApiModuleDependencies {
  auth?: AuthRouteDependencies;
  competitions?: CompetitionsRouteDependencies;
  courses?: CoursesRouteDependencies;
  divisions?: DivisionsRouteDependencies;
  players?: PlayersRouteDependencies;
  results?: ResultsRouteDependencies;
  updates?: UpdatesRouteDependencies;
  users?: UsersRouteDependencies;
}

export function getRegisteredRoutes(
  dependencies: ApiModuleDependencies = {},
): RouteDefinition[] {
  return [
    ...healthRoutes,
    ...getAuthRoutes(dependencies.auth),
    ...getUpdatesRoutes(dependencies.updates, dependencies.auth),
    ...getCompetitionsRoutes(dependencies.competitions),
    ...getCoursesRoutes(dependencies.courses),
    ...getDivisionsRoutes(dependencies.divisions),
    ...getPlayersRoutes(dependencies.players, dependencies.auth),
    ...getResultsRoutes(dependencies.results),
    ...getUsersRoutes(dependencies.users, dependencies.auth),
  ];
}
