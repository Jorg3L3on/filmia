"use client";

import { Children, useState, type ReactNode } from "react";
import { Button } from "@/components/Button";

/** «Lo mejor de {año}» in blocks (FIL-I32): the first `step` rows, then «Ver 25 más» until all. */
export const YearTopMore = ({ step, children }: { step: number; children: ReactNode }) => {
  const rows = Children.toArray(children);
  const [shown, setShown] = useState(step);
  const next = Math.min(step, rows.length - shown);

  return (
    <>
      {rows.slice(0, shown)}
      {next > 0 ? (
        <li className="flex items-center justify-between gap-3 pt-3">
          <p className="text-xs text-mist">
            {shown} de {rows.length}
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShown((current) => current + step)}
            className="h-11 min-h-11 press-scale"
          >
            Ver {next} más
          </Button>
        </li>
      ) : null}
    </>
  );
};
