"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

type TitleSynopsisProps = {
  text: string;
};

export const TitleSynopsis = ({ text }: TitleSynopsisProps) => {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 220;

  return (
    <section className="space-y-2">
      <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-mist">
        Sinopsis
      </h2>
      <p
        className={cn(
          "max-w-2xl text-sm leading-7 text-fog",
          !expanded && "line-clamp-5",
        )}
      >
        {text}
      </p>
      {long ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          className={cn("text-xs font-medium text-accent hover:text-accent-hover", focusRing)}
        >
          {expanded ? "Menos" : "Más"}
        </button>
      ) : null}
    </section>
  );
};
