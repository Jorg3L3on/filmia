import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PosterImage } from "@/components/PosterImage";
import { SharePage } from "@/components/share/SharePage";
import { getSharedCompat } from "@/lib/compat-store";
import { compatLabel } from "@/lib/compat";
import { shareMetadataBase } from "@/lib/share";
import { posterFrame } from "@/lib/ui";

export const dynamic = "force-dynamic";

type ShareCompatProps = { params: Promise<{ token: string }> };

const headline = (names: [string, string], label: string) => `${names[0]} y ${names[1]} son ${label} compatibles`;

export const generateMetadata = async ({ params }: ShareCompatProps): Promise<Metadata> => {
  const shared = await getSharedCompat((await params).token);
  if (!shared) {
    return { title: "Enlace no disponible", robots: { index: false, follow: false } };
  }
  const title = headline(shared.names, compatLabel(shared.card));
  return {
    metadataBase: await shareMetadataBase(),
    title,
    description: shared.card.phrase,
    robots: { index: false, follow: false },
    openGraph: { title, description: shared.card.phrase, type: "website", siteName: "Filmia" },
    twitter: { card: "summary_large_image", title, description: shared.card.phrase },
  };
};

/**
 * Public compatibility card (FIL-I19-4, canvas 2·3): the %, the phrase and what
 * they both loved. First names only; no rating, no «donde no coinciden».
 */
export default async function ShareCompatPage({ params }: ShareCompatProps) {
  const shared = await getSharedCompat((await params).token);
  if (!shared) {
    notFound();
  }
  const { names, card } = shared;

  return (
    <SharePage>
      <header className="space-y-3 text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-affinity">
          {names[0]} × {names[1]}
        </p>
        <p className="font-serif text-7xl leading-none tracking-[-0.03em] text-paper">{compatLabel(card)}</p>
        <h1 className="text-lg font-semibold text-paper">compatibles en Filmia</h1>
        <p className="mx-auto max-w-prose text-pretty text-sm text-fog">{card.phrase}</p>
      </header>
      {card.bothLove.length > 0 ? (
        <section className="w-full space-y-3" aria-labelledby="los-une">
          <h2 id="los-une" className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-fog">
            Las que más los unen
          </h2>
          <ol className="grid w-full grid-cols-3 gap-3">
            {card.bothLove.map((film, index) => (
              <li key={film.catalogId} className="space-y-1.5">
                <PosterImage
                  name={film.name}
                  posterPath={film.posterPath}
                  className={`${posterFrame} ring-1 ring-white/10`}
                  priority={index < 3}
                  sizes="(max-width: 640px) 31vw, 160px"
                />
                <p className="line-clamp-2 text-[13px] leading-snug text-paper">{film.name}</p>
                {film.year ? <p className="text-[11px] text-fog">{film.year}</p> : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      <p className="text-center text-xs text-fog">
        {card.approx
          ? "Por gustos parecidos: aún vieron pocas películas en común."
          : `Con ${card.common} películas que vieron los dos.`}
      </p>
    </SharePage>
  );
}
