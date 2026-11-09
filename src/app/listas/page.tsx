import { HitArea } from "@/components/HitArea";
import { Suspense } from "react";
import type { CSSProperties, ReactNode } from "react";
import { collectionCountLabel } from "@/lib/labels";
import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { ListCard, listCardGridClass } from "@/components/ListCard";
import { PageHeader } from "@/components/PageHeader";
import {
  SegmentActionTooltip,
  SegmentPlusIcon,
  segmentActionCompactClass,
} from "@/components/SegmentAction";
import { ListsBodySkeleton } from "@/components/PageSkeletons";
import { mxToday } from "@/lib/cine-core";
import { WATCHLIST_NAME, WATCHLIST_SLUG, listHref, partitionUserLists } from "@/lib/lists";
import { focusRing } from "@/lib/ui";
import { getLists } from "@/lib/queries";
import { AvatarStack } from "@/components/lists/PersonAvatar";
import { QuieroVerPinnedCard } from "@/components/lists/QuieroVerPinnedCard";
import { OwnerRequestsNotice, SharedWithMeSection } from "@/components/lists/SharedWithMe";
import { getPendingRequestsForOwner, getSharedWithMe } from "@/lib/list-invites";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Listas",
} as const;

type ListCollectionLayout = "rail" | "grid";

const listCollectionClassName: Record<ListCollectionLayout, string> = {
  rail: "rail -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-8 overflow-x-auto overscroll-x-contain px-4 pb-3 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-[repeat(auto-fill,minmax(124px,1fr))] sm:gap-x-8 sm:gap-y-10 sm:overflow-visible sm:px-0 sm:pb-0",
  grid: listCardGridClass,
};

const ListCollection = ({
  children,
  layout = "rail",
}: {
  children: ReactNode;
  layout?: ListCollectionLayout;
}) => <ul className={listCollectionClassName[layout]}>{children}</ul>;

export default function ListsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Listas"
        inlineActions
        actions={
          <Link
            href="/listas/nueva"
            aria-label="Nueva lista"
            className={segmentActionCompactClass}
          >
            <SegmentPlusIcon />
            <SegmentActionTooltip label="Crear lista" />
          </Link>
        }
      />
      <Suspense fallback={<ListsBodySkeleton />}>
        <ListsBody />
      </Suspense>
    </div>
  );
}

/** «12 · compartida con 3» and the members' avatars on your shared lists (canvas 4·1). */
const sharedCardProps = (list: { _count: { items: number; series: number }; members: Array<{ id: string; name: string | null }> }) =>
  list.members.length > 0
    ? {
        subtitle: `${collectionCountLabel(list._count.items, list._count.series)} · compartida con ${list.members.length}`,
        badge: <AvatarStack people={list.members} />,
      }
    : {};

const ListsBody = async () => {
  const userId = await requireUserId();
  const [lists, shared, requests] = await Promise.all([
    getLists(),
    getSharedWithMe(userId),
    getPendingRequestsForOwner(userId),
  ]);
  const { fixed: allFixed, custom, years } = partitionUserLists(lists);
  // Quiero ver is pinned on top (FIL-34), so the rail skips it.
  const watchlist = allFixed.find((list) => list.slug === WATCHLIST_SLUG);
  const fixed = allFixed.filter((list) => list !== watchlist);
  const year = Number(mxToday().slice(0, 4));

  return (
    <div className="space-y-12">
      <QuieroVerPinnedCard
        name={watchlist?.name ?? WATCHLIST_NAME}
        itemCount={watchlist?._count.items ?? 0}
        seriesCount={watchlist?._count.series}
        posters={watchlist?.items.map((item) => item.title) ?? []}
      />
      <OwnerRequestsNotice requests={requests} />
      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-paper">
          <span className="text-accent">
            <SectionIcon name="daily" />
          </span>
          Listas diarias
        </h2>
        <ListCollection>
          {fixed.map((list, index) => (
            <li
              key={list.id}
              className="min-w-0 stagger-in"
              style={{ "--stagger": index } as CSSProperties}
            >
              <ListCard
                href={listHref(list)}
                name={list.name}
                slug={list.slug}
                description={list.description}
                itemCount={list._count.items}
                  seriesCount={list._count.series}
                posters={list.items.map((item) => item.title)}
                {...sharedCardProps(list)}
              />
            </li>
          ))}
        </ListCollection>
      </section>

      <section className="space-y-4 pt-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-paper">
          <span className="text-accent">
            <SectionIcon name="custom" />
          </span>
          Personalizadas
        </h2>
        {custom.length === 0 ? (
          <EmptyState
            variant="listas"
            title="Todavía no hay listas propias"
            description="Crea una colección para un mood, un ciclo o un maratón."
            actionHref="/listas/nueva"
            actionLabel="Nueva lista"
          />
        ) : (
          <ListCollection layout="grid">
            {custom.map((list, index) => (
              <li
                key={list.id}
                className="min-w-0 stagger-in"
                style={{ "--stagger": index } as CSSProperties}
              >
                <ListCard
                  href={listHref(list)}
                  name={list.name}
                  slug={list.slug}
                  description={list.description}
                  itemCount={list._count.items}
                  seriesCount={list._count.series}
                  posters={list.items.map((item) => item.title)}
                  layout="grid"
                  {...sharedCardProps(list)}
                />
              </li>
            ))}
          </ListCollection>
        )}
      </section>

      <SharedWithMeSection shared={shared} />

      <section id="tus-anos" className="scroll-mt-20 space-y-4 pt-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-paper">
          <span className="text-cine">
            <SectionIcon name="years" />
          </span>
          Tus años
        </h2>
        {years.length === 0 ? (
          <Link
            href="/cine#mejor"
            className={`relative inline-flex items-center gap-1.5 text-sm text-fog transition-colors hover:text-paper ${focusRing}`}
          >
            Arma tu top 10 de {year} en Cine
            <span aria-hidden="true">›</span>
            <HitArea />
          </Link>
        ) : (
          <ListCollection layout="grid">
            {years.map((list, index) => (
              <li
                key={list.id}
                className="min-w-0 stagger-in"
                style={{ "--stagger": index } as CSSProperties}
              >
                <ListCard
                  href={listHref(list)}
                  name={list.name}
                  slug={list.slug}
                  description={list.description}
                  itemCount={list._count.items}
                  seriesCount={list._count.series}
                  posters={list.items.map((item) => item.title)}
                  layout="grid"
                />
              </li>
            ))}
          </ListCollection>
        )}
      </section>
    </div>
  );
};

/** One stroke family for the three section marks (FIL-I44-15; they were ▦ ★ ✦). */
const SectionIcon = ({ name }: { name: "daily" | "custom" | "years" }) => (
  <svg
    viewBox="0 0 24 24"
    width={18}
    height={18}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {name === "daily" ? (
      <>
        <rect x="4" y="5" width="16" height="15" rx="2.5" />
        <path d="M4 10h16M9 3v4M15 3v4" />
      </>
    ) : name === "custom" ? (
      <path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.4l-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z" />
    ) : (
      <>
        <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
        <path d="M16 6h3a3 3 0 0 1-3 4M8 6H5a3 3 0 0 0 3 4M12 13v4M8.5 20h7" />
      </>
    )}
  </svg>
);
