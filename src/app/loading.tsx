import { ViewTransition } from "react";
import { IrisLoader } from "@/components/launch/IrisLoader";

/** Root fallback. The home layout suspends under this boundary so Iris is the first paint. */
export default function Loading() {
  return (
    <ViewTransition name="launch" default="none" exit="iris-out">
      <IrisLoader />
    </ViewTransition>
  );
}
