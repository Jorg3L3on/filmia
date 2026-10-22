"use client";

import { usePathname } from "next/navigation";
import { HoySkeleton, PageChromeSkeleton } from "@/components/PageSkeletons";

/**
 * The root boundary's skeleton (FIL-I25-6): Hoy's big poster only on `/`; anywhere else a
 * neutral header + blocks, so a cold /perfil never flashes Hoy before its own skeleton.
 */
export const RootLoadingSkeleton = () => (usePathname() === "/" ? <HoySkeleton /> : <PageChromeSkeleton />);
