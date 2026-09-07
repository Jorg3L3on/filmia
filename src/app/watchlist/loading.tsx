import { WatchlistBodySkeleton } from "@/components/PageSkeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-48 rounded-xl shimmer" />
      <WatchlistBodySkeleton />
    </div>
  );
}
