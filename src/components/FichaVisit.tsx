"use client";

import { useEffect } from "react";
import { useNavLabel } from "@/components/NavOriginTracker";
import { browserFichaStorage, emitFichaOpened, fichaHref, rememberOpenedFicha } from "@/lib/ficha-session";

type FichaVisitProps = {
  /** Null on a ficha preview: nothing to remember until the Title exists. */
  titleId: string | null;
  /** Back label for the pages opened from this ficha («‹ Obsesión»). */
  name: string;
};

export const FichaVisit = ({ titleId, name }: FichaVisitProps) => {
  useNavLabel(name);
  useEffect(() => {
    if (!titleId) {
      return;
    }
    rememberOpenedFicha(titleId, browserFichaStorage());
    emitFichaOpened(fichaHref(titleId));
  }, [titleId]);

  return null;
};
