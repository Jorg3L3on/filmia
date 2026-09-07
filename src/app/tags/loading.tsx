import { TagsBodySkeleton } from "@/components/PageSkeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-40 rounded-xl shimmer" />
      <TagsBodySkeleton />
    </div>
  );
}
