import { Suspense } from "react";
import {
  DiaryRouteSkeleton,
  DiaryRouteSkeletonFallback,
} from "@/components/DiaryRouteSkeleton";

export default function Loading() {
  return (
    <Suspense fallback={<DiaryRouteSkeletonFallback />}>
      <DiaryRouteSkeleton />
    </Suspense>
  );
}
