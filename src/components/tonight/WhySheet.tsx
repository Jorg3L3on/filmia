"use client";

import { useId, useTransition } from "react";
import { sendTasteFeedback } from "@/app/actions/tonight";
import { Button } from "@/components/Button";
import { PosterImage } from "@/components/PosterImage";
import { Sheet, SheetHandle } from "@/components/Sheet";
import type { CoverflowTitle } from "@/components/coverflow/types";
import { cn } from "@/lib/cn";
import { showToast } from "@/lib/toast";
import type { ReasonKind } from "@/lib/tonight";

type WhySheetProps = {
  title: CoverflowTitle | null;
  lens: string;
  onClose: () => void;
};

const ICON: Record<ReasonKind, "spark" | "clock" | "hourglass" | "note" | "star" | "tv" | "tag"> = {
  taste_anchor: "spark",
  taste_tag: "tag",
  taste_person: "spark",
  quality: "star",
  fit: "clock",
  fit_over: "clock",
  series: "tv",
  rewatch: "spark",
  note: "note",
  position: "note",
  fresh_platform: "tv",
  fresh_added: "note",
  aging: "hourglass",
  wildcard: "spark",
  pinned: "spark",
};

/** «Por qué esta»: the reasons behind a pick, plus Más así / Menos así. */
export const WhySheet = ({ title, lens, onClose }: WhySheetProps) => {
  const headingId = useId();
  const [isPending, startTransition] = useTransition();
  const tonight = title?.tonight;
  const open = Boolean(title && tonight);

  const feedback = (kind: "more_like" | "less_like") => {
    if (!title) {
      return;
    }
    onClose();
    showToast({
      title: kind === "more_like" ? "Más como esta" : "Menos como esta",
      description: "Hoy aprende de ti.",
    });
    startTransition(async () => {
      try {
        await sendTasteFeedback(title.id, kind, lens);
      } catch {
        showToast({ title: "No se pudo guardar", variant: "error" });
      }
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      labelledBy={headingId}
      overlayLabel="Cerrar Por qué esta"
      align="bottom"
      dragDismiss
      portal
    >
      {title && tonight ? (
        <>
          <div className="flex flex-col items-center px-5 pt-3">
            <SheetHandle />
            <div className="flex w-full items-start gap-3">
              <div className="w-11 shrink-0">
                <PosterImage name={title.name} posterPath={title.posterPath} sizes="44px" className="rounded-md" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
                  <SparkIcon /> Por qué te la propongo
                </p>
                <h2 id={headingId} className="mt-1 line-clamp-2 font-serif text-2xl leading-tight text-paper">
                  {title.name}
                </h2>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Cerrar" className="h-9 w-9 shrink-0 px-0">
                <CloseIcon />
              </Button>
            </div>
          </div>

          <ul className="space-y-4 px-5 pt-5" data-no-sheet-drag>
            {tonight.reasons.slice(0, 5).map((reason, index) => (
              <li key={`${reason.kind}-${index}`} className="flex items-start gap-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/12 text-accent-hover">
                  <ReasonIcon kind={ICON[reason.kind] ?? "spark"} />
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold leading-snug text-paper">{reason.text}</p>
                  {reason.detail ? (
                    <p className="mt-0.5 text-[13px] leading-snug text-fog">{reason.detail}</p>
                  ) : null}
                </div>
              </li>
            ))}
            {tonight.queueNote && !tonight.reasons.some((reason) => reason.kind === "note") ? (
              <li className="flex items-start gap-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/12 text-accent-hover">
                  <ReasonIcon kind="note" />
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold leading-snug text-paper">Tu nota al guardarla</p>
                  <p className="mt-0.5 text-[13px] italic leading-snug text-fog">«{tonight.queueNote}»</p>
                </div>
              </li>
            ) : null}
          </ul>

          <div className="space-y-3 px-5 pb-2 pt-6" data-no-sheet-drag>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => feedback("more_like")} pending={isPending} className={cn("flex-1 border border-chrome")}>
                <ThumbIcon up /> Más así
              </Button>
              <Button type="button" variant="ghost" onClick={() => feedback("less_like")} pending={isPending} className={cn("flex-1 border border-chrome")}>
                <ThumbIcon /> Menos así
              </Button>
            </div>
            <p className="text-center text-xs leading-relaxed text-faint">
              Hoy aprende de lo que ves, lo que saltas y lo que puntúas. Nunca comparte tus datos.
            </p>
          </div>
        </>
      ) : null}
    </Sheet>
  );
};

const SparkIcon = () => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
    <path d="M12 2.5c.6 3.9 2.6 5.9 6.5 6.5-3.9.6-5.9 2.6-6.5 6.5-.6-3.9-2.6-5.9-6.5-6.5 3.9-.6 5.9-2.6 6.5-6.5Z" />
  </svg>
);

const ReasonIcon = ({ kind }: { kind: "spark" | "clock" | "hourglass" | "note" | "star" | "tv" | "tag" }) => {
  const common = { viewBox: "0 0 24 24", width: 16, height: 16, fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
  switch (kind) {
    case "clock":
      return <svg {...common}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>;
    case "hourglass":
      return <svg {...common}><path d="M7 3.5h10M7 20.5h10M8 3.5v3.2c0 1.2.5 2.3 1.4 3.1L12 12l-2.6 2.2A4 4 0 0 0 8 17.3v3.2M16 3.5v3.2c0 1.2-.5 2.3-1.4 3.1L12 12l2.6 2.2a4 4 0 0 1 1.4 3.1v3.2" /></svg>;
    case "note":
      return <svg {...common}><path d="M5 4.5h11l3 3V19.5H5z" /><path d="M8 9h8M8 12.5h8M8 16h5" /></svg>;
    case "star":
      return <svg {...common}><path d="m12 3.6 2.35 4.76 5.25.76-3.8 3.7.9 5.23L12 15.58 7.3 18.05l.9-5.23-3.8-3.7 5.25-.76Z" /></svg>;
    case "tv":
      return <svg {...common}><rect x="3.5" y="5.5" width="17" height="11" rx="2" /><path d="M8.5 20h7" /></svg>;
    case "tag":
      return <svg {...common}><path d="M3 11.2V5a2 2 0 0 1 2-2h6.2a2 2 0 0 1 1.4.6l7.8 7.8a2 2 0 0 1 0 2.8l-6.2 6.2a2 2 0 0 1-2.8 0L3.6 12.6a2 2 0 0 1-.6-1.4Z" /><circle cx="8" cy="8" r="1.2" /></svg>;
    default:
      return <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 2.5c.6 3.9 2.6 5.9 6.5 6.5-3.9.6-5.9 2.6-6.5 6.5-.6-3.9-2.6-5.9-6.5-6.5 3.9-.6 5.9-2.6 6.5-6.5Z" /><path d="M5 15.5c.3 1.8 1.2 2.7 3 3-1.8.3-2.7 1.2-3 3-.3-1.8-1.2-2.7-3-3 1.8-.3 2.7-1.2 3-3Z" /></svg>;
  }
};

const ThumbIcon = ({ up = false }: { up?: boolean }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={up ? undefined : "rotate-180"}>
    <path d="M7 10.5 12 5.5l5 5M12 5.5v13" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
    <path strokeLinecap="round" d="M7 7l10 10M17 7 7 17" />
  </svg>
);
