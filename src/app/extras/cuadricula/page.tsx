import { NavLabel } from "@/components/NavOriginTracker";
import { CuadriculaGrid, RarityPanel, CuadriculaGame } from "@/components/juegos/CuadriculaGame";
import { DiariaResult, DiariaUnavailable } from "@/components/juegos/DiariaResult";
import { DiariaShareButton } from "@/components/juegos/DiariaShareButton";
import { CUADRICULA_ID, gridMarks } from "@/lib/juegos/diarias/cuadricula";
import { loadRarities, openCuadricula } from "@/lib/juegos/diarias/cuadricula-store";
import { loadDiariaTable } from "@/lib/juegos/diarias/store";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "La cuadrícula · La diaria" } as const;

/**
 * La cuadrícula (FIL-I54-4, board J-1-cuadricula): three people by three conditions, nine tries,
 * the same grid for every account. Once over, the grid, the rarity and the day table.
 */
export default async function CuadriculaPage() {
  const userId = await requireUserId();
  const now = new Date();
  const opened = await openCuadricula(userId, now).catch(() => null);

  if (opened?.status === "ok" && opened.view.finished) {
    const view = opened.view;
    const [table, rarities] = await Promise.all([loadDiariaTable(userId, CUADRICULA_ID, view.day, now), loadRarities(view.day)]);
    const filled = view.cells.filter((cell) => cell.film).map((cell) => cell.index);
    return (
      <div className="tanda-screen mx-auto flex w-full max-w-md flex-1 flex-col">
        <NavLabel label="La cuadrícula" />
        <DiariaResult
          id={CUADRICULA_ID}
          day={view.day}
          score={`${view.score} de ${view.total}`}
          table={table}
          rowScore={(row) => `${row.score}/9`}
          rowExtra={(row) => {
            const rarity = rarities.get(row.userId);
            return rarity != null ? `Rareza ${rarity}` : null;
          }}
          summary={<RarityPanel view={view} />}
          share={
            <DiariaShareButton id={CUADRICULA_ID} partidaId={view.partidaId} day={view.day} score={`${view.score} de ${view.total}`} marks={gridMarks(filled)} />
          }
        >
          <CuadriculaGrid view={view} />
        </DiariaResult>
      </div>
    );
  }

  return (
    <div className="tanda-screen mx-auto flex w-full max-w-md flex-1 flex-col">
      <NavLabel label="La cuadrícula" />
      {opened?.status === "ok" ? (
        <CuadriculaGame key={opened.view.partidaId} initialView={opened.view} />
      ) : (
        <DiariaUnavailable id={CUADRICULA_ID} failed={!opened} />
      )}
    </div>
  );
}
