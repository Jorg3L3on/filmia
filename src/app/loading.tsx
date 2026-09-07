import { DiaryModeToggle } from "@/components/DiaryModeToggle";
import { DiaryBodySkeleton } from "@/components/PageSkeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <DiaryModeToggle mode="picks" />
      <DiaryBodySkeleton />
    </div>
  );
}
