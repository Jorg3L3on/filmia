"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import {
  createOscarGroupAction,
  deleteOscarGroupAction,
  joinOscarGroupAction,
  leaveOscarGroupAction,
  regenerateOscarGroupLinkAction,
  type GroupActionState,
} from "@/app/actions/quiniela";
import { ShareButton } from "@/components/share/ShareButton";
import { OSCAR_GROUP_NAME_MAX } from "@/lib/quinielas/group-limits";
import { showToast } from "@/lib/toast";
import { showActionError, TOAST_COPY } from "@/lib/toast-alerts";
import { buttonClass, fieldClass } from "@/lib/ui";

const initial: GroupActionState = { error: null };

/** «Crear un grupo»: optional name, then the group's page with its link. */
export const OscarGroupCreate = ({ ownerFirstName }: { ownerFirstName: string }) => {
  const [state, action, pending] = useActionState(createOscarGroupAction, initial);
  return (
    <form action={action} className="flex flex-col gap-3" data-quiniela-create>
      <label className="flex flex-col gap-1.5 text-sm text-fog">
        Nombre del grupo (opcional)
        <input
          name="name"
          maxLength={OSCAR_GROUP_NAME_MAX}
          placeholder={`La quiniela de ${ownerFirstName}`}
          className={fieldClass}
          autoComplete="off"
        />
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={buttonClass({ size: "lg", pending, className: "bg-star hover:bg-star/90" })}>
        {pending ? "Creando…" : "Crear grupo"}
      </button>
    </form>
  );
};

/** The owner's invite: share or copy the link; «Nuevo enlace» retires the old one. */
export const OscarGroupInvite = ({ groupId, path, groupName }: { groupId: string; path: string; groupName: string }) => {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).href);
      showToast({ title: TOAST_COPY.linkCopied, description: "Mándalo a quien quieras retar." });
    } catch {
      showActionError({ title: TOAST_COPY.couldNotCopyLink, description: new URL(path, window.location.origin).href });
    }
  };

  const regenerate = () =>
    startTransition(async () => {
      const next = await regenerateOscarGroupLinkAction(groupId).catch(() => null);
      setConfirming(false);
      if (!next) {
        showActionError({ title: "No se pudo cambiar el enlace" });
        return;
      }
      showToast({ title: "Enlace nuevo", description: "El anterior ya no sirve." });
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-3" data-quiniela-invite>
      <p className="truncate rounded-xl border border-chrome bg-well px-3 py-2 font-mono text-xs text-fog" data-invite-link={path}>
        {path}
      </p>
      <div className="flex gap-2.5">
        <ShareButton
          path={path}
          imagePath="/extras/quinielas/imagen"
          fileName="quiniela-oscar.png"
          title={groupName}
          text={`Te reto a la quiniela del Óscar en Filmia: «${groupName}».`}
          className={buttonClass({ size: "lg", className: "flex-1 bg-star hover:bg-star/90" })}
        >
          Invitar
        </ShareButton>
        <button type="button" onClick={copy} className={buttonClass({ variant: "ghost", size: "lg", className: "border border-chrome" })}>
          Copiar enlace
        </button>
      </div>
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-fog" role="group" aria-label="Cambiar el enlace">
          <span>El enlace anterior dejará de servir.</span>
          <button type="button" onClick={regenerate} disabled={pending} className={buttonClass({ size: "sm" })}>
            {pending ? "Cambiando…" : "Cambiar enlace"}
          </button>
          <button type="button" onClick={() => setConfirming(false)} className={buttonClass({ variant: "ghost", size: "sm" })}>
            Cancelar
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="self-start text-sm text-fog underline-offset-2 hover:text-paper hover:underline">
          Nuevo enlace
        </button>
      )}
    </div>
  );
};

/** «Salir del grupo» for members, «Borrar el grupo» for its owner; both ask once. */
export const OscarGroupLeave = ({ groupId, owner }: { groupId: string; owner: boolean }) => {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = () =>
    startTransition(async () => {
      const result = await (owner ? deleteOscarGroupAction(groupId) : leaveOscarGroupAction(groupId));
      setError(result.error);
    });
  const label = owner ? "Borrar el grupo" : "Salir del grupo";
  return (
    <div className="flex flex-col gap-2">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-fog" role="group" aria-label={label}>
          <span>{owner ? "Se borra para todos." : "Puedes volver con el enlace."}</span>
          <button type="button" onClick={run} disabled={pending} className={buttonClass({ variant: "danger", size: "sm" })}>
            {pending ? "…" : label}
          </button>
          <button type="button" onClick={() => setConfirming(false)} className={buttonClass({ variant: "ghost", size: "sm" })}>
            Cancelar
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="self-start text-sm text-fog underline-offset-2 hover:text-paper hover:underline">
          {label}
        </button>
      )}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
};

/** «Entrar al grupo» on the invite page. */
export const OscarGroupJoin = ({ token }: { token: string }) => {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex w-full flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await joinOscarGroupAction(token);
            setError(result.error);
          })
        }
        className={buttonClass({ size: "lg", pending, className: "w-full bg-star hover:bg-star/90" })}
      >
        {pending ? "Entrando…" : "Entrar al grupo"}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
};
