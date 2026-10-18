"use client";

import { useEffect } from "react";

/**
 * Marks the document after hydration. The first HTML paint can still show Iris
 * (standalone, no attribute yet). Later suspense fallbacks match
 * `html[data-booted] .iris-loader` and stay on the Hoy skeleton.
 */
export const LaunchBoot = () => {
  useEffect(() => {
    document.documentElement.dataset.booted = "";
  }, []);
  return null;
};
