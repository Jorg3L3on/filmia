import { PageHeaderSkeleton, WatchlistBodySkeleton } from "@/components/PageSkeletons";

export default function Loading() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton />
      <WatchlistBodySkeleton />
    </div>
  );
}
