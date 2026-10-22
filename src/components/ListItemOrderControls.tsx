"use client";

import { type MouseEvent, type PointerEvent } from "react";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

type ListMoveDirection = "up" | "down";

type ListItemOrderControlsProps = {
  canMoveUp: boolean;
  canMoveDown: boolean;
  pending?: boolean;
  /** `lg` = 44 px targets (Quiero ver's Reordenar, FIL-I24-5); `md` keeps the 32 px discs elsewhere. */
  size?: "md" | "lg";
  onMove: (direction: ListMoveDirection) => void;
};

export const ListItemOrderControls = ({
  canMoveUp,
  canMoveDown,
  pending = false,
  size = "md",
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
        size={size}
        onMove={() => onMove("up")}
      />
      <OrderButton
        disabled={!canMoveDown || pending}
        label="Bajar"
        icon="down"
        size={size}
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
  size,
  onMove,
}: {
  disabled: boolean;
  label: string;
  icon: "up" | "down";
  size: "md" | "lg";
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
        "press-scale relative z-20 inline-flex pointer-events-auto items-center justify-center rounded-full border border-chrome text-fog transition-[border-color,color,transform] duration-[var(--duration-press)]",
        size === "lg" ? "size-11" : "size-8",
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
