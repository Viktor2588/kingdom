/* ============================================================
   systems-siege.js — Aktive Belagerungsabwehr (Phase 43).
   Optionale interaktive Verteidigung gegen einen anstehenden
   Rivalen-Raid: Mauer-/Bresche-Management (Verstärken/Ausfall/
   Bannschild) statt Konterdreieck. DOM-frei; erweitert GameSystems.
   Die automatische Raid-Auflösung bleibt als Fallback unberührt.
   ============================================================ */
(function () {
  'use strict';
  var root = (typeof window !== 'undefined') ? window : globalThis;
  var SYS = root.GameSystems, I = root.GameSystemsInternal;
  if (!SYS || !I) throw new Error('systems-siege.js muss nach systems.js geladen werden');
  var round = I.round, GD = I.GD;

  var ROUNDS = 6, MAX_SHIELD = 2;

  function finiteNum(v) { v = Number(v); return isFinite(v) ? v : 0; }

  function ensureSiege(state) {
    if (!state.siege || typeof state.siege !== 'object' || Array.isArray(state.siege)) state.siege = { active: null, lastResult: null };
    var sg = state.siege;
    if (!sg.lastResult || typeof sg.lastResult !== 'object') sg.lastResult = null;
    if (sg.active && (!GD().rival(sg.active.rivalId) || ['wallHp', 'wallMax', 'rivalRemaining', 'rivalPower', 'round', 'rounds', 'shield'].some(function (k) { return !isFinite(Number(sg.active[k])); }))) sg.active = null;
    return sg;
  }

  function siegePending(state) { return !!state.raid && !ensureSiege(state).active; }

  function startSiege(state) {
    var sg = ensureSiege(state);
    if (sg.active) return { ok: false, reason: 'Belagerung läuft bereits.' };
    if (!state.raid) return { ok: false, reason: 'Kein Angriff steht bevor.' };
    var rv = GD().rival(state.raid.rivalId);
    if (!rv) return { ok: false, reason: 'Unbekannter Rivale.' };
    var wallMax = Math.max(60, round(SYS.defenseValue(state) * 0.7));
    var power = Math.max(1, round(finiteNum(state.raid.power)));
    sg.active = {
      rivalId: rv.id,
      rivalPower: power,
      rivalRemaining: power,
      wallHp: wallMax,
      wallMax: wallMax,
      round: 1,
      rounds: ROUNDS,
      shield: MAX_SHIELD,
      log: ['🏰 ' + rv.name + ' berennt die Mauern! Halte ' + ROUNDS + ' Wellen stand.']
    };
    sg.lastResult = null;
    I.log(state, '🏰 Aktive Belagerungsabwehr gegen ' + rv.name + ' begonnen.', 'gold');
    return { ok: true, active: sg.active, rival: rv };
  }

  function finishSiege(state, won, active) {
    var raidResult = SYS.resolveActiveDefense(state, won) || { repelled: !!won };
    var bonus = null;
    if (won) {
      bonus = { seelen: 5 + round(active.rivalPower * 0.03), magie: round(active.rivalPower * 0.04) };
      I.addResources(state, bonus);
      state.metrics.activeSiegesWon = (state.metrics.activeSiegesWon || 0) + 1;
      I.log(state, '🏰 Belagerung abgewehrt – die Mauern halten! Aktiv-Bonus erbeutet.', 'gold');
    } else {
      I.log(state, '🏰 Die Mauern sind gebrochen.', 'bad');
    }
    var result = { won: !!won, rounds: active.round, rivalId: active.rivalId, raidResult: raidResult, bonus: bonus };
    var sg = ensureSiege(state);
    sg.active = null;
    sg.lastResult = result;
    return result;
  }

  // Eine Verteidigungsaktion ausführen; danach trifft die Welle ein.
  function siegeAction(state, actionId) {
    var sg = ensureSiege(state), active = sg.active;
    if (!active) return { ok: false, reason: 'Keine Belagerung aktiv.' };
    var repair = Math.max(8, round(active.wallMax * 0.2));
    // Ausfall muss mehr Feindkraft tilgen, als er an Mauer (plus entgangener
    // Reparatur) kostet – sonst wäre er ein Fallenzug. Im Hochkraft-Band lohnt er.
    var sortieDmg = Math.max(12, round(active.rivalPower * 0.22));
    var sortieCost = Math.max(4, round(active.wallMax * 0.05));
    var negate = false, line;

    if (actionId === 'verstaerken') {
      var healed = Math.min(repair, active.wallMax - active.wallHp);
      active.wallHp += healed;
      line = '🧱 Verstärken: +' + healed + ' Mauer.';
    } else if (actionId === 'ausfall') {
      active.rivalRemaining = Math.max(0, active.rivalRemaining - sortieDmg);
      active.wallHp = Math.max(0, active.wallHp - sortieCost);
      line = '⚔️ Ausfall: −' + sortieDmg + ' Feindkraft (−' + sortieCost + ' Mauer).';
    } else if (actionId === 'bannschild') {
      if (active.shield <= 0) return { ok: false, reason: 'Keine Bannschild-Ladungen.' };
      active.shield--;
      negate = true;
      line = '✨ Bannschild: nächste Welle abgewehrt.';
    } else {
      return { ok: false, reason: 'Unbekannte Aktion.' };
    }

    var roundsLeft = Math.max(1, active.rounds - active.round + 1);
    var incoming = negate ? 0 : Math.ceil(active.rivalRemaining / roundsLeft);
    active.wallHp = Math.max(0, active.wallHp - incoming);
    active.rivalRemaining = Math.max(0, active.rivalRemaining - incoming);
    line += incoming ? (' 💥 Welle: −' + incoming + ' Mauer.') : ' 🛡️ Keine Welle.';
    active.log.unshift(line);
    active.log = active.log.slice(0, 7);

    if (active.wallHp <= 0) return { ok: true, finished: true, won: false, result: finishSiege(state, false, active), line: line };
    active.round++;
    if (active.round > active.rounds) return { ok: true, finished: true, won: true, result: finishSiege(state, true, active), line: line };
    return { ok: true, finished: false, active: active, incoming: incoming, line: line };
  }

  // Belagerung abbrechen: der Raid löst sich später regulär automatisch auf.
  function abortSiege(state) {
    var sg = ensureSiege(state);
    if (!sg.active) return { ok: false, reason: 'Keine Belagerung aktiv.' };
    sg.active = null;
    I.log(state, '🏳️ Aktive Verteidigung abgebrochen – die Mauern entscheiden selbst.', '');
    return { ok: true };
  }

  function siegeStatus(state) {
    var sg = ensureSiege(state), active = sg.active;
    return {
      pending: !!state.raid && !active,
      active: active,
      rival: active ? GD().rival(active.rivalId) : (state.raid ? GD().rival(state.raid.rivalId) : null),
      raid: state.raid || null,
      lastResult: sg.lastResult
    };
  }

  Object.assign(SYS, {
    SIEGE_ROUNDS: ROUNDS,
    SIEGE_MAX_SHIELD: MAX_SHIELD,
    siegePending: siegePending,
    startSiege: startSiege,
    siegeAction: siegeAction,
    abortSiege: abortSiege,
    siegeStatus: siegeStatus
  });
})();
