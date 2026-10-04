"use client";

import { MarkSeenEye, type MarkSeenEyeProps } from "@/components/MarkSeenEye";

type WatchlistMarkSeenButtonProps = Omit<MarkSeenEyeProps, "saveLabel">;

export const WatchlistMarkSeenButton = (props: WatchlistMarkSeenButtonProps) => (
  <MarkSeenEye {...props} />
);
