"use client";

import { useEffect } from "react";
import { browserFichaStorage, emitFichaOpened, fichaHref, rememberOpenedFicha } from "@/lib/ficha-session";

type FichaVisitProps = {
  titleId: string;
};

export const FichaVisit = ({ titleId }: FichaVisitProps) => {
  useEffect(() => {
    rememberOpenedFicha(titleId, browserFichaStorage());
    emitFichaOpened(fichaHref(titleId));
  }, [titleId]);

  return null;
};
