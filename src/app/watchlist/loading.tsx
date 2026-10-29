import { PageHeaderSkeleton, WatchlistBodySkeleton } from "@/components/PageSkeletons";

export default function Loading() {
  return (
    <div className="space-y-5 max-sm:-mt-6 max-sm:space-y-1">
      <div className="hidden sm:block">
        <PageHeaderSkeleton />
      </div>
      <WatchlistBodySkeleton />
    </div>
  );
}
