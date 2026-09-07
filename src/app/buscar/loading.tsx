import { SearchBodySkeleton } from "@/components/PageSkeletons";

export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="h-10 w-36 rounded-xl shimmer" />
      <SearchBodySkeleton />
    </div>
  );
}
