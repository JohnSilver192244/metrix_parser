import type {
  AuthSession,
  AuthSessionResponse,
  LoginRequestBody,
  LoginResponse,
} from "@metrix-parser/shared-types";

import { ApiClientError, requestEnvelope } from "./http";

export function getCurrentSession(): Promise<AuthSession> {
  return requestEnvelope<AuthSessionResponse>("/auth/session", {
    method: "GET",
  }).then((envelope) => envelope.data);
}

export function login(credentials: LoginRequestBody): Promise<LoginResponse> {
  return requestEnvelope<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  }).then((envelope) => envelope.data);
}

export function logout(): Promise<AuthSession> {
  return requestEnvelope<AuthSessionResponse>("/auth/logout", {
    method: "POST",
  }).then((envelope) => envelope.data);
}

export function resolveAuthErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === "invalid_credentials") {
      return "Неверный логин или пароль.";
    }

    return error.message;
  }

  return "Не удалось выполнить вход.";
}
