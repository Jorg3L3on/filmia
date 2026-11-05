/**
 * Shared by the proxy (no client code there) and the toast catalog (FIL-I41-18).
 * The proxy answers a Server Action that has no valid session with a 401 carrying
 * SESSION_EXPIRED_HEADER and this plain-text body, so the action rejects with a readable message.
 */
export const SESSION_EXPIRED_TITLE = "Sesión vencida";
export const SESSION_EXPIRED_DETAIL = "Vuelve a entrar para guardarlo.";
export const SESSION_EXPIRED_BODY = `${SESSION_EXPIRED_TITLE}. ${SESSION_EXPIRED_DETAIL}`;
export const SESSION_EXPIRED_HEADER = "x-filmia-session";
export const SESSION_EXPIRED_VALUE = "expired";

/** Next's text for an action response it could not read: never shown to the user as is. */
export const NEXT_UNEXPECTED_RESPONSE = "An unexpected response was received from the server.";

/** The action rejected because the proxy found no valid session. */
export const isSessionExpiredError = (error: unknown) =>
  error instanceof Error && error.message === SESSION_EXPIRED_BODY;
