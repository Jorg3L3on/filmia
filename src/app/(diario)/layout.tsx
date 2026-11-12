import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

/**
 * Suspends the home segment so the root `loading.tsx` (the Hoy skeleton) is in
 * the first HTML chunk. A loading file cannot cover the layout in its own
 * segment; the root fallback can. The yield is one macrotask: a promise that is
 * already resolved never flushes that shell. Hoy's deck query stays in the page
 * Suspense. The cold-start loader is in the root layout (FIL-43) and waits for
 * the deck on its own.
 */
const DiarioLayout = async ({ children }: { children: ReactNode }) => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
  return children;
};

export default DiarioLayout;
