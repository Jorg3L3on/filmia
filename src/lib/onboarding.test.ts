import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BEDTIME_SLOTS,
  EMPTY_YEAR_SELECTION,
  FIRST_STEP,
  ONBOARDING_STEPS,
  bedtimeCopy,
  cycleYearPick,
  hhmmToSlot,
  moonElevation,
  nextStep,
  pickYearGrid,
  prevStep,
  resolveBienvenidaEntry,
  resolveInitialStep,
  resolveOnboardingYear,
  selectionFromLibrary,
  slotToHHMM,
  stepAnnouncement,
  stepDirection,
  suggestWeekendFrom,
  yearGridNeedsFallback,
  yearPickStateOf,
} from "./onboarding";
import { payoffEmptyKind, pickPayoffCard } from "./onboarding/payoff";
import type { TonightDecks } from "./tonight-store";

describe("bienvenida steps", () => {
  it("walks forward and back through the seven steps", () => {
    assert.equal(ONBOARDING_STEPS.length, 7);
    assert.equal(nextStep("intro"), "favorita");
    assert.equal(nextStep("primera-noche"), null);
    assert.equal(prevStep("intro"), null);
    assert.equal(prevStep("anio"), "favorita");
    assert.equal(stepDirection("favorita", "anio"), "forward");
    assert.equal(stepDirection("anio", "favorita"), "back");
    assert.match(stepAnnouncement("favorita"), /Paso 2 de 7/);
  });

  it("resumes a gated account where it left off", () => {
    assert.equal(resolveInitialStep({ onboardingStep: "plataformas" }), "plataformas");
    assert.equal(resolveInitialStep({ onboardingStep: "nope" }), FIRST_STEP);
    assert.equal(resolveInitialStep({ onboardingStep: null }), FIRST_STEP);
  });

  it("never repeats the Bienvenida once it is finished", () => {
    assert.equal(resolveBienvenidaEntry({ onboardedAt: null, cookieOnboarded: false }), "flow");
    assert.equal(resolveBienvenidaEntry({ onboardedAt: null, cookieOnboarded: true }), "flow");
    assert.equal(resolveBienvenidaEntry({ onboardedAt: new Date(), cookieOnboarded: true }), "home");
    assert.equal(resolveBienvenidaEntry({ onboardedAt: new Date(), cookieOnboarded: undefined }), "home");
    // DB says finished, this device's cookie still says no: re-mint it on the way to Hoy.
    assert.equal(resolveBienvenidaEntry({ onboardedAt: new Date(), cookieOnboarded: false }), "resync");
  });
});

describe("lo mejor del año grid", () => {
  it("cycles none → la vi → favorita → none and keeps a single crown", () => {
    let state = EMPTY_YEAR_SELECTION;
    let step = cycleYearPick(state, 1);
    assert.deepEqual(step.changes, [{ tmdbId: 1, to: "seen" }]);
    state = step.selection;
    step = cycleYearPick(state, 1);
    assert.deepEqual(step.changes, [{ tmdbId: 1, to: "favorite" }]);
    state = step.selection;
    assert.equal(yearPickStateOf(state, 1), "favorite");

    // Crown another title: the first one goes back to «la vi».
    state = cycleYearPick(state, 2).selection;
    step = cycleYearPick(state, 2);
    assert.deepEqual(step.changes, [
      { tmdbId: 1, to: "seen" },
      { tmdbId: 2, to: "favorite" },
    ]);
    state = step.selection;
    assert.equal(state.favoriteTmdbId, 2);
    assert.equal(yearPickStateOf(state, 1), "seen");

    step = cycleYearPick(state, 2);
    assert.deepEqual(step.changes, [{ tmdbId: 2, to: "none" }]);
    assert.equal(step.selection.favoriteTmdbId, null);
    assert.equal(yearPickStateOf(step.selection, 2), "none");
    assert.equal(yearPickStateOf(step.selection, 1), "seen");
  });

  it("rebuilds the selection from the library (watched 10 in the grid = crown)", () => {
    const selection = selectionFromLibrary(
      [
        { tmdbId: 5, watched: true, rating: 10 },
        { tmdbId: 6, watched: true, rating: null },
        { tmdbId: 7, watched: false, rating: null },
        { tmdbId: 99, watched: true, rating: 10 },
      ],
      [5, 6, 7],
    );
    assert.deepEqual([...selection.seen].sort(), [5, 6]);
    assert.equal(selection.favoriteTmdbId, 5);
  });

  it("picks the first vote tier with enough titles, else merges by votes", () => {
    const tier = (ids: number[], votes = 1000) => ids.map((tmdbId) => ({ tmdbId, voteCount: votes - tmdbId }));
    assert.equal(pickYearGrid([tier([1, 2, 3, 4, 5, 6, 7, 8, 9]), tier([1, 2])]).length, 9);
    const merged = pickYearGrid([tier([1, 2, 3]), tier([2, 3, 4, 5]), tier([6])]);
    assert.deepEqual(merged.map((item) => item.tmdbId), [1, 2, 3, 4, 5, 6]);
    assert.equal(yearGridNeedsFallback(merged), false);
    assert.equal(yearGridNeedsFallback([1, 2]), true);
    assert.equal(resolveOnboardingYear(new Date("2026-10-06T12:00:00")), 2026);
  });
});

describe("hour drum", () => {
  it("maps slots to HH:MM across midnight and back", () => {
    assert.equal(BEDTIME_SLOTS, 29);
    assert.equal(slotToHHMM(0), "20:00");
    assert.equal(slotToHHMM(14), "23:30");
    assert.equal(slotToHHMM(16), "00:00");
    assert.equal(slotToHHMM(17), "00:15");
    assert.equal(slotToHHMM(28), "03:00");
    assert.equal(slotToHHMM(99), "03:00");
    for (let slot = 0; slot < BEDTIME_SLOTS; slot += 1) {
      assert.equal(hhmmToSlot(slotToHHMM(slot)), slot);
    }
    assert.equal(hhmmToSlot("19:00"), 0);
    assert.equal(hhmmToSlot("05:00"), 28);
    assert.equal(hhmmToSlot("garbage"), 14);
  });

  it("derives copy, moon height and the weekend default", () => {
    assert.equal(bedtimeCopy("23:30"), "Hoy te sugerirá lo que acabe antes de las 23:30.");
    assert.equal(moonElevation(0), 0);
    assert.equal(moonElevation(28), 1);
    assert.equal(suggestWeekendFrom("23:30"), "01:00");
    assert.equal(suggestWeekendFrom("02:30"), "03:00");
  });
});

describe("tu primera noche", () => {
  const card = (id: string, runtimeMinutes: number | null, personal: string | null) => ({
    id,
    name: `Título ${id}`,
    kind: "MOVIE" as const,
    year: 2024,
    rating: null,
    posterPath: null,
    platform: "NETFLIX" as const,
    imdbRating: 7.5,
    runtimeMinutes,
    components: { gusto: 0.5, calidad: 0.5, impulso: 0.2, novedad: 0.1, reposo: 0.5, fatiga: 1 },
    reasons: personal ? [{ kind: "taste_anchor" as const, text: personal, weight: 0.5, personal: true }] : [],
    wildcard: false,
    pinned: false,
    posterAmbient: null,
    queueNote: null,
    overview: null,
  });
  const decks = (titles: ReturnType<typeof card>[]): TonightDecks => ({
    lenses: titles.length > 0 ? [{ slug: "para-ti", name: "Para ti", kind: "para-ti", titles }] : [],
    nightEnds: { weekday: "23:30", weekend: "01:00" },
    userPlatforms: ["NETFLIX"],
    profileSize: 1,
    computedAt: new Date().toISOString(),
    queueSize: titles.length,
  });

  it("returns the top ranked card with its personal reason and the clock fit", () => {
    const now = new Date("2026-10-06T21:00:00"); // Tuesday night, bedtime 23:30
    const result = pickPayoffCard(decks([card("a", 100, "Porque le diste 5★ a Interestelar"), card("b", 300, null)]), now);
    assert.ok(result);
    assert.equal(result.id, "a");
    assert.equal(result.reason, "Porque le diste 5★ a Interestelar");
    assert.equal(result.endsAt, "22:40");
    assert.equal(result.overflowMinutes, 0);
    assert.equal(result.night, true);
    assert.equal(result.platform, "NETFLIX");
  });

  it("explains an empty deck", () => {
    assert.equal(pickPayoffCard(decks([]), new Date()), null);
    assert.equal(payoffEmptyKind({ userPlatforms: [], queueSize: 0 }), "no-platforms");
    assert.equal(payoffEmptyKind({ userPlatforms: ["MAX"], queueSize: 0 }), "empty-queue");
    assert.equal(payoffEmptyKind({ userPlatforms: ["MAX"], queueSize: 3 }), "nothing-on-platforms");
  });
});
