import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { FichaVisit } from "@/components/FichaVisit";
import { DiaryDayChip } from "@/components/ficha/DiaryDayChip";
import { FichaTopBar } from "@/components/ficha/FichaTopBar";
import { TitleActionsSkeleton, TitleProvidersSkeleton } from "@/components/PageSkeletons";
import { TitleFichaActions } from "@/components/TitleFichaActions";
import { TitleHero } from "@/components/TitleHero";
import { TitleSynopsis } from "@/components/TitleSynopsis";
import type { ReactNode } from "react";
import type { CatalogRow } from "@/db";
import { fichaAffinity } from "@/lib/affinity-store";
import type { TmdbTitleExtras } from "@/lib/tmdb";
import {
  getOwnedTitleIdByTmdb,
  previewTitleFromCatalog,
  resolvePreviewCatalog,
  resolvePreviewMetadata,
  withPreviewMetadata,
  type PreviewTitle,
} from "@/lib/catalog-preview";
import { parseStoredTmdbGenres } from "@/lib/diary-picks";
import { getAssignableLists, getRelatedTitles, getUserStreamingPlatforms } from "@/lib/queries";
import { requireUserId } from "@/lib/session";
import { resolveTitleExtras } from "@/lib/title-extras";
import { resolveTitlePeople } from "@/lib/title-people";
import {
  catalogNeedsEnrichment,
  kindFromSlug,
  ownedFichaHref,
  parseDiaryLog,
  parseTmdbIdParam,
  type DiaryLog,
} from "@/lib/title-preview";
import { getWatchProvidersForTitle } from "@/lib/watch-providers-cache";
import {
  AffinitySlot,
  affinityRowOf,
  heroProps,
  TitlePeopleBlock,
  TitleProvidersBlock,
  TitleRelatedBlock,
} from "../../../[id]/title-sections";
import TitleLoading from "./loading";

export const dynamic = "force-dynamic";

type PreviewParams = { kind: string; tmdbId: string };

type PreviewPageProps = {
  params: Promise<PreviewParams>;
  searchParams: Promise<{ fecha?: string | string[]; destino?: string | string[] }>;
};

const parseParams = ({ kind: kindSlug, tmdbId: rawId }: PreviewParams) => {
  const kind = kindFromSlug(kindSlug);
  const tmdbId = parseTmdbIdParam(rawId);
  return kind && tmdbId ? { kind, tmdbId } : null;
};

export const generateMetadata = async ({ params }: PreviewPageProps): Promise<Metadata> => {
  const parsed = parseParams(await params);
  const row = parsed ? await resolvePreviewCatalog(parsed.tmdbId, parsed.kind) : null;
  if (!row) {
    return { title: "Título", description: "Ficha en Filmia, tu diario de películas y series." };
  }
  const lead = [row.year ? String(row.year) : null, row.kind === "SERIES" ? "Serie" : "Película"]
    .filter(Boolean)
    .join(" · ");
  return { title: row.name, description: `${lead} en Filmia.` };
};

/**
 * Ficha preview (FIL-I8): a film you do not have yet, by TMDB id. Same «Cartel»
 * as `/titulos/[id]`, nothing personal, and no Title until an action creates
 * it. A film you already have goes straight to your own ficha.
 */
export default async function TitlePreviewPage({ params, searchParams }: PreviewPageProps) {
  const parsed = parseParams(await params);
  if (!parsed) {
    notFound();
  }
  const diaryLog = parseDiaryLog(await searchParams);
  const userId = await requireUserId();
  const ownedId = await getOwnedTitleIdByTmdb(userId, parsed.tmdbId, parsed.kind);
  if (ownedId) {
    redirect(ownedFichaHref(ownedId, diaryLog));
  }

  return (
    <Suspense fallback={<TitleLoading />}>
      <TitlePreview tmdbId={parsed.tmdbId} kind={parsed.kind} diaryLog={diaryLog} userId={userId} />
    </Suspense>
  );
}

const TitlePreview = async ({
  tmdbId,
  kind,
  diaryLog,
  userId,
}: {
  tmdbId: number;
  kind: CatalogRow["kind"];
  diaryLog: DiaryLog | null;
  userId: string;
}) => {
  const row = await resolvePreviewCatalog(tmdbId, kind);
  if (!row) {
    notFound();
  }

  const title = previewTitleFromCatalog(row);
  const posterKey = `tmdb-${kind}-${tmdbId}`;
  const pending = catalogNeedsEnrichment(row);
  // TMDB (cached, fast) for backdrop and synopsis; TMDB + OMDb for the chips.
  const extrasPromise = resolveTitleExtras(title);
  const fullPromise = resolvePreviewMetadata(row).then((metadata) => withPreviewMetadata(title, metadata));
  const listsPromise = getAssignableLists();
  const peoplePromise = resolveTitlePeople(title);
  const providersPromise = getWatchProvidersForTitle(title);
  const platformsPromise = getUserStreamingPlatforms();
  // «Para ti» (FIL-I9) once the row has its genres, keywords and people (same lookup as the chips).
  const affinity = (
    <AffinitySlot
      promise={fullPromise.then((full) => fichaAffinity(userId, affinityRowOf(full)))}
      titleName={title.name}
    />
  );
  const relatedPromise = fullPromise.then((full) =>
    getRelatedTitles("", parseStoredTmdbGenres(full.tmdbGenres).map((genre) => genre.id)),
  );

  return (
    <article className="space-y-8">
      <FichaVisit titleId={null} name={title.name} />
      <section className="ficha-head" aria-label={title.name}>
        <FichaTopBar trailing={diaryLog ? <DiaryDayChip log={diaryLog} /> : undefined} />
        <Suspense fallback={<TitleHero {...heroProps(title, null, { posterKey, imdbPending: pending, affinity })} />}>
          <PreviewHero
            title={title}
            extrasPromise={extrasPromise}
            fullPromise={fullPromise}
            posterKey={posterKey}
            pending={pending}
            affinity={affinity}
          />
        </Suspense>
        <div className="ficha-body-a space-y-4">
          {title.overview?.trim() ? (
            <TitleSynopsis text={title.overview} />
          ) : (
            <Suspense fallback={null}>
              <PreviewSynopsis extrasPromise={extrasPromise} />
            </Suspense>
          )}
          <Suspense fallback={<TitleActionsSkeleton />}>
            <PreviewActions title={title} listsPromise={listsPromise} diaryLog={diaryLog} />
          </Suspense>
        </div>
      </section>

      <Suspense fallback={null}>
        <TitlePeopleBlock peoplePromise={peoplePromise} kind={title.kind} />
      </Suspense>

      <Suspense fallback={<TitleProvidersSkeleton />}>
        <TitleProvidersBlock providersPromise={providersPromise} platformsPromise={platformsPromise} />
      </Suspense>

      <Suspense fallback={null}>
        <TitleRelatedBlock relatedPromise={relatedPromise} />
      </Suspense>
    </article>
  );
};

/** Two steps: the backdrop as soon as TMDB answers, the IMDb and award chips once OMDb does. */
const PreviewHero = async ({
  title,
  extrasPromise,
  fullPromise,
  posterKey,
  pending,
  affinity,
}: {
  title: PreviewTitle;
  extrasPromise: Promise<TmdbTitleExtras>;
  fullPromise: Promise<PreviewTitle>;
  posterKey: string;
  pending: boolean;
  affinity: ReactNode;
}) => {
  const extras = await extrasPromise;
  return (
    <Suspense fallback={<TitleHero {...heroProps(title, extras, { posterKey, imdbPending: pending, affinity })} />}>
      <PreviewHeroFull extras={extras} fullPromise={fullPromise} posterKey={posterKey} affinity={affinity} />
    </Suspense>
  );
};

const PreviewHeroFull = async ({
  extras,
  fullPromise,
  posterKey,
  affinity,
}: {
  extras: TmdbTitleExtras;
  fullPromise: Promise<PreviewTitle>;
  posterKey: string;
  affinity: ReactNode;
}) => <TitleHero {...heroProps(await fullPromise, extras, { posterKey, affinity })} />;

const PreviewSynopsis = async ({ extrasPromise }: { extrasPromise: Promise<TmdbTitleExtras> }) => (
  <TitleSynopsis text={(await extrasPromise).overview ?? null} />
);

const PreviewActions = async ({
  title,
  listsPromise,
  diaryLog,
}: {
  title: PreviewTitle;
  listsPromise: ReturnType<typeof getAssignableLists>;
  diaryLog: DiaryLog | null;
}) => {
  const lists = await listsPromise;
  return (
    <TitleFichaActions
      titleId={null}
      snapshot={{
        tmdbId: title.tmdbId,
        kind: title.kind,
        name: title.name,
        originalName: title.originalName,
        year: title.year,
        posterPath: title.posterPath,
      }}
      diaryLog={diaryLog}
      titleName={title.name}
      watched={false}
      inWatchlist={false}
      listCount={0}
      rating={null}
      review={null}
      platform={null}
      pinnedTonight={false}
      previewLists={lists}
    />
  );
};
