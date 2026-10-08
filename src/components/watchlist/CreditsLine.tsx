"use client";

import Link from "next/link";
import { Fragment } from "react";
import { buildPersonSearchHref } from "@/lib/person-filmography";
import { personLinkClass } from "@/lib/ui";
import type { CreditParts } from "@/lib/watchlist-credits";

/** «, » between names and « y » before the last, like the plain credits string. */
const separator = (index: number, count: number) =>
  index === 0 ? "" : index === count - 1 ? " y " : ", ";


/**
 * «Dirigida por Martin Scorsese · Con …» where each director (or a series'
 * creator) opens Buscar on their filmography. Taps stay on the link: they
 * never reach the ficha's own press / swipe handlers.
 */
export const CreditsLine = ({ parts, className }: { parts: CreditParts; className?: string }) => (
  <p className={className}>
    {parts.leads.length > 0 ? (
      <>
        {parts.verb} por{" "}
        {parts.leads.map((lead, index) => (
          <Fragment key={lead.id}>
            {separator(index, parts.leads.length)}
            <Link
              href={buildPersonSearchHref({ personId: lead.id, role: "director", name: lead.name })}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              className={personLinkClass}
            >
              {lead.name}
            </Link>
          </Fragment>
        ))}
      </>
    ) : null}
    {parts.leads.length > 0 && parts.cast.length > 0 ? " · " : null}
    {parts.cast.length > 0
      ? `Con ${parts.cast.map((name, index) => `${separator(index, parts.cast.length)}${name}`).join("")}`
      : null}
  </p>
);
