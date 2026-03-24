import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { AuthUser } from "@metrix-parser/shared-types";

import {
  getCurrentSession,
  login,
  logout,
  resolveAuthErrorMessage,
} from "../../shared/api/auth";
import {
  clearStoredSessionToken,
  setStoredSessionToken,
} from "./auth-storage";

export interface AuthContextValue {
  status: "loading" | "authenticated" | "anonymous";
  user: AuthUser | null;
  isSubmitting: boolean;
  errorMessage: string | null;
  signIn: (loginValue: string, passwordValue: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  status: "anonymous",
  user: null,
  isSubmitting: false,
  errorMessage: null,
  signIn: async () => false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function restoreSession() {
      try {
        const session = await getCurrentSession();

        if (!isActive) {
          return;
        }

        if (session.authenticated && session.user) {
          setStatus("authenticated");
          setUser(session.user);
          return;
        }

        clearStoredSessionToken();
        setStatus("anonymous");
        setUser(null);
      } catch {
        if (!isActive) {
          return;
        }

        clearStoredSessionToken();
        setStatus("anonymous");
        setUser(null);
      }
    }

    void restoreSession();

    return () => {
      isActive = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    return {
      status,
      user,
      isSubmitting,
      errorMessage,
      async signIn(loginValue, passwordValue) {
        setIsSubmitting(true);
        setErrorMessage(null);

        try {
          const response = await login({
            login: loginValue.trim(),
            password: passwordValue,
          });

          setStoredSessionToken(response.sessionToken);
          setStatus(response.session.authenticated ? "authenticated" : "anonymous");
          setUser(response.session.user);

          return response.session.authenticated;
        } catch (error) {
          clearStoredSessionToken();
          setStatus("anonymous");
          setUser(null);
          setErrorMessage(resolveAuthErrorMessage(error));

          return false;
        } finally {
          setIsSubmitting(false);
        }
      },
      async signOut() {
        setIsSubmitting(true);

        try {
          await logout();
        } finally {
          clearStoredSessionToken();
          setStatus("anonymous");
          setUser(null);
          setErrorMessage(null);
          setIsSubmitting(false);
        }
      },
    };
  }, [errorMessage, isSubmitting, status, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
