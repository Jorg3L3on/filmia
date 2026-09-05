import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { ListCard } from "@/components/ListCard";
import { listHref, partitionUserLists } from "@/lib/lists";
import { getLists } from "@/lib/queries";
import { btnPrimary } from "@/lib/ui";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Listas",
} as const;

export default async function ListsPage() {
  const lists = await getLists();
  const { fixed, custom } = partitionUserLists(lists);

  return (
    <div className="space-y-12">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-serif text-4xl tracking-tight text-paper">Listas</h1>
        <Link href="/listas/nueva" className={btnPrimary}>
          Nueva lista
        </Link>
      </header>

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-paper">
          <span className="text-accent" aria-hidden="true">
            ▦
          </span>
          Listas diarias
        </h2>
        <ul className="rail -mx-4 flex gap-8 overflow-x-auto px-4 pb-3 sm:gap-10">
          {fixed.map((list) => (
            <li key={list.id}>
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
        </ul>
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
          <ul className="rail -mx-4 flex gap-8 overflow-x-auto px-4 pb-3 sm:gap-10">
            {custom.map((list) => (
              <li key={list.id}>
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
          </ul>
        )}
      </section>
    </div>
  );
}
