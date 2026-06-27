/* dev/perf.test.js — Performance-Regressions-Guard (bun:test, Phase 31).
   Messung (2026-06-20): ~7 µs/Tick (~143k Ticks/s), computeBonuses ~2,5 µs.
   Das Spiel ist bereits sehr schnell — Caching wäre verfrühte Optimierung
   mit Staleness-Risiko und wurde bewusst NICHT eingebaut. Stattdessen
   sichert dieser sehr lockere Guard gegen massive künftige Regressionen ab.
   NICHT Teil des Spiels.   Aufruf: bun test dev/perf.test.js             */
import { test, expect } from "bun:test";
import "../js/data-tables.js";
import "../js/data.js";
import "../js/state.js";
import "../js/systems.js";
import "../js/systems-bestiary.js";
import "../js/systems-combat.js";
import "../js/systems-contracts.js";

const GST = globalThis.GameState, SYS = globalThis.GameSystems;

test("Tick-Durchsatz bleibt hoch (Regressions-Guard)", () => {
  const s = GST.createDefault();
  s.buildings.magieturm = 4; s.buildings.mine = 3; s.buildings.arena = 3; s.buildings.forschungsgilde = 3;
  for (let i = 0; i < 200; i++) SYS.tick(s); // Aufwärmen auf einen Mittelspiel-Stand
  const N = 3000;
  const t0 = performance.now();
  for (let i = 0; i < N; i++) SYS.tick(s);
  const ms = performance.now() - t0;
  // Gemessen ~21 ms für 3000 Ticks; Guard bei 2 s lässt >25× Spielraum,
  // bleibt also auch auf langsamen CI-Runnern stabil.
  expect(ms).toBeLessThan(2000);
  expect(isFinite(s.resources.magie)).toBe(true);
});

test("computeBonuses ist günstig genug für häufige Aufrufe", () => {
  const s = GST.createDefault();
  const N = 5000;
  const t0 = performance.now();
  for (let i = 0; i < N; i++) SYS.computeBonuses(s);
  const ms = performance.now() - t0;
  expect(ms).toBeLessThan(1500); // gemessen ~12 ms
});
