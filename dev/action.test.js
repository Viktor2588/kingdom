/* dev/action.test.js — Echtzeit-Action-Kampf (Phase 45, Schritt 1).
   Prüft Aufbau, deterministische Fixed-Step-Sim, Sieg/Niederlage,
   garantierte Terminierung, Beute und Seed-Roundtrip.              */
import { test, expect } from "bun:test";
import "../js/data-tables.js";
import "../js/data.js";
import "../js/state.js";
import "../js/systems.js";
import "../js/systems-bestiary.js";
import "../js/systems-combat.js";
import "../js/systems-skirmish.js";
import "../js/systems-siege.js";
import "../js/systems-battle.js";
import "../js/systems-action.js";
import "../js/systems-contracts.js";

const GST = globalThis.GameState, A = globalThis.GameActionCombat, GD = globalThis.GameData;

function setup(level, stage) {
  const s = GST.createDefault();
  s.herrscher.level = level || 1; s.herrscher.stage = stage || 0;
  return s;
}
function nearest(v) {
  let best = null, bd = Infinity;
  for (const e of v.enemies) { const dx = e.x - v.hero.x, dy = e.y - v.hero.y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = e; } }
  return best;
}
// Treibt das Gefecht beidseitig automatisch: Held läuft auf das nächste Ziel zu und greift an.
function autoPlay(s, dtMs) {
  dtMs = dtMs || A.STEP_MS;
  let guard = 0;
  while (A.renderView(s).status === 'active' && guard++ < 20000) {
    const v = A.renderView(s), e = nearest(v);
    A.setIntent(s, e ? { moveX: e.x - v.hero.x, moveY: e.y - v.hero.y, attack: true } : { moveX: 0, moveY: 0, attack: true });
    A.step(s, dtMs);
  }
  return { status: A.renderView(s).status, steps: guard };
}

test("Aufbau: Held + Gegner + aktive Arena", () => {
  const s = setup(10, 1);
  const r = A.start(s, 'wald', s.creatures.map((c) => c.uid), true, 123);
  expect(r.ok).toBe(true);
  const v = A.renderView(s);
  expect(v.w).toBeGreaterThan(0); expect(v.h).toBeGreaterThan(0);
  expect(v.status).toBe('active');
  expect(v.hero.hp).toBeGreaterThan(0);
  expect(v.enemies.length).toBeGreaterThan(0);
  // alle Positionen liegen innerhalb der Arena
  v.enemies.concat([v.hero]).forEach((u) => { expect(u.x).toBeGreaterThanOrEqual(0); expect(u.x).toBeLessThanOrEqual(v.w); expect(u.y).toBeGreaterThanOrEqual(0); expect(u.y).toBeLessThanOrEqual(v.h); });
});

test("ohne Einheiten kein Gefecht", () => {
  const s = setup(1, 0);
  expect(A.start(s, 'wald', [], false).ok).toBe(false);
});

test("Determinismus: gleicher Seed + gleiche Eingaben → identischer Verlauf", () => {
  const a = setup(8, 1); A.start(a, 'hoehlen', a.creatures.map((c) => c.uid), true, 777);
  const b = setup(8, 1); A.start(b, 'hoehlen', b.creatures.map((c) => c.uid), true, 777);
  for (let i = 0; i < 200; i++) {
    if (A.renderView(a).status !== 'active') break;
    const va = A.renderView(a), ea = nearest(va), vb = A.renderView(b), eb = nearest(vb);
    A.setIntent(a, ea ? { moveX: ea.x - va.hero.x, moveY: ea.y - va.hero.y } : { moveX: 0, moveY: 0 });
    A.setIntent(b, eb ? { moveX: eb.x - vb.hero.x, moveY: eb.y - vb.hero.y } : { moveX: 0, moveY: 0 });
    A.step(a, A.STEP_MS); A.step(b, A.STEP_MS);
  }
  expect(JSON.stringify(A.renderView(a))).toBe(JSON.stringify(A.renderView(b)));
});

test("Fixed-Step: viele kleine Schritte == ein großer Schritt gleicher Gesamtzeit", () => {
  const fine = setup(8, 1); A.start(fine, 'wald', fine.creatures.map((c) => c.uid), true, 42);
  const coarse = setup(8, 1); A.start(coarse, 'wald', coarse.creatures.map((c) => c.uid), true, 42);
  const intent = { moveX: 1, moveY: 0, attack: true };
  A.setIntent(fine, intent); A.setIntent(coarse, intent);
  for (let i = 0; i < 6; i++) A.step(fine, A.STEP_MS);   // 6 × 1 Tick
  A.step(coarse, A.STEP_MS * 6);                          // 1 Aufruf, 6 Ticks
  expect(JSON.stringify(A.renderView(fine))).toBe(JSON.stringify(A.renderView(coarse)));
});

test("starker Held gewinnt, erhält Beute und leert das Gefecht", () => {
  const s = setup(25, 3);
  const before = s.resources.gold + s.resources.seelen + s.resources.material;
  A.start(s, 'wald', s.creatures.map((c) => c.uid), true, 5);
  const out = autoPlay(s);
  expect(out.status).toBe('won');
  const res = A.applyResult(s);
  expect(res.won).toBe(true);
  expect(res.reward).toBeTruthy();
  expect(s.actionBattle).toBeNull();
  expect(s.resources.gold + s.resources.seelen + s.resources.material).toBeGreaterThan(before);
});

test("schwacher Held verliert gegen übermächtige Region (terminiert sicher)", () => {
  const s = setup(1, 0);
  A.start(s, GD.regions[GD.regions.length - 1].id, s.creatures.map((c) => c.uid), true, 9);
  const out = autoPlay(s);
  expect(out.status).toBe('lost');
  expect(out.steps).toBeLessThan(20000);
  expect(A.applyResult(s).won).toBe(false);
  expect(s.actionBattle).toBeNull();
});

test("jedes Gefecht terminiert (Stichprobe über Regionen/Seeds)", () => {
  GD.regions.slice(0, 6).forEach((region, i) => {
    const s = setup(10, 1);
    A.start(s, region.id, s.creatures.map((c) => c.uid), true, 17 + i * 31);
    const out = autoPlay(s);
    expect(['won', 'lost']).toContain(out.status);
    expect(A.renderView(s).elapsed).toBeLessThanOrEqual(A.MAX_SECONDS + 1);
  });
});

test("Seed-Roundtrip: Gefecht übersteht JSON-Serialisierung und ist fortsetzbar", () => {
  const s = setup(8, 1);
  A.start(s, 'wald', s.creatures.map((c) => c.uid), true, 321);
  for (let i = 0; i < 20 && A.renderView(s).status === 'active'; i++) { A.setIntent(s, { moveX: 1, moveY: 0 }); A.step(s, A.STEP_MS); }
  const round = JSON.parse(JSON.stringify(s));   // rng-Funktion geht verloren → rehydrate stellt sie aus dem Seed her
  expect(round.actionBattle).toBeTruthy();
  const out = autoPlay(round);
  expect(['won', 'lost']).toContain(out.status);
});

test("Ausweichrolle gewährt i-Frames und unterliegt einem Cooldown", () => {
  const s = setup(8, 1);
  A.start(s, 'wald', s.creatures.map((c) => c.uid), true, 55);
  A.setIntent(s, { moveX: 0, moveY: 0, dodge: true });
  A.step(s, A.STEP_MS);
  let v = A.renderView(s);
  expect(v.hero.invuln).toBeGreaterThan(0);     // i-Frames aktiv
  expect(v.hero.dodgeCd).toBeGreaterThan(0);    // Cooldown läuft
  // i-Frames laufen ab
  A.setIntent(s, { moveX: 0, moveY: 0, dodge: false });
  for (let i = 0; i < 20; i++) A.step(s, A.STEP_MS);
  v = A.renderView(s);
  expect(v.hero.invuln).toBe(0);
  // erneuter Dodge während Cooldown wird nicht gewährt (keine neuen i-Frames)
  if (v.hero.dodgeCd > 0) {
    A.setIntent(s, { moveX: 0, moveY: 0, dodge: true });
    A.step(s, A.STEP_MS);
    expect(A.renderView(s).hero.invuln).toBe(0);
  }
});

test("Gegner telegrafieren ihren Schlag, bevor sie treffen (sichtbare Gefahrenzone)", () => {
  const s = setup(3, 0);
  A.start(s, 'sumpf', s.creatures.map((c) => c.uid), true, 88);
  let sawWindup = false;
  for (let i = 0; i < 600 && A.renderView(s).status === 'active'; i++) {
    const v = A.renderView(s);
    const w = v.enemies.find((e) => e.state === 'windup');
    if (w) { sawWindup = true; expect(w.danger).toBeTruthy(); expect(w.danger.r).toBeGreaterThan(0); expect(w.windup).toBeLessThanOrEqual(w.windupMax); break; }
    A.setIntent(s, { moveX: 0, moveY: 0, attack: true });   // stillstehen → Gegner kommen heran
    A.step(s, A.STEP_MS);
  }
  expect(sawWindup).toBe(true);
});

// Held steht still und greift an; optional weicht er telegrafierten Schlägen aus.
function runStanding(level, stage, region, seed, dodgeOn, steps) {
  const s = setup(level, stage);
  A.start(s, region, s.creatures.map((c) => c.uid), true, seed);
  for (let i = 0; i < steps && A.renderView(s).status === 'active'; i++) {
    const v = A.renderView(s);
    let intent = { moveX: 0, moveY: 0, attack: true };
    if (dodgeOn && v.hero.dodgeCd === 0) {
      const threat = v.enemies.find((e) => e.state === 'windup' && e.windup <= 0.12 &&
        Math.hypot(v.hero.x - e.danger.x, v.hero.y - e.danger.y) <= e.danger.r);
      if (threat) { const dx = v.hero.x - threat.danger.x, dy = v.hero.y - threat.danger.y, l = Math.hypot(dx, dy) || 1; intent = { moveX: dx / l, moveY: dy / l, attack: true, dodge: true }; }
    }
    A.setIntent(s, intent); A.step(s, A.STEP_MS);
  }
  return A.renderView(s).hero;
}

test("Ausweichen reduziert erlittenen Schaden gegenüber passivem Stillstehen", () => {
  const passive = runStanding(6, 1, 'sumpf', 404, false, 220);
  const dodger = runStanding(6, 1, 'sumpf', 404, true, 220);
  expect(passive.hp).toBeLessThan(passive.maxHp);   // passiver Held wird getroffen
  expect(dodger.hp).toBeGreaterThan(passive.hp);     // Ausweichen verhindert Schaden
});

// Held nach rechts bewegen, bis das nächste Ziel innerhalb von R liegt (Auto-Angriff aus).
function moveIntoRange(s, R) {
  for (let i = 0; i < 60; i++) {
    const v = A.renderView(s), e = nearest(v);
    if (e && Math.hypot(e.x - v.hero.x, e.y - v.hero.y) <= R) return e;
    A.setIntent(s, { moveX: 1, moveY: 0, attack: false }); A.step(s, A.STEP_MS);
  }
  return null;
}
function totalEnemyHp(v) { return v.enemies.reduce((a, e) => a + e.hp, 0); }

test("Hotbar: Held besitzt Cooldown-Fähigkeiten, anfangs alle bereit", () => {
  const s = setup(8, 1);   // Herrscher → Magie-Kit
  A.start(s, 'wald', s.creatures.map((c) => c.uid), true, 12);
  const cds = A.renderView(s).hero.cooldowns;
  expect(cds.length).toBeGreaterThanOrEqual(2);
  cds.forEach((c) => { expect(c.ready).toBe(true); expect(c.cdLeft).toBe(0); });
});

test("Fähigkeit feuert, trifft das nächste Ziel und geht auf Cooldown", () => {
  const s = setup(10, 1);
  A.start(s, 'wald', s.creatures.map((c) => c.uid), true, 31);
  const slot = A.renderView(s).hero.cooldowns.findIndex((c) => c.kind === 'damage');
  expect(slot).toBeGreaterThanOrEqual(0);
  expect(moveIntoRange(s, 38)).toBeTruthy();
  const before = totalEnemyHp(A.renderView(s));
  A.setIntent(s, { moveX: 0, moveY: 0, attack: false, skills: [slot] }); A.step(s, A.STEP_MS);
  const v = A.renderView(s);
  expect(totalEnemyHp(v)).toBeLessThan(before);    // Schaden gewirkt
  expect(v.hero.cooldowns[slot].cdLeft).toBeGreaterThan(0);   // auf Cooldown
  // erneutes Feuern während Cooldown bleibt wirkungslos
  const hpNow = totalEnemyHp(v);
  A.setIntent(s, { moveX: 0, moveY: 0, attack: false, skills: [slot] }); A.step(s, A.STEP_MS);
  expect(totalEnemyHp(A.renderView(s))).toBe(hpNow);
});

test("Brand-Status verursacht Schaden über Zeit (DoT)", () => {
  const s = setup(2, 0);   // schwacher Magier vs. zähe Region → Feuerstoß tötet nicht sofort
  A.start(s, GD.regions[Math.min(6, GD.regions.length - 1)].id, s.creatures.map((c) => c.uid), true, 77);
  const fireSlot = A.renderView(s).hero.cooldowns.findIndex((c) => c.id === 'feuer');
  expect(fireSlot).toBeGreaterThanOrEqual(0);
  expect(moveIntoRange(s, 38)).toBeTruthy();
  A.setIntent(s, { moveX: 0, moveY: 0, attack: false, skills: [fireSlot] }); A.step(s, A.STEP_MS);
  const burning = A.renderView(s).enemies.find((e) => e.statuses.includes('brand'));
  expect(burning).toBeTruthy();
  const hp0 = burning.hp;
  // wegbewegen, nicht angreifen, keine Fähigkeiten → der einzige Schaden ist der Brand-DoT
  for (let i = 0; i < 15; i++) { A.setIntent(s, { moveX: -1, moveY: 0, attack: false }); A.step(s, A.STEP_MS); }
  const still = A.renderView(s).enemies.find((e) => e.key === burning.key);
  if (still) expect(still.hp).toBeLessThan(hp0);   // DoT hat geschadet (oder Gegner ist daran gestorben)
});

test("Gegnervielfalt: mehrere Verhaltenstypen erscheinen", () => {
  const s = setup(8, 1);
  A.start(s, GD.regions[Math.min(5, GD.regions.length - 1)].id, s.creatures.map((c) => c.uid), true, 13);
  const kinds = {};
  A.renderView(s).enemies.forEach((e) => { kinds[e.kind] = true; });
  expect(Object.keys(kinds).length).toBeGreaterThanOrEqual(2);   // nicht nur ein Typ
});

test("Boss erscheint in der Schlusswelle und hat eine Wut-Phase unter 50 % LP", () => {
  // schwächste Region mit Boss (Macht ≥200) + sehr starker Held → erreicht die Schlusswelle zügig
  const region = GD.regions.filter((r) => r.power >= 200).sort((a, b) => a.power - b.power)[0];
  expect(region).toBeTruthy();
  const s = setup(60, GD.rulerStages.length - 1);
  A.start(s, region.id, s.creatures.map((c) => c.uid), true, 21);
  let boss = null;
  for (let i = 0; i < 8000 && A.renderView(s).status === 'active'; i++) {
    const v = A.renderView(s);
    if (v.wave === v.totalWaves) { boss = v.enemies.find((e) => e.boss); if (boss) break; }
    const e = nearest(v);
    A.setIntent(s, e ? { moveX: e.x - v.hero.x, moveY: e.y - v.hero.y, attack: true } : { moveX: 0, moveY: 0, attack: true });
    A.step(s, A.STEP_MS);
  }
  expect(boss).toBeTruthy();
  expect(boss.enraged).toBe(false);
  // Boss unter 50 % bringen → Enrage schaltet sich beim nächsten Tick ein
  const raw = s.actionBattle.enemies.find((e) => e.boss);
  raw.hp = Math.floor(raw.maxHp * 0.4);
  A.setIntent(s, { moveX: 0, moveY: 0, attack: false }); A.step(s, A.STEP_MS);
  const after = s.actionBattle.enemies.find((e) => e.boss);
  if (after) expect(after.enraged).toBe(true);
});

test("Mehrere Wellen: das Gefecht eskaliert und endet erst nach der Schlusswelle", () => {
  const s = setup(30, 4);
  A.start(s, 'wald', s.creatures.map((c) => c.uid), true, 5);
  expect(A.renderView(s).totalWaves).toBeGreaterThanOrEqual(2);
  let maxWave = 1;
  for (let i = 0; i < 20000 && A.renderView(s).status === 'active'; i++) {
    const v = A.renderView(s); maxWave = Math.max(maxWave, v.wave);
    const e = nearest(v);
    A.setIntent(s, e ? { moveX: e.x - v.hero.x, moveY: e.y - v.hero.y, attack: true } : { moveX: 0, moveY: 0, attack: true });
    A.step(s, A.STEP_MS);
  }
  expect(A.renderView(s).status).toBe('won');
  expect(maxWave).toBeGreaterThanOrEqual(2);   // mindestens eine Folge-Welle durchgespielt
});

test("Combo/Schwung steigt mit Treffern und bricht beim Schaden", () => {
  const s = setup(20, 3);
  A.start(s, 'wald', s.creatures.map((c) => c.uid), true, 99);
  // auf Gegner zulaufen und angreifen → Combo wächst
  for (let i = 0; i < 80 && A.renderView(s).status === 'active' && A.renderView(s).combo < 3; i++) {
    const v = A.renderView(s), e = nearest(v);
    A.setIntent(s, e ? { moveX: e.x - v.hero.x, moveY: e.y - v.hero.y, attack: true } : { moveX: 0, moveY: 0, attack: true });
    A.step(s, A.STEP_MS);
  }
  expect(A.renderView(s).combo).toBeGreaterThan(1);
  // Treffer einstecken: Held neben einen Gegner stellen, stehen bleiben → Schwung bricht auf 0
  if (A.renderView(s).status === 'active') {
    let broke = false;
    for (let i = 0; i < 200 && A.renderView(s).status === 'active'; i++) {
      A.setIntent(s, { moveX: 0, moveY: 0, attack: false }); A.step(s, A.STEP_MS);
      if (A.renderView(s).combo === 0) { broke = true; break; }
    }
    expect(broke).toBe(true);
  }
});

test("autoResolve: kopfloses Auto-Gefecht terminiert, wertet aus und ist deterministisch", () => {
  const a = setup(22, 3), b = setup(22, 3);
  const ra = A.autoResolve(a, 'wald', a.creatures.map((c) => c.uid), true, 8);
  const rb = A.autoResolve(b, 'wald', b.creatures.map((c) => c.uid), true, 8);
  expect(typeof ra.won).toBe('boolean');
  expect(ra.won).toBe(rb.won);          // gleicher Seed → gleiches Ergebnis
  expect(a.actionBattle).toBeNull();    // Gefecht aufgelöst
  // starker Held räumt die schwache Region
  expect(ra.won).toBe(true);
});

test("Rückzug beendet das Gefecht", () => {
  const s = setup(5, 0);
  A.start(s, 'wald', s.creatures.map((c) => c.uid), true, 1);
  expect(s.actionBattle).toBeTruthy();
  A.abort(s);
  expect(s.actionBattle).toBeNull();
});
