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

/** Claims beyond identity. `onboarded: false` keeps the proxy redirecting to /bienvenida. */
export type SessionFlags = {
  onboarded: boolean;
};

export const DEFAULT_SESSION_FLAGS: SessionFlags = { onboarded: true };

export type SessionPayload = SessionUser &
  SessionFlags & {
    exp: number;
    iat: number;
  };
