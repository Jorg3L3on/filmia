"use client";

import { useEffect } from "react";

/**
 * Registers the assets-only service worker (JOR-219).
 * Production only — avoids next dev / HMR fighting the SW; never caches diary data.
 */
export const ServiceWorkerRegister = () => {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        // Progressive enhancement — auth and force-dynamic routes must keep working without SW.
      });
  }, []);

  return null;
};

/** Kept here so the worker has one home (verify-fase-4); Perfil «Avisos» uses these for push. */
export const hasServiceWorker = () => typeof navigator !== "undefined" && "serviceWorker" in navigator;

/** The worker registers in production on load; push needs it in dev and on a first visit too. */
export const ensureServiceWorker = async () => {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (!existing) {
    await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  }
  return navigator.serviceWorker.ready;
};

export const currentPushSubscription = async () => {
  const registration = await navigator.serviceWorker.getRegistration("/");
  return registration ? registration.pushManager.getSubscription() : null;
};
