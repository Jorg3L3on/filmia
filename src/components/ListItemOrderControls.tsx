"use client";

import { type MouseEvent, type PointerEvent } from "react";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

type ListMoveDirection = "up" | "down";

type ListItemOrderControlsProps = {
  canMoveUp: boolean;
  canMoveDown: boolean;
  pending?: boolean;
  onMove: (direction: ListMoveDirection) => void;
};

export const ListItemOrderControls = ({
  canMoveUp,
  canMoveDown,
  pending = false,
  onMove,
}: ListItemOrderControlsProps) => {
  return (
    <div
      className="relative z-20 flex shrink-0 items-center gap-1"
      role="group"
      aria-label="Orden en la lista"
    >
      <OrderButton
        disabled={!canMoveUp || pending}
        label="Subir"
        icon="up"
        onMove={() => onMove("up")}
      />
      <OrderButton
        disabled={!canMoveDown || pending}
        label="Bajar"
        icon="down"
        onMove={() => onMove("down")}
      />
    </div>
  );
};

const stopRowEvent = (event: MouseEvent | PointerEvent) => {
  event.stopPropagation();
};

const OrderButton = ({
  disabled,
  label,
  icon,
  onMove,
}: {
  disabled: boolean;
  label: string;
  icon: "up" | "down";
  onMove: () => void;
}) => {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    stopRowEvent(event);
    onMove();
  };

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      onClick={handleClick}
      onPointerDown={stopRowEvent}
      className={cn(
        "relative z-20 inline-flex h-8 w-8 pointer-events-auto items-center justify-center rounded-full border border-chrome text-fog transition",
        focusRing,
        disabled
          ? "cursor-not-allowed opacity-35"
          : "hover:border-accent hover:text-paper",
      )}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4 fill-none stroke-current stroke-[1.75]"
      >
        {icon === "up" ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 14.5 12 8.5l6 6" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9.5 12 15.5l6-6" />
        )}
      </svg>
    </button>
  );
};
