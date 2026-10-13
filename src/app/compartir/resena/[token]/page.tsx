import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PosterImage } from "@/components/PosterImage";
import { SharePage } from "@/components/share/SharePage";
import { ShareStars } from "@/components/share/ShareStars";
import { formatStarScore, TITLE_KIND_LABEL } from "@/lib/labels";
import { excerpt } from "@/lib/share-card";
import { getSharedReview, shareMetadataBase } from "@/lib/share";
import { tmdbBackdropUrl } from "@/lib/tmdb";
import { posterFrame } from "@/lib/ui";

export const dynamic = "force-dynamic";

type ShareReviewProps = { params: Promise<{ token: string }> };

const NOT_FOUND: Metadata = {
  title: "Enlace no disponible",
  robots: { index: false, follow: false },
};

export const generateMetadata = async ({ params }: ShareReviewProps): Promise<Metadata> => {
  const review = await getSharedReview((await params).token);
  if (!review) {
    return NOT_FOUND;
  }
  const score = review.rating != null ? `★ ${formatStarScore(review.rating)}` : null;
  const title = [review.name, score].filter(Boolean).join(" · ");
  const description =
    excerpt(review.review, 180) ||
    [review.year, TITLE_KIND_LABEL[review.kind]].filter(Boolean).join(" · ") + " en Filmia.";
  return {
    metadataBase: await shareMetadataBase(),
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: "article", siteName: "Filmia" },
    twitter: { card: "summary_large_image", title, description },
  };
};

/** Public, read-only review card (FIL-I15-4): poster, stars and review; nothing about the owner. */
export default async function ShareReviewPage({ params }: ShareReviewProps) {
  const review = await getSharedReview((await params).token);
  if (!review) {
    notFound();
  }
  const meta = [review.year, TITLE_KIND_LABEL[review.kind]].filter(Boolean).join(" · ");

  return (
    <SharePage backdropSrc={review.backdropPath ? tmdbBackdropUrl(review.backdropPath, "w1280") : null}>
      <article className="flex w-full flex-col items-center gap-5 text-center">
        <div className="w-[52vw] max-w-[220px]">
          <PosterImage
            name={review.name}
            posterPath={review.posterPath}
            className={`${posterFrame} shadow-[0_28px_64px_rgba(0,0,0,0.72)] ring-1 ring-white/10`}
            priority
            sizes="(max-width: 640px) 52vw, 220px"
            tmdbSize="w500"
          />
        </div>
        <header className="space-y-1.5">
          {meta ? <p className="text-[13px] text-fog">{meta}</p> : null}
          <h1 className="font-serif text-[2.25rem] leading-[1.05] tracking-[-0.02em] text-paper sm:text-5xl">
            {review.name}
          </h1>
          {review.originalName && review.originalName !== review.name ? (
            <p className="text-[13px] text-fog">{review.originalName}</p>
          ) : null}
        </header>
        {review.rating != null ? (
          <p className="flex flex-col items-center gap-1">
            <ShareStars rating={review.rating} />
            <span className="text-sm font-semibold text-star">
              {formatStarScore(review.rating)}
              <span className="font-normal text-fog"> de 5</span>
            </span>
            <span className="sr-only">{`${formatStarScore(review.rating)} de 5 estrellas`}</span>
          </p>
        ) : null}
        {review.review ? (
          <blockquote className="max-w-prose whitespace-pre-line text-pretty font-serif text-lg leading-relaxed text-paper/90">
            «{review.review}»
          </blockquote>
        ) : null}
      </article>
    </SharePage>
  );
}
