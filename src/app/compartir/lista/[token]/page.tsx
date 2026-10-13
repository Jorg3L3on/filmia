import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PosterImage } from "@/components/PosterImage";
import { SharePage } from "@/components/share/SharePage";
import { getSharedList, shareMetadataBase } from "@/lib/share";
import { posterFrame } from "@/lib/ui";

export const dynamic = "force-dynamic";

type ShareListProps = { params: Promise<{ token: string }> };

const countLabel = (count: number) => (count === 1 ? "1 título" : `${count} títulos`);

export const generateMetadata = async ({ params }: ShareListProps): Promise<Metadata> => {
  const list = await getSharedList((await params).token);
  if (!list) {
    return { title: "Enlace no disponible", robots: { index: false, follow: false } };
  }
  const names = list.titles.slice(0, 4).map((title) => title.name).join(", ");
  const description =
    list.description ?? (names ? `${countLabel(list.total)}: ${names}…` : "Una lista en Filmia.");
  return {
    metadataBase: await shareMetadataBase(),
    title: list.name,
    description,
    robots: { index: false, follow: false },
    openGraph: { title: list.name, description, type: "website", siteName: "Filmia" },
    twitter: { card: "summary_large_image", title: list.name, description },
  };
};

/** Public, read-only list (FIL-I15-4): name, description and posters in the owner's order. */
export default async function ShareListPage({ params }: ShareListProps) {
  const list = await getSharedList((await params).token);
  if (!list) {
    notFound();
  }

  return (
    <SharePage>
      <header className="space-y-2 text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">
          Lista · {countLabel(list.total)}
        </p>
        <h1 className="font-serif text-[2.25rem] leading-[1.05] tracking-[-0.02em] text-paper sm:text-5xl">
          {list.name}
        </h1>
        {list.description ? (
          <p className="mx-auto max-w-prose text-pretty text-sm text-fog">{list.description}</p>
        ) : null}
      </header>
      {list.titles.length > 0 ? (
        <ol className="grid w-full grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4">
          {list.titles.map((title, index) => (
            <li key={`${title.name}-${index}`} className="space-y-1.5">
              <PosterImage
                name={title.name}
                posterPath={title.posterPath}
                className={`${posterFrame} ring-1 ring-white/10`}
                priority={index < 6}
                sizes="(max-width: 640px) 31vw, 160px"
              />
              <p className="line-clamp-2 text-[13px] leading-snug text-paper">{title.name}</p>
              {title.year ? <p className="text-[11px] text-fog">{title.year}</p> : null}
            </li>
          ))}
        </ol>
      ) : null}
      {list.total > list.titles.length ? (
        <p className="text-sm text-fog">y {countLabel(list.total - list.titles.length)} más</p>
      ) : list.titles.length === 0 ? (
        <p className="text-sm text-fog">Esta lista aún está vacía.</p>
      ) : null}
    </SharePage>
  );
}
