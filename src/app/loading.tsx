import { ViewTransition } from "react";
import { HoySkeleton } from "@/components/PageSkeletons";
import { IrisLoader } from "@/components/launch/IrisLoader";

/**
 * Cold start (standalone, before hydration) paints Iris. After `data-booted`,
 * the loader is `display: none` and this boundary is the Hoy skeleton.
 * The named view transition is the 240ms iris-out; its new image is not
 * crossfaded, so Hoy is already painted under the hole.
 */
export default function Loading() {
  return (
    <>
      <ViewTransition name="launch" default="none" exit="iris-out">
        <IrisLoader />
      </ViewTransition>
      <HoySkeleton />
    </>
  );
}
