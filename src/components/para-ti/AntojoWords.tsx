import Link from "next/link";
import type { CSSProperties } from "react";
import { ANTOJOS } from "@/lib/para-ti/antojos";
import { ROOMS } from "@/lib/para-ti/rooms";
import { focusRing } from "@/lib/ui";

/**
 * «¿Qué se te antoja?» (FIL-I60-4): the eight antojos as big serif words, not chips. Each word
 * carries its room's colour; a tap opens that antojo (`?antojo=<id>`, so back and links work).
 */
export const AntojoWords = ({ query }: { query: string }) => (
  <nav aria-label="Antojos" className="para-ti-words">
    <ol className="para-ti-word-list">
      {ANTOJOS.map((antojo, index) => (
        <li key={antojo.id} style={{ "--i": index, "--room-rgb": ROOMS[antojo.id].rgb } as CSSProperties}>
          <Link
            href={`/para-ti?antojo=${antojo.id}${query ? `&${query}` : ""}`}
            className={`para-ti-word ${focusRing}`}
            data-antojo-word={antojo.id}
          >
            <span className="para-ti-word-index" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="para-ti-word-text">{antojo.label}</span>
          </Link>
        </li>
      ))}
    </ol>
  </nav>
);
