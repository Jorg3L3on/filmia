"use client";

import { MarkWatchedSheet } from "@/components/MarkWatchedSheet";
import { WatchlistFichaMenu } from "@/components/watchlist/WatchlistFichaMenu";
import { WatchlistNoteSheet } from "@/components/watchlist/WatchlistNoteSheet";
import type { FichaView } from "@/components/watchlist/types";

type WatchlistSheetsProps = {
  markTarget: FichaView | null;
  menuTarget: FichaView | null;
  noteTarget: FichaView | null;
  onCloseMark: () => void;
  onWatchedSaved: (ficha: FichaView, rating: number | null) => void;
  onWatchedError: (ficha: FichaView) => void;
  onCloseMenu: () => void;
  onTonight: (ficha: FichaView) => void;
  onMoveToTop: (ficha: FichaView) => void;
  onNote: (ficha: FichaView) => void;
  onNotTonight: (ficha: FichaView) => void;
  onRemove: (ficha: FichaView) => void;
  onCloseNote: () => void;
  onSaveNote: (ficha: FichaView, note: string) => void;
};

/** The three sheets of the cartelera (one instance each): Vi esto · menú · nota. */
export const WatchlistSheets = ({
  markTarget,
  menuTarget,
  noteTarget,
  onCloseMark,
  onWatchedSaved,
  onWatchedError,
  onCloseMenu,
  onTonight,
  onMoveToTop,
  onNote,
  onNotTonight,
  onRemove,
  onCloseNote,
  onSaveNote,
}: WatchlistSheetsProps) => (
  <>
    <MarkWatchedSheet
      open={Boolean(markTarget)}
      titleId={markTarget?.id ?? ""}
      titleName={markTarget?.name ?? ""}
      rating={markTarget?.rating ?? null}
      review={markTarget?.review ?? null}
      // The row's platform preselects «Dónde la vi» (FIL-I24-4, like Hoy since FIL-I21-1);
      // undefined when it has none, so the sheet starts on «Ninguna» and sends nothing.
      platform={markTarget?.platform?.platform ?? undefined}
      silent
      onClose={onCloseMark}
      onSaved={(_watchedAt, rating) => {
        if (markTarget) onWatchedSaved(markTarget, rating);
      }}
      onError={() => {
        if (markTarget) onWatchedError(markTarget);
      }}
    />
    <WatchlistFichaMenu
      ficha={menuTarget}
      onClose={onCloseMenu}
      onTonight={(ficha) => {
        onCloseMenu();
        onTonight(ficha);
      }}
      onMoveToTop={(ficha) => {
        onCloseMenu();
        onMoveToTop(ficha);
      }}
      onNote={(ficha) => {
        onCloseMenu();
        onNote(ficha);
      }}
      onNotTonight={(ficha) => {
        onCloseMenu();
        onNotTonight(ficha);
      }}
      onRemove={(ficha) => {
        onCloseMenu();
        onRemove(ficha);
      }}
    />
    <WatchlistNoteSheet ficha={noteTarget} onClose={onCloseNote} onSave={onSaveNote} />
  </>
);
