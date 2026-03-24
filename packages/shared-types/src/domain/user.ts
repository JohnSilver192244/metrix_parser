export interface AuthUser {
  login: string;
  createdAt?: string;
}

export interface AuthSession {
  authenticated: boolean;
  user: AuthUser | null;
}

export interface LoginRequestBody {
  login: string;
  password: string;
}

export interface LoginResponse {
  sessionToken: string;
  session: AuthSession;
}

export interface AppUser {
  login: string;
  createdAt: string;
}

export interface AppUserDbRecord {
  login: string;
  password: string;
  created_at: string;
}

export interface UserSessionDbRecord {
  session_token: string;
  user_login: string;
  created_at: string;
}
