/* dev/siege.test.js — Aktive Belagerungsabwehr (Phase 43).
   Prüft Verfügbarkeit, Wall-/Bresche-Loop, Sieg/Niederlage über die bestehende
   Raid-Auflösung, das Überspringen der Auto-Auflösung sowie den Save-Roundtrip. */
import { test, expect } from "bun:test";
import "../js/data-tables.js";
import "../js/data.js";
import "../js/state.js";
import "../js/systems.js";
import "../js/systems-bestiary.js";
import "../js/systems-combat.js";
import "../js/systems-skirmish.js";
import "../js/systems-siege.js";
import "../js/systems-contracts.js";

const GST = globalThis.GameState, SYS = globalThis.GameSystems;

function withRaid(power) {
  const s = GST.createDefault();
  s.claimedRegions = ['wald'];
  s.raid = { rivalId: 'clayron', power: power, atTick: s.tick + 18, warnTick: s.tick };
  return s;
}

test("Belagerung ist nur bei anstehendem Raid verfügbar", () => {
  const s = GST.createDefault();
  expect(SYS.siegePending(s)).toBe(false);
  expect(SYS.startSiege(s).ok).toBe(false);
  const r = withRaid(120);
  expect(SYS.siegePending(r)).toBe(true);
  const start = SYS.startSiege(r);
  expect(start.ok).toBe(true);
  expect(start.active.round).toBe(1);
  expect(start.active.wallHp).toBe(start.active.wallMax);
  expect(start.active.shield).toBe(SYS.SIEGE_MAX_SHIELD);
  expect(SYS.startSiege(r).ok).toBe(false); // schon aktiv
});

test("Aktionen wirken: Verstärken, Ausfall, Bannschild", () => {
  const s = withRaid(300);
  SYS.startSiege(s);
  const a0 = SYS.siegeStatus(s).active, remBefore = a0.rivalRemaining;
  const sortie = SYS.siegeAction(s, 'ausfall');
  expect(sortie.ok).toBe(true);
  if (!sortie.finished) expect(SYS.siegeStatus(s).active.rivalRemaining).toBeLessThan(remBefore);
  // Bannschild verbraucht eine Ladung und wehrt die Welle ab.
  const s2 = withRaid(300); SYS.startSiege(s2);
  const shieldBefore = SYS.siegeStatus(s2).active.shield;
  const ban = SYS.siegeAction(s2, 'bannschild');
  expect(ban.ok).toBe(true);
  expect(ban.incoming).toBe(0);
  if (!ban.finished) expect(SYS.siegeStatus(s2).active.shield).toBe(shieldBefore - 1);
});

test("schwacher Angriff wird durch aktives Verteidigen abgewehrt (Beute + raidsRepelled)", () => {
  const s = withRaid(100);
  const seelenBefore = s.resources.seelen, repelledBefore = s.metrics.raidsRepelled || 0;
  SYS.startSiege(s);
  let guard = 20, res;
  while (SYS.siegeStatus(s).active && guard-- > 0) res = SYS.siegeAction(s, 'verstaerken');
  expect(res.finished).toBe(true);
  expect(res.won).toBe(true);
  expect(s.raid).toBeNull();               // Raid aufgelöst
  expect(s.siege.active).toBeNull();
  expect(s.metrics.raidsRepelled).toBe(repelledBefore + 1);
  expect(s.resources.seelen).toBeGreaterThan(seelenBefore); // clayron-Beute (seelen) + Aktiv-Bonus
});

test("übermächtiger Angriff bricht die Mauern (Niederlage über reguläre Bruchlogik)", () => {
  const s = withRaid(100000);
  SYS.startSiege(s);
  const res = SYS.siegeAction(s, 'verstaerken');
  expect(res.finished).toBe(true);
  expect(res.won).toBe(false);
  expect(s.raid).toBeNull();
  expect(s.siege.active).toBeNull();
});

test("aktive Belagerung verhindert die automatische Raid-Auflösung", () => {
  const s = withRaid(120);
  SYS.startSiege(s);
  s.raid.atTick = s.tick;                   // Angriff wäre jetzt fällig
  const step = SYS.stepThreat(s);
  expect(step.raidResult).toBeNull();       // nicht auto-aufgelöst
  expect(s.raid).not.toBeNull();            // Raid bleibt für die aktive Verteidigung
  expect(s.siege.active).not.toBeNull();
});

test("resolveActiveDefense erzwingt das Ergebnis (Abwehr trotz schwacher Verteidigung)", () => {
  const s = withRaid(999999);               // Verteidigung << Angriffskraft
  const res = SYS.resolveActiveDefense(s, true);
  expect(res.repelled).toBe(true);          // erzwungen
  expect(s.raid).toBeNull();
});

test("Save-Roundtrip erhält laufende Belagerung; ohne Raid wird sie verworfen", () => {
  const s = withRaid(300);
  SYS.startSiege(s);
  SYS.siegeAction(s, 'verstaerken');
  const round = GST.normalize(JSON.parse(JSON.stringify(s)));
  expect(round.version).toBe(GST.VERSION);
  expect(round.siege.active).not.toBeNull();
  expect(round.siege.active.rivalId).toBe('clayron');
  // Belagerung ohne zugehörigen Raid ist ungültig → wird bereinigt.
  const orphan = withRaid(300); SYS.startSiege(orphan); orphan.raid = null;
  expect(GST.normalize(orphan).siege.active).toBeNull();
});
