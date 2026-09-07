"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { browserFichaStorage, readRecentFichaHrefs } from "@/lib/ficha-session";

const PREFETCH_HREFS = [
  "/",
  "/watchlist",
  "/buscar",
  "/listas",
  "/perfil",
  "/tags",
] as const;

export const NavPrefetch = () => {
  const router = useRouter();

  useEffect(() => {
    const prefetchAll = () => {
      const recentFichas = readRecentFichaHrefs(browserFichaStorage());
      for (const href of [...PREFETCH_HREFS, ...recentFichas]) {
        router.prefetch(href);
      }
    };

    const timer = window.setTimeout(prefetchAll, 180);
    return () => window.clearTimeout(timer);
  }, [router]);

  return null;
};
