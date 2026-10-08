import type { TitleKind } from "@/db";
import { agingScore, freshnessScore, impulseScore, QUALITY_REASON_MIN } from "@/lib/tonight/score";
import type {
  ReasonKind,
  TonightFit,
  TonightQueueEntry,
  TonightReason,
  TonightTitle,
} from "@/lib/tonight/types";
import { isLatinName } from "@/lib/watchlist-credits";

/**
 * The one-line «gancho» under each ficha in Quiero ver. Reasons come from the
 * Esta noche engine (persisted per pick) or from `fallbackReasons` for titles
 * it never ranked; the fit line is synthesised on the client with the clock.
 */

export type HookKind = ReasonKind | "snoozed";

export type WatchlistHook = {
  kind: HookKind;
  text: string;
  detail?: string;
};

/** First match wins. `fit` and `note` are synthesised, the rest come from the reasons. */
export const HOOK_PRIORITY: readonly ReasonKind[] = [
  "pinned",
  "fresh_platform",
  "fit",
  "note",
  "taste_anchor",
  "taste_person",
  "series",
  "rewatch",
  "quality",
  "aging",
  "fresh_added",
];

/** Beyond this the night is too far away for «termina a tiempo» to mean anything. */
export const FIT_HOOK_MAX_REMAINING = 300;

export const fitHook = (
  fit: TonightFit | null,
  kind: TitleKind,
  runtimeMinutes: number | null,
): WatchlistHook | null => {
  if (
    !fit ||
    !runtimeMinutes ||
    !fit.endsAt ||
    fit.overflowMinutes > 0 ||
    fit.remainingMinutes <= 0 ||
    fit.remainingMinutes > FIT_HOOK_MAX_REMAINING
  ) {
    return null;
  }
  return {
    kind: "fit",
    text:
      kind === "SERIES"
        ? `Un capítulo termina a tiempo · acaba ${fit.endsAt}`
        : `Termina a tiempo · acaba ${fit.endsAt}`,
  };
};

export const formatSnoozedHook = (until: Date) =>
  `Ahora no · vuelve a Hoy el ${until.toLocaleDateString("es-MX", { day: "numeric", month: "short" })}`;

const NEVER_A_HOOK: ReadonlySet<ReasonKind> = new Set(["fit", "fit_over", "position", "wildcard"]);

export type ChooseHookInput = {
  reasons: readonly TonightReason[];
  fit: TonightFit | null;
  queueNote: string | null;
  kind: TitleKind;
  runtimeMinutes: number | null;
  snoozedUntil: Date | null;
  now: Date;
};

export const chooseHook = ({
  reasons,
  fit,
  queueNote,
  kind,
  runtimeMinutes,
  snoozedUntil,
  now,
}: ChooseHookInput): WatchlistHook | null => {
  if (snoozedUntil && snoozedUntil.getTime() > now.getTime()) {
    return { kind: "snoozed", text: formatSnoozedHook(snoozedUntil) };
  }

  const best = new Map<ReasonKind, TonightReason>();
  for (const reason of reasons) {
    if (NEVER_A_HOOK.has(reason.kind)) {
      continue;
    }
    const current = best.get(reason.kind);
    if (!current || reason.weight > current.weight) {
      best.set(reason.kind, reason);
    }
  }

  const fromFit = fitHook(fit, kind, runtimeMinutes);
  for (const candidate of HOOK_PRIORITY) {
    if (candidate === "fit") {
      if (fromFit) {
        return fromFit;
      }
      continue;
    }
    if (candidate === "note") {
      if (queueNote?.trim()) {
        return { kind: "note", text: queueNote.trim() };
      }
      continue;
    }
    const reason = best.get(candidate);
    if (reason) {
      return { kind: reason.kind, text: reason.text, detail: reason.detail };
    }
  }
  return null;
};

/**
 * Reasons for a queued title the engine has not ranked (or whose picks are
 * stale): freshness, impulse and aging straight from the engine's pure pieces,
 * plus a quality line and the director when the name is readable.
 */
export const fallbackReasons = (
  title: TonightTitle,
  entry: TonightQueueEntry | undefined,
  now: Date,
  options: { qualityBar?: number | null } = {},
): TonightReason[] => {
  const reasons: TonightReason[] = [
    ...freshnessScore(title, entry, now).reasons,
    ...impulseScore(title, entry).reasons,
    ...agingScore(title, entry, now).reasons,
  ];

  if (title.imdbRating != null && title.imdbRating >= QUALITY_REASON_MIN) {
    const top = options.qualityBar != null && title.imdbRating >= options.qualityBar;
    reasons.push({
      kind: "quality",
      text: top ? `IMDb ${title.imdbRating.toFixed(1)} · entre lo mejor de tu lista` : `IMDb ${title.imdbRating.toFixed(1)}`,
      weight: 0.2,
      personal: false,
    });
  }

  const lead = title.people.find(
    (person) => (person.role === "director" || person.role === "creator") && isLatinName(person.name),
  );
  if (lead) {
    const verb = title.kind === "SERIES" && lead.role === "creator" ? "Creada" : "Dirigida";
    reasons.push({ kind: "taste_person", text: `${verb} por ${lead.name}`, weight: 0.1, personal: false });
  }

  return reasons;
};
