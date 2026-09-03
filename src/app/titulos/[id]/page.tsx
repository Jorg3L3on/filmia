import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteTitle } from "@/app/actions/titles";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { ImdbBadge } from "@/components/ImdbBadge";
import { MarkWatchedForm } from "@/components/MarkWatchedForm";
import { PersonalRating } from "@/components/PersonalRating";
import { PlatformBadge } from "@/components/PlatformBadge";
import { PosterImage } from "@/components/PosterImage";
import { TagPills } from "@/components/TagPills";
import { WatchlistToggle } from "@/components/WatchlistToggle";
import { WatchProvidersMx } from "@/components/WatchProvidersMx";
import { TITLE_KIND_LABEL } from "@/lib/labels";
import { getTitleById, isTitleInWatchlist } from "@/lib/queries";
import { btnDanger, btnPrimary, eyebrowClass, focusRing, posterFrame } from "@/lib/ui";
import { getWatchProvidersForTitle } from "@/lib/watch-providers-cache";

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

  const { data: watchProviders } = await getWatchProvidersForTitle(title);

  const deleteAction = deleteTitle.bind(null, title.id);

  return (
    <article className="grid gap-10 md:grid-cols-[280px_1fr]">
      <PosterImage
        name={title.name}
        posterPath={title.posterPath}
        className={`${posterFrame} md:sticky md:top-24`}
        priority
        sizes="(max-width: 768px) 90vw, 280px"
      />
      <div className="space-y-5">
        <p className={eyebrowClass}>
          {TITLE_KIND_LABEL[title.kind]}
          {title.year ? ` · ${title.year}` : ""}
        </p>
        <h1 className="font-serif text-4xl leading-tight tracking-tight text-white md:text-5xl">
          {title.name}
        </h1>
        {title.originalName ? (
          <p className="text-sm text-fog">{title.originalName}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-4">
          <ImdbBadge rating={title.imdbRating} />
          <PersonalRating rating={title.rating} />
        </div>
        <PlatformBadge platform={title.platform} />
        <WatchProvidersMx data={watchProviders} />
        <TagPills tags={title.tags.map((item) => item.tag)} />
        <WatchlistToggle titleId={title.id} inWatchlist={inWatchlist} />
        {title.watchedAt ? (
          <p className="text-sm text-fog">
            Vista el{" "}
            {title.watchedAt.toLocaleDateString("es-MX", {
              year: "numeric",
              month: "long",
              day: "numeric",
              timeZone: "UTC",
            })}
          </p>
        ) : (
          <MarkWatchedForm titleId={title.id} variant="detail" />
        )}
        {(() => {
          const collections = title.listItems.filter(
            (item) => item.list.kind === "COLLECTION",
          );
          if (collections.length === 0) {
            return null;
          }
          return (
            <p className="text-sm text-fog">
              En listas:{" "}
              {collections.map((item, index) => (
                <span key={item.listId}>
                  {index > 0 ? ", " : ""}
                  <Link
                    href={`/listas/${item.list.id}`}
                    className={`text-accent underline-offset-2 hover:underline ${focusRing}`}
                  >
                    {item.list.name}
                  </Link>
                </span>
              ))}
            </p>
          );
        })()}
        {title.review ? (
          <p className="max-w-2xl whitespace-pre-wrap text-base leading-relaxed text-paper/90">
            {title.review}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href={`/titulos/${title.id}/editar`} className={btnPrimary}>
            Editar
          </Link>
          <form action={deleteAction}>
            <ConfirmSubmit
              label="Borrar"
              confirmMessage={`¿Borrar “${title.name}”?`}
              className={btnDanger}
            />
          </form>
        </div>
      </div>
    </article>
  );
}
