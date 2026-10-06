"use client";

import type { ReactNode, RefObject } from "react";
import { cn } from "@/lib/cn";
import { eyebrowClass } from "@/lib/ui";

type StepHeaderProps = {
  eyebrow: string;
  title: ReactNode;
  lede?: ReactNode;
  headingRef?: RefObject<HTMLHeadingElement | null>;
  align?: "left" | "center";
  size?: "md" | "lg";
};

export const StepHeader = ({ eyebrow, title, lede, headingRef, align = "left", size = "md" }: StepHeaderProps) => (
  <header className={cn("space-y-2", align === "center" && "text-center")}>
    <p className={cn(eyebrowClass, "fade-up")}>{eyebrow}</p>
    <h1
      ref={headingRef}
      tabIndex={-1}
      className={cn(
        "fade-up font-serif tracking-tight text-paper outline-none",
        size === "lg" ? "text-[2.4rem] leading-[1.02] sm:text-5xl" : "text-[1.9rem] leading-[1.08] sm:text-4xl",
      )}
      style={{ animationDelay: "60ms" }}
    >
      {title}
    </h1>
    {lede ? (
      <p className="fade-up-late max-w-prose text-[15px] leading-relaxed text-fog">{lede}</p>
    ) : null}
  </header>
);
