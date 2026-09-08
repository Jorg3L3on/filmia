import { DiaryBodySkeleton, PageHeaderSkeleton } from "@/components/PageSkeletons";

export default function Loading() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton withAction />
      <DiaryBodySkeleton label="Cargando etiqueta" />
    </div>
  );
}
