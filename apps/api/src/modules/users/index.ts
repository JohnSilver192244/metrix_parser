import type { AppUser } from "@metrix-parser/shared-types";

import { sendSuccess } from "../../lib/http";
import { resolveListPagination } from "../../lib/pagination";
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
      handler: async ({ req, res, url }) => {
        await requireAuthenticatedUser(readSessionToken(req), authDependencies);

        const pagination = resolveListPagination(url);
        const allUsers = await (dependencies.listUsers ?? listUsersFromRuntime)();
        const users = allUsers.slice(pagination.offset, pagination.offset + pagination.limit);

        sendSuccess(res, users, {
          count: users.length,
          limit: pagination.limit,
          offset: pagination.offset,
        });
      },
    },
  ];
}
