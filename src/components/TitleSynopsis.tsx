"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

type TitleSynopsisProps = {
  text?: string | null;
};

/**
 * Synopsis under the title (dirección A): three lines, «Más» only when it does
 * not fit. The height opens with --duration-morph · --ease-out (Animated
 * Collapsible) and «Menos» folds it back. No synopsis, no block.
 */
export const TitleSynopsis = ({ text }: TitleSynopsisProps) => {
  const body = text?.trim() || "";
  const ref = useRef<HTMLParagraphElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [fullHeight, setFullHeight] = useState<number | null>(null);
  const id = useId();

  useEffect(() => {
    const node = ref.current;
    const inner = innerRef.current;
    if (!node || !inner || typeof ResizeObserver === "undefined") {
      return;
    }
    // Watch the text, not the clamped box: a late web font or a new width
    // changes the text's height while the box stays at three lines.
    const measure = () => {
      const textHeight = inner.getBoundingClientRect().height;
      setFullHeight(Math.ceil(textHeight));
      if (!node.classList.contains("is-open")) {
        setOverflows(textHeight > node.clientHeight + 1);
      }
    };
    const observer = new ResizeObserver(measure);
    observer.observe(inner);
    observer.observe(node);
    return () => observer.disconnect();
  }, [body]);

  if (!body) {
    return null;
  }

  return (
    <section className="ficha-synopsis-a ficha-enter" aria-label="Sinopsis" style={{ "--i": 4 } as CSSProperties}>
      <p
        ref={ref}
        id={id}
        className={cn("ficha-synopsis-text", expanded && "is-open", overflows && !expanded && "is-clamped")}
        style={expanded && fullHeight ? { maxHeight: fullHeight } : undefined}
      >
        <span ref={innerRef} className="block">
          {body}
        </span>
      </p>
      {overflows ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          aria-controls={id}
          className={cn(
            "press-scale mt-1 inline-flex min-h-9 items-center rounded-full px-3 text-[13px] font-semibold text-accent transition-colors duration-[var(--duration-hover)] hover:text-accent-hover",
            focusRing,
          )}
        >
          {expanded ? "Menos" : "Más"}
        </button>
      ) : null}
    </section>
  );
};
