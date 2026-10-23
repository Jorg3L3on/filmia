"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { remindPremiereAction } from "@/app/actions/rutas";
import { Button } from "@/components/Button";
import { formatShortDay } from "@/lib/cine-core";
import { showToast } from "@/lib/toast";

/** «Avísame el día»: a push the morning it opens. Without a device, Perfil turns the avisos on. */
export const RemindPremiereButton = ({ catalogId, reminded, day }: { catalogId: string; reminded: boolean; day: string }) => {
  const [done, setDone] = useState(reminded);
  const [noDevice, setNoDevice] = useState(false);
  const [pending, startTransition] = useTransition();
  if (done) {
    return (
      <p className="text-[13px] text-success">
        Te avisamos el {formatShortDay(day)}.
        {noDevice ? (
          <>
            {" "}
            <Link href="/perfil#tu-filmia" className="text-accent-hover underline">
              Activa los avisos
            </Link>{" "}
            para recibirlo.
          </>
        ) : null}
      </p>
    );
  }
  return (
    <Button
      size="md"
      pending={pending}
      onClick={() =>
        startTransition(async () => {
          const outcome = await remindPremiereAction(catalogId);
          if (!outcome.ok) {
            showToast({ title: "No se pudo guardar", description: outcome.error, variant: "error" });
            return;
          }
          setNoDevice(!outcome.pushReady);
          setDone(true);
        })
      }
    >
      Avísame el día
    </Button>
  );
};
