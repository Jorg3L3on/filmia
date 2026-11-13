"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * La noche (FIL-I51-4): asks the server again about every 20 s while the screen is visible, and
 * right away when it comes back. No sockets and nothing paid: a plain refresh of the page's data.
 */
export const OscarLiveRefresh = ({ seconds = 20 }: { seconds?: number }) => {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };
    const timer = window.setInterval(tick, seconds * 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, seconds]);
  return null;
};
