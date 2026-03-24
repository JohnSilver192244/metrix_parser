import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";

import type {
  AppUser,
  AppUserDbRecord,
  AuthSession,
  AuthUser,
  LoginRequestBody,
  LoginResponse,
} from "@metrix-parser/shared-types";

import { HttpError } from "../../lib/http-errors";
import { createApiSupabaseAdminClient } from "../../lib/supabase-admin";

const APP_PUBLIC_SCHEMA = "app_public";
const APP_USERS_SELECT_COLUMNS = [
  "login",
  "password",
  "created_at",
].join(", ");
const APP_USERS_PUBLIC_SELECT_COLUMNS = [
  "login",
  "created_at",
].join(", ");
const USER_SESSIONS_SELECT_COLUMNS = [
  "session_token",
  "user_login",
  "created_at",
].join(", ");
const AUTHORIZATION_PREFIX = "Bearer ";

type AppUserPublicRecord = Pick<AppUserDbRecord, "login" | "created_at">;

interface UserSessionLookupRecord {
  session_token: string;
  user_login: string;
  created_at: string;
}

interface AuthRuntimeAdapter {
  findUserByLogin(login: string): Promise<AppUserDbRecord | null>;
  findUserBySessionToken(sessionToken: string): Promise<AuthUser | null>;
  createSession(userLogin: string): Promise<string>;
  deleteSession(sessionToken: string): Promise<void>;
  listUsers(): Promise<AppUser[]>;
}

export interface AuthGuardDependencies {
  getSession?: (sessionToken: string | null) => Promise<AuthSession>;
  requireAuthenticatedUser?: (sessionToken: string | null) => Promise<AuthUser>;
}

function createAnonymousSession(): AuthSession {
  return {
    authenticated: false,
    user: null,
  };
}

function toAuthUser(record: AppUserPublicRecord): AuthUser {
  return {
    login: record.login,
    createdAt: record.created_at,
  };
}

function toAppUser(record: AppUserPublicRecord): AppUser {
  return {
    login: record.login,
    createdAt: record.created_at,
  };
}

function createSupabaseAuthAdapter(): AuthRuntimeAdapter {
  const supabase = createApiSupabaseAdminClient();

  return {
    async findUserByLogin(login) {
      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("app_users")
        .select(APP_USERS_SELECT_COLUMNS)
        .eq("login", login)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to load app user: ${error.message}`);
      }

      return (data as AppUserDbRecord | null) ?? null;
    },
    async findUserBySessionToken(sessionToken) {
      const { data: sessionRecord, error: sessionError } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("user_sessions")
        .select(USER_SESSIONS_SELECT_COLUMNS)
        .eq("session_token", sessionToken)
        .maybeSingle();

      if (sessionError) {
        throw new Error(`Failed to load user session: ${sessionError.message}`);
      }

      if (!sessionRecord) {
        return null;
      }

      const resolvedSessionRecord =
        sessionRecord as unknown as UserSessionLookupRecord;

      const { data: userRecord, error: userError } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("app_users")
        .select(APP_USERS_PUBLIC_SELECT_COLUMNS)
        .eq("login", resolvedSessionRecord.user_login)
        .maybeSingle();

      if (userError) {
        throw new Error(`Failed to load app user by session: ${userError.message}`);
      }

      if (!userRecord) {
        return null;
      }

      return toAuthUser(userRecord as unknown as AppUserPublicRecord);
    },
    async createSession(userLogin) {
      const sessionToken = randomUUID();
      const { error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("user_sessions")
        .insert({
          session_token: sessionToken,
          user_login: userLogin,
        });

      if (error) {
        throw new Error(`Failed to create user session: ${error.message}`);
      }

      return sessionToken;
    },
    async deleteSession(sessionToken) {
      const { error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("user_sessions")
        .delete()
        .eq("session_token", sessionToken);

      if (error) {
        throw new Error(`Failed to delete user session: ${error.message}`);
      }
    },
    async listUsers() {
      const { data, error } = await supabase
        .schema(APP_PUBLIC_SCHEMA)
        .from("app_users")
        .select(APP_USERS_PUBLIC_SELECT_COLUMNS)
        .order("login", { ascending: true });

      if (error) {
        throw new Error(`Failed to load app users list: ${error.message}`);
      }

      return ((data ?? []) as unknown as AppUserPublicRecord[]).map(toAppUser);
    },
  };
}

export function readSessionToken(req: IncomingMessage): string | null {
  const authorization = req.headers.authorization;

  if (Array.isArray(authorization) || typeof authorization !== "string") {
    return null;
  }

  if (!authorization.startsWith(AUTHORIZATION_PREFIX)) {
    return null;
  }

  const sessionToken = authorization.slice(AUTHORIZATION_PREFIX.length).trim();

  return sessionToken.length > 0 ? sessionToken : null;
}

export async function getCurrentSessionFromRuntime(
  sessionToken: string | null,
): Promise<AuthSession> {
  if (!sessionToken) {
    return createAnonymousSession();
  }

  const adapter = createSupabaseAuthAdapter();
  const user = await adapter.findUserBySessionToken(sessionToken);

  if (!user) {
    return createAnonymousSession();
  }

  return {
    authenticated: true,
    user,
  };
}

export async function resolveCurrentSession(
  sessionToken: string | null,
  dependencies: AuthGuardDependencies = {},
): Promise<AuthSession> {
  return (dependencies.getSession ?? getCurrentSessionFromRuntime)(sessionToken);
}

export async function requireAuthenticatedUserFromRuntime(
  sessionToken: string | null,
): Promise<AuthUser> {
  const session = await getCurrentSessionFromRuntime(sessionToken);

  if (!session.authenticated || !session.user) {
    throw new HttpError(401, "unauthorized", "Authentication required");
  }

  return session.user;
}

export async function requireAuthenticatedUser(
  sessionToken: string | null,
  dependencies: AuthGuardDependencies = {},
): Promise<AuthUser> {
  return (dependencies.requireAuthenticatedUser ?? requireAuthenticatedUserFromRuntime)(
    sessionToken,
  );
}

export async function loginWithCredentialsFromRuntime(
  credentials: LoginRequestBody,
): Promise<LoginResponse> {
  const adapter = createSupabaseAuthAdapter();
  const userRecord = await adapter.findUserByLogin(credentials.login);

  if (!userRecord || userRecord.password !== credentials.password) {
    throw new HttpError(401, "invalid_credentials", "Неверный логин или пароль.");
  }

  const user = toAuthUser(userRecord);
  const sessionToken = await adapter.createSession(user.login);

  return {
    sessionToken,
    session: {
      authenticated: true,
      user,
    },
  };
}

export async function logoutFromRuntime(sessionToken: string | null): Promise<void> {
  if (!sessionToken) {
    return;
  }

  const adapter = createSupabaseAuthAdapter();
  await adapter.deleteSession(sessionToken);
}

export async function listUsersFromRuntime(): Promise<AppUser[]> {
  const adapter = createSupabaseAuthAdapter();

  return adapter.listUsers();
}
