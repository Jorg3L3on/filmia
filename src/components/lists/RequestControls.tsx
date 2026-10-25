"use client";

import { useState, useTransition } from "react";
import { cancelMyRequest, decideRequests, dismissMyRequest } from "@/app/actions/list-sharing";
import { cn } from "@/lib/cn";
import { showToast } from "@/lib/toast";
import { showActionError, TOAST_COPY } from "@/lib/toast-alerts";
import { focusRing } from "@/lib/ui";

const pill = cn(
  "press-scale inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-semibold transition disabled:opacity-60",
  focusRing,
);
export const approveClass = cn(pill, "bg-accent text-ink hover:bg-accent-hover");
export const rejectClass = cn(pill, "border border-white/15 bg-white/[0.06] text-paper hover:bg-white/10");

/** Canvas 3·1/3·2: approve or reject one or several requests of a list. */
export const DecideButtons = ({
  listId,
  requestIds,
  approveLabel = "Aprobar",
  rejectLabel = "Rechazar",
  names,
}: {
  listId: string;
  requestIds: string[];
  approveLabel?: string;
  rejectLabel?: string;
  /** For the toast: «Ana ya está en la lista». */
  names?: string;
}) => {
  const [isPending, startTransition] = useTransition();
  const decided = (decision: "approve" | "reject") =>
    showToast({
      title: decision === "approve" ? TOAST_COPY.requestApproved : TOAST_COPY.requestRejected,
      description:
        decision === "approve"
          ? names
            ? `${names} ya puede${requestIds.length > 1 ? "n" : ""} entrar.`
            : undefined
          : undefined,
    });
  const decide = (decision: "approve" | "reject") =>
    startTransition(async () => {
      try {
        await decideRequests(listId, requestIds, decision);
        decided(decision);
      } catch {
        showActionError({
          title: TOAST_COPY.couldNotSave,
          retry: async () => {
            await decideRequests(listId, requestIds, decision);
            decided(decision);
          },
        });
      }
    });
  return (
    <span className="inline-flex gap-2">
      <button type="button" disabled={isPending} onClick={() => decide("reject")} className={rejectClass}>
        {rejectLabel}
      </button>
      <button type="button" disabled={isPending} onClick={() => decide("approve")} className={approveClass}>
        {approveLabel}
      </button>
    </span>
  );
};

/** «Cancelar solicitud» (canvas 2·3) or «Entendido» on a refusal. */
export const MyRequestButton = ({ requestId, kind }: { requestId: string; kind: "cancel" | "dismiss" }) => {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  if (done) {
    return null;
  }
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          try {
            await (kind === "cancel" ? cancelMyRequest(requestId) : dismissMyRequest(requestId));
            setDone(true);
          } catch {
            showActionError({ title: TOAST_COPY.couldNotSave });
          }
        })
      }
      className={cn("text-sm text-fog underline-offset-4 hover:text-paper hover:underline", focusRing)}
    >
      {kind === "cancel" ? "Cancelar solicitud" : "Entendido"}
    </button>
  );
};
