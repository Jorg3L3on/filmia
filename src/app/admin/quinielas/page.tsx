import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { cn } from "@/lib/cn";
import { listCeremonies } from "@/lib/quinielas/ceremonies";
import { ceremonyInfo } from "@/lib/quinielas/hub-core";
import { getClosingTimes, getWinnerCounts } from "@/lib/quinielas/store";
import { focusRing } from "@/lib/ui";

export const dynamic = "force-dynamic";

export const generateMetadata = async () => {
  await requireAdmin();
  return { title: "Admin · Quinielas", robots: { index: false, follow: false } };
};

/** /admin/quinielas (FIL-I51-8): every ceremony with a file, to open its ballots or enter winners. */
export default async function AdminQuinielasPage() {
  await requireAdmin();
  const [closing, winners] = await Promise.all([getClosingTimes(), getWinnerCounts()]);
  const ceremonies = listCeremonies();
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 pb-10" data-admin-quinielas>
      <header className="flex flex-col gap-1.5">
        <p className="text-xs uppercase tracking-[0.08em] text-fog">
          <Link href="/admin" className={cn("hover:text-paper", focusRing)}>
            Admin
          </Link>{" "}
          · solo tú
        </p>
        <h1 className="font-serif text-[2.1rem] font-semibold leading-tight text-paper">Quinielas de premios</h1>
        <p className="text-sm text-fog">
          Una entrega nueva se agrega con <code>npm run quiniela:nueva</code> (u <code>oscars:build</code> para el Óscar) y su
          import en <code>src/lib/quinielas/ceremonies.ts</code>.
        </p>
      </header>
      <ul className="flex flex-col gap-2">
        {ceremonies.map((file) => {
          const info = ceremonyInfo(file);
          return (
            <li key={file.id}>
              <Link
                href={`/admin/quinielas/${file.id}`}
                data-admin-ceremony={file.id}
                className={cn("flex min-h-14 flex-col justify-center rounded-2xl border border-line bg-well px-4 py-2.5 hover:border-star/50", focusRing)}
              >
                <span className="font-semibold text-paper">{info.title}</span>
                <span className="text-xs text-fog">
                  Ceremonia {file.ceremonyOn} · {closing[file.id] ? "boletas abiertas o cerradas" : "boletas sin abrir"} ·{" "}
                  {winners[file.id] ?? 0} de {file.categories.length} ganadoras
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
