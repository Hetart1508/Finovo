export type AuthUser = {
  id: number;
  name: string;
  email: string;
  daily_threshold?: number;
};

export type AuthSession = {
  user: AuthUser;
  expiresAt: number;
  accessToken?: string;
  refreshToken?: string;
};
