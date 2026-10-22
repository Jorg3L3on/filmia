import { Suspense } from "react";
import type { CSSProperties, ReactNode } from "react";
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
import { listHref, partitionUserLists } from "@/lib/lists";
import { focusRing } from "@/lib/ui";
import { getLists } from "@/lib/queries";
import { AvatarStack } from "@/components/lists/PersonAvatar";
import { OwnerRequestsNotice, SharedWithMeSection } from "@/components/lists/SharedWithMe";
import { getPendingRequestsForOwner, getSharedWithMe } from "@/lib/list-invites";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Listas",
} as const;

type ListCollectionLayout = "rail" | "grid";

const listCollectionClassName: Record<ListCollectionLayout, string> = {
  rail: "rail -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-8 overflow-x-auto overscroll-x-contain px-4 pb-3 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-3 sm:gap-10 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4",
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
        backHref="/perfil"
        backLabel="Volver a Perfil"
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
const sharedCardProps = (list: { _count: { items: number }; members: Array<{ id: string; name: string | null }> }) =>
  list.members.length > 0
    ? {
        subtitle: `${list._count.items} · compartida con ${list.members.length}`,
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
  const { fixed, custom, years } = partitionUserLists(lists);
  const year = Number(mxToday().slice(0, 4));

  return (
    <div className="space-y-12">
      <OwnerRequestsNotice requests={requests} />
      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-paper">
          <span className="text-accent" aria-hidden="true">
            ▦
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
                posters={list.items.map((item) => item.title)}
                {...sharedCardProps(list)}
              />
            </li>
          ))}
        </ListCollection>
      </section>

      <section className="space-y-4 pt-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-paper">
          <span className="text-accent" aria-hidden="true">
            ★
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
          <span className="text-cine" aria-hidden="true">
            ✦
          </span>
          Tus años
        </h2>
        {years.length === 0 ? (
          <Link
            href="/cine#mejor"
            className={`inline-flex items-center gap-1.5 text-sm text-fog transition-colors hover:text-paper ${focusRing}`}
          >
            Arma tu top 10 de {year} en Cine
            <span aria-hidden="true">›</span>
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
