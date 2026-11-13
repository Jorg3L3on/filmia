import Link from "next/link";
import { OscarCloseForm, OscarWinnerForm } from "@/components/admin/OscarAdminForms";
import { requireAdmin } from "@/lib/admin";
import { utcToMexicoCityLocal } from "@/lib/juegos/oscar/admin";
import { loadOscarCategories } from "@/lib/juegos/oscar/ballot-load";
import { knownOscarCeremonyYears, oscarSeasonYear } from "@/lib/juegos/oscar/ceremonies";
import { getOscarClosesAt, getOscarWinners } from "@/lib/juegos/oscar/store";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

export const dynamic = "force-dynamic";

export const generateMetadata = async () => {
  await requireAdmin();
  return { title: "Admin · Quiniela", robots: { index: false, follow: false } };
};

const timeFormat = new Intl.DateTimeFormat("es-MX", { hour: "numeric", minute: "2-digit", timeZone: "America/Mexico_City" });

/**
 * /admin/quiniela (FIL-I51-4): open the ballots (closing time) and, the night of the ceremony,
 * enter each winner as it is announced; correct it if needed. `?entrega=2024` rehearses with a
 * past ceremony that nobody plays.
 */
export default async function AdminQuinielaPage({ searchParams }: { searchParams: Promise<{ entrega?: string }> }) {
  await requireAdmin();
  const season = oscarSeasonYear();
  const known = knownOscarCeremonyYears();
  const asked = Number((await searchParams).entrega);
  const year = known.includes(asked) ? asked : known.includes(season) ? season : null;

  if (!year) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 pb-10">
        <h1 className="font-serif text-[2.1rem] font-semibold text-paper">Quiniela del Óscar</h1>
        <p className="text-sm text-fog">
          No hay archivo de la entrega {season}. Se agrega con <code>npm run oscars:build -- --entrega {season}</code> o a mano.
        </p>
      </div>
    );
  }

  const [categories, winners, closesAt] = await Promise.all([
    loadOscarCategories(year),
    getOscarWinners(year),
    getOscarClosesAt(year),
  ]);
  const announced = Object.keys(winners).length;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 pb-10" data-admin-quiniela>
      <header className="flex flex-col gap-1.5">
        <p className="text-xs uppercase tracking-[0.08em] text-fog">
          <Link href="/admin" className={cn("hover:text-paper", focusRing)}>
            Admin
          </Link>{" "}
          · solo tú
        </p>
        <h1 className="font-serif text-[2.1rem] font-semibold leading-tight text-paper">Quiniela del Óscar {year}</h1>
        <p className="text-sm text-fog">
          {announced} de {categories?.length ?? 0} anunciadas.
          {year !== season ? ` Ensayo: la temporada es ${season}.` : ""}
        </p>
        {known.length > 1 || year !== season ? (
          <nav aria-label="Entregas" className="flex flex-wrap gap-2 text-sm">
            {known.map((option) => (
              <Link
                key={option}
                href={`/admin/quiniela?entrega=${option}`}
                aria-current={option === year ? "page" : undefined}
                className={cn("rounded-full border border-line px-3 py-1 text-fog aria-[current=page]:border-star aria-[current=page]:text-paper", focusRing)}
              >
                {option}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>

      <section aria-labelledby="cierre" className="flex flex-col gap-2.5">
        <h2 id="cierre" className="text-[13px] font-semibold uppercase tracking-[0.06em] text-fog">
          Cierre de boletas
        </h2>
        <OscarCloseForm year={year} value={closesAt ? utcToMexicoCityLocal(closesAt) : ""} />
      </section>

      <section aria-labelledby="ganadoras" className="flex flex-col gap-2.5">
        <h2 id="ganadoras" className="text-[13px] font-semibold uppercase tracking-[0.06em] text-fog">
          Ganadoras
        </h2>
        {(categories ?? []).map((category) => {
          const winner = winners[category.id];
          const nominee = winner ? category.nominees.find((option) => option.id === winner.nomineeId) : null;
          return (
            <OscarWinnerForm
              key={category.id}
              year={year}
              categoryId={category.id}
              label={category.label}
              nominees={category.nominees.map(({ id, name, detail }) => ({ id, name, detail }))}
              winnerId={winner?.nomineeId ?? null}
              winnerLine={winner ? `Ganó ${nominee?.name ?? winner.nomineeId} · ${timeFormat.format(winner.announcedAt)}` : null}
            />
          );
        })}
      </section>
    </div>
  );
}
