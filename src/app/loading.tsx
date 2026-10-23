import { ViewTransition } from "react";
import { IrisLoader } from "@/components/launch/IrisLoader";
import { RootLoadingSkeleton } from "@/components/RootLoadingSkeleton";

/**
 * Cold start (standalone, before hydration) paints Iris. After `data-booted`,
 * the loader is `display: none` and this boundary is the Hoy skeleton on `/` and a neutral one
 * elsewhere (FIL-I25-6).
 * The named view transition is the 240ms iris-out; its new image is not
 * crossfaded, so Hoy is already painted under the hole.
 */
export default function Loading() {
  return (
    <>
      <ViewTransition name="launch" default="none" exit="iris-out">
        <IrisLoader />
      </ViewTransition>
      <RootLoadingSkeleton />
    </>
  );
}
