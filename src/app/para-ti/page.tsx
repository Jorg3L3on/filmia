import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AntojoBack } from "@/components/para-ti/AntojoBack";
import { AntojoWords } from "@/components/para-ti/AntojoWords";
import { OpeningMark } from "@/components/para-ti/OpeningMark";
import { AntojoShelfView } from "@/components/para-ti/AntojoShelfView";
import { ParaTiFilters } from "@/components/para-ti/ParaTiFilters";
import { ParaTiRoom } from "@/components/para-ti/ParaTiRoom";
import { ParaTiShelfRow } from "@/components/para-ti/ParaTiShelfRow";
import { ColdStartNotice, NoPlatformsNotice } from "@/components/para-ti/ParaTiNotices";
import { ShelfSkeleton, ShelvesSkeleton } from "@/components/para-ti/ParaTiSkeletons";
import { antojoById, isAntojoId, type Antojo } from "@/lib/para-ti/antojos";
import { filtersToParams, parseFilters, type ParaTiFilters as Filters } from "@/lib/para-ti/rank";
import { loadAntojoTitles, loadParaTiShelves } from "@/lib/para-ti/store";
import { requireUserId } from "@/lib/session";
import { focusRing } from "@/lib/ui";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export const generateMetadata = async ({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<Metadata> => {
  const antojo = antojoById([(await searchParams).antojo].flat()[0]);
  return { title: antojo ? `${antojo.label} · Para ti` : "Para ti" };
};

/** Para ti (FIL-I60): what you feel like, and titles you have not saved, ranked for you. */
export default async function ParaTiPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const userId = await requireUserId();
  const params = await searchParams;
  const raw = [params.antojo].flat()[0];
  const antojo = isAntojoId(raw) ? antojoById(raw) : null;
  const filters = parseFilters(params);

  return (
    <ParaTiRoom antojo={antojo?.id ?? null}>
      {antojo ? <AntojoView userId={userId} antojo={antojo} filters={filters} /> : <Opening userId={userId} filters={filters} />}
    </ParaTiRoom>
  );
}

/** The question and the words are static: they paint at once; the shelves stream in under them. */
const Opening = ({ userId, filters }: { userId: string; filters: Filters }) => {
  const query = new URLSearchParams(filtersToParams(filters)).toString();
  return (
    <div className="para-ti-opening mx-auto w-full max-w-5xl">
      <OpeningMark>
        <OpeningHero />
        <AntojoWords query={query} />
      </OpeningMark>
      <Suspense fallback={<ShelvesSkeleton />}>
        <OpeningShelves userId={userId} filters={filters} />
      </Suspense>
    </div>
  );
};

const OpeningHero = () => (
  <header className="para-ti-hero avatar-room">
    <p className="para-ti-eyebrow">Para ti</p>
    <h1 className="para-ti-question">¿Qué se te antoja?</h1>
  </header>
);

const OpeningShelves = async ({ userId, filters }: { userId: string; filters: Filters }) => {
  const { shelves, noPlatforms, cold } = await loadParaTiShelves(userId, filters);
  return (
    <div className="para-ti-shelves">
      {noPlatforms || cold ? (
        <div className="space-y-3">
          {noPlatforms ? <NoPlatformsNotice /> : null}
          {cold ? <ColdStartNotice /> : null}
        </div>
      ) : null}
      {shelves.map((shelf) => (
        <ParaTiShelfRow key={shelf.id} shelf={shelf} />
      ))}
    </div>
  );
};

const AntojoView = ({ userId, antojo, filters }: { userId: string; antojo: Antojo; filters: Filters }) => (
  <div className="para-ti-antojo mx-auto w-full max-w-5xl">
    <header className="para-ti-antojo-head avatar-room">
      <AntojoBack />
      <div className="min-w-0">
        <p className="para-ti-eyebrow">Para ti</p>
        <h1 className="para-ti-antojo-title">{antojo.label}</h1>
      </div>
    </header>
    <ParaTiFilters antojo={antojo.id} filters={filters} />
    {/* No key: a filter change is a transition, so the shelf stays mounted and reshuffles in place. */}
    <Suspense fallback={<ShelfSkeleton />}>
      <AntojoTitles userId={userId} antojo={antojo} filters={filters} />
    </Suspense>
  </div>
);

const AntojoTitles = async ({ userId, antojo, filters }: { userId: string; antojo: Antojo; filters: Filters }) => {
  const { titles, noPlatforms, cold, withAllPlatforms } = await loadAntojoTitles(userId, antojo.id, filters);
  const allPlatforms = new URLSearchParams({ antojo: antojo.id, ...filtersToParams({ ...filters, onlyMine: false }) });
  return (
    <>
      {noPlatforms || cold ? (
        <div className="mt-4 space-y-3">
          {noPlatforms ? <NoPlatformsNotice /> : null}
          {cold ? <ColdStartNotice /> : null}
        </div>
      ) : null}
      {titles.length === 0 ? (
        <div className="para-ti-empty" role="status">
          <p className="font-serif text-2xl text-paper">Nada de «{antojo.label}» por aquí</p>
          <p className="mt-2 text-sm text-fog">
            {filters.onlyMine && withAllPlatforms > 0
              ? `No está en tus plataformas con estos filtros, pero hay ${withAllPlatforms} en otras.`
              : "Prueba con menos filtros o con otro antojo."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {filters.onlyMine && withAllPlatforms > 0 ? (
              <Link href={`/para-ti?${allPlatforms}`} className={`para-ti-cta ${focusRing}`}>
                Ver en todas las plataformas
              </Link>
            ) : null}
            <Link href={`/para-ti?antojo=${antojo.id}`} className={`para-ti-cta is-ghost ${focusRing}`}>
              Quitar filtros
            </Link>
          </div>
        </div>
      ) : (
        <AntojoShelfView
          titles={titles}
          antojo={antojo.id}
          label={antojo.label}
          memoryKey={`${antojo.id}?${new URLSearchParams(filtersToParams(filters))}`}
        />
      )}
    </>
  );
};
