import { PageHeaderSkeleton, ShimmerBlock } from "@/components/PageSkeletons";

/** Canvas 1·2: the same shape as the rows, so nothing jumps when they arrive. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-xl space-y-6 py-2" aria-busy="true" aria-label="Cruzando sus gustos">
      <PageHeaderSkeleton />
      <p className="text-sm text-fog">Cruzando los gustos de quienes ven hoy…</p>
      <div className="flex gap-2">
        {[0, 1, 2].map((index) => (
          <ShimmerBlock key={index} className="h-9 w-24 rounded-full" />
        ))}
      </div>
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="flex gap-3 rounded-3xl border border-white/[0.08] p-3">
          <ShimmerBlock className={index === 0 ? "h-36 w-24 rounded-xl" : "h-24 w-16 rounded-xl"} />
          <div className="flex-1 space-y-2">
            <ShimmerBlock className="h-5 w-2/3 rounded" />
            <ShimmerBlock className="h-3 w-1/2 rounded" />
            <ShimmerBlock className="h-3 w-5/6 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
