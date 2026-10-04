import { PageHeaderSkeleton, SearchBodySkeleton } from "@/components/PageSkeletons";

export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeaderSkeleton />
      <SearchBodySkeleton />
    </div>
  );
}
