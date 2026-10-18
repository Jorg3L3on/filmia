import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

/**
 * Suspends the home segment so the root `loading.tsx` (Iris) is in the first
 * HTML chunk. A loading file cannot cover the layout in its own segment; the
 * root fallback can. The yield is one macrotask: a promise that is already
 * resolved never flushes that shell. Hoy's deck query stays in the page
 * Suspense, so the iris does not wait on it. Return visits keep this yield,
 * but the root fallback swaps to HoySkeleton once `data-booted` is set.
 */
const DiarioLayout = async ({ children }: { children: ReactNode }) => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
  return children;
};

export default DiarioLayout;
