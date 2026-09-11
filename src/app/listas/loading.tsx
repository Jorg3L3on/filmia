import { ListsEtiquetasSegment } from "@/components/ListsEtiquetasSegment";
import { ListsBodySkeleton, PageHeaderSkeleton } from "@/components/PageSkeletons";

/** Soft Listas↔Etiquetas nav keeps the segment; only the body shimmers. */
export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <PageHeaderSkeleton withAction />
        <ListsEtiquetasSegment />
      </div>
      <ListsBodySkeleton />
    </div>
  );
}
