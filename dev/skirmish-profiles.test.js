/* Phase 42: Gegnerprofile, Bossphasen, Rotation und Optionalziele. */
import { test, expect } from "bun:test";
import "../js/data-tables.js";
import "../js/data.js";
import "../js/state.js";
import "../js/systems.js";
import "../js/systems-combat.js";
import "../js/systems-skirmish.js";

const GST = globalThis.GameState, SYS = globalThis.GameSystems;

function unlockedState() {
  const s = GST.createDefault();
  s.herrscher.stage = 3;
  s.herrscher.level = 12;
  s.claimedRegions = ['wald', 'hoehlen', 'sumpf', 'ruinen', 'grenze'];
  return s;
}

function exactCounter(state) {
  return SYS.skirmishStatus(state).intent.counter;
}

function driveToResult(state) {
  let guard = 40, result = null;
  while (SYS.skirmishStatus(state).active && guard-- > 0) {
    const counter = exactCounter(state);
    const action = SYS.skirmishActionAvailable(state, counter) ? counter : 'block';
    result = SYS.skirmishAction(state, action);
  }
  return result;
}

test('drei Profile besitzen vollständige Normal- und Bossgrammatiken', () => {
  expect(SYS.SKIRMISH_PROFILES.map((p) => p.id)).toEqual(['waechter', 'bestie', 'hexer']);
  expect(new Set(SYS.SKIRMISH_MISSIONS.map((m) => m.profileId)).size).toBe(3);
  SYS.SKIRMISH_PROFILES.forEach((profile) => {
    expect(profile.normal.length).toBeGreaterThanOrEqual(4);
    expect(profile.boss.length).toBeGreaterThanOrEqual(4);
    [...profile.normal, ...profile.boss].forEach((intentId) => {
      const intent = SYS.SKIRMISH_INTENTS[intentId];
      expect(intent).toBeTruthy();
      expect(SYS.SKIRMISH_ACTIONS[intent.counter]).toBeTruthy();
      expect(intent.hint.length).toBeGreaterThan(8);
    });
    expect(profile.bossPhase.attackMult).toBeGreaterThan(0);
    expect(profile.bossPhase.damageTakenMult).toBeGreaterThan(0);
  });
  expect(SYS.SKIRMISH_MODIFIERS.length).toBe(3);
  expect(SYS.SKIRMISH_OBJECTIVES.map((o) => o.id)).toEqual(['ohne_finisher', 'perfekte_serie', 'blitzsieg']);
});

test('Seeds und Einsatzrotation sind reproduzierbar, aber wechseln nach jedem Start', () => {
  const a = unlockedState(), b = unlockedState();
  a.tick = b.tick = 73;
  const pa = SYS.skirmishPreview(a, 'daemonenvorstoss');
  const pb = SYS.skirmishPreview(b, 'daemonenvorstoss');
  expect([pa.profile.id, pa.modifier.id, pa.objective.id]).toEqual([pb.profile.id, pb.modifier.id, pb.objective.id]);
  SYS.startSkirmish(a, 'daemonenvorstoss', 'arkanist');
  SYS.startSkirmish(b, 'daemonenvorstoss', 'arkanist');
  a.skirmish.active.enemyHp = a.skirmish.active.enemyMaxHp = 9999;
  b.skirmish.active.enemyHp = b.skirmish.active.enemyMaxHp = 9999;
  a.skirmish.active.heroAttack = b.skirmish.active.heroAttack = 1;
  const seqA = [], seqB = [];
  for (let i = 0; i < 7; i++) {
    seqA.push(SYS.skirmishStatus(a).intent.id);
    seqB.push(SYS.skirmishStatus(b).intent.id);
    SYS.skirmishAction(a, exactCounter(a));
    SYS.skirmishAction(b, exactCounter(b));
  }
  expect(seqA).toEqual(seqB);
  SYS.retreatSkirmish(a);
  const next = SYS.skirmishPreview(a, 'daemonenvorstoss');
  expect(next.modifier.id).not.toBe(pa.modifier.id);
  expect(next.objective.id).not.toBe(pa.objective.id);
});

test('alle Profile wechseln unter 50 Prozent sichtbar in ihre Bossphase', () => {
  SYS.SKIRMISH_MISSIONS.forEach((mission) => {
    const s = unlockedState();
    SYS.startSkirmish(s, mission.id, 'ausgewogen');
    const active = SYS.skirmishStatus(s).active;
    active.enemyHp = Math.floor(active.enemyMaxHp / 2) + 1;
    active.heroAttack = 1;
    const result = SYS.skirmishAction(s, exactCounter(s));
    const status = SYS.skirmishStatus(s);
    expect(result.phaseChanged).toBe(true);
    expect(status.active.phase).toBe('boss');
    expect(status.phase.name).toBe(status.profile.bossPhase.name);
    expect(status.profile.boss).toContain(status.intent.id);
    expect(status.active.log.some((line) => line.includes('BOSSPHASE'))).toBe(true);
  });
});

test('Optionalziele vergeben nur bei Erfüllung zusätzliche Beute und EP', () => {
  const clean = unlockedState();
  SYS.startSkirmish(clean, 'grenzalarm', 'ausgewogen');
  expect(SYS.skirmishStatus(clean).objective.id).toBe('ohne_finisher');
  clean.skirmish.active.enemyHp = 1;
  const won = SYS.skirmishAction(clean, exactCounter(clean)).result;
  expect(won.objectiveMet).toBe(true);
  expect(won.objectiveReward.gold).toBeGreaterThan(0);
  expect(won.objectiveXp).toBeGreaterThan(0);
  expect(clean.metrics.skirmishObjectives).toBe(1);
  expect(clean.skirmish.objectivesCompleted).toBe(1);

  const missed = unlockedState();
  SYS.startSkirmish(missed, 'grenzalarm', 'ausgewogen');
  missed.skirmish.active.focus = 5;
  missed.skirmish.active.enemyHp = 1;
  const lostBonus = SYS.skirmishAction(missed, 'finisher').result;
  expect(lostBonus.won).toBe(true);
  expect(lostBonus.objectiveMet).toBe(false);
  expect(lostBonus.objectiveReward).toBeNull();

  const streak = GST.createDefault();
  streak.claimedRegions.push('wald');
  SYS.startSkirmish(streak, 'bestienjagd', 'ausgewogen');
  expect(SYS.skirmishStatus(streak).objective.id).toBe('perfekte_serie');
  for (let i = 0; i < 3; i++) SYS.skirmishAction(streak, exactCounter(streak));
  expect(SYS.skirmishStatus(streak).active.objectiveComplete).toBe(true);
  expect(SYS.skirmishStatus(streak).objectiveProgress).toContain('3 / 3');

  const blitz = unlockedState();
  SYS.startSkirmish(blitz, 'daemonenvorstoss', 'ausgewogen');
  expect(SYS.skirmishStatus(blitz).objective.id).toBe('blitzsieg');
  blitz.skirmish.active.enemyHp = 1;
  const fast = SYS.skirmishAction(blitz, exactCounter(blitz)).result;
  expect(fast.objectiveMet).toBe(true);
  expect(fast.rounds).toBe(1);
});

test('Szenariomatrix: jedes Gegnerprofil ist mit jeder Haltung gewinnbar', () => {
  const outcomes = [];
  SYS.SKIRMISH_MISSIONS.forEach((mission) => {
    SYS.SKIRMISH_STANCES.forEach((stance) => {
      const s = unlockedState();
      const start = SYS.startSkirmish(s, mission.id, stance.id);
      expect(start.ok).toBe(true);
      const result = driveToResult(s);
      outcomes.push(mission.profileId + ':' + stance.id);
      expect(result.finished).toBe(true);
      expect(result.won).toBe(true);
    });
  });
  expect(outcomes.length).toBe(12);
  expect(new Set(outcomes).size).toBe(12);
});

test('Szenariomatrix deckt Niederlagen aller Profile ohne Dauerverlust ab', () => {
  SYS.SKIRMISH_MISSIONS.forEach((mission) => {
    const s = unlockedState(), before = JSON.stringify(s.resources);
    SYS.startSkirmish(s, mission.id, 'ausgewogen');
    s.skirmish.active.heroHp = 1;
    const counter = exactCounter(s);
    const wrong = counter === 'angriff' ? 'block' : 'angriff';
    const result = SYS.skirmishAction(s, wrong);
    expect(result.finished).toBe(true);
    expect(result.won).toBe(false);
    expect(JSON.stringify(s.resources)).toBe(before);
  });
});

test('neue Läufe und laufende v11-Altsaves normalisieren abwärtskompatibel', () => {
  const current = unlockedState();
  SYS.startSkirmish(current, 'bestienjagd', 'waechter');
  SYS.skirmishAction(current, exactCounter(current));
  const round = GST.normalize(JSON.parse(JSON.stringify(current)));
  const currentStatus = SYS.skirmishStatus(round);
  expect(round.version).toBe(11);
  expect(currentStatus.active.profileId).toBe('bestie');
  expect(currentStatus.active.modifierId).toBe('eiserne_reserve');
  expect(currentStatus.active.objectiveId).toBe('perfekte_serie');
  expect(currentStatus.active.perfectStreak).toBe(1);

  const legacy = unlockedState();
  SYS.startSkirmish(legacy, 'grenzalarm', 'ausgewogen');
  ['profileId', 'modifierId', 'objectiveId', 'phase', 'intentStep', 'perfectStreak', 'maxPerfectStreak', 'finishersUsed', 'objectiveComplete'].forEach((key) => delete legacy.skirmish.active[key]);
  delete legacy.skirmish.rotation;
  delete legacy.skirmish.objectivesCompleted;
  const migrated = GST.normalize(JSON.parse(JSON.stringify(legacy)));
  const legacyStatus = SYS.skirmishStatus(migrated);
  expect(legacyStatus.active).toBeTruthy();
  expect(legacyStatus.profile.id).toBe('legacy');
  expect(legacyStatus.modifier.id).toBe('legacy');
  expect(legacyStatus.objective.id).toBe('none');
  expect(SYS.skirmishAction(migrated, legacyStatus.intent.counter).ok).toBe(true);
});
