import type { Metadata } from "next";
import Link from "next/link";
import { TitleForm } from "@/components/TitleForm";
import { metadataServicesConfigured } from "@/lib/metadata";
import { getCollectionLists, getTags } from "@/lib/queries";
import { btnPrimary, focusRing, wellClass } from "@/lib/ui";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Registrar título",
};

export const dynamic = "force-dynamic";

export default async function NewTitlePage() {
  const [tags, lists, metadataConfig] = await Promise.all([
    getTags(),
    getCollectionLists(),
    Promise.resolve(metadataServicesConfigured()),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="flex items-center justify-between gap-3">
        <Link
          href="/buscar"
          className={cn("text-sm text-fog hover:text-paper", focusRing)}
        >
          ←
        </Link>
        <h1 className="font-serif text-2xl text-paper">Registrar título</h1>
        <Link href="/buscar" className="text-sm font-medium text-accent hover:text-accent-hover">
          Buscar en TMDB
        </Link>
      </header>

      <Link
        href="/buscar"
        className={`${wellClass} flex items-center justify-between gap-4 border-accent/30 p-5 transition hover:border-accent`}
      >
        <div className="space-y-1">
          <p className="font-medium text-paper">¿No encuentras la película o serie?</p>
          <p className="text-sm text-fog">
            Busca en TMDB y añade títulos con toda su información en un solo paso.
          </p>
        </div>
        <span className={btnPrimary}>Buscar en TMDB</span>
      </Link>

      <TitleForm tags={tags} lists={lists} metadataConfig={metadataConfig} />
    </div>
  );
}
