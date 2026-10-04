"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { cn } from "@/lib/cn";

type TitleSynopsisProps = {
  text?: string | null;
};

export const TitleSynopsis = ({ text }: TitleSynopsisProps) => {
  const [expanded, setExpanded] = useState(false);
  const body = text?.trim() || "";
  const empty = body.length === 0;
  const long = body.length > 220;

  return (
    <section className="space-y-2">
      <h2 className="text-[11px] font-medium uppercase tracking-[0.22em] text-mist">
        Sinopsis
      </h2>
      {empty ? (
        <p className="text-sm text-mist" aria-label="Sinopsis no disponible">
          N/A
        </p>
      ) : (
        <>
          <p
            className={cn(
              "max-w-2xl text-sm leading-7 text-fog",
              !expanded && "line-clamp-5",
            )}
          >
            {body}
          </p>
          {long ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setExpanded((current) => !current)}
              aria-expanded={expanded}
              className="h-auto min-h-0 px-0 text-accent hover:text-accent-hover"
            >
              {expanded ? "Menos" : "Más"}
            </Button>
          ) : null}
        </>
      )}
    </section>
  );
};
