import type {
  AuthSession,
  LoginRequestBody,
  LoginResponse,
} from "@metrix-parser/shared-types";

import { readJsonBody, sendSuccess } from "../../lib/http";
import { HttpError } from "../../lib/http-errors";
import type { RouteDefinition } from "../../lib/router";
import {
  logoutFromRuntime,
  loginWithCredentialsFromRuntime,
  readSessionToken,
  resolveCurrentSession,
  type AuthGuardDependencies,
} from "./runtime";

export interface AuthRouteDependencies extends AuthGuardDependencies {
  login?: (credentials: LoginRequestBody) => Promise<LoginResponse>;
  logout?: (sessionToken: string | null) => Promise<void>;
}

function parseLoginRequestBody(body: unknown): LoginRequestBody {
  if (!body || typeof body !== "object") {
    throw new HttpError(400, "invalid_payload", "Request body must be a JSON object");
  }

  const loginValue = "login" in body ? body.login : undefined;
  const passwordValue = "password" in body ? body.password : undefined;

  if (typeof loginValue !== "string" || loginValue.trim().length === 0) {
    throw new HttpError(400, "invalid_login", "Login is required");
  }

  if (typeof passwordValue !== "string" || passwordValue.length === 0) {
    throw new HttpError(400, "invalid_password", "Password is required");
  }

  return {
    login: loginValue.trim(),
    password: passwordValue,
  };
}

export function getAuthRoutes(
  dependencies: AuthRouteDependencies = {},
): RouteDefinition[] {
  return [
    {
      method: "GET",
      path: "/auth/session",
      handler: async ({ req, res }) => {
        const sessionToken = readSessionToken(req);
        const session = await resolveCurrentSession(sessionToken, dependencies);

        sendSuccess<AuthSession>(res, session);
      },
    },
    {
      method: "POST",
      path: "/auth/login",
      handler: async ({ req, res }) => {
        const body = await readJsonBody<LoginRequestBody>(req);
        const credentials = parseLoginRequestBody(body);
        const response = await (dependencies.login ?? loginWithCredentialsFromRuntime)(
          credentials,
        );

        sendSuccess(res, response);
      },
    },
    {
      method: "POST",
      path: "/auth/logout",
      handler: async ({ req, res }) => {
        const sessionToken = readSessionToken(req);

        await (dependencies.logout ?? logoutFromRuntime)(sessionToken);

        sendSuccess<AuthSession>(res, {
          authenticated: false,
          user: null,
        });
      },
    },
  ];
}
