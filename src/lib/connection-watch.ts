import { showToast } from "@/lib/toast";
import { TOAST_COPY } from "@/lib/toast-alerts";

/**
 * A client navigation whose RSC fetch never reached the server (UX-17): Next leaves the page as
 * it was and says nothing. Prefetches fail quietly too, so only a real navigation (an `rsc`
 * request that is not a prefetch) is reported, with «Reintentar» repeating it.
 */
export const CONNECTION_TOAST_KEY = "connection-lost";

const headerOf = (input: RequestInfo | URL, init: RequestInit | undefined, name: string) => {
  const fromInit = init?.headers ? new Headers(init.headers).get(name) : null;
  if (fromInit != null) {
    return fromInit;
  }
  return typeof Request !== "undefined" && input instanceof Request ? input.headers.get(name) : null;
};

export const isNavigationFetch = (input: RequestInfo | URL, init?: RequestInit) =>
  headerOf(input, init, "rsc") === "1" &&
  !headerOf(input, init, "next-router-prefetch") &&
  !headerOf(input, init, "next-router-segment-prefetch") &&
  !headerOf(input, init, "next-action");

/** The page the navigation was going to, without Next's `_rsc` cache-buster. */
export const navigationTarget = (input: RequestInfo | URL, base: string) => {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(raw, base);
  url.searchParams.delete("_rsc");
  return `${url.pathname}${url.search}${url.hash}`;
};

export const announceConnectionLost = (target: string, go: (path: string) => void) => {
  showToast({
    key: CONNECTION_TOAST_KEY,
    title: TOAST_COPY.connectionLost,
    description: TOAST_COPY.connectionLostDetail,
    variant: "error",
    persistent: true,
    action: { label: TOAST_COPY.retry, onClick: () => go(target) },
  });
};

/**
 * Wraps a fetch so a failed navigation is reported. On a failed RSC navigation Next falls back to
 * a full browser navigation, which offline lands on the browser's error page and loses the page
 * the user was on. So that one fetch is held (never settles): the page stays, the toast offers
 * «Reintentar», and the next navigation supersedes the held one. Anything else is rethrown.
 */
export const watchNavigationFailures =
  (original: typeof fetch, go: (path: string) => void, base: () => string): typeof fetch =>
  async (input, init) => {
    try {
      return await original(input, init);
    } catch (error) {
      if (error instanceof TypeError && isNavigationFetch(input, init)) {
        announceConnectionLost(navigationTarget(input, base()), go);
        return new Promise<Response>(() => {});
      }
      throw error;
    }
  };
