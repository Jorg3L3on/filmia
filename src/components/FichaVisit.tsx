"use client";

import { useEffect } from "react";
import { useNavLabel } from "@/components/NavOriginTracker";
import { browserFichaStorage, emitFichaOpened, fichaHref, rememberOpenedFicha } from "@/lib/ficha-session";

type FichaVisitProps = {
  titleId: string;
  /** Back label for the pages opened from this ficha («‹ Obsesión»). */
  name: string;
};

export const FichaVisit = ({ titleId, name }: FichaVisitProps) => {
  useNavLabel(name);
  useEffect(() => {
    rememberOpenedFicha(titleId, browserFichaStorage());
    emitFichaOpened(fichaHref(titleId));
  }, [titleId]);

  return null;
};
