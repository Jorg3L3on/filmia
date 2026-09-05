"use client";

import { ViewTransition } from "react";
import { posterTransitionName } from "@/lib/motion-ids";

type SharedPosterProps = {
  titleId: string;
  children: React.ReactNode;
  className?: string;
};

export const SharedPoster = ({ titleId, children, className }: SharedPosterProps) => {
  return (
    <ViewTransition name={posterTransitionName(titleId)} share="morph" default="none">
      <div className={className}>{children}</div>
    </ViewTransition>
  );
};
