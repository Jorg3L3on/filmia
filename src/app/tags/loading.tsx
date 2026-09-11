import { ListsEtiquetasSegment } from "@/components/ListsEtiquetasSegment";
import {
  PageHeaderSkeleton,
  TagsBodySkeleton,
  TagsCreateFormSkeleton,
} from "@/components/PageSkeletons";

/** Soft Listas↔Etiquetas nav keeps the segment; only the body shimmers. */
export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <PageHeaderSkeleton />
        <ListsEtiquetasSegment />
      </div>
      <TagsCreateFormSkeleton />
      <TagsBodySkeleton />
    </div>
  );
}
