import Link from "next/link";
import { notFound } from "next/navigation";
import { QuinielaCloseForm, QuinielaWinnerForm } from "@/components/admin/QuinielaAdminForms";
import { requireAdmin } from "@/lib/admin";
import { cn } from "@/lib/cn";
import { utcToMexicoCityLocal } from "@/lib/quinielas/admin";
import { loadCategories } from "@/lib/quinielas/ballot-load";
import { getCeremony } from "@/lib/quinielas/ceremonies";
import { ceremonyInfo } from "@/lib/quinielas/hub-core";
import { getClosesAt, getWinners } from "@/lib/quinielas/store";
import { focusRing } from "@/lib/ui";

export const dynamic = "force-dynamic";

export const generateMetadata = async () => {
  await requireAdmin();
  return { title: "Admin · Quinielas", robots: { index: false, follow: false } };
};

const timeFormat = new Intl.DateTimeFormat("es-MX", { hour: "numeric", minute: "2-digit", timeZone: "America/Mexico_City" });

/**
 * /admin/quinielas/[ceremonia] (FIL-I51-4): open the ballots (closing time) and, the night of the
 * ceremony, enter each winner as it is announced; correct it if needed. A past ceremony nobody
 * plays works as a rehearsal.
 */
export default async function AdminCeremonyPage({ params }: { params: Promise<{ ceremonia: string }> }) {
  await requireAdmin();
  const file = getCeremony((await params).ceremonia);
  if (!file) {
    notFound();
  }
  const ceremony = ceremonyInfo(file);
  const [categories, winners, closesAt] = await Promise.all([
    loadCategories(file.id),
    getWinners(file.id),
    getClosesAt(file.id),
  ]);
  const announced = Object.keys(winners).length;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 pb-10" data-admin-quiniela>
      <header className="flex flex-col gap-1.5">
        <p className="text-xs uppercase tracking-[0.08em] text-fog">
          <Link href="/admin/quinielas" className={cn("hover:text-paper", focusRing)}>
            Admin · Quinielas
          </Link>{" "}
          · solo tú
        </p>
        <h1 className="font-serif text-[2.1rem] font-semibold leading-tight text-paper">{ceremony.title}</h1>
        <p className="text-sm text-fog">
          {announced} de {categories?.length ?? 0} anunciadas · ceremonia el {file.ceremonyOn}.
        </p>
      </header>

      <section aria-labelledby="cierre" className="flex flex-col gap-2.5">
        <h2 id="cierre" className="text-[13px] font-semibold uppercase tracking-[0.06em] text-fog">
          Cierre de boletas
        </h2>
        <QuinielaCloseForm ceremonyId={file.id} value={closesAt ? utcToMexicoCityLocal(closesAt) : ""} />
      </section>

      <section aria-labelledby="ganadoras" className="flex flex-col gap-2.5">
        <h2 id="ganadoras" className="text-[13px] font-semibold uppercase tracking-[0.06em] text-fog">
          Ganadoras
        </h2>
        {(categories ?? []).map((category) => {
          const winner = winners[category.id];
          const nominee = winner ? category.nominees.find((option) => option.id === winner.nomineeId) : null;
          return (
            <QuinielaWinnerForm
              key={category.id}
              ceremonyId={file.id}
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
