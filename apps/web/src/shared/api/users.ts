import type {
  ApiEnvelope,
  AppUser,
  UsersListMeta,
  UsersListResponse,
} from "@metrix-parser/shared-types";

import { ApiClientError, requestEnvelope } from "./http";

export function listUsers(): Promise<
  ApiEnvelope<UsersListResponse, UsersListMeta>
> {
  return requestEnvelope<UsersListResponse, UsersListMeta>("/users", {
    method: "GET",
  });
}

export function resolveUsersErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  return "Не удалось загрузить список пользователей.";
}

export function resolveUsersTotal(
  users: AppUser[],
  meta?: UsersListMeta,
): number {
  return meta?.count ?? users.length;
}
