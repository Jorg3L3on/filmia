import { ListsBodySkeleton, PageHeaderSkeleton } from "@/components/PageSkeletons";

export default function Loading() {
  return (
    <div className="space-y-12">
      <PageHeaderSkeleton withAction />
      <ListsBodySkeleton />
    </div>
  );
}
