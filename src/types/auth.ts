export type AuthUser = {
  id?: number;
  name: string;
  email?: string;
  role?: string;
};

export type AuthSession = {
  user: AuthUser;
  expiresAt?: number;
};
