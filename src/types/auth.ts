export type AuthUser = {
  id?: number;
  name: string;
  email?: string;
  role?: string;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
  expiresAt?: number;
};
