/* dev/achievements.test.js — Erfolge & Statistik (Phase 37).
   Lädt die DOM-freien Module und prüft Evaluierung, Belohnung,
   stille Synchronisation, Fortschritt, Save-Roundtrip und Datenintegrität.
   Aufruf:  bun test dev/achievements.test.js                              */
import { test, expect } from "bun:test";
import "../js/data-tables.js";
import "../js/data.js";
import "../js/state.js";
import "../js/systems.js";
import "../js/systems-bestiary.js";
import "../js/systems-combat.js";
import "../js/systems-contracts.js";
import "../js/achievements.js";

const GD = globalThis.GameData, GST = globalThis.GameState, ACH = globalThis.GameAchievements;

test("frischer Spielstand schaltet keine Erfolge versehentlich frei", () => {
  const s = GST.createDefault();
  ACH.sync(s);
  expect(s.achievements.length).toBe(0);
  expect(ACH.unlockedCount(s)).toBe(0);
});

test("Datenintegrität: eindeutige IDs, gültige Kategorien/Ziele/Belohnungen", () => {
  const cats = {}; ACH.CATEGORIES.forEach((c) => { cats[c.id] = true; });
  const resIds = {}; GD.resources.forEach((r) => { resIds[r.id] = true; });
  const seen = {};
  expect(ACH.total()).toBeGreaterThanOrEqual(30);
  ACH.ACHIEVEMENTS.forEach((a) => {
    expect(seen[a.id]).toBeUndefined();
    seen[a.id] = true;
    expect(typeof a.title).toBe("string");
    expect(cats[a.cat]).toBe(true);
    expect(typeof a.cur).toBe("function");
    const goal = ACH.goalOf(a);
    expect(Number.isFinite(goal)).toBe(true);
    expect(goal).toBeGreaterThan(0);
    if (a.reward) Object.keys(a.reward).forEach((k) => { expect(resIds[k]).toBe(true); });
  });
});

test("progressOf liefert für alle Erfolge endliche Werte", () => {
  const s = GST.createDefault();
  ACH.ACHIEVEMENTS.forEach((a) => {
    const p = ACH.progressOf(s, a);
    [p.cur, p.max, p.frac].forEach((v) => { expect(Number.isFinite(v)).toBe(true); });
    expect(p.max).toBeGreaterThan(0);
    expect(p.frac).toBeGreaterThanOrEqual(0);
    expect(p.frac).toBeLessThanOrEqual(1);
    expect(p.cur).toBeLessThanOrEqual(p.max);
  });
});

test("evaluate schaltet erfüllte Erfolge frei, gewährt Belohnung und ist idempotent", () => {
  const s = GST.createDefault();
  const magieBefore = s.resources.magie;
  s.metrics.summoned = 5;
  const fresh = ACH.evaluate(s);
  const ids = fresh.map((a) => a.id);
  expect(ids).toContain("k_summon5");
  expect(ACH.isUnlocked(s, "k_summon5")).toBe(true);
  expect(s.resources.magie).toBe(magieBefore + 120); // reward { magie: 120 }

  // Zweiter Aufruf darf weder doppelt freischalten noch erneut belohnen.
  const magieAfter = s.resources.magie;
  const again = ACH.evaluate(s);
  expect(again.map((a) => a.id)).not.toContain("k_summon5");
  expect(s.resources.magie).toBe(magieAfter);
});

test("sync markiert bereits erfüllte Erfolge ohne Belohnung (keine Belohnungsflut)", () => {
  const s = GST.createDefault();
  s.metrics.crafted = 50;            // erfüllt a_craft10
  const materialBefore = s.resources.material;
  ACH.sync(s);
  expect(ACH.isUnlocked(s, "a_craft10")).toBe(true);
  expect(s.resources.material).toBe(materialBefore); // sync gewährt keine Belohnung
});

test("dynamische Ziele leiten sich aus den Spieldaten ab", () => {
  const regionGoal = ACH.goalOf(ACH.get("r_regionAll"));
  const stageGoal = ACH.goalOf(ACH.get("h_stageMax"));
  expect(regionGoal).toBe(GD.regions.length);
  expect(stageGoal).toBe(GD.rulerStages.length - 1);
});

test("Save-Roundtrip erhält Erfolge und bereinigt korrupte Werte", () => {
  const s = GST.createDefault();
  s.metrics.summoned = 5; ACH.evaluate(s);
  const round = GST.normalize(JSON.parse(JSON.stringify(s)));
  expect(round.achievements).toContain("k_summon5");
  expect(round.version).toBe(GST.VERSION);

  // Duplikate + unbekannte IDs werden entfernt.
  const dirty = GST.createDefault();
  dirty.achievements = ["k_summon5", "voll_erfunden", "k_summon5"];
  const cleaned = GST.normalize(dirty);
  expect(cleaned.achievements).toEqual(["k_summon5"]);

  // Nicht-Array (korrupt) wird zu leerer Liste.
  const broken = GST.createDefault();
  broken.achievements = "kaputt";
  expect(GST.normalize(broken).achievements).toEqual([]);
});

test("tick() meldet neu freigeschaltete Erfolge", () => {
  const SYS = globalThis.GameSystems;
  const s = GST.createDefault();
  s.metrics.expeditionsWon = 1;       // erfüllt c_exped1
  const ev = SYS.tick(s);
  expect(Array.isArray(ev.achievementsUnlocked)).toBe(true);
  expect(ev.achievementsUnlocked.map((a) => a.id)).toContain("c_exped1");
});
