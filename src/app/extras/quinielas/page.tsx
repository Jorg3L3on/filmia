import Link from "next/link";
import { NavLabel } from "@/components/NavOriginTracker";
import { BackDisc } from "@/components/PageHeader";
import { cn } from "@/lib/cn";
import { JUEGOS_PATH } from "@/lib/juegos/core";
import { listCeremonies, quinielaToday } from "@/lib/quinielas/ceremonies";
import { ceremonyPath, hubEntries, type HubEntry } from "@/lib/quinielas/hub-core";
import { getClosingTimes, getVoteCounts, getWinnerCounts } from "@/lib/quinielas/store";
import { formatClose } from "@/lib/quinielas/view";
import { requireUserId } from "@/lib/session";
import { focusRing } from "@/lib/ui";

export const dynamic = "force-dynamic";

export const metadata = { title: "Quinielas de premios" } as const;

const DAY_FORMAT = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", timeZone: "UTC" });
const day = (iso: string) => DAY_FORMAT.format(new Date(`${iso}T12:00:00Z`));

const STATE_LABEL: Record<HubEntry["state"], string> = {
  "en-vivo": "En vivo",
  abierta: "Abierta",
  pronto: "Abre pronto",
  proxima: "Próxima",
  resultado: "Resultado",
};

/** «… 5:00 p.m.» already ends in a period: never two. */
const sentence = (text: string) => (text.endsWith(".") ? text : `${text}.`);

const line = (entry: HubEntry) => {
  switch (entry.state) {
    case "abierta":
      return sentence(`Llevas ${entry.voted} de ${entry.total}. Cierra ${entry.closesAt ? formatClose(entry.closesAt) : "al empezar la ceremonia"}`);
    case "en-vivo":
      return entry.announced > 0 ? `${entry.announced} de ${entry.total} anunciadas.` : "Ya empezó la ceremonia.";
    case "resultado":
      return "Ya se anunció todo: mira cuántas le atinaste.";
    case "pronto":
      return `Nominadas el ${day(entry.nominationsOn)}; ceremonia el ${day(entry.ceremonyOn)}.`;
    default:
      return `Las nominadas salen el ${day(entry.nominationsOn)}.`;
  }
};

/**
 * Quinielas de premios (FIL-I51-8): every ceremony in season or still ahead, the live and open ones
 * first. Two can be open at once (BAFTA and the Óscar in February).
 */
export default async function QuinielasHubPage() {
  const userId = await requireUserId();
  const now = new Date();
  const [closingTimes, voteCounts, winnerCounts] = await Promise.all([
    getClosingTimes(),
    getVoteCounts(userId),
    getWinnerCounts(),
  ]);
  const entries = hubEntries(listCeremonies(), { today: quinielaToday(now), now, closingTimes, voteCounts, winnerCounts });

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5" data-quiniela-hub>
      <NavLabel label="Quinielas de premios" />
      <div className="flex items-center gap-3">
        <BackDisc href={JUEGOS_PATH} label="Volver a Extras" />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-star">Extras</p>
          <h1 className="mt-1 font-serif text-[1.9rem] font-semibold leading-none text-paper">Quinielas de premios</h1>
        </div>
      </div>
      <p className="text-sm text-fog">
        Predice quién gana cada categoría, reta a tus amigos con un enlace y sigue tus aciertos la noche de la ceremonia.
      </p>
      {entries.length === 0 ? (
        <div className="rounded-2xl border border-chrome bg-surface p-5" data-quiniela-hub-empty>
          <h2 className="font-serif text-xl text-paper">Abre con las nominaciones</h2>
          <p className="mt-2 text-sm text-fog">
            Cada quiniela aparece aquí el día que salen sus nominadas: Globos de Oro en diciembre, BAFTA y Óscar en enero,
            Emmy en julio.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {entries.map((entry) => (
            <li key={entry.info.id}>
              <Link
                href={ceremonyPath(entry.info.id)}
                data-hub-ceremony={entry.info.id}
                data-hub-state={entry.state}
                className={cn(
                  "flex min-h-16 flex-col gap-1 rounded-2xl border bg-surface px-4 py-3 hover:border-star/60",
                  entry.state === "abierta" || entry.state === "en-vivo" ? "border-star/50" : "border-chrome",
                  focusRing,
                )}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-paper">{entry.info.title}</span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em]",
                      entry.state === "en-vivo" ? "bg-danger/15 text-danger" : entry.state === "abierta" ? "bg-star/15 text-star" : "bg-well text-fog",
                    )}
                  >
                    {STATE_LABEL[entry.state]}
                  </span>
                </span>
                <span className="text-sm text-fog">{line(entry)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
