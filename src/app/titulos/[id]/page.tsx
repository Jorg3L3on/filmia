import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteTitle } from "@/app/actions/titles";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { PosterImage } from "@/components/PosterImage";
import { TagPills } from "@/components/TagPills";
import { WatchlistToggle } from "@/components/WatchlistToggle";
import {
  formatImdbRating,
  formatRating,
  PLATFORM_LABEL,
  TITLE_KIND_LABEL,
} from "@/lib/labels";
import { getTitleById, isTitleInWatchlist } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function TitleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [title, inWatchlist] = await Promise.all([
    getTitleById(id),
    isTitleInWatchlist(id),
  ]);

  if (!title) {
    notFound();
  }

  const deleteAction = deleteTitle.bind(null, title.id);
  const imdbLabel = formatImdbRating(title.imdbRating);

  return (
    <article className="grid gap-8 md:grid-cols-[220px_1fr]">
      <PosterImage
        name={title.name}
        posterPath={title.posterPath}
        className="rounded-lg"
        priority
      />
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.2em] text-[#00e054]">
          {TITLE_KIND_LABEL[title.kind]}
          {title.year ? ` · ${title.year}` : ""}
        </p>
        <h1 className="font-serif text-4xl text-white">{title.name}</h1>
        {title.originalName ? (
          <p className="text-sm text-[#99aabb]">{title.originalName}</p>
        ) : null}
        <p className="text-lg text-[#ff8000]">Tu nota: {formatRating(title.rating)}</p>
        {imdbLabel ? (
          <p className="text-lg font-medium text-[#f5c518]">{imdbLabel}</p>
        ) : null}
        {title.platform ? (
          <p className="text-sm text-[#99aabb]">{PLATFORM_LABEL[title.platform]}</p>
        ) : null}
        {title.watchedAt ? (
          <p className="text-sm text-[#99aabb]">
            Vista el{" "}
            {title.watchedAt.toLocaleDateString("es-MX", {
              year: "numeric",
              month: "long",
              day: "numeric",
              timeZone: "UTC",
            })}
          </p>
        ) : null}
        <TagPills tags={title.tags.map((item) => item.tag)} />
        {(() => {
          const collections = title.listItems.filter(
            (item) => item.list.kind === "COLLECTION",
          );
          if (collections.length === 0) {
            return null;
          }
          return (
            <p className="text-sm text-[#99aabb]">
              En listas:{" "}
              {collections.map((item, index) => (
                <span key={item.listId}>
                  {index > 0 ? ", " : ""}
                  <Link
                    href={`/listas/${item.list.id}`}
                    className="text-[#00e054] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e054]"
                  >
                    {item.list.name}
                  </Link>
                </span>
              ))}
            </p>
          );
        })()}
        <WatchlistToggle titleId={title.id} inWatchlist={inWatchlist} />
        {title.review ? (
          <p className="max-w-2xl whitespace-pre-wrap text-[#c8d6e5]">{title.review}</p>
        ) : null}
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href={`/titulos/${title.id}/editar`}
            className="rounded-full bg-[#00e054] px-4 py-2 text-sm font-semibold text-[#14181c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Editar
          </Link>
          <form action={deleteAction}>
            <ConfirmSubmit
              label="Borrar"
              confirmMessage={`¿Borrar “${title.name}”?`}
              className="rounded-full border border-[#5a2a2a] px-4 py-2 text-sm text-[#ff8a80] hover:bg-[#2a1616] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff8a80]"
            />
          </form>
        </div>
      </div>
    </article>
  );
}
