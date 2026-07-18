export type AuthUser = {
  id: number;
  name: string;
  email: string;
  daily_threshold?: number;
  gemini_admin?: boolean;
};

export type AuthSession = {
  user: AuthUser;
  expiresAt: number;
  accessToken?: string;
  refreshToken?: string;
};
