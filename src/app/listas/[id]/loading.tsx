import { ListsBodySkeleton, PageHeaderSkeleton } from "@/components/PageSkeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withAction />
      <ListsBodySkeleton label="Cargando lista" />
    </div>
  );
}
