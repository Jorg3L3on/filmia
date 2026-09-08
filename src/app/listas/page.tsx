import { Suspense } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ListCard } from "@/components/ListCard";
import { PageHeader } from "@/components/PageHeader";
import { ListsBodySkeleton } from "@/components/PageSkeletons";
import { listHref, partitionUserLists } from "@/lib/lists";
import { getLists } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Listas",
} as const;

const listCollectionClassName =
  "rail -mx-4 flex gap-8 overflow-x-auto px-4 pb-3 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-10 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4";

const ListCollection = ({ children }: { children: ReactNode }) => (
  <ul className={listCollectionClassName}>{children}</ul>
);

export default function ListsPage() {
  return (
    <div className="space-y-12">
      <PageHeader
        title="Listas"
        actions={<Button href="/listas/nueva">Nueva lista</Button>}
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
    <>
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
          <ListCollection>
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
                />
              </li>
            ))}
          </ListCollection>
        )}
      </section>
    </>
  );
};
