import Link from "next/link";
import { MarkWatchedForm } from "@/components/MarkWatchedForm";
import { PersonalRating } from "@/components/PersonalRating";
import { PlatformBadge } from "@/components/PlatformBadge";
import { PosterImage } from "@/components/PosterImage";
import { ImdbBadge } from "@/components/ImdbBadge";
import { TITLE_KIND_LABEL } from "@/lib/labels";
import type { titleInclude } from "@/lib/queries";
import type { Prisma } from "@/generated/prisma/client";

type WatchlistItem = Prisma.ListItemGetPayload<{
  include: { title: { include: typeof titleInclude } };
}>;

type WatchlistCardProps = {
  item: WatchlistItem;
  variant: "hero" | "queue";
  position: number;
  removeAction: () => void;
  updateNoteAction: (formData: FormData) => void;
};

export const WatchlistCard = ({
  item,
  variant,
  position,
  removeAction,
  updateNoteAction,
}: WatchlistCardProps) => {
  const { title } = item;

  if (variant === "hero") {
    return (
      <article className="relative overflow-hidden rounded-2xl border border-transparent bg-[#111] p-[1px] shadow-[0_0_40px_rgba(139,92,246,0.15)]">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#2563eb] via-[#7c3aed] to-[#db2777] opacity-90" />
        <div className="relative grid gap-6 rounded-[15px] bg-[#0a0a0a] p-6 md:grid-cols-[180px_1fr]">
          <div className="relative">
            <div className="absolute -left-2 -top-2 z-10 rounded-full bg-gradient-to-r from-[#2563eb] to-[#db2777] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
              Siguiente
            </div>
            <PosterImage name={title.name} posterPath={title.posterPath} className="rounded-xl" />
          </div>
          <div className="flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.2em] text-[#8b5cf6]">
                #{position} en cola · {TITLE_KIND_LABEL[title.kind]}
                {title.year ? ` · ${title.year}` : ""}
              </p>
              <h2 className="font-serif text-3xl text-white md:text-4xl">
                <Link
                  href={`/titulos/${title.id}`}
                  className="hover:text-[#4fc3ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b5cf6]"
                >
                  {title.name}
                </Link>
              </h2>
              <PlatformBadge platform={title.platform} />
              <div className="flex flex-wrap items-center gap-4">
                <ImdbBadge rating={title.imdbRating} />
                <PersonalRating rating={title.rating} />
              </div>
              <form action={updateNoteAction} className="space-y-2">
                <label className="block space-y-1">
                  <span className="text-xs uppercase tracking-wide text-[#678]">
                    Nota de cola
                  </span>
                  <input
                    name="queueNote"
                    defaultValue={item.queueNote ?? ""}
                    placeholder="¿Por qué lo quieres ver?"
                    className="w-full rounded-xl border border-[#2c3440] bg-[#141414] px-3 py-2 text-sm text-white placeholder:text-[#556] focus:border-[#8b5cf6] focus:outline-none"
                  />
                </label>
                <button
                  type="submit"
                  className="text-xs text-[#8b5cf6] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b5cf6]"
                >
                  Guardar nota
                </button>
              </form>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <MarkWatchedForm titleId={title.id} variant="hero" />
              <form action={removeAction}>
                <button
                  type="submit"
                  className="rounded-full border border-[#3a3a3a] px-4 py-2.5 text-sm text-[#99aabb] hover:border-[#555] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b5cf6]"
                >
                  Quitar de la cola
                </button>
              </form>
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="group relative flex gap-4 rounded-xl border border-[#2c3440] bg-[#111] p-4 transition hover:border-[#7c3aed]/50">
      <div className="flex w-8 shrink-0 flex-col items-center gap-2 pt-1">
        <span className="rounded-full bg-[#1a1a1a] px-2 py-0.5 text-xs font-medium text-[#8b5cf6]">
          {position}
        </span>
      </div>
      <Link
        href={`/titulos/${title.id}`}
        className="w-16 shrink-0 overflow-hidden rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b5cf6]"
        aria-label={title.name}
      >
        <PosterImage
          name={title.name}
          posterPath={title.posterPath}
          className="aspect-square rounded-lg"
        />
      </Link>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-[#678]">
            {TITLE_KIND_LABEL[title.kind]}
            {title.year ? ` · ${title.year}` : ""}
          </p>
          <h3 className="truncate font-serif text-lg text-white group-hover:text-[#4fc3ff]">
            <Link href={`/titulos/${title.id}`}>{title.name}</Link>
          </h3>
          <PlatformBadge platform={title.platform} compact />
          <div className="flex flex-wrap items-center gap-3">
            <ImdbBadge rating={title.imdbRating} />
            <PersonalRating rating={title.rating} size="sm" />
          </div>
        </div>
        {item.queueNote ? (
          <p className="line-clamp-2 text-xs text-[#8899aa]">{item.queueNote}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <MarkWatchedForm titleId={title.id} variant="queue" />
          <form action={removeAction}>
            <button
              type="submit"
              className="rounded-full px-3 py-1 text-xs text-[#778] hover:text-[#ff8a80] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff8a80]"
            >
              Quitar
            </button>
          </form>
        </div>
      </div>
    </article>
  );
};
