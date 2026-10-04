import { ListsEtiquetasSegment } from "@/components/ListsEtiquetasSegment";
import { SegmentActionPlaceholder } from "@/components/SegmentAction";
import { ListsBodySkeleton } from "@/components/PageSkeletons";

/** Soft Listas↔Etiquetas nav keeps the segment; only the body shimmers. */
export default function Loading() {
  return (
    <div className="space-y-8">
      <ListsEtiquetasSegment action={<SegmentActionPlaceholder />} />
      <ListsBodySkeleton />
    </div>
  );
}
