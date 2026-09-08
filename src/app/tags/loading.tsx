import { PageHeaderSkeleton, TagsBodySkeleton } from "@/components/PageSkeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <TagsBodySkeleton />
    </div>
  );
}
