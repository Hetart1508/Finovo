export type AuthUser = {
  id?: number;
  name: string;
  email?: string;
  role?: string;
  gemini_admin?: boolean;
};

export type AuthSession = {
  user: AuthUser;
  expiresAt?: number;
};
