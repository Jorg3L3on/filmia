import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addDays } from "@/lib/cine-core";
import { JUEGOS, weekKeyOf } from "@/lib/juegos/core";
import { DIARIA_IDS, DIARIAS } from "@/lib/juegos/diarias/core";
import { juegosPushPlan, LAUNCH_PUSH_DAYS, launchPushLens, tandaPushLens } from "@/lib/juegos/push";

describe("Las diarias: staggered launches (FIL-I54-5)", () => {
  it("from Mayor o menor on, no two games of the cartel launch less than a week apart", () => {
    // La tanda (12 nov) and Mayor o menor (13 nov) predate this rule; the day-by-day test below still keeps them on separate days.
    const dates = JUEGOS.flatMap((juego) => (juego.launchedOn && juego.launchedOn >= "2026-11-13" ? [juego.launchedOn] : [])).sort();
    for (let index = 1; index < dates.length; index += 1) {
      assert.ok(dates[index]! >= addDays(dates[index - 1]!, LAUNCH_PUSH_DAYS), `${dates[index - 1]} → ${dates[index]}`);
    }
  });

  it("the four launch dates are a week or more apart, and after Mayor o menor's", () => {
    const dates = DIARIA_IDS.map((id) => DIARIAS[id].launchedOn).sort();
    const mayor = JUEGOS.find((juego) => juego.id === "mayor")!.launchedOn!;
    for (const [index, date] of dates.entries()) {
      const before = index === 0 ? mayor : dates[index - 1]!;
      assert.ok(date >= addDays(before, LAUNCH_PUSH_DAYS), `${date} is less than a week after ${before}`);
    }
  });

  it("day by day with juegosPushPlan, nobody gets more than one push a day, and each launch lands on its own day", () => {
    // A person with every switch on who never opens the tanda: the most pushes anyone could get.
    const sent = new Set<string>();
    const launchDay = new Map<string, string>();
    let day = "2026-11-12";
    while (day <= "2027-02-15") {
      const plan = juegosPushPlan(
        { juegosPush: true, hasSubscription: true, openedTandaThisWeek: false, sent },
        { week: weekKeyOf(new Date(`${day}T18:00:00Z`)), today: day, juegos: JUEGOS },
      );
      // The cron runs once a day: one plan, at most one push.
      if (plan?.kind === "launch") {
        sent.add(launchPushLens(plan.juego.id));
        launchDay.set(plan.juego.id, day);
      } else if (plan?.kind === "tanda") {
        sent.add(tandaPushLens(weekKeyOf(new Date(`${day}T18:00:00Z`))));
      }
      day = addDays(day, 1);
    }
    for (const id of DIARIA_IDS) {
      assert.equal(launchDay.get(id), DIARIAS[id].launchedOn, `${id}'s launch push`);
    }
    // Every game of the cartel with a launch date (FIL-I54's and FIL-I55's too) gets its push on its own day.
    for (const juego of JUEGOS.filter((item) => item.launchedOn && item.launchedOn >= "2026-11-12")) {
      assert.equal(launchDay.get(juego.id), juego.launchedOn, `${juego.id}'s launch push`);
    }
    assert.equal(new Set(launchDay.values()).size, launchDay.size, "two launches on one day");
  });
});
