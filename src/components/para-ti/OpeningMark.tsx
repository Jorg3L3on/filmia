"use client";

import { markFromOpening } from "@/components/para-ti/AntojoBack";

/** Remembers that an antojo word was tapped here (see AntojoBack). */
export const OpeningMark = ({ children }: { children: React.ReactNode }) => (
  <div
    onClickCapture={(event) => {
      if ((event.target as HTMLElement).closest("[data-antojo-word]")) markFromOpening();
    }}
  >
    {children}
  </div>
);
