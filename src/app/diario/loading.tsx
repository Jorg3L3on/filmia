import { DiaryBodySkeleton, PageHeaderSkeleton } from "@/components/PageSkeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <DiaryBodySkeleton mode="calendar" label="Cargando tu diario" />
    </div>
  );
}
