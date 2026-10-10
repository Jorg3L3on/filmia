import { SearchBodySkeleton } from "@/components/PageSkeletons";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 pt-[3.5rem] sm:pt-0">
      <SearchBodySkeleton />
    </div>
  );
}
