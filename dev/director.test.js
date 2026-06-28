/* dev/director.test.js — Phase 47: Watch-Director und Zeitraffer. */
import { test, expect } from "bun:test";
import "../js/data-tables.js";
import "../js/data.js";
import "../js/art-data.js";
import "../js/state.js";
import "../js/systems.js";
import "../js/systems-bestiary.js";
import "../js/systems-combat.js";
import "../js/systems-skirmish.js";
import "../js/systems-siege.js";
import "../js/systems-battle.js";
import "../js/systems-action.js";
import "../js/systems-contracts.js";
import "../js/systems-specializations.js";
import "../js/systems-bosses.js";
import "../js/achievements.js";
import "../js/completion-planner.js";
import "../js/systems-chronicle.js";
import "../js/systems-pacing.js";
import "../js/systems-director.js";

const GS = globalThis.GameState;
const SYS = globalThis.GameSystems;
const DIR = globalThis.GameDirector;

function fresh() {
  const state = GS.createDefault();
  state.settings.watch = true;
  DIR.observe(state, null);
  return state;
}

test("Save-v21 normalisiert Director-Feed und Pauseoption defensiv", () => {
  const state = fresh();
  state.version = 20;
  state.director = { feed: [null, { title: "ok" }], milestones: "kaputt", seen: ["a", "a", 4], cameraTab: 7 };
  state.settings.watchPauseDecision = 0;
  const clean = GS.normalize(JSON.parse(JSON.stringify(state)));
  expect(clean.version).toBe(21);
  expect(clean.director.feed).toEqual([{ title: "ok" }]);
  expect(clean.director.milestones).toEqual([]);
  expect(clean.director.seen).toEqual(["a"]);
  expect(clean.director.cameraTab).toBeNull();
  expect(clean.settings.watchPauseDecision).toBe(true);
});

test("wiederholte Aktionen werden zu einem lesbaren Themenblock gruppiert", () => {
  const state = fresh();
  for (let tick = 1; tick <= 12; tick++) {
    state.tick = tick;
    DIR.observe(state, { text: `🏘️ Wohnbezirk Stufe ${tick + 1}.` });
  }
  expect(state.director.feed).toHaveLength(1);
  expect(state.director.feed[0]).toMatchObject({ kind: "build", count: 12, title: "Aufbau · 12 Schritte" });
  expect(state.director.feed[0].latest).toContain("Stufe 13");
});

test("Form, S-Rang, Set, Boss, Region und Erfolg erzeugen Vorher/Nachher-Replays", () => {
  const state = fresh();
  const sRank = GS.newCreature(state, "daemonenfuerst");
  state.creatures.push(sRank);
  state.seenSpecies.push("daemonenfuerst");
  ["magistahlklinge", "magistahlpanzer", "magistahlhelm", "magistahlhandschuhe", "magistahlstiefel"].forEach((id, index) => {
    state.inventory.push({ uid: 900 + index, recipeId: id });
  });
  state.bosses.defeated.push("jura_koloss");
  state.claimedRegions.push("wald");
  state.achievements.push("r_build8");
  state.tick = 20;
  const result = DIR.observe(state, null);
  const kinds = result.milestones.map((entry) => entry.kind);
  expect(kinds).toContain("species");
  expect(kinds).toContain("rank");
  expect(kinds).toContain("set");
  expect(kinds).toContain("boss");
  expect(kinds).toContain("region");
  expect(kinds).toContain("achievement");
  result.milestones.forEach((entry) => {
    expect(entry.before).not.toBeUndefined();
    expect(entry.after).not.toBeUndefined();
  });
});

test("bereits gesehene Meilensteine werden nicht doppelt in den Feed geschrieben", () => {
  const state = fresh();
  state.claimedRegions.push("wald");
  state.tick = 1;
  DIR.observe(state, null);
  const count = state.director.milestones.length;
  state.director.snapshot.regions = [];
  state.tick = 2;
  DIR.observe(state, null);
  expect(state.director.milestones).toHaveLength(count);
});

test("Risikoerkennung unterscheidet Raid, Entscheidung und riskante Expedition", () => {
  const state = fresh();
  state.raid = { rivalId: "orcus", atTick: 50, power: 100 };
  expect(DIR.riskState(state).kind).toBe("raid");
  state.raid = null;
  state.activeEvent = globalThis.GameData.events[0].id;
  expect(DIR.riskState(state).kind).toBe("decision");
  state.activeEvent = null;
  state.expeditions.push({ risk: "risky" });
  expect(DIR.riskState(state).kind).toBe("expedition");
});

test("Headless-Zeitraffer pausiert vor einer offenen Entscheidung", () => {
  const state = fresh();
  state.activeEvent = globalThis.GameData.events[0].id;
  const result = DIR.runUntil(state, "decision", 30);
  expect(result.reason).toBe("decision");
  expect(result.ticks).toBe(1);
  expect(state.activeEvent).not.toBeNull();
});

test("60-Minuten-Autolauf bleibt verdichtet und ohne doppelte Meilenstein-IDs", () => {
  const state = fresh();
  let value = 47;
  const originalRandom = Math.random;
  Math.random = () => ((value = (value * 1664525 + 1013904223) >>> 0) / 4294967296);
  try {
    for (let i = 0; i < 3600; i++) {
      const events = SYS.tick(state);
      const action = SYS.autoPlayStep(state);
      DIR.observe(state, action, events);
    }
  } finally {
    Math.random = originalRandom;
  }
  expect(state.director.feed.length).toBeLessThanOrEqual(30);
  expect(state.director.feed.some((entry) => entry.type === "group" && entry.count > 1)).toBe(true);
  expect(new Set(state.director.milestones.map((entry) => entry.id)).size).toBe(state.director.milestones.length);
  expect(state.director.milestones.length).toBeGreaterThan(5);
});
