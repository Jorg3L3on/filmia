import { PosterRailSkeleton } from "@/components/PageSkeletons";

const Bar = ({ className }: { className: string }) => <span className={`shimmer block rounded-lg ${className}`} aria-hidden="true" />;

/** The three ready shelves while they load: same blocks as `ParaTiShelfRow` (FIL-I60-4). */
export const ShelvesSkeleton = () => (
  <div className="para-ti-shelves" aria-busy="true" aria-label="Cargando estantes">
    {[0, 1, 2].map((index) => (
      <div key={index} className="para-ti-shelf-row">
        <div className="mb-3 flex items-baseline justify-between">
          <Bar className="h-7 w-52 sm:h-8" />
          <Bar className="h-3 w-5" />
        </div>
        <PosterRailSkeleton count={4} itemClassName="w-[7.5rem] sm:w-36" />
        <div className="h-[3.25rem]" aria-hidden="true" />
      </div>
    ))}
  </div>
);

/** An antojo's shelf while it loads: the shelf's height and the card under it. */
export const ShelfSkeleton = () => (
  <div className="para-ti-shelf" aria-busy="true" aria-label="Cargando títulos">
    <div className="para-ti-track-skeleton">
      <span className="shimmer block h-full w-[var(--depth)] rounded-poster" aria-hidden="true" />
    </div>
    <div className="para-ti-center-row">
      <Bar className="float-right ml-3 h-11 w-36 rounded-full" />
      <Bar className="h-7 w-1/2" />
      <Bar className="mt-2 h-4 w-1/3" />
      <Bar className="mt-6 h-11 w-64 rounded-full" />
    </div>
  </div>
);
