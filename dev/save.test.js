/* dev/save.test.js — Save Export/Import & Robustheit (bun:test, Phase 30).
   Prüft verlustfreien Roundtrip, Abweisung ungültiger Daten, Migration
   alter Stände und definierte Rückgaben ohne localStorage (Node).
   NICHT Teil des Spiels.   Aufruf: bun test dev/save.test.js          */
import { test, expect } from "bun:test";
import "../js/data-tables.js";
import "../js/data.js";
import "../js/state.js";
import "../js/systems.js";
import "../js/systems-bestiary.js";
import "../js/systems-combat.js";
import "../js/systems-contracts.js";

const GST = globalThis.GameState;

test("exportSave/importSave: verlustfreier Roundtrip", () => {
  const s = GST.createDefault();
  s.resources.gold = 12345;
  const text = GST.exportSave(s);
  expect(typeof text).toBe('string');
  const res = GST.importSave(text);
  expect(res.ok).toBe(true);
  expect(res.state.resources.gold).toBe(12345);
  expect(res.state.creatures.length).toBe(s.creatures.length);
  expect(res.state.version).toBe(GST.VERSION);
});

test("importSave: ungültiger Inhalt wird sauber abgewiesen (kein Crash)", () => {
  expect(GST.importSave('kein json {{{').ok).toBe(false);
  expect(GST.importSave('"nur ein string"').ok).toBe(false);
  expect(GST.importSave('[1,2,3]').ok).toBe(false);
});

test("importSave: alter Spielstand wird auf das aktuelle Schema migriert", () => {
  const res = GST.importSave(JSON.stringify({ version: 1, resources: { gold: 5 } }));
  expect(res.ok).toBe(true);
  expect(res.state.version).toBe(GST.VERSION);
  expect(res.state.creatures.length).toBeGreaterThan(0);
});

test("saveResult/loadResult ohne localStorage (Node): definierte, crashfreie Rückgaben", () => {
  const r = GST.saveResult(GST.createDefault());
  expect(r.ok).toBe(false);
  expect(r.reason).toBe('unavailable');
  expect(GST.loadResult()).toEqual({ state: null, error: null });
});
