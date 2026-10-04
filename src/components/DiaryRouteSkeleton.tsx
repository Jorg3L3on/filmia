"use client";

import { useSearchParams } from "next/navigation";
import { DiaryModeToggle } from "@/components/DiaryModeToggle";
import {
  DiaryBodySkeleton,
  type DiarySkeletonMode,
} from "@/components/PageSkeletons";
import { parseDiaryMode } from "@/lib/diary-picks";
import { HISTORIAL_DEFAULT_VIEW, type DeckViewMode } from "@/lib/diary-view";

const isView = (value: string | null): value is DeckViewMode =>
  value === "deck" || value === "grid" || value === "calendar";

const resolveSkeletonMode = (
  mode: ReturnType<typeof parseDiaryMode>,
  viewParam: string | null,
): DiarySkeletonMode => {
  if (mode !== "historial") {
    return "picks";
  }
  if (isView(viewParam)) {
    return viewParam;
  }
  return HISTORIAL_DEFAULT_VIEW;
};

/** Soft-nav loading chrome that mirrors Qué ver / Historial + view. */
export const DiaryRouteSkeleton = () => {
  const params = useSearchParams();
  const mode = parseDiaryMode(params.get("mode") ?? undefined);
  const skeletonMode = resolveSkeletonMode(mode, params.get("view"));

  return (
    <div className="space-y-6">
      <DiaryModeToggle mode={mode} />
      <DiaryBodySkeleton
        mode={skeletonMode}
        label={
          mode === "historial" ? "Cargando historial" : "Cargando diario"
        }
      />
    </div>
  );
};

export const DiaryRouteSkeletonFallback = () => (
  <div className="space-y-6">
    <DiaryModeToggle mode="picks" />
    <DiaryBodySkeleton mode="picks" />
  </div>
);
