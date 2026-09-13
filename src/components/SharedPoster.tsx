"use client";

import { ViewTransition } from "react";
import { posterTransitionName } from "@/lib/motion-ids";

type SharedPosterProps = {
  titleId: string;
  children: React.ReactNode;
  className?: string;
  /**
   * Shared-element morph into the title page. Disable in grids/stacks where the
   * same titleId can appear more than once on screen (ViewTransition names must
   * be unique).
   */
  share?: boolean;
};

export const SharedPoster = ({
  titleId,
  children,
  className,
  share = true,
}: SharedPosterProps) => {
  if (!share) {
    return <div className={className}>{children}</div>;
  }

  return (
    <ViewTransition name={posterTransitionName(titleId)} share="morph" default="none">
      <div className={className}>{children}</div>
    </ViewTransition>
  );
};
