import { PageHeader } from "@/components/PageHeader";
import { SegmentActionPlaceholder } from "@/components/SegmentAction";
import { ListsBodySkeleton } from "@/components/PageSkeletons";

/** The header is static, so it stays put; only the body shimmers. */
export default function Loading() {
  return (
    <div className="space-y-8">
      <PageHeader title="Listas" actions={<SegmentActionPlaceholder />} />
      <ListsBodySkeleton />
    </div>
  );
}
