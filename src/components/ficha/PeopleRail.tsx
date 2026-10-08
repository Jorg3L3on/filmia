import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { staggerStyle } from "@/lib/motion-style";
import { buildPersonSearchHref } from "@/lib/person-filmography";
import type { PeopleRailItem } from "@/lib/tmdb-people";
import { focusRing } from "@/lib/ui";

const profileUrl = (path: string) => `https://image.tmdb.org/t/p/w185${path}`;

/**
 * «Reparto y equipo» (dirección A): Dirección · Fotografía · up to eight cast
 * in glass cards. A round photo only when TMDB has one — no placeholder, no
 * initials; every card keeps the same height. Each card opens the person's
 * filmography in that role (`/buscar?persona=…&rol=…`, FIL-I3-5).
 */
export const PeopleRail = ({ items }: { items: readonly PeopleRailItem[] }) => {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3" aria-label="Reparto y equipo">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-mist">Reparto y equipo</h2>
      <ul className="rail rail-fade -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1.5 sm:mx-0 sm:px-0">
        {items.map((person, index) => (
          <li key={`${person.role}-${person.id}`} className="stagger-in shrink-0" style={staggerStyle(index)}>
            <Link
              href={buildPersonSearchHref({ personId: person.id, role: person.role, name: person.name })}
              aria-label={person.detail ? `${person.name}, ${person.detail}` : person.name}
              className={cn(
                "person-card press-scale relative flex h-[9.5rem] w-[6.75rem] flex-col items-center gap-2 overflow-hidden rounded-[1.125rem] px-2 pt-3 pb-3 text-center sm:h-[10.75rem] sm:w-[8.25rem]",
                person.profilePath ? "justify-start" : "justify-center",
                focusRing,
              )}
            >
              {person.profilePath ? (
                <Image
                  src={profileUrl(person.profilePath)}
                  alt=""
                  width={68}
                  height={68}
                  sizes="(max-width: 640px) 68px, 84px"
                  className="person-photo size-[4.25rem] shrink-0 rounded-full object-cover ring-1 ring-white/14 sm:size-[5.25rem]"
                />
              ) : null}
              <span className="line-clamp-2 text-[13px] font-semibold leading-tight text-paper sm:text-sm">
                {person.name}
              </span>
              {person.detail ? (
                <span
                  className={cn(
                    "-mt-1 line-clamp-2 text-[11px] leading-snug sm:text-xs",
                    person.crew ? "text-accent" : "text-fog",
                  )}
                >
                  {person.detail}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};
