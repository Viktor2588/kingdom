/* dev/battle.test.js — Neues Tactical-RPG-Kampfsystem (Phase 44).
   Prüft Aufbau, Determinismus, Aktionsfluss, Terminierung (Sieg/Niederlage/
   Timeout), Beute, KI und Save-Roundtrip der laufenden Schlacht.            */
import { test, expect } from "bun:test";
import "../js/data-tables.js";
import "../js/data.js";
import "../js/state.js";
import "../js/systems.js";
import "../js/systems-combat.js";
import "../js/systems-skirmish.js";
import "../js/systems-siege.js";
import "../js/systems-battle.js";

const GST = globalThis.GameState, B = globalThis.GameBattle, GD = globalThis.GameData;

function setup(level, stage) {
  const s = GST.createDefault();
  s.herrscher.level = level || 1; s.herrscher.stage = stage || 0;
  return s;
}
// Spielt eine Schlacht beidseitig automatisch zu Ende und gibt den Status zurück.
function autoPlay(s) {
  let guard = 0;
  while (B.renderView(s).status === 'active' && guard++ < 5000) {
    if (B.isPlayerTurn(s)) {
      const u = B.currentUnit(s), foes = B.renderView(s).enemies.filter((e) => !e.dead);
      let acted = false;
      for (const abId of u.abilities) {
        const ab = B.ability(abId); if (ab.kind !== 'damage') continue;
        for (const t of B.abilityTargets(s, abId)) { if (foes.some((f) => f.pos.x === t.x && f.pos.y === t.y)) { if (B.useAbility(s, abId, t.x, t.y).ok) { acted = true; break; } } }
        if (acted) break;
      }
      if (!acted) {
        const reach = B.reachableCells(s), target = foes[0]; let best = null, bd = 999;
        for (const k of Object.keys(reach)) { const p = k.split(',').map(Number), d = Math.abs(p[0] - target.pos.x) + Math.abs(p[1] - target.pos.y); if (d < bd) { bd = d; best = p; } }
        if (best) B.moveUnit(s, best[0], best[1]);
        const cur = B.currentUnit(s), adj = foes.find((f) => Math.abs(f.pos.x - cur.pos.x) + Math.abs(f.pos.y - cur.pos.y) <= 1);
        if (adj && B.isPlayerTurn(s)) B.useAbility(s, 'schlag', adj.pos.x, adj.pos.y); else if (B.isPlayerTurn(s)) B.waitTurn(s);
      }
    } else B.enemyTurn(s);
  }
  return { status: B.renderView(s).status, steps: guard };
}

test("Aufbau: Party + Gegner + Gitter, Status aktiv, eine aktive Einheit", () => {
  const s = setup(10, 1);
  const r = B.startBattle(s, 'wald', s.creatures.map((c) => c.uid), true, 123);
  expect(r.ok).toBe(true);
  const v = B.renderView(s);
  expect(v.w).toBe(8); expect(v.h).toBe(6);
  expect(v.party.length).toBeGreaterThan(0);
  expect(v.enemies.length).toBeGreaterThan(0);
  expect(v.status).toBe('active');
  expect(v.active).toBeTruthy();
  // jede Einheit hat ein Fähigkeiten-Kit
  v.party.concat(v.enemies).forEach((u) => { expect(u.abilities.length).toBeGreaterThan(0); });
});

test("Determinismus: gleicher Seed → gleiches Terrain und gleiche Gegnerzahl", () => {
  const a = setup(5, 0); B.startBattle(a, 'hoehlen', a.creatures.map((c) => c.uid), true, 777);
  const b = setup(5, 0); B.startBattle(b, 'hoehlen', b.creatures.map((c) => c.uid), true, 777);
  expect(JSON.stringify(B.renderView(a).grid)).toBe(JSON.stringify(B.renderView(b).grid));
  expect(B.renderView(a).enemies.length).toBe(B.renderView(b).enemies.length);
});

test("Datenintegrität der Fähigkeiten", () => {
  Object.keys(B.ABILITIES).forEach((id) => {
    const ab = B.ABILITIES[id];
    expect(['damage', 'heal', 'guard']).toContain(ab.kind);
    expect(ab.range).toBeGreaterThanOrEqual(0);
    expect(ab.mp).toBeGreaterThanOrEqual(0);
  });
});

test("starke Party gewinnt und erhält Beute; Schlacht wird geleert", () => {
  const s = setup(25, 3);
  const goldBefore = s.resources.gold, xpBefore = s.herrscher.xp;
  B.startBattle(s, 'wald', s.creatures.map((c) => c.uid), true, 5);
  const out = autoPlay(s);
  expect(out.status).toBe('won');
  const res = B.applyResult(s);
  expect(res.won).toBe(true);
  expect(res.reward).toBeTruthy();
  expect(s.tacticalBattle).toBeNull();
  expect(s.resources.gold + s.resources.seelen + s.resources.material).toBeGreaterThan(goldBefore);
  expect(s.herrscher.xp).toBeGreaterThanOrEqual(xpBefore);
});

test("schwache Party verliert gegen übermächtige Region (terminiert sicher)", () => {
  const s = setup(1, 0);
  B.startBattle(s, GD.regions[GD.regions.length - 1].id, s.creatures.map((c) => c.uid), true, 9);
  const out = autoPlay(s);
  expect(out.status).toBe('lost');
  expect(out.steps).toBeLessThan(5000);   // kein Endloskampf
  const res = B.applyResult(s);
  expect(res.won).toBe(false);
  expect(s.tacticalBattle).toBeNull();
});

test("jede Schlacht terminiert (Stichprobe über Regionen/Seeds)", () => {
  GD.regions.slice(0, 6).forEach((region, i) => {
    const s = setup(10, 1);
    B.startBattle(s, region.id, s.creatures.map((c) => c.uid), true, 17 + i * 31);
    const out = autoPlay(s);
    expect(['won', 'lost']).toContain(out.status);
  });
});

test("Save-Roundtrip: laufende Schlacht überlebt normalize und ist fortsetzbar", () => {
  const s = setup(8, 1);
  B.startBattle(s, 'wald', s.creatures.map((c) => c.uid), true, 321);
  // ein paar Züge spielen
  for (let i = 0; i < 3 && B.renderView(s).status === 'active'; i++) { if (B.isPlayerTurn(s)) B.waitTurn(s); else B.enemyTurn(s); }
  const round = GST.normalize(JSON.parse(JSON.stringify(s)));
  expect(round.version).toBe(GST.VERSION);
  expect(round.tacticalBattle).toBeTruthy();
  // nach Laden fortsetzbar (rehydrate stellt den RNG her)
  const out = autoPlay(round);
  expect(['won', 'lost']).toContain(out.status);

  // kaputte Struktur wird verworfen
  const broken = setup(1, 0); broken.tacticalBattle = { regionId: 'wald', party: 'x' };
  expect(GST.normalize(broken).tacticalBattle).toBeNull();
});

test("Rückzug beendet die Schlacht", () => {
  const s = setup(5, 0);
  B.startBattle(s, 'wald', s.creatures.map((c) => c.uid), true, 1);
  expect(s.tacticalBattle).toBeTruthy();
  B.abortBattle(s);
  expect(s.tacticalBattle).toBeNull();
});
