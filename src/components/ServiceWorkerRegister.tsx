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
