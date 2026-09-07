import type { Metadata } from "next";
import Link from "next/link";
import { TitleForm } from "@/components/TitleForm";
import { metadataServicesConfigured } from "@/lib/metadata";
import { getCollectionLists, getTagFilters } from "@/lib/queries";
import { focusRing } from "@/lib/ui";

export const metadata: Metadata = {
  title: "Registrar título",
};

export const dynamic = "force-dynamic";

export default async function NewTitlePage() {
  const [tags, lists, metadataConfig] = await Promise.all([
    getTagFilters(),
    getCollectionLists(),
    Promise.resolve(metadataServicesConfigured()),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="flex items-center justify-between gap-3">
        <Link
          href="/buscar"
          aria-label="Volver a buscar"
          className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-fog hover:bg-well hover:text-paper ${focusRing}`}
        >
          ←
        </Link>
        <h1 className="font-serif text-2xl text-paper">Registrar título</h1>
        <Link href="/buscar" className="text-sm font-medium text-accent hover:text-accent-hover">
          Buscar en TMDB
        </Link>
      </header>

      <TitleForm tags={tags} lists={lists} metadataConfig={metadataConfig} />
    </div>
  );
}
