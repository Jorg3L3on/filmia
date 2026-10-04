import { ListsEtiquetasSegment } from "@/components/ListsEtiquetasSegment";
import { TagsBodySkeleton } from "@/components/PageSkeletons";
import { SegmentActionPlaceholder } from "@/components/SegmentAction";

/** Soft Listas↔Etiquetas nav keeps the segment; only the body shimmers. */
export default function Loading() {
  return (
    <div className="space-y-8">
      <ListsEtiquetasSegment action={<SegmentActionPlaceholder />} />
      <TagsBodySkeleton />
    </div>
  );
}
