import { PageHeaderSkeleton, TagDetailBodySkeleton } from "@/components/PageSkeletons";

export default function Loading() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton withAction />
      <TagDetailBodySkeleton />
    </div>
  );
}
