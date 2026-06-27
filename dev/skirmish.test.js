/* dev/skirmish.test.js — Sturmeinsätze (Phase 40).
   Prüft Konterdreieck, Fokus/Kombo, Sieg/Niederlage, Eskalation,
   Freischaltungen und Save-v11-Migration.                         */
import { test, expect } from "bun:test";
import "../js/data-tables.js";
import "../js/data.js";
import "../js/state.js";
import "../js/systems.js";
import "../js/systems-bestiary.js";
import "../js/systems-combat.js";
import "../js/systems-skirmish.js";
import "../js/systems-contracts.js";

const GST = globalThis.GameState, SYS = globalThis.GameSystems;

function correctAction(state) {
  const status = SYS.skirmishStatus(state);
  return status.intent.counter;
}

function winActive(state) {
  let guard = 30, last;
  while (SYS.skirmishStatus(state).active && guard-- > 0) {
    const action = correctAction(state);
    if (action === 'magie' && !SYS.skirmishActionAvailable(state, action)) {
      last = SYS.skirmishAction(state, 'angriff');
    } else last = SYS.skirmishAction(state, action);
  }
  return last;
}

test("Missionen sind vollständig und der Grenzalarm ist sofort spielbar", () => {
  const s = GST.createDefault();
  expect(SYS.SKIRMISH_MISSIONS.length).toBe(3);
  expect(SYS.availableSkirmishMissions(s).map((m) => m.id)).toEqual(['grenzalarm']);
  const start = SYS.startSkirmish(s, 'grenzalarm');
  expect(start.ok).toBe(true);
  const status = SYS.skirmishStatus(s);
  expect(status.active.heroHp).toBeGreaterThan(0);
  expect(status.active.enemyHp).toBeGreaterThan(0);
  expect(status.intent.counter).toBe('block');
});

test("perfekter Konter baut Kombo/Fokus auf und verhindert Gegenschaden", () => {
  const s = GST.createDefault();
  SYS.startSkirmish(s, 'grenzalarm');
  const before = SYS.skirmishStatus(s).active.heroHp;
  const res = SYS.skirmishAction(s, correctAction(s));
  expect(res.ok).toBe(true);
  expect(res.correct).toBe(true);
  expect(SYS.skirmishStatus(s).active.heroHp).toBe(before);
  expect(SYS.skirmishStatus(s).active.combo).toBe(1);
  expect(SYS.skirmishStatus(s).active.focus).toBeGreaterThan(1);
});

test("falsche Reaktion verursacht Schaden und bricht die Kombo", () => {
  const s = GST.createDefault();
  SYS.startSkirmish(s, 'grenzalarm');
  SYS.skirmishAction(s, 'block'); // korrekt: Kombo 1
  const active = SYS.skirmishStatus(s).active;
  const before = active.heroHp;
  const res = SYS.skirmishAction(s, 'block'); // Ritual erwartet Angriff
  expect(res.ok).toBe(true);
  expect(res.correct).toBe(false);
  expect(SYS.skirmishStatus(s).active.heroHp).toBeLessThan(before);
  expect(SYS.skirmishStatus(s).active.combo).toBe(0);
});

test("Verschlingen benötigt vollen Fokus und wirkt als Finisher mit Heilung", () => {
  const s = GST.createDefault();
  SYS.startSkirmish(s, 'grenzalarm');
  expect(SYS.skirmishActionAvailable(s, 'finisher')).toBe(false);
  const active = SYS.skirmishStatus(s).active;
  active.focus = 5;
  active.heroHp -= 20;
  const hp = active.heroHp, enemy = active.enemyHp;
  const res = SYS.skirmishAction(s, 'finisher');
  expect(res.ok).toBe(true);
  if (SYS.skirmishStatus(s).active) {
    expect(SYS.skirmishStatus(s).active.heroHp).toBeGreaterThan(hp);
    expect(SYS.skirmishStatus(s).active.enemyHp).toBeLessThan(enemy);
    expect(SYS.skirmishStatus(s).active.focus).toBe(0);
  } else expect(res.finished).toBe(true);
});

test("Sieg vergibt Beute/EP und erhöht Serie sowie Eskalation", () => {
  const s = GST.createDefault();
  const gold = s.resources.gold, xp = s.herrscher.xp;
  SYS.startSkirmish(s, 'grenzalarm');
  const result = winActive(s);
  expect(result.finished).toBe(true);
  expect(result.won).toBe(true);
  expect(s.skirmish.active).toBeNull();
  expect(s.skirmish.heat).toBe(1);
  expect(s.skirmish.streak).toBe(1);
  expect(s.resources.gold).toBeGreaterThan(gold);
  expect(s.herrscher.xp).toBeGreaterThan(xp);
  expect(s.metrics.skirmishesWon).toBe(1);
  expect(s.metrics.skirmishesPlayed).toBe(1);
  expect(s.metrics.skirmishBestCombo).toBeGreaterThan(0);
});

test("Niederlage ist verlustfrei, beendet die Serie und senkt Eskalation", () => {
  const s = GST.createDefault();
  s.skirmish.heat = 3; s.skirmish.streak = 2;
  SYS.startSkirmish(s, 'grenzalarm');
  const active = SYS.skirmishStatus(s).active;
  active.heroHp = 1;
  const resources = JSON.stringify(s.resources);
  const wrong = correctAction(s) === 'angriff' ? 'block' : 'angriff';
  const result = SYS.skirmishAction(s, wrong);
  expect(result.finished).toBe(true);
  expect(result.won).toBe(false);
  expect(s.skirmish.streak).toBe(0);
  expect(s.skirmish.heat).toBe(2);
  expect(JSON.stringify(s.resources)).toBe(resources);
});

test("höhere Missionen werden durch Reichsfortschritt freigeschaltet", () => {
  const s = GST.createDefault();
  expect(SYS.startSkirmish(s, 'bestienjagd').ok).toBe(false);
  s.claimedRegions.push('wald');
  expect(SYS.missionUnlocked(s, SYS.skirmishMission('bestienjagd'))).toBe(true);
  s.herrscher.stage = 3;
  expect(SYS.missionUnlocked(s, SYS.skirmishMission('daemonenvorstoss'))).toBe(true);
});

test("Save-v11-Roundtrip erhält laufenden Einsatz und repariert Defekte", () => {
  const s = GST.createDefault();
  SYS.startSkirmish(s, 'grenzalarm');
  SYS.skirmishAction(s, 'block');
  const round = GST.normalize(JSON.parse(JSON.stringify(s)));
  expect(round.version).toBe(GST.VERSION);
  expect(round.skirmish.active.missionId).toBe('grenzalarm');
  expect(round.skirmish.active.combo).toBe(1);

  const broken = GST.createDefault();
  broken.skirmish = { heat: 999, streak: -4, active: { missionId: 'grenzalarm', heroHp: 'kaputt', enemyHp: 5 } };
  const clean = GST.normalize(broken);
  expect(clean.skirmish.heat).toBe(8);
  expect(clean.skirmish.streak).toBe(0);
  expect(clean.skirmish.active).toBeNull();
});
