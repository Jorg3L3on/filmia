export const SESSION_COOKIE_NAME = "filmia.session-token";

export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export const resolveAuthSecret = () =>
  process.env.AUTH_SECRET?.trim() ||
  process.env.NEXTAUTH_SECRET?.trim() ||
  "";

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
};

export type SessionPayload = SessionUser & {
  exp: number;
  iat: number;
};
