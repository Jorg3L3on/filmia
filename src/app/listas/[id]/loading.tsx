import { ListsBodySkeleton } from "@/components/PageSkeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="h-3 w-20 rounded-full shimmer" />
        <div className="h-10 w-56 rounded-xl shimmer" />
      </div>
      <ListsBodySkeleton label="Cargando lista" />
    </div>
  );
}
