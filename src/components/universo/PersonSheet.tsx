"use client";

import Link from "next/link";
import { useEffect, useId, useState, useTransition } from "react";
import { universoPerson } from "@/app/actions/universo";
import { Button } from "@/components/Button";
import { ShimmerBlock } from "@/components/PageSkeletons";
import { Sheet, SheetHandle } from "@/components/Sheet";
import { StartRutaButton } from "@/components/universo/StartRutaButton";
import { ROLE_LABEL, type UniversoNode } from "@/lib/universo/core";
import type { UniversoPerson } from "@/lib/universo/store";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

/**
 * U3 · one person of your universe: n de N, bridges, their ruta (whole or «esenciales») and the
 * film that opens most bridges. Loaded on open (TMDB, cached).
 */
export const PersonSheet = ({ node, onClose }: { node: UniversoNode | null; onClose: () => void }) => {
  const headingId = useId();
  const [person, setPerson] = useState<UniversoPerson | null>(null);
  const [, startLoad] = useTransition();

  useEffect(() => {
    if (!node) {
      return;
    }
    // A sheet for someone else is ignored until this one answers (`loaded` checks the key).
    startLoad(async () => {
      setPerson(await universoPerson(node.key));
    });
  }, [node]);

  const loaded = person && node && person.key === node.key ? person : null;

  return (
    <Sheet open={Boolean(node)} onClose={onClose} labelledBy={headingId} overlayLabel="Cerrar" align="bottom" dragDismiss portal>
      {node ? (
        <div className="flex flex-col gap-4 px-5 pb-5 pt-3">
          <SheetHandle />
          <header>
            <h2 id={headingId} className="font-serif text-2xl leading-tight text-paper">
              {node.name}
            </h2>
            <p className="text-[13px] text-fog">
              {ROLE_LABEL[node.role]}
              {loaded?.firstFilm ? ` · entró con ${loaded.firstFilm}` : ""}
            </p>
          </header>
          <dl className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-chrome/70 px-3 py-2.5">
              <dt className="text-[11px] text-fog">Vistas</dt>
              <dd className="font-serif text-2xl text-paper">
                {node.count}
                {loaded?.total ? <span className="text-[14px] text-fog"> de {loaded.total}</span> : null}
              </dd>
            </div>
            <div className="rounded-2xl bg-chrome/70 px-3 py-2.5">
              <dt className="text-[11px] text-fog">Puentes</dt>
              <dd className="font-serif text-2xl text-paper">{node.bridge ? node.count - 1 : 0}</dd>
            </div>
          </dl>
          {!loaded ? (
            <div className="space-y-2" aria-busy="true" aria-label="Cargando">
              <ShimmerBlock className="h-4 w-56 rounded-full" />
              <ShimmerBlock className="h-16 w-full rounded-2xl" />
            </div>
          ) : (
            <>
              {loaded.ruta && !loaded.ruta.whole && loaded.total ? (
                <p className="text-[14px] leading-snug text-paper/85">
                  Sus esenciales son {loaded.ruta.size}, no {loaded.total}: {loaded.ruta.names.slice(0, 4).join(", ")}
                  {loaded.ruta.names.length > 4 ? "…" : "."} Las otras están en su filmografía.
                </p>
              ) : null}
              {loaded.mostBridges ? (
                <div className="rounded-2xl border border-line px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-affinity">La que más puentes abre</p>
                  <p className="mt-1 font-serif text-xl text-paper">{loaded.mostBridges.name}</p>
                  <p className="text-[13px] text-fog">
                    {[
                      loaded.mostBridges.people.map((name) => `+ ${name}`).join(", "),
                      loaded.mostBridges.platformLabel,
                      loaded.mostBridges.runtime ? `${loaded.mostBridges.runtime} min` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              ) : null}
              <div className="flex flex-col gap-2">
                {loaded.ruta ? (
                  loaded.ruta.started ? (
                    <Button href="/rutas" variant="secondary" size="lg" onClick={onClose}>
                      Ya tienes su ruta
                    </Button>
                  ) : (
                    <StartRutaButton sourceKey={loaded.ruta.sourceKey} label={`Empezar «${loaded.ruta.title}»`} />
                  )
                ) : null}
                {loaded.filmographyHref ? (
                  <Link href={loaded.filmographyHref} className={cn("press-scale self-center rounded-xl px-4 py-2.5 text-[14px] text-fog hover:text-paper", focusRing)}>
                    Ver toda su filmografía
                  </Link>
                ) : null}
              </div>
            </>
          )}
        </div>
      ) : null}
    </Sheet>
  );
};
