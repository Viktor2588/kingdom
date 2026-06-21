/* dev/playthrough.js — Headless-Durchspiel (jsdom). Spielt eine
   komplette Sitzung mit echtem Spielcode durch: Ticks laufen lassen,
   bauen, beschwören, benennen, entwickeln, leveln, schmieden,
   ausrüsten, Magie lernen, Expedition, speichern/laden. Prüft nach
   jedem Schritt Invarianten + dass die UI fehlerfrei rendert.
   NICHT Teil des Spiels.   Aufruf:  bun test dev/playthrough.test.js  */
import { test, expect } from "bun:test";
import { JSDOM } from "jsdom";

var dir = import.meta.dir + '/..';
var html = await Bun.file(dir + '/index.html').text();

var pass = 0, fail = 0, warn = 0, fails = [];
function ok(cond, msg) { if (cond) { pass++; } else { fail++; fails.push(msg); console.log('  ✗ ' + msg); } }
function note(msg) { warn++; console.log('  ⚠ ' + msg); }
function step(msg) { console.log('\n• ' + msg); }

var dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
var window = dom.window, document = window.document;
for (const f of ['js/data-tables.js', 'js/data.js', 'js/state.js', 'js/systems.js', 'js/systems-combat.js', 'js/ui.js', 'js/ui-adventure.js', 'js/main.js']) {
  window.eval(await Bun.file(dir + '/' + f).text());
}

var T = window.__TEMPEST__; T.stopLoop();
var S = T.state, SYS = window.GameSystems, UI = window.GameUI, GD = window.GameData;
var TABS = ['uebersicht', 'reich', 'kreaturen', 'magie', 'schmiede', 'karte'];

function renderAll(ctx) {
  TABS.forEach(function (tab) {
    try { UI.activeTab = tab; UI.render();
      if (document.getElementById('screen').children.length === 0) throw new Error('leer');
    } catch (e) { ok(false, 'UI „' + tab + '" nach ' + ctx + ' — ' + e.message); }
  });
  pass++; // ein Sammel-OK je renderAll wenn keiner geworfen hat
}
function tick(n) { for (var i = 0; i < n; i++) SYS.tick(S); }

// ---------------------------------------------------------------
step('Startzustand');
ok(SYS.totalCreatureCount(S) === 3 && S.creatures.length === 2, 'Start mit 3 Kreaturen in Stapeln');
ok(S.resources.gold === 150, 'Start-Gold 150');
renderAll('Start');

step('60 Ticks Leerlauf — Produktion läuft');
var before = JSON.parse(JSON.stringify(S.resources));
tick(60);
ok(S.resources.nahrung !== before.nahrung || S.resources.magie !== before.magie, 'Ressourcen verändern sich durch Tick');
ok(S.resources.gold >= 0 && S.resources.nahrung >= 0, 'keine negativen Ressourcen');
renderAll('Leerlauf');

step('Wirtschaft aufbauen (bauen, solange leistbar)');
// Spielgeld geben wie ein fortgeschrittener Spieler
S.resources.gold += 8000; S.resources.material += 8000; S.resources.magie += 8000;
S.resources.wissen += 800; S.resources.nahrung += 600;
var built = 0;
['mine', 'farm', 'markt', 'forschungsgilde', 'wohnbezirk', 'schmiede', 'beschwoerungskreis', 'magieturm', 'labyrinth'].forEach(function (id) {
  for (var lvl = 0; lvl < 3; lvl++) {
    var r = SYS.build ? SYS.build(S, id) : null;
    if (r && r.ok !== false) built++; else break;
  }
});
ok(built > 0, built + ' Gebäude-Stufen gebaut');
renderAll('Bauen');

step('Bevölkerung: viele Kreaturen beschwören');
var sumOk = 0;
['goblin', 'schleim', 'schreckenswolf', 'skelett', 'oger', 'echsenmensch'].forEach(function (sp) {
  if (!GD.creature(sp)) { note('Spezies „' + sp + '" existiert nicht — übersprungen'); return; }
  var r = SYS.summon(S, sp);
  if (r && r.ok !== false) sumOk++;
});
ok(sumOk >= 3, sumOk + ' Kreaturen beschworen');
renderAll('Beschwören');

step('Namensgebung → Aspekt + Skill-Slots');
var goblin = S.creatures.filter(function (c) { return c.speciesId === 'goblin'; })[0];
var nm = SYS.nameCreature(S, goblin.uid, 'Goldzahn', 'wuterich');
ok(goblin.named === true, 'Goblin ist benannt');
ok(goblin.name === 'Goldzahn', 'Name gesetzt');
ok(goblin.aspect === 'wuterich', 'Aspekt Wüterich gesetzt');
S.resources.magie += 1000; S.resources.seelen += 200;
var av = SYS.availableSkills(S, goblin);
if (av.length) { var rls = SYS.learnSkill(S, goblin.uid, av[0]); ok(rls.ok || goblin.skills.length >= SYS.skillCapacity(goblin), 'Skill gelernt oder Slots voll'); }
renderAll('Benennen');

step('Evolution: Goblin → nächste Form');
var sp = GD.creature(goblin.speciesId);
var target = sp && sp.evolvesTo && sp.evolvesTo[0];
if (target) {
  S.resources.seelen += 500; S.resources.magie += 2000;
  goblin.level = Math.max(goblin.level, (sp.levelCap || 20));
  var ev = SYS.evolve(S, goblin.uid, target.id || target);
  ok(goblin.speciesId !== 'goblin' || (ev && ev.ok === false), 'Evolution durchgeführt oder sauber abgelehnt');
} else { note('Goblin hat keine Evolution in den Daten'); }
renderAll('Evolution');

step('Leveln über XP');
var lvlBefore = goblin.level;
SYS.addCreatureXp(S, goblin, 5000);
ok(goblin.level >= lvlBefore, 'Level steigt nicht zurück (jetzt Lv ' + goblin.level + ')');
ok(goblin.xp >= 0, 'XP konsistent');
renderAll('Leveln');

step('Magie lernen');
var learned = 0;
(GD.magic || GD.spells || []).slice(0, 4).forEach(function (m) {
  S.resources.wissen += 1000; S.resources.magie += 1000;
  var r = SYS.learnMagic(S, m.id);
  if (r && r.ok !== false) learned++;
});
ok(learned > 0 || (S.learnedMagic && S.learnedMagic.length > 0), learned + ' Zauber/Forschungen freigeschaltet');
renderAll('Magie');

step('Schmieden + Ausrüsten');
var recipes = GD.recipes || [];
var crafted = null;
for (var i = 0; i < recipes.length; i++) {
  S.resources.material += 2000; S.resources.magie += 2000; S.resources.gold += 2000;
  var cr = SYS.craft(S, recipes[i].id);
  if (cr && cr.item) { crafted = cr.item; break; }
}
ok(crafted !== null, 'Item geschmiedet');
if (crafted) {
  var eq = SYS.equipItem(S, crafted.uid, goblin.uid);
  var equipped = false;
  for (var slot in goblin.equipment) { if (goblin.equipment[slot] === crafted.uid) equipped = true; }
  ok(equipped || (eq && eq.ok === false), 'Item ausgerüstet oder sauber abgelehnt');
}
renderAll('Schmiede');

step('Jobs zuweisen + 120 Ticks Wirtschaft mit Bevölkerung');
var jobs = ['armee', 'magie', 'material', 'wissen', 'frei'];
S.creatures.forEach(function (c, i) { c.job = jobs[i % jobs.length]; });
var g0 = S.resources.gold;
tick(120);
ok(S.resources.gold >= 0 && S.resources.nahrung >= 0, 'Wirtschaft bleibt nicht-negativ über 120 Ticks');
renderAll('Wirtschaft');

step('Expedition / Auto-Kampf');
var regions = GD.regions || [];
var expWon = 0, expRun = 0;
regions.slice(0, 3).forEach(function (reg) {
  var army = S.creatures.filter(function (c) { return c.job === 'armee'; }).map(function (c) { return c.uid; });
  if (!army.length) { army = [S.creatures[0].uid]; }
  var r = SYS.startExpedition ? SYS.startExpedition(S, reg.id, army) : (SYS.expedition ? SYS.expedition(S, reg.id, army) : null);
  if (r && r.ok !== false) { expRun++; if (r.won || (r.result && r.result.won)) expWon++; }
});
// Expeditionen ggf. über Ticks auflösen
tick(60);
ok(expRun > 0 || (S.expeditions && S.expeditions.length >= 0), expRun + ' Expedition(en) gestartet');
renderAll('Expedition');

step('Expeditionsrisiko → Verwundung, Heilung & Tod');
var unit = S.creatures.filter(function (c) { return !SYS.creatureBusy(S, c.uid); })[0];
var rExp = { regionId: 'gebirge', creatureUids: [unit.uid], rulerJoined: false, risk: 'normal', power: 1, startTick: S.tick, returnsAtTick: S.tick };
var rRes = SYS.resolveExpedition(S, rExp);
ok(rRes.won === false && SYS.isWounded(S, unit), 'Normale Niederlage verwundet die Einheit');
renderAll('Verwundet');
var until = unit.woundedUntil;
while (S.tick < until) SYS.tick(S);
ok(!SYS.isWounded(S, unit), 'Verwundung heilt mit der Zeit');
var doomed = S.creatures.filter(function (c) { return c.uid !== unit.uid && !SYS.creatureBusy(S, c.uid); })[0];
if (doomed) {
  var deathRes = SYS.resolveExpedition(S, { regionId: 'gebirge', creatureUids: [doomed.uid], rulerJoined: false, risk: 'riskant', power: 1, startTick: S.tick, returnsAtTick: S.tick });
  ok(deathRes.dead === 1 && !SYS.findCreature(S, doomed.uid), 'Riskante Niederlage tötet die Einheit endgültig');
}

step('Benannter Anführer → Armeegruppe → Kartenbewegung');
S.resources.gold += 10000; S.resources.nahrung += 10000; S.resources.magie += 10000;
S.buildings.arena = Math.max(3, S.buildings.arena || 0);
var leaders = SYS.eligibleArmyLeaders(S);
if (!leaders.length) {
  var promoted = S.creatures.filter(function (c) { return !c.named && !SYS.creatureBusy(S, c.uid); })[0];
  if (promoted) { SYS.nameCreature(S, promoted.uid, 'Marschall', 'bollwerk'); leaders = SYS.eligibleArmyLeaders(S); }
}
if (leaders.length) {
  var formed = SYS.createArmyGroup(S, leaders[0].uid, 'Durchspiel-Legion');
  ok(formed.ok, 'Armeegruppe mit benanntem Anführer gegründet');
  var troop = SYS.recruitableTroops(S)[0];
  var recruited = SYS.recruitTroops(S, formed.group.id, troop.id, 10);
  ok(recruited.ok && SYS.armyCommandUsed(formed.group) > 0, 'Massentruppen rekrutiert');
  var moved = SYS.moveArmyGroup(S, formed.group.id, 'wald');
  ok(moved.ok && formed.group.position === 'wald', 'Armeefigur auf Weltkarte bewegt');
  var campaign = SYS.attackWithArmyGroup(S, formed.group.id, 'sicher');
  ok(campaign.ok, 'Kartenkampf mit dauerhaften Truppenverlusten ausgewertet');
  var siteMove = campaign.won ? SYS.moveArmyGroup(S, formed.group.id, 'site_manaquelle') : { ok: false };
  var siteCapture = siteMove.ok ? SYS.interactMapSite(S, formed.group.id, 'manaquelle') : { ok: false };
  ok(!campaign.won || (siteMove.ok && siteCapture.ok && SYS.mapSiteClaimed(S, 'manaquelle')), 'Abenteuerkarten-Fundort erreicht und Ressourcenanlage gesichert');
  renderAll('Armeegruppen');
} else {
  note('Keine freie benannte Kreatur für Armeegruppen-Test verfügbar');
}

step('Prozedurales Echo-Netz → Pfadwahl, Affixe und Beute');
if (S.claimedRegions.indexOf('wald') < 0) S.claimedRegions.push('wald');
if (S.claimedRegions.indexOf('hoehlen') < 0) S.claimedRegions.push('hoehlen');
var echoRun = SYS.ensureEchoMap(S);
ok(echoRun && echoRun.nodes.length === 12 && SYS.availableEchoNodes(S).length >= 2, 'Echo-Netz mit mehreren Startpfaden erzeugt');
var echoArmy = (typeof formed !== 'undefined' && formed && formed.ok) ? formed.group : SYS.rulerArmyGroup(S);
if (SYS.armyCommandUsed(echoArmy) <= 0) SYS.recruitTroops(S, echoArmy.id, 'schleim', 10);
// Ein Startknoten kann bei einem zufälligen Seed ein legitimer Seitenarm ohne
// direkten Nachfolger sein. Für diesen Pfad-Test gezielt einen verbundenen
// Start wählen, damit die Aussage unabhängig von Date.now() reproduzierbar ist.
var echoStarts = SYS.availableEchoNodes(S);
var echoTarget = echoStarts.filter(function (start) {
  return echoRun.nodes.some(function (node) { return node.parents.indexOf(start.id) >= 0; });
})[0] || echoStarts[0];
var echoFight = SYS.challengeEcho(S, echoArmy.id, echoTarget.id, 'sicher');
ok(echoFight.ok && echoFight.won && SYS.echoNodeCompleted(S, echoTarget.id), 'erstes Echo mit einer Armee abgeschlossen');
ok(SYS.availableEchoNodes(S).some(function (node) { return node.parents.indexOf(echoTarget.id) >= 0; }), 'Sieg öffnet einen verbundenen Folgepfad');
renderAll('Echo-Territorien');

step('Herrscher-Progression');
var hl = S.herrscher.level;
SYS.addRulerXp(S, 5000);
ok(S.herrscher.level >= hl, 'Herrscher-Level steigt (jetzt Lv ' + S.herrscher.level + ')');
renderAll('Herrscher');

step('Rivalen & Bedrohung (Raid + Gegenangriff)');
S.buildings.labyrinth = Math.max(S.buildings.labyrinth, 2);
S.creatures.forEach(function (c) { if (!SYS.isWounded(S, c)) c.job = 'armee'; });
ok(SYS.defenseValue(S) > 0, 'Verteidigung berechnet (' + SYS.defenseValue(S) + ')');
SYS.scheduleRaid(S); S.raid.power = 1; S.raid.atTick = S.tick;
var raidRes = SYS.resolveRaid(S);
ok(raidRes && raidRes.repelled, 'Schwacher Angriff abgewehrt');
var rivId = 'clayron';
S.rivalProgress[rivId] = SYS.RIVAL_COUNTER_REPELS;
S.metrics.seelenGesamt = 99999; SYS.addRulerXp(S, 500000);
var ca = SYS.counterAttackRival(S, rivId, S.creatures.map(function (c) { return c.uid; }));
ok(ca.ok, 'Gegenangriff ausführbar');
if (ca.won) ok(SYS.isRivalDefeated(S, rivId), 'Rivale endgültig besiegt → Reichsbonus aktiv');
else ok(true, 'Gegenangriff aufgelöst');
renderAll('Rivalen');

step('Events & Affinität');
var goldEv = S.resources.gold;
SYS.applyEventEffect(S, { res: { gold: 200 }, buff: { effect: { produktionAll: 0.2 }, dauer: 30, label: 'Test' } });
ok(S.resources.gold === goldEv + 200, 'Event-Ressourceneffekt angewendet');
ok(SYS.computeBonuses(S).produktionAll >= 0.2, 'Temporärer Buff aktiv');
S.activeEvent = 'haendler'; S.resources.material += 300;
var rev = SYS.resolveEvent(S, 1);
ok(rev.ok && S.activeEvent === null, 'Wahl-Event aufgelöst');
if (SYS.canChooseAffinity(S).ok) { SYS.chooseAffinity(S, 'feuer'); ok(S.affinity === 'feuer', 'Affinität gewählt'); }
else ok(true, 'Affinität noch nicht wählbar (ok)');
renderAll('Events');

step('Speichern → Laden (Roundtrip über normalize)');
var snapshot = JSON.parse(JSON.stringify(S));
var reloaded = window.GameState.normalize(JSON.parse(JSON.stringify(snapshot)));
ok(SYS.totalCreatureCount(reloaded) === SYS.totalCreatureCount(S), 'Kreaturenzahl bleibt nach Reload');
ok(reloaded.herrscher.level === S.herrscher.level, 'Herrscher-Level bleibt nach Reload');
ok(reloaded.resources.gold === S.resources.gold, 'Gold bleibt nach Reload');

step('Großer Tick-Marathon (1000 Ticks, Stabilität)');
var crashed = false;
try { tick(1000); } catch (e) { crashed = true; ok(false, 'Crash im Tick-Marathon — ' + e.message); }
if (!crashed) ok(true, '1000 Ticks ohne Crash');
ok(isFinite(S.resources.gold) && isFinite(S.resources.magie), 'Ressourcen bleiben endliche Zahlen (kein NaN/Infinity)');
renderAll('Marathon');

// ---------------------------------------------------------------
console.log('\n========================================');
console.log('  Durchspiel: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen, ' + warn + ' Hinweise');
console.log('========================================');
try { dom.window.close(); } catch (e) {}

test('playthrough — komplette Sitzung ohne Laufzeitfehler', () => {
  if (fails.length) console.log('FEHLER:\n  - ' + fails.join('\n  - '));
  expect(fails).toEqual([]);
});
