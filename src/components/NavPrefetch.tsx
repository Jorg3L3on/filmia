"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  FICHA_OPENED_EVENT,
  browserFichaStorage,
  readRecentFichaHrefs,
} from "@/lib/ficha-session";
import { collectWarmNavHrefs, scheduleIdleWork } from "@/lib/nav-prefetch";

const warmedHrefs = new Set<string>();

export const NavPrefetch = () => {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const prefetchHref = (href: string) => {
      if (!href || warmedHrefs.has(href)) {
        return;
      }
      warmedHrefs.add(href);
      router.prefetch(href);
    };

    const prefetchWarmNav = () => {
      const recentFichas = readRecentFichaHrefs(browserFichaStorage());
      for (const href of collectWarmNavHrefs(pathname, recentFichas)) {
        prefetchHref(href);
      }
    };

    const cancelIdle = scheduleIdleWork(prefetchWarmNav);

    const handleFichaOpened = (event: Event) => {
      const href = (event as CustomEvent<string>).detail;
      if (typeof href === "string" && href !== pathname) {
        prefetchHref(href);
      }
    };

    window.addEventListener(FICHA_OPENED_EVENT, handleFichaOpened);
    return () => {
      cancelIdle();
      window.removeEventListener(FICHA_OPENED_EVENT, handleFichaOpened);
    };
  }, [pathname, router]);

  return null;
};
