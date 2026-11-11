"use client";

import { usePathname } from "next/navigation";
import { FichaBodySkeleton, HoySkeleton, PageChromeSkeleton } from "@/components/PageSkeletons";
import { FichaLoadingPoster } from "@/components/ficha/FichaLoadingPoster";
import { titleIdFromHref } from "@/lib/poster-flight";

/**
 * The root boundary's skeleton (FIL-I25-6): Hoy's big poster only on `/`; anywhere else a
 * neutral header + blocks, so a cold /perfil never flashes Hoy before its own skeleton.
 * A ficha gets its own skeleton with the tapped poster in place, so the poster cut lands
 * there even when the root boundary is the one that shows (FIL-I46-2).
 */
export const RootLoadingSkeleton = () => {
  const pathname = usePathname();
  if (pathname === "/") {
    return <HoySkeleton />;
  }
  const titleId = titleIdFromHref(pathname);
  if (titleId) {
    return <FichaBodySkeleton poster={<FichaLoadingPoster titleId={titleId} />} />;
  }
  return <PageChromeSkeleton />;
};
