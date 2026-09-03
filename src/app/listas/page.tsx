import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { ListCard } from "@/components/ListCard";
import { PageHeader } from "@/components/PageHeader";
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
    <div className="space-y-8">
      <PageHeader
        eyebrow="Colecciones"
        title="Listas"
        description="Quiero ver, Favoritas y Por rewatch siempre están. Las personalizadas las armas tú."
        actions={
          <Link href="/listas/nueva" className={btnPrimary}>
            Nueva lista
          </Link>
        }
      />

      <section className="space-y-4">
        <h2 className="text-xs uppercase tracking-[0.2em] text-mist">
          Listas diarias
        </h2>
        <ul className="grid gap-4 md:grid-cols-3">
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

      <section className="space-y-4">
        <h2 className="text-xs uppercase tracking-[0.2em] text-mist">
          Personalizadas
        </h2>
        {custom.length === 0 ? (
          <EmptyState
            title="Todavía no hay listas propias"
            description="Crea una colección para un mood, un ciclo o un maratón. Las diarias no se tocan."
            actionHref="/listas/nueva"
            actionLabel="Nueva lista"
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
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
