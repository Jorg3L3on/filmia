import { RootLoadingSkeleton } from "@/components/RootLoadingSkeleton";

/**
 * The root boundary: the Hoy skeleton on `/` and a neutral one elsewhere (FIL-I25-6).
 * The cold-start loader lives in the root layout (FIL-43), outside this boundary,
 * so the stream swapping this fallback never cuts its reveal short.
 */
export default function Loading() {
  return <RootLoadingSkeleton />;
}
