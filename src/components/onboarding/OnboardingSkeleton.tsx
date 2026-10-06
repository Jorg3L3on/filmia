import { ShimmerBlock } from "@/components/PageSkeletons";

export const OnboardingSkeleton = ({ label = "Cargando la bienvenida" }: { label?: string }) => (
  <div
    className="bienvenida-shell mx-auto flex min-h-[100dvh] w-full max-w-xl flex-col gap-8 px-5 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
    aria-busy="true"
    aria-label={label}
  >
    <div className="flex justify-center gap-2.5">
      {Array.from({ length: 7 }, (_, index) => (
        <ShimmerBlock key={index} className="size-2.5 rounded-[3px]" />
      ))}
    </div>
    <div className="flex flex-1 flex-col justify-center gap-6">
      <ShimmerBlock className="mx-auto h-12 w-36 rounded-xl" />
      <ShimmerBlock className="mx-auto h-3 w-40 rounded-full" />
      <ShimmerBlock className="mx-auto h-24 w-full max-w-sm rounded-2xl" />
      <ShimmerBlock className="mx-auto h-4 w-64 rounded-full" />
    </div>
    <ShimmerBlock className="h-12 w-full rounded-[var(--radius-button)]" />
  </div>
);
