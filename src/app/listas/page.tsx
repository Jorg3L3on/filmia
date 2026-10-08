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
import { listHref, partitionUserLists } from "@/lib/lists";
import { getLists } from "@/lib/queries";

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

const ListsBody = async () => {
  const lists = await getLists();
  const { fixed, custom } = partitionUserLists(lists);

  return (
    <div className="space-y-12">
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
                />
              </li>
            ))}
          </ListCollection>
        )}
      </section>
    </div>
  );
};
