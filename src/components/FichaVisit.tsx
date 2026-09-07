"use client";

import { useEffect } from "react";
import { browserFichaStorage, rememberOpenedFicha } from "@/lib/ficha-session";

type FichaVisitProps = {
  titleId: string;
};

export const FichaVisit = ({ titleId }: FichaVisitProps) => {
  useEffect(() => {
    rememberOpenedFicha(titleId, browserFichaStorage());
  }, [titleId]);

  return null;
};
