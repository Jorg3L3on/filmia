import { ListsBodySkeleton } from "@/components/PageSkeletons";

export default function Loading() {
  return (
    <div className="space-y-12">
      <div className="h-10 w-36 rounded-xl shimmer" />
      <ListsBodySkeleton />
    </div>
  );
}
