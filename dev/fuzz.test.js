/* dev/fuzz.test.js — Seed-basierter Varianz-/Invarianten-Test (bun:test).
   Spielt viele unterschiedliche Auto-Sessions mit zufälligen Ressourcen-
   schüben durch (der Berater wählt dadurch verschiedene Wege/Einheiten/
   Skills) und prüft Invarianten: keine NaN/Infinity, keine Ausnahmen,
   Produktion berechenbar, Save-Roundtrip stabil. (Phase 24: mehr Tiefe/
   Varianz statt immer derselben Einheiten.)  NICHT Teil des Spiels.
   Aufruf: bun test dev/fuzz.test.js                                     */
import { test, expect } from "bun:test";
import "../js/data-tables.js";
import "../js/data.js";
import "../js/state.js";
import "../js/systems.js";

const GST = globalThis.GameState, SYS = globalThis.GameSystems;

// Deterministischer PRNG, damit Fehlschläge reproduzierbar sind.
function lcg(seed) {
  let s = seed >>> 0;
  return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function allFinite(obj) {
  return Object.keys(obj).every(function (k) {
    var v = obj[k];
    return typeof v !== 'number' || isFinite(v);
  });
}

const SEEDS = [1, 7, 42, 99, 256, 1000, 31337, 65535];
const RES = ['gold', 'material', 'magie', 'wissen', 'seelen', 'nahrung'];

test("Fuzz: variierte Auto-Sessions bleiben crash-/NaN-frei und speicherbar", () => {
  const fails = [];
  SEEDS.forEach(function (seed) {
    const rnd = lcg(seed);
    try {
      const s = GST.createDefault();
      for (var step = 0; step < 500; step++) {
        // Zufällige Ressourcenschübe → der Berater schlägt unterschiedliche Wege ein.
        if (rnd() < 0.3) {
          RES.forEach(function (r) { s.resources[r] = (s.resources[r] || 0) + Math.floor(rnd() * 600); });
        }
        if (rnd() < 0.75) SYS.autoPlayStep(s);
        SYS.tick(s);
        if (!allFinite(s.resources)) { fails.push('seed ' + seed + ' @step ' + step + ': nicht-endliche Ressource'); return; }
      }
      const prod = SYS.production(s);
      if (!prod || !allFinite(prod.rates)) { fails.push('seed ' + seed + ': Produktion nicht berechenbar'); return; }
      const clone = GST.normalize(JSON.parse(JSON.stringify(s)));
      if (clone.creatures.length !== s.creatures.length) fails.push('seed ' + seed + ': Roundtrip verliert Kreaturen');
      if (!allFinite(SYS.production(clone).rates)) fails.push('seed ' + seed + ': geladener Stand nicht berechenbar');
    } catch (e) {
      fails.push('seed ' + seed + ': Ausnahme – ' + (e && e.message));
    }
  });
  if (fails.length) console.log('FUZZ-FEHLER:\n  - ' + fails.join('\n  - '));
  expect(fails).toEqual([]);
});
