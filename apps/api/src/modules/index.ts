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
  getSeasonPointsTableRoutes,
  type SeasonPointsTableRouteDependencies,
} from "./season-points-table";
import {
  getSeasonStandingsRoutes,
  type SeasonStandingsRouteDependencies,
} from "./season-standings";
import {
  getSeasonsRoutes,
  type SeasonsRouteDependencies,
} from "./seasons";
import {
  getUpdatesRoutes,
  type UpdatesRouteDependencies,
} from "./updates";
import {
  getUsersRoutes,
  type UsersRouteDependencies,
} from "./users";
import {
  getTournamentCategoriesRoutes,
  type TournamentCategoriesRouteDependencies,
} from "./tournament-categories";

export interface ApiModuleDependencies {
  auth?: AuthRouteDependencies;
  competitions?: CompetitionsRouteDependencies;
  courses?: CoursesRouteDependencies;
  divisions?: DivisionsRouteDependencies;
  players?: PlayersRouteDependencies;
  results?: ResultsRouteDependencies;
  seasonPointsTable?: SeasonPointsTableRouteDependencies;
  seasonStandings?: SeasonStandingsRouteDependencies;
  seasons?: SeasonsRouteDependencies;
  tournamentCategories?: TournamentCategoriesRouteDependencies;
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
    ...getCompetitionsRoutes(dependencies.competitions, dependencies.auth),
    ...getCoursesRoutes(dependencies.courses),
    ...getDivisionsRoutes(dependencies.divisions, dependencies.auth),
    ...getPlayersRoutes(dependencies.players, dependencies.auth),
    ...getResultsRoutes(dependencies.results),
    ...getSeasonsRoutes(dependencies.seasons),
    ...getSeasonPointsTableRoutes(dependencies.seasonPointsTable),
    ...getSeasonStandingsRoutes(dependencies.seasonStandings, dependencies.auth),
    ...getTournamentCategoriesRoutes(
      dependencies.tournamentCategories,
      dependencies.auth,
    ),
    ...getUsersRoutes(dependencies.users, dependencies.auth),
  ];
}
