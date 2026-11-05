import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  announceSessionExpired,
  isSessionExpiredResponse,
  loginHrefFor,
  resetSessionExpired,
  SESSION_TOAST_KEY,
} from "@/lib/session-expired";
import { SESSION_EXPIRED_BODY, SESSION_EXPIRED_HEADER, SESSION_EXPIRED_VALUE } from "@/lib/session-expired-copy";
import { dismissToast, getToasts, showToast } from "@/lib/toast";
import { TOAST_COPY } from "@/lib/toast-alerts";

const clear = () => {
  for (const item of getToasts()) dismissToast(item.id);
};

describe("session gone while the ficha is open (FIL-I41-18)", () => {
  beforeEach(() => {
    resetSessionExpired();
    clear();
  });

  it("recognises only the proxy's 401", () => {
    const expired = new Response(SESSION_EXPIRED_BODY, {
      status: 401,
      headers: { [SESSION_EXPIRED_HEADER]: SESSION_EXPIRED_VALUE },
    });
    assert.equal(isSessionExpiredResponse(expired), true);
    assert.equal(isSessionExpiredResponse(new Response("x", { status: 401 })), false);
    assert.equal(isSessionExpiredResponse(new Response("x", { status: 200 })), false);
  });

  it("takes back the optimistic success toast and shows one «Sesión vencida» with «Entrar»", () => {
    showToast({ title: TOAST_COPY.addedWatchlist, description: "El Padrino III" });
    showToast({ title: TOAST_COPY.markedSeen, description: "El Padrino" });
    announceSessionExpired(Date.now(), "/titulos/tmdb/pelicula/242");
    // The action then rejects and the page reports it: muted.
    showToast({ title: TOAST_COPY.couldNotSave, description: SESSION_EXPIRED_BODY, variant: "error" });

    const toasts = getToasts();
    assert.equal(toasts.length, 1, JSON.stringify(toasts.map((toast) => toast.title)));
    const [toast] = toasts;
    assert.equal(toast?.key, SESSION_TOAST_KEY);
    assert.equal(toast?.title, "Sesión vencida");
    assert.equal(toast?.variant, "error");
    assert.equal(toast?.durationMs, null);
    assert.equal(toast?.action?.label, "Entrar");
  });

  it("sends the user back to the same ficha after signing in", () => {
    assert.equal(loginHrefFor("/titulos/tmdb/pelicula/242"), "/login?callbackUrl=%2Ftitulos%2Ftmdb%2Fpelicula%2F242");
    assert.equal(loginHrefFor("/"), "/login");
  });

  it("never shows Next's English text for an unreadable response", () => {
    showToast({
      title: TOAST_COPY.couldNotSave,
      description: "An unexpected response was received from the server.",
      variant: "error",
    });
    assert.equal(getToasts().at(-1)?.description, TOAST_COPY.retryHint);
  });
});
