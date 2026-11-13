import { addDays } from "@/lib/cine-core";
import { TANDA_PATH, type Juego } from "@/lib/juegos/core";
import type { PushPayload } from "@/lib/push/web-push";

/**
 * Avisos de Extras (FIL-I50-5). Pure: who gets what. At most one tanda push a week (only to whom
 * has not opened that week's tanda) and one per game launch, never two on the same day, never to
 * whom turned «Avisos de Extras» off. The copy has no guilt and no urgency.
 */

/** A launch is news for a week; after that the game is just on the portada. */
export const LAUNCH_PUSH_DAYS = 7;

export const JUEGOS_PUSH_KIND = "juegos_push";
export const tandaPushLens = (week: string) => `tanda|${week}`;
export const launchPushLens = (juegoId: string) => `launch|${juegoId}`;

export type JuegosPushPerson = {
  juegosPush: boolean;
  hasSubscription: boolean;
  /** A `tanda_dealt` this week: the person already opened it. */
  openedTandaThisWeek: boolean;
  /** `juegos_push` lenses already sent to this person. */
  sent: ReadonlySet<string>;
};

export type JuegosPushPlan = { kind: "launch"; juego: Juego } | { kind: "tanda" } | null;

/** Games whose launch is still news on `today` (`YYYY-MM-DD`). */
export const recentLaunches = (juegos: readonly Juego[], today: string) =>
  juegos.filter(
    (juego) =>
      juego.href != null &&
      juego.launchedOn != null &&
      juego.launchedOn <= today &&
      today < addDays(juego.launchedOn, LAUNCH_PUSH_DAYS),
  );

export const juegosPushPlan = (
  person: JuegosPushPerson,
  input: { week: string; today: string; juegos: readonly Juego[] },
): JuegosPushPlan => {
  if (!person.juegosPush || !person.hasSubscription) {
    return null;
  }
  const launch = recentLaunches(input.juegos, input.today).find((juego) => !person.sent.has(launchPushLens(juego.id)));
  if (launch) {
    return { kind: "launch", juego: launch };
  }
  if (!person.openedTandaThisWeek && !person.sent.has(tandaPushLens(input.week))) {
    return { kind: "tanda" };
  }
  return null;
};

export const juegosPushPayload = (plan: Exclude<JuegosPushPlan, null>, epoch: string): PushPayload =>
  plan.kind === "launch"
    ? {
        title: `Nuevo en Extras: ${plan.juego.name}`,
        body: plan.juego.line,
        url: plan.juego.href ?? "/extras",
        tag: `juegos-launch-${plan.juego.id}`,
      }
    : {
        title: "Tu tanda de la semana ya está",
        body: `Diez películas de ${epoch}. ¿Cuántas viste?`,
        url: TANDA_PATH,
        tag: "juegos-tanda",
      };

// ---------------------------------------------------------------------------
// «Te retaron» (FIL-I53-3): its own switch, outside the weekly cap above
// ---------------------------------------------------------------------------

/** `PickEvent.kind` of a «te retaron» push; `lens` is `reto|<YYYY-MM-DD>` (Mexico City). */
export const RETO_PUSH_KIND = "reto_push";
export const retoPushLens = (day: string) => `reto|${day}`;

export type RetoPushPerson = {
  retosPush: boolean;
  hasSubscription: boolean;
  /** `reto_push` lenses already sent to this person. */
  sent: ReadonlySet<string>;
};

/**
 * Whether a reto received on `today` pushes: only the first of the day; the rest wait together in
 * «Te toca». «Avisos de Extras» (`juegosPush`) plays no part, and this switch plays none there.
 */
export const shouldPushReto = (person: RetoPushPerson, today: string) =>
  person.retosPush && person.hasSubscription && !person.sent.has(retoPushLens(today));

/** No guilt, no urgency: who and which game, and that it waits. */
export const retoPushPayload = (input: { fromName: string; juegoName: string; url: string }): PushPayload => ({
  title: `${input.fromName} te retó`,
  body: `${input.juegoName}. Juega cuando quieras.`,
  url: input.url,
  tag: "juegos-reto",
});
