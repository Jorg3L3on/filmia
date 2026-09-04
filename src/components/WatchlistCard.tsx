import Link from "next/link";
import { ListItemOrderControls } from "@/components/ListItemOrderControls";
import { MarkWatchedForm } from "@/components/MarkWatchedForm";
import { PersonalRating } from "@/components/PersonalRating";
import { PlatformBadge } from "@/components/PlatformBadge";
import { PosterImage } from "@/components/PosterImage";
import { ImdbBadge } from "@/components/ImdbBadge";
import { TagPills } from "@/components/TagPills";
import { SeriesStatusBadge } from "@/components/SeriesStatusBadge";
import { TITLE_KIND_LABEL } from "@/lib/labels";
import type { titleInclude } from "@/lib/queries";
import { btnGhost, btnLink, eyebrowClass, fieldClass, focusRing, posterFrame } from "@/lib/ui";
import type { Prisma } from "@/generated/prisma/browser";

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
  updateNoteAction: (formData: FormData) => void;
};

export const WatchlistCard = ({
  item,
  variant,
  position,
  listId,
  canMoveUp,
  canMoveDown,
  removeAction,
  updateNoteAction,
}: WatchlistCardProps) => {
  const { title } = item;

  if (variant === "hero") {
    return (
      <article className="relative overflow-hidden rounded-md border border-line bg-well p-5 md:p-6">
        <div className="grid grid-cols-[128px_1fr] items-start gap-4 sm:grid-cols-[160px_1fr] md:grid-cols-[180px_1fr] md:gap-6">
          <div className="relative w-full max-w-[180px]">
            <div className="absolute -left-1 -top-1 z-10 rounded-full bg-accent px-3 py-1 text-xs font-semibold uppercase tracking-wider text-ink">
              Siguiente
            </div>
            <PosterImage
              name={title.name}
              posterPath={title.posterPath}
              className={posterFrame}
              sizes="180px"
              priority
            />
          </div>
          <div className="flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <p className={eyebrowClass}>
                #{position} en cola · {TITLE_KIND_LABEL[title.kind]}
                {title.year ? ` · ${title.year}` : ""}
              </p>
              {title.kind === "SERIES" ? (
                <SeriesStatusBadge status={title.seriesStatus} />
              ) : null}
              <h2 className="font-serif text-3xl text-white md:text-4xl">
                <Link href={`/titulos/${title.id}`} className={`hover:text-accent ${focusRing}`}>
                  {title.name}
                </Link>
              </h2>
              <PlatformBadge platform={title.platform} />
              <div className="flex flex-wrap items-center gap-4">
                <ImdbBadge rating={title.imdbRating} />
                <PersonalRating rating={title.rating} />
              </div>
              <TagPills tags={title.tags.map((item) => item.tag)} />
              <form action={updateNoteAction} className="space-y-2">
                <label className="block space-y-1">
                  <span className="text-xs uppercase tracking-wide text-mist">
                    Nota de cola
                  </span>
                  <input
                    name="queueNote"
                    defaultValue={item.queueNote ?? ""}
                    placeholder="¿Por qué lo quieres ver?"
                    className={fieldClass}
                  />
                </label>
                <button type="submit" className={btnLink}>
                  Guardar nota
                </button>
              </form>
            </div>
            <div className="space-y-3">
              <ListItemOrderControls
                listId={listId}
                titleId={item.titleId}
                canMoveUp={canMoveUp}
                canMoveDown={canMoveDown}
              />
              <MarkWatchedForm
                titleId={title.id}
                variant="hero"
                rating={title.rating}
                review={title.review}
              />
              <form action={removeAction}>
                <button type="submit" className={btnGhost}>
                  Quitar de Quiero ver
                </button>
              </form>
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="group relative flex gap-4 rounded-md border border-line bg-well p-3 transition hover:border-accent/30">
      <div className="flex w-8 shrink-0 flex-col items-center gap-2 pt-1">
        <span className="rounded-full bg-canvas px-2 py-0.5 text-xs font-medium text-accent">
          {position}
        </span>
      </div>
      <Link
        href={`/titulos/${title.id}`}
        className={`w-16 shrink-0 overflow-hidden rounded-poster ${focusRing}`}
        aria-label={title.name}
      >
        <PosterImage
          name={title.name}
          posterPath={title.posterPath}
          className="rounded-poster"
          sizes="64px"
        />
      </Link>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-mist">
            {TITLE_KIND_LABEL[title.kind]}
            {title.year ? ` · ${title.year}` : ""}
          </p>
          {title.kind === "SERIES" ? (
            <SeriesStatusBadge status={title.seriesStatus} compact />
          ) : null}
          <h3 className="truncate font-serif text-lg text-white group-hover:text-accent">
            <Link href={`/titulos/${title.id}`}>{title.name}</Link>
          </h3>
          <PlatformBadge platform={title.platform} compact />
          <div className="flex flex-wrap items-center gap-3">
            <ImdbBadge rating={title.imdbRating} />
            <PersonalRating rating={title.rating} size="sm" />
          </div>
          <TagPills tags={title.tags.map((item) => item.tag)} compact />
        </div>
        {item.queueNote ? (
          <p className="line-clamp-2 text-xs text-fog">{item.queueNote}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <ListItemOrderControls
            listId={listId}
            titleId={item.titleId}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
          />
          <MarkWatchedForm
            titleId={title.id}
            variant="queue"
            rating={title.rating}
            review={title.review}
          />
          <form action={removeAction}>
            <button
              type="submit"
              className="rounded-full px-3 py-1 text-xs text-mist hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
            >
              Quitar
            </button>
          </form>
        </div>
      </div>
    </article>
  );
};
