"use client";

import Link from "next/link";
import { useState } from "react";
import { PosterImage } from "@/components/PosterImage";
import { Sheet } from "@/components/Sheet";
import { LaurelIcon } from "@/components/watchlist/icons";
import { cn } from "@/lib/cn";
import {
  oscarNominationsLine,
  oscarTickets,
  oscarsSummaryLine,
  type OscarTicket,
  type PersonOscars as PersonOscarsData,
} from "@/lib/person-oscars";
import { previewFichaHref } from "@/lib/title-preview";
import { focusRing } from "@/lib/ui";

/**
 * The person's Óscar as gold tickets hanging from an axis (FIL-I45-4), newest first: a win has a
 * filled dot and a gold ticket, a nomination an outlined one. A single nomination is one line; no
 * data, no section (FIL-I43).
 */

const TicketBody = ({ ticket }: { ticket: OscarTicket }) => (
  <>
    <span
      className={cn(
        "absolute -top-[21px] left-[52px] size-2.5 rounded-full border-2 border-star shadow-[0_0_10px_rgb(240_193_74/0.6)]",
        ticket.won ? "bg-star" : "bg-canvas",
      )}
      aria-hidden="true"
    />
    <span className="font-serif text-[28px] leading-none tracking-[-0.02em] text-star">{ticket.row.year}</span>
    {ticket.row.title ? (
      <span className="block w-11 overflow-hidden rounded-md bg-well shadow-[0_10px_24px_-12px_rgb(0_0_0/0.9)]">
        <PosterImage name={ticket.row.title} posterPath={ticket.row.posterPath} sizes="44px" tmdbSize="w185" />
      </span>
    ) : (
      <span className="flex aspect-[2/3] w-11 items-center justify-center rounded-md bg-star/10 text-star" aria-hidden="true">
        <LaurelIcon size={18} />
      </span>
    )}
    <span className="block">
      <span className="line-clamp-2 text-[12.5px] leading-tight font-semibold text-paper">
        {ticket.row.title ?? ticket.row.categoryEs}
      </span>
      {ticket.row.title ? <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-fog">{ticket.row.categoryEs}</span> : null}
    </span>
  </>
);

const ticketClass = (won: boolean) =>
  cn(
    "relative flex h-full w-[118px] flex-col gap-2 rounded-[14px] border p-3 text-left",
    won
      ? "border-star/80 bg-linear-to-b from-[#2b2412] to-[#1a1812] shadow-[0_0_0_1px_rgb(240_193_74/0.2),0_18px_36px_-16px_rgb(240_193_74/0.5)]"
      : "border-star/35 bg-linear-to-b from-[#1a1812] to-surface",
  );

const Ticket = ({ ticket }: { ticket: OscarTicket }) => {
  const label = `${ticket.won ? "Ganó" : "Nominada"} en ${ticket.row.year}: ${ticket.row.categoryEs}${ticket.row.title ? `, ${ticket.row.title}` : ""}`;
  return ticket.row.tmdbId ? (
    <Link
      href={previewFichaHref("MOVIE", ticket.row.tmdbId)}
      aria-label={label}
      className={cn(ticketClass(ticket.won), "press-scale hover:border-star", focusRing)}
    >
      <TicketBody ticket={ticket} />
    </Link>
  ) : (
    <div role="img" aria-label={label} className={ticketClass(ticket.won)}>
      <TicketBody ticket={ticket} />
    </div>
  );
};

/** Tickets on the axis before «Ver los N». */
const AXIS_MAX = 12;

export const PersonOscars = ({ oscars }: { oscars: PersonOscarsData }) => {
  const [sheet, setSheet] = useState(false);
  const tickets = oscarTickets(oscars);

  // One nomination and no win: a single line, as before.
  if (oscars.wins.length === 0 && tickets.length <= 1) {
    const only = tickets[0]?.row;
    return (
      <p aria-label="Óscar" className="flex items-center gap-2 text-sm text-paper/80">
        <span className="text-star" aria-hidden="true">
          <LaurelIcon size={14} />
        </span>
        {oscarNominationsLine(oscars.nominations)}
        {only ? <span className="text-fog">· {only.year}{only.title ? `, ${only.title}` : ""}</span> : null}
      </p>
    );
  }

  const shown = tickets.slice(0, AXIS_MAX);
  const hidden = tickets.length - shown.length;
  return (
    <section aria-label="Óscar" className="space-y-3.5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10.5px] font-medium tracking-[0.22em] text-star uppercase">Academia</p>
          <h3 className="mt-1.5 flex items-center gap-2 font-serif text-[27px] leading-[1.05] tracking-[-0.015em] text-paper">
            <span className="text-star drop-shadow-[0_0_8px_rgb(240_193_74/0.7)]" aria-hidden="true">
              <LaurelIcon size={22} />
            </span>
            Óscar
          </h3>
        </div>
        <p className="mb-1 text-right font-serif text-[14px] text-fog italic">{oscarsSummaryLine(oscars)}</p>
      </div>
      <div className="relative -mx-4 sm:mx-0">
        <span
          className="persona-axis pointer-events-none absolute inset-x-0 top-1.5 h-px bg-linear-to-r from-transparent via-star/60 to-transparent"
          aria-hidden="true"
        />
        <ul className="persona-tickets flex gap-2.5 overflow-x-auto px-4 pt-[22px] pb-1 [scrollbar-width:none] sm:px-0">
          {shown.map((ticket, index) => (
            <li key={ticket.row.key} className="shrink-0" style={{ ["--i" as string]: index }}>
              <Ticket ticket={ticket} />
            </li>
          ))}
          {hidden > 0 ? (
            <li className="shrink-0">
              <button
                type="button"
                onClick={() => setSheet(true)}
                className={cn(
                  "press-scale flex h-full min-h-[11rem] w-[96px] flex-col items-center justify-center gap-1 rounded-[14px] border border-star/35 text-star",
                  focusRing,
                )}
              >
                <span className="font-serif text-2xl">+{hidden}</span>
                <span className="text-xs">Ver los {tickets.length}</span>
              </button>
            </li>
          ) : null}
        </ul>
      </div>
      <p className="flex items-center gap-3 text-[11px] text-fog">
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full bg-star" aria-hidden="true" />
          ganó
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full border-[1.5px] border-star" aria-hidden="true" />
          nominada
        </span>
        <span>· cada boleto abre la ficha</span>
      </p>
      <Sheet open={sheet} onClose={() => setSheet(false)} label="Óscar">
        <div className="space-y-3 px-4 pt-2 pb-4">
          <h3 className="font-serif text-2xl text-paper">Óscar · {oscarsSummaryLine(oscars)}</h3>
          <ul className="max-h-[60vh] divide-y divide-white/6 overflow-y-auto" data-no-sheet-drag>
            {tickets.map((ticket) => (
              <li key={ticket.row.key} className="flex min-h-12 items-center gap-3 py-2 text-sm">
                <span
                  className={cn("size-2.5 shrink-0 rounded-full border-2 border-star", ticket.won ? "bg-star" : "bg-transparent")}
                  aria-hidden="true"
                />
                <span className="w-11 shrink-0 font-serif text-star">{ticket.row.year}</span>
                <span className="min-w-0 flex-1">
                  {ticket.row.tmdbId ? (
                    <Link
                      href={previewFichaHref("MOVIE", ticket.row.tmdbId)}
                      onClick={() => setSheet(false)}
                      className={cn("block truncate text-paper hover:text-star", focusRing)}
                    >
                      {ticket.row.title ?? ticket.row.categoryEs}
                    </Link>
                  ) : (
                    <span className="block truncate text-paper">{ticket.row.title ?? ticket.row.categoryEs}</span>
                  )}
                  <span className="block truncate text-xs text-fog">
                    {ticket.won ? "Ganó" : "Nominada"} · {ticket.row.categoryEs}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Sheet>
    </section>
  );
};
