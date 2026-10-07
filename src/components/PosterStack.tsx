import { PosterImage } from "@/components/PosterImage";
import { SharedPoster } from "@/components/SharedPoster";
import { cn } from "@/lib/cn";

export type PosterStackItem = {
  id: string;
  name: string;
  posterPath: string | null;
};

type PosterStackProps = {
  posters: PosterStackItem[];
  size?: "sm" | "lg";
  emptyLabel?: string;
};

export const PosterStack = ({
  posters,
  size = "lg",
  emptyLabel = "Vacía",
}: PosterStackProps) => {
  const shown = posters.slice(0, 3);
  const isSmall = size === "sm";

  if (shown.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-2xl border border-dashed border-chrome bg-well text-xs text-mist",
          isSmall ? "h-[120px]" : "h-[126px] sm:h-[142px]",
        )}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-2xl",
        isSmall ? "h-[120px]" : "h-[126px] sm:h-[142px]",
      )}
      aria-hidden="true"
    >
      <div className={cn("absolute inset-y-0 left-0", isSmall ? "right-0" : "right-[18%]")}>
      {shown.map((title, index) => (
        <div
          key={title.id}
          className={cn(
            "absolute top-0 overflow-hidden rounded-2xl border border-canvas bg-well shadow-[0_10px_24px_rgba(0,0,0,0.45)]",
            index === 0 ? "left-0 z-30 h-full w-[72%]" : "h-[88%]",
            index === 0 ? undefined : isSmall ? "w-[50%]" : "w-[58%]",
          )}
          style={
            index === 0
              ? undefined
              : {
                  left: `${isSmall ? 18 + index * 14 : 28 + index * 18}%`,
                  top: `${6 * index}%`,
                  zIndex: 30 - index,
                }
          }
        >
          <SharedPoster titleId={title.id} share={false} className="h-full">
            <PosterImage
              name={title.name}
              posterPath={title.posterPath}
              sizes={isSmall ? "96px" : "140px"}
              className="h-full rounded-none transition-[filter] duration-[var(--duration-hover)] group-hover:brightness-110"
              ratio="fill"
            />
          </SharedPoster>
        </div>
      ))}
      </div>
    </div>
  );
};
