"use client";

import { useEffect, useRef, useState } from "react";

/** The page title scrolled away (a sentinel at the top crosses the header): the sticky bar condenses. */
export const useCondensedBar = () => {
  const [condensed, setCondensed] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setCondensed(Boolean(entry && !entry.isIntersecting && entry.boundingClientRect.top < 0)),
      { rootMargin: "-56px 0px 0px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return { condensed, sentinelRef };
};
