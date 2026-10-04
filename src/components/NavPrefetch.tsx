"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  FICHA_OPENED_EVENT,
  browserFichaStorage,
  readRecentFichaHrefs,
} from "@/lib/ficha-session";
import {
  collectWarmNavHrefs,
  readBrowserConnection,
  resolveNavPrefetchPolicy,
  scheduleIdleWork,
  scheduleStaggeredWork,
} from "@/lib/nav-prefetch";

const warmedHrefs = new Set<string>();

export const NavPrefetch = () => {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const policy = resolveNavPrefetchPolicy(readBrowserConnection());
    if (!policy.enabled) {
      return;
    }

    let cancelStagger: (() => void) | undefined;

    const prefetchHref = (href: string) => {
      if (!href || warmedHrefs.has(href)) {
        return;
      }
      warmedHrefs.add(href);
      router.prefetch(href);
    };

    const prefetchWarmNav = () => {
      const recentFichas = readRecentFichaHrefs(browserFichaStorage());
      const hrefs = collectWarmNavHrefs(pathname, recentFichas, policy);
      cancelStagger?.();
      cancelStagger = scheduleStaggeredWork(
        hrefs.map((href) => () => prefetchHref(href)),
        policy.staggerMs,
      );
    };

    const cancelIdle = scheduleIdleWork(prefetchWarmNav, {
      idleMs: policy.idleMs,
      idleTimeoutMs: policy.idleTimeoutMs,
    });

    const handleFichaOpened = (event: Event) => {
      if (policy.maxRecentFichas <= 0) {
        return;
      }
      const href = (event as CustomEvent<string>).detail;
      if (typeof href === "string" && href !== pathname) {
        prefetchHref(href);
      }
    };

    window.addEventListener(FICHA_OPENED_EVENT, handleFichaOpened);
    return () => {
      cancelIdle();
      cancelStagger?.();
      window.removeEventListener(FICHA_OPENED_EVENT, handleFichaOpened);
    };
  }, [pathname, router]);

  return null;
};
