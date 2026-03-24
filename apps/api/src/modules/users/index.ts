import type { AppUser } from "@metrix-parser/shared-types";

import { sendSuccess } from "../../lib/http";
import type { RouteDefinition } from "../../lib/router";
import {
  listUsersFromRuntime,
  readSessionToken,
  requireAuthenticatedUser,
  type AuthGuardDependencies,
} from "../auth/runtime";

export interface UsersRouteDependencies {
  listUsers?: () => Promise<AppUser[]>;
}

export function getUsersRoutes(
  dependencies: UsersRouteDependencies = {},
  authDependencies: AuthGuardDependencies = {},
): RouteDefinition[] {
  return [
    {
      method: "GET",
      path: "/users",
      handler: async ({ req, res }) => {
        await requireAuthenticatedUser(readSessionToken(req), authDependencies);

        const users = await (dependencies.listUsers ?? listUsersFromRuntime)();

        sendSuccess(res, users, {
          count: users.length,
        });
      },
    },
  ];
}
