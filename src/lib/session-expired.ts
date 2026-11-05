import { dismissToastsShownSince, setToastGate, showToast } from "@/lib/toast";
import {
  SESSION_EXPIRED_BODY,
  SESSION_EXPIRED_HEADER,
  SESSION_EXPIRED_VALUE,
  NEXT_UNEXPECTED_RESPONSE,
} from "@/lib/session-expired-copy";
import { TOAST_COPY } from "@/lib/toast-alerts";

/** Session gone while a page stays open (FIL-I41-18); the wire format is in session-expired-copy. */

export const SESSION_TOAST_KEY = "session-expired";
/** Optimistic toasts shown this long before the refusal are taken back. */
const RECENT_MS = 15_000;
/** For this long after the refusal, other toasts are muted: one clear message. */
const MUTE_MS = 15_000;

let expiredAt: number | null = null;

export const isSessionExpiredResponse = (response: Pick<Response, "status" | "headers">) =>
  response.status === 401 && response.headers.get(SESSION_EXPIRED_HEADER) === SESSION_EXPIRED_VALUE;

/** `/login?callbackUrl=<where the user is>` so signing in brings them back. */
export const loginHrefFor = (path: string) =>
  path && path !== "/" ? `/login?callbackUrl=${encodeURIComponent(path)}` : "/login";

const currentPath = () =>
  typeof window === "undefined" ? "/" : `${window.location.pathname}${window.location.search}`;

/** One persistent «Sesión vencida» toast with «Entrar»; the optimistic success toasts go away. */
export const announceSessionExpired = (now: number = Date.now(), path: string = currentPath()) => {
  expiredAt = now;
  dismissToastsShownSince(now - RECENT_MS, (item) => item.key === SESSION_TOAST_KEY);
  showToast({
    key: SESSION_TOAST_KEY,
    title: TOAST_COPY.sessionExpired,
    description: TOAST_COPY.sessionExpiredDetail,
    variant: "error",
    persistent: true,
    action: {
      label: TOAST_COPY.signIn,
      onClick: () => {
        window.location.assign(loginHrefFor(path));
      },
    },
  });
};


setToastGate((payload) => {
  if (payload.key !== SESSION_TOAST_KEY && expiredAt != null && Date.now() - expiredAt <= MUTE_MS) {
    return null;
  }
  if (payload.description === NEXT_UNEXPECTED_RESPONSE || payload.description === SESSION_EXPIRED_BODY) {
    return { ...payload, description: TOAST_COPY.retryHint };
  }
  return payload;
});

/** Test hook: forget a previous refusal. */
export const resetSessionExpired = () => {
  expiredAt = null;
};

let installed = false;

/** Watch every fetch of the page (Server Actions go through `window.fetch`). Idempotent. */
export const installSessionWatch = () => {
  if (installed || typeof window === "undefined") {
    return;
  }
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const response = await original(...args);
    if (isSessionExpiredResponse(response)) {
      announceSessionExpired();
    }
    return response;
  };
};
