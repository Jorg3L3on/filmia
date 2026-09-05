import Link from "next/link";
import { ImdbBadge } from "@/components/ImdbBadge";
import { ListItemOrderControls } from "@/components/ListItemOrderControls";
import { PosterImage } from "@/components/PosterImage";
import { PosterPlatformBadge } from "@/components/PosterPlatformBadge";
import { SharedPoster } from "@/components/SharedPoster";
import { WatchlistMarkSeenButton } from "@/components/WatchlistMarkSeenButton";
import { cn } from "@/lib/cn";
import { TITLE_KIND_LABEL } from "@/lib/labels";
import type { titleInclude } from "@/lib/queries";
import { btnGhost, focusRing } from "@/lib/ui";
import type { Platform, Prisma } from "@/generated/prisma/browser";

type WatchlistItem = Prisma.ListItemGetPayload<{
  include: { title: { include: typeof titleInclude } };
}>;

type WatchlistCardProps = {
  item: WatchlistItem;
  variant: "hero" | "queue";
  position: number;
  listId: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  removeAction: () => void;
  preferredPlatforms?: readonly Platform[];
  swapUpTitleId?: string | null;
  swapDownTitleId?: string | null;
};

export const WatchlistCard = ({
  item,
  variant,
  position,
  listId,
  canMoveUp,
  canMoveDown,
  removeAction,
  preferredPlatforms = [],
  swapUpTitleId,
  swapDownTitleId,
}: WatchlistCardProps) => {
  const { title } = item;
  const yearLabel = title.year ? String(title.year) : TITLE_KIND_LABEL[title.kind];
  const synopsis = title.overview?.trim() || null;

  if (variant === "hero") {
    return (
      <article className="card-physics overflow-hidden rounded-card border border-line bg-surface p-4 sm:p-5">
        <div className="flex gap-4">
          <WatchlistPoster
            title={title}
            size="hero"
            className="isolate z-0 w-[112px] shrink-0 sm:w-[140px]"
            posterClassName="rounded-poster"
            sizes="140px"
            preferredPlatforms={preferredPlatforms}
            priority
          />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-bold text-ink">
                {position}
              </span>
              <div className="min-w-0 space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-mist">
                  Próxima en tu lista
                </p>
                <h2 className="font-serif text-2xl leading-tight text-paper sm:text-3xl">
                  <Link href={`/titulos/${title.id}`} className={`hover:text-accent ${focusRing}`}>
                    {title.name}
                  </Link>
                </h2>
                <p className="text-sm text-fog">
                  {yearLabel}
                  {title.year ? ` · ${TITLE_KIND_LABEL[title.kind]}` : ""}
                </p>
              </div>
            </div>
            {item.queueNote ? (
              <p className="line-clamp-3 text-sm text-fog">
                <span className="mr-2 text-mist">Nota personal</span>
                {item.queueNote}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <ListItemOrderControls
                listId={listId}
                titleId={item.titleId}
                canMoveUp={canMoveUp}
                canMoveDown={canMoveDown}
                swapUpTitleId={swapUpTitleId}
                swapDownTitleId={swapDownTitleId}
              />
              <form action={removeAction}>
                <button type="submit" className={btnGhost}>
                  Quitar
                </button>
              </form>
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="flex items-center gap-3 rounded-2xl px-1 py-2">
      <span className="w-5 shrink-0 text-center text-sm font-semibold text-mist">
        {position}
      </span>
      <WatchlistPoster
        title={title}
        size="queue"
        className="isolate z-0 w-14 shrink-0"
        posterClassName="rounded-lg"
        sizes="56px"
        preferredPlatforms={preferredPlatforms}
      />
      <div className="w-[7.25rem] shrink-0 sm:w-[11rem]">
        <h3 className="truncate font-medium text-paper">
          <Link href={`/titulos/${title.id}`} className={`hover:text-accent ${focusRing}`}>
            {title.name}
          </Link>
        </h3>
        <p className="text-sm text-fog">{yearLabel}</p>
        <ImdbBadge rating={title.imdbRating} compact />
      </div>
      {synopsis ? (
        <p className="min-w-0 flex-1 line-clamp-2 text-sm leading-5 text-fog">
          {synopsis}
        </p>
      ) : (
        <span className="min-w-0 flex-1" />
      )}
      <ListItemOrderControls
        listId={listId}
        titleId={item.titleId}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        swapUpTitleId={swapUpTitleId}
        swapDownTitleId={swapDownTitleId}
      />
    </article>
  );
};

const WatchlistPoster = ({
  title,
  size,
  className,
  posterClassName,
  sizes,
  preferredPlatforms = [],
  priority = false,
}: {
  title: WatchlistItem["title"];
  size: "hero" | "queue";
  className: string;
  posterClassName: string;
  sizes: string;
  preferredPlatforms?: readonly Platform[];
  priority?: boolean;
}) => (
  <div className={cn("relative", className)}>
    <Link
      href={`/titulos/${title.id}`}
      aria-label={title.name}
      className={cn("block", focusRing)}
    >
      <SharedPoster titleId={title.id}>
        <PosterImage
          name={title.name}
          posterPath={title.posterPath}
          className={posterClassName}
          sizes={sizes}
          priority={priority}
        />
      </SharedPoster>
    </Link>
    <WatchlistMarkSeenButton
      titleId={title.id}
      titleName={title.name}
      rating={title.rating}
      review={title.review}
      size={size}
    />
    <PosterPlatformBadge
      watchProvidersMx={title.watchProvidersMx}
      preferredPlatforms={preferredPlatforms}
      size={size}
    />
  </div>
);
