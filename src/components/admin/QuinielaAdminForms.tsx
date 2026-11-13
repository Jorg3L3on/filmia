"use client";

import { useActionState } from "react";
import { clearWinnerAction, setCloseAction, setWinnerAction } from "@/app/actions/quiniela-admin";
import type { QuinielaAdminResult } from "@/lib/quinielas/admin";
import { buttonClass, fieldClass } from "@/lib/ui";

const Status = ({ state, okText }: { state: QuinielaAdminResult | null; okText: string }) =>
  state ? (
    <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-xs text-success" : "text-xs text-danger"}>
      {state.ok ? okText : state.error}
    </p>
  ) : null;

/** When the ballots close (the ceremony's start), Mexico City time. */
export const QuinielaCloseForm = ({ ceremonyId, value }: { ceremonyId: string; value: string }) => {
  const [state, action, pending] = useActionState(setCloseAction, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2.5" data-admin-close>
      <input type="hidden" name="ceremonyId" value={ceremonyId} />
      <label className="flex min-w-56 flex-1 flex-col gap-1 text-sm text-fog">
        Inicio de la ceremonia (hora de Ciudad de México)
        <input type="datetime-local" name="closesAt" defaultValue={value} required className={fieldClass} />
      </label>
      <button type="submit" disabled={pending} className={buttonClass({ pending })}>
        {value ? "Cambiar cierre" : "Abrir boletas"}
      </button>
      <div className="basis-full">
        <Status state={state} okText="Guardado." />
      </div>
    </form>
  );
};

type Nominee = { id: string; name: string; detail: string | null };

/** One category: pick the winner, save; «Quitar» if it went to the wrong category. */
export const QuinielaWinnerForm = ({
  ceremonyId,
  categoryId,
  label,
  nominees,
  winnerId,
  winnerLine,
}: {
  ceremonyId: string;
  categoryId: string;
  label: string;
  nominees: Nominee[];
  winnerId: string | null;
  winnerLine: string | null;
}) => {
  const [state, action, pending] = useActionState(setWinnerAction, null);
  const [clearState, clear, clearing] = useActionState(clearWinnerAction, null);
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-well p-3" data-admin-category={categoryId}>
      <form action={action} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="ceremonyId" value={ceremonyId} />
        <input type="hidden" name="categoryId" value={categoryId} />
        <label className="flex min-w-0 flex-1 basis-56 flex-col gap-1 text-sm font-semibold text-paper">
          {label}
          <select name="nomineeId" defaultValue={winnerId ?? ""} required className={fieldClass} key={winnerId ?? "none"}>
            <option value="" disabled>
              Elige a la ganadora
            </option>
            {nominees.map((nominee) => (
              <option key={nominee.id} value={nominee.id}>
                {nominee.detail ? `${nominee.name} · ${nominee.detail}` : nominee.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={pending} className={buttonClass({ pending })}>
          {winnerId ? "Corregir" : "Guardar"}
        </button>
      </form>
      <div className="flex flex-wrap items-center gap-2 text-xs text-fog">
        {winnerLine ? <span data-admin-winner>{winnerLine}</span> : <span>Sin anunciar</span>}
        {winnerId ? (
          <form action={clear}>
            <input type="hidden" name="ceremonyId" value={ceremonyId} />
            <input type="hidden" name="categoryId" value={categoryId} />
            <button type="submit" disabled={clearing} className="underline-offset-2 hover:text-paper hover:underline">
              Quitar
            </button>
          </form>
        ) : null}
      </div>
      <Status state={state} okText="Guardada." />
      <Status state={clearState} okText="Quitada." />
    </div>
  );
};
