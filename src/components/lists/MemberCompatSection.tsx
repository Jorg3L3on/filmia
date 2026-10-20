import { PersonAvatar } from "@/components/lists/PersonAvatar";
import { PosterImage } from "@/components/PosterImage";
import { ShareButton, ShareIcon } from "@/components/share/ShareButton";
import { compatLabel } from "@/lib/compat";
import type { MemberCompat } from "@/lib/compat-store";
import { slugify } from "@/lib/labels";

/**
 * «Compatibilidad» in Miembros (FIL-I19-4, canvas 2·1–2·2): your % with each
 * person who decides and, with three or more, the group's. Tap a row for the
 * card; «Donde no coinciden» stays here, never in what gets shared.
 */
export const MemberCompatSection = ({
  compat,
  viewer,
}: {
  compat: MemberCompat;
  viewer: { id: string; name: string };
}) => (
  <section className="space-y-3" aria-labelledby="compatibilidad-title">
    <h2 id="compatibilidad-title" className="text-sm font-semibold uppercase tracking-[0.14em] text-fog">
      Compatibilidad
    </h2>
    {compat.group ? (
      <p className="rounded-3xl border border-affinity/25 bg-affinity/[0.06] px-4 py-3 text-sm text-paper">
        <span className="font-serif text-2xl text-affinity">{compatLabel(compat.group)}</span>{" "}
        <span className="text-fog">el grupo de esta lista</span>
      </p>
    ) : null}
    <ul className="space-y-2">
      {compat.pairs.map(({ other, card, sharePath }) => (
        <li key={other.id} className="rounded-3xl border border-white/[0.08] bg-white/[0.03]">
          {card ? (
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-3">
                <span className="inline-flex">
                  <PersonAvatar person={viewer} size={28} />
                  <PersonAvatar person={other} size={28} className="-ml-2" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-paper">Tú × {other.name}</span>
                  <span className="block truncate text-xs text-fog">{card.phrase}</span>
                </span>
                <span className="font-serif text-xl text-affinity tabular-nums">{compatLabel(card)}</span>
              </summary>
              <div className="space-y-4 border-t border-white/[0.06] px-4 pb-4 pt-3 text-sm">
                <p className="text-fog">
                  {card.approx
                    ? `Por gustos parecidos: ${card.common === 1 ? "solo 1 película" : `${card.common} películas`} que vieron los dos.`
                    : `${card.common} películas que vieron los dos.`}
                </p>
                {card.genres.length > 0 ? (
                  <div className="space-y-1.5">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-fog">Géneros que comparten</h3>
                    <ul className="flex flex-wrap gap-1.5">
                      {card.genres.map((genre) => (
                        <li key={genre} className="rounded-full border border-affinity/30 px-2.5 py-0.5 text-xs text-paper">
                          {genre}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {card.bothLove.length > 0 ? (
                  <div className="space-y-1.5">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-fog">A los dos les encantó</h3>
                    <ul className="grid grid-cols-3 gap-2">
                      {card.bothLove.map((film) => (
                        <li key={film.catalogId} className="space-y-1">
                          <PosterImage
                            name={film.name}
                            posterPath={film.posterPath}
                            className="rounded-lg"
                            tmdbSize="w185"
                            sizes="96px"
                          />
                          <p className="line-clamp-2 text-xs text-paper">{film.name}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {card.disagree ? (
                  <div className="space-y-1">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-fog">Donde no coinciden</h3>
                    <p className="text-paper/90">
                      {card.disagree.name}: a uno le encantó y al otro no tanto. Solo lo ven ustedes.
                    </p>
                  </div>
                ) : null}
                {sharePath ? (
                  <ShareButton
                    path={sharePath}
                    imagePath={`${sharePath}/historia`}
                    title={`${viewer.name} y ${other.name} son ${compatLabel(card)} compatibles`}
                    text={card.phrase}
                    fileName={`${slugify(`${viewer.name}-${other.name}`) || "compatibilidad"}.png`}
                    ariaLabel={`Compartir en historias tu compatibilidad con ${other.name}`}
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-paper"
                  >
                    <ShareIcon className="size-4" />
                    Compartir en historias
                  </ShareButton>
                ) : null}
              </div>
            </details>
          ) : (
            <div className="flex items-center gap-3 px-3 py-3">
              <span className="inline-flex">
                <PersonAvatar person={viewer} size={28} />
                <PersonAvatar person={other} size={28} className="-ml-2" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-paper">Tú × {other.name}</span>
                <span className="block text-xs text-fog">Aún no hay suficientes calificaciones para compararlos.</span>
              </span>
            </div>
          )}
        </li>
      ))}
    </ul>
    <p className="text-xs text-fog">
      Solo cuentan quienes pueden editar; quien solo ve la lista no entra en el cálculo.
    </p>
  </section>
);
