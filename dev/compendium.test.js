/* dev/compendium.test.js — Bestiarium-Fortschritt (Phase 38).
   Prüft seenSpecies: Startwert, Live-Erfassung, Normalisierung, Save-Roundtrip
   sowie die vom Bestiarium genutzte Datenintegrität (Linie + Basiswerte).
   Aufruf:  bun test dev/compendium.test.js                                  */
import { test, expect } from "bun:test";
import "../js/data-tables.js";
import "../js/data.js";
import "../js/state.js";
import "../js/systems.js";
import "../js/systems-bestiary.js";
import "../js/systems-combat.js";
import "../js/systems-contracts.js";
import "../js/achievements.js";

const GD = globalThis.GameData, GST = globalThis.GameState, SYS = globalThis.GameSystems;

test("frischer Spielstand hat die Startspezies als entdeckt", () => {
  const s = GST.createDefault();
  expect(s.seenSpecies.slice().sort()).toEqual(["goblin", "schleim"]);
});

test("recordSeenSpecies erfasst neu gehaltene Spezies (idempotent)", () => {
  const s = GST.createDefault();
  s.creatures.push(GST.newCreature(s, "wolf"));
  SYS.recordSeenSpecies(s);
  expect(s.seenSpecies).toContain("wolf");
  const before = s.seenSpecies.length;
  SYS.recordSeenSpecies(s);
  expect(s.seenSpecies.length).toBe(before); // keine Duplikate
});

test("tick() erfasst entdeckte Spezies live", () => {
  const s = GST.createDefault();
  s.creatures.push(GST.newCreature(s, "echse"));
  SYS.tick(s);
  expect(s.seenSpecies).toContain("echse");
});

test("normalize vereinigt gehaltene Spezies und bereinigt korrupte Werte", () => {
  // Alt-Spielstand ohne seenSpecies: aktuelle Kreaturen gelten als entdeckt.
  const legacy = GST.createDefault();
  legacy.creatures.push(GST.newCreature(legacy, "oger"));
  delete legacy.seenSpecies;
  const migrated = GST.normalize(legacy);
  expect(migrated.seenSpecies).toContain("oger");

  // Unbekannte IDs + Duplikate werden entfernt.
  const dirty = GST.createDefault();
  dirty.seenSpecies = ["schleim", "voll_erfunden", "schleim"];
  expect(GST.normalize(dirty).seenSpecies.filter((id) => id === "schleim").length).toBe(1);
  expect(GST.normalize(dirty).seenSpecies).not.toContain("voll_erfunden");

  // Nicht-Array (korrupt) wird repariert (mind. aktuelle Kreaturen).
  const broken = GST.createDefault();
  broken.seenSpecies = "kaputt";
  expect(Array.isArray(GST.normalize(broken).seenSpecies)).toBe(true);

  const huntDirty = GST.createDefault();
  huntDirty.bestiaryHunts = { tracks: { Schleim: 2, Erfunden: 99 }, lures: { Goblin: "3" } };
  const huntClean = GST.normalize(huntDirty);
  expect(huntClean.bestiaryHunts.tracks.Schleim).toBe(2);
  expect(huntClean.bestiaryHunts.tracks.Erfunden).toBeUndefined();
  expect(huntClean.bestiaryHunts.lures.Goblin).toBe(3);
});

test("Save-Roundtrip erhält den Bestiarium-Fortschritt", () => {
  const s = GST.createDefault();
  s.creatures.push(GST.newCreature(s, "drache"));
  SYS.recordSeenSpecies(s);
  const round = GST.normalize(JSON.parse(JSON.stringify(s)));
  expect(round.seenSpecies).toContain("drache");
  expect(round.version).toBe(GST.VERSION);
});

test("alle Kreaturen besitzen Linie + endliche Basiswerte (Bestiarium-Daten)", () => {
  expect(GD.creatures.length).toBeGreaterThanOrEqual(40);
  GD.creatures.forEach((sp) => {
    expect(typeof sp.line).toBe("string");
    expect(sp.line.length).toBeGreaterThan(0);
    expect(GD.RANKS.indexOf(sp.rank)).toBeGreaterThanOrEqual(0);
    ["lp", "ang", "ver", "mag", "tmp"].forEach((k) => {
      expect(Number.isFinite(sp.base[k])).toBe(true);
    });
    (sp.evolvesTo || []).forEach((e) => { expect(GD.creature(e.to)).toBeTruthy(); });
  });
});

test("Fährten lassen sich in Köder binden und locken eine Grundform an", () => {
  const s = GST.createDefault();
  s.creatures = s.creatures.filter((c) => c.speciesId !== "fee");
  s.seenSpecies = s.seenSpecies.filter((id) => id !== "fee");
  s.resources.magie = 0; // Köderjagd nutzt Fährten statt normaler Beschwörungskosten
  s.buildings.beschwoerungskreis = 1;
  s.buildings.wohnbezirk = 3;

  const track = SYS.awardBestiaryTracks(s, "seelenbrunnen", 1);
  expect(track.line).toBe("Untot");
  s.bestiaryHunts.tracks.Geist = 3;
  expect(SYS.canPrepareBestiaryLure(s, "Geist").ok).toBe(true);
  expect(SYS.prepareBestiaryLure(s, "Geist").ok).toBe(true);
  const hunt = SYS.useBestiaryLure(s, "fee");
  expect(hunt.ok).toBe(true);
  expect(hunt.action).toBe("summon");
  expect(s.seenSpecies).toContain("fee");
  expect(s.bestiaryHunts.lures.Geist).toBe(0);
});

test("Köderjagd trainiert Evolutionsvorläufer ohne harte Gates zu umgehen", () => {
  const s = GST.createDefault();
  const elite = GST.newCreature(s, "hobgoblin");
  elite.named = true;
  elite.name = "Jagdschüler";
  elite.level = 1;
  elite.armyGroupId = null;
  s.creatures.push(elite);
  s.seenSpecies = GD.creatures.map((sp) => sp.id).filter((id) => id !== "goblin_lord");
  s.bestiaryHunts.lures.Goblin = 1;
  const before = elite.level;
  const hunt = SYS.useBestiaryLure(s, "goblin_lord");
  expect(hunt.ok).toBe(true);
  expect(hunt.action).toBe("train");
  expect(elite.level).toBeGreaterThan(before);
});

test("vollständige Linien geben kleine Ökologie-Boni", () => {
  const s = GST.createDefault();
  const before = SYS.computeBonuses(s).produktionMagie;
  const slimeLine = GD.creatures.filter((sp) => sp.line === "Schleim").map((sp) => sp.id);
  s.seenSpecies = Array.from(new Set(s.seenSpecies.concat(slimeLine)));
  expect(SYS.bestiaryLineComplete(s, "Schleim")).toBe(true);
  expect(SYS.computeBonuses(s).produktionMagie).toBeGreaterThan(before);
});
