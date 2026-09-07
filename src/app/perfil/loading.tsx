import { ProfileBodySkeleton } from "@/components/PageSkeletons";

export default function Loading() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="h-10 w-28 rounded-xl shimmer" />
      <ProfileBodySkeleton />
    </div>
  );
}
