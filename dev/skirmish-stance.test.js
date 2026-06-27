/* dev/skirmish-stance.test.js — Kampfhaltungen (Phase 41).
   Prüft Haltungs-Effekte, neutralen Default (altes Verhalten), Voreinstellung
   und Save-Roundtrip. Ergänzt skirmish.test.js (Basis-Mechanik).            */
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

function freshActive(stanceId) {
  const s = GST.createDefault();
  SYS.startSkirmish(s, "grenzalarm", stanceId);
  return { s, a: SYS.skirmishStatus(s).active };
}

test("Haltungen sind vollständig, eindeutig und enthalten den neutralen Default", () => {
  const ids = SYS.SKIRMISH_STANCES.map((x) => x.id);
  expect(ids.length).toBe(4);
  expect(new Set(ids).size).toBe(4);
  expect(ids[0]).toBe("ausgewogen");
  SYS.SKIRMISH_STANCES.forEach((st) => {
    ["hpMult", "atkMult", "retaliationMult", "magieMult"].forEach((k) => {
      expect(Number.isFinite(st[k])).toBe(true);
      expect(st[k]).toBeGreaterThan(0);
    });
    expect(st.startFocus).toBeGreaterThanOrEqual(1);
  });
  const neutral = SYS.skirmishStance("ausgewogen");
  expect(neutral.hpMult).toBe(1);
  expect(neutral.atkMult).toBe(1);
  expect(neutral.startFocus).toBe(1);
  expect(neutral.retaliationMult).toBe(1);
  expect(neutral.magieMult).toBe(1);
});

test("Default ohne Haltung ist neutral (altes Verhalten bleibt erhalten)", () => {
  const s = GST.createDefault();
  SYS.startSkirmish(s, "grenzalarm"); // kein stanceId
  const a = SYS.skirmishStatus(s).active;
  expect(a.stanceId).toBe("ausgewogen");
  expect(a.focus).toBe(1);
});

test("Haltungen verschieben LP, Angriff und Startfokus erwartungsgemäß", () => {
  const base = freshActive("ausgewogen").a;
  const berserk = freshActive("berserker").a;
  const waechter = freshActive("waechter").a;
  const arkan = freshActive("arkanist").a;

  expect(waechter.heroMaxHp).toBeGreaterThan(base.heroMaxHp);
  expect(berserk.heroMaxHp).toBeLessThan(base.heroMaxHp);
  expect(berserk.heroAttack).toBeGreaterThan(base.heroAttack);
  expect(waechter.heroAttack).toBeLessThan(base.heroAttack);
  expect(arkan.focus).toBe(3);
});

test("Berserker kassiert mehr Gegenschaden als Wächter bei gleicher Fehlreaktion", () => {
  // Erste Absicht bei grenzalarm ist 'hieb' (Konter: block) → 'angriff' ist falsch.
  const b = freshActive("berserker");
  const w = freshActive("waechter");
  expect(SYS.skirmishStatus(b.s).intent.counter).toBe("block");
  const rb = SYS.skirmishAction(b.s, "angriff");
  const rw = SYS.skirmishAction(w.s, "angriff");
  expect(rb.correct).toBe(false);
  expect(rw.correct).toBe(false);
  expect(rb.retaliation).toBeGreaterThan(rw.retaliation);
});

test("Voreinstellung wird gemerkt und beim Start übernommen", () => {
  const s = GST.createDefault();
  SYS.setSkirmishStance(s, "arkanist");
  expect(SYS.skirmishStatus(s).stanceId).toBe("arkanist");
  SYS.startSkirmish(s, "grenzalarm"); // ohne explizite Haltung → nutzt Voreinstellung
  expect(SYS.skirmishStatus(s).active.stanceId).toBe("arkanist");
});

test("Save-Roundtrip erhält Haltung; korrupte Haltung wird repariert", () => {
  const s = GST.createDefault();
  SYS.startSkirmish(s, "grenzalarm", "berserker");
  const round = GST.normalize(JSON.parse(JSON.stringify(s)));
  expect(round.skirmish.active.stanceId).toBe("berserker");
  expect(round.skirmish.stance).toBe("berserker");
  // Korrupte Haltung im laufenden Einsatz → ensureState defaultet beim Zugriff.
  round.skirmish.active.stanceId = "voll_erfunden";
  expect(SYS.skirmishStatus(round).active.stanceId).toBe("berserker"); // fällt auf Voreinstellung zurück
});
