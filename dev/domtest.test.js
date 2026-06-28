/* dev/domtest.test.js — Headless-DOM-Test (bun:test + jsdom). Lädt die
   echte index.html, führt alle Skripte aus und prüft, dass die gesamte
   Oberfläche ohne Laufzeitfehler rendert. NICHT Teil des Spiels.
   Aufruf:  bun test dev/domtest.test.js                              */
import { test, expect } from "bun:test";
import { JSDOM } from "jsdom";

var dir = import.meta.dir + '/..';
var html = await Bun.file(dir + '/index.html').text();

var pass = 0, fail = 0, fails = [];
function ok(cond, msg) { if (cond) { pass++; } else { fail++; fails.push(msg); console.log('  ✗ ' + msg); } }
function tryRender(label, fn) { try { fn(); ok(true, label); } catch (e) { ok(false, label + ' — ' + e.message); console.log('     ' + (e.stack || '').split('\n')[1]); } }

var dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
var window = dom.window, document = window.document;

// Skripte in Reihenfolge im window-Scope ausführen (wie der Browser)
for (const f of ['js/data-tables.js', 'js/data.js', 'js/art-data.js', 'js/state.js', 'js/systems.js', 'js/systems-bestiary.js', 'js/systems-combat.js', 'js/systems-skirmish.js', 'js/systems-siege.js', 'js/systems-battle.js', 'js/systems-action.js', 'js/systems-contracts.js', 'js/systems-specializations.js', 'js/systems-bosses.js', 'js/achievements.js', 'js/completion-planner.js', 'js/systems-chronicle.js', 'js/render/canvas-core.js', 'js/render/effects.js', 'js/render/battle-scene.js', 'js/render/adventure-scene.js', 'js/render/action-scene.js', 'js/ui.js', 'js/ui-adventure.js', 'js/ui-progress.js', 'js/ui-contracts.js', 'js/ui-specializations.js', 'js/ui-bosses.js', 'js/ui-chronicle.js', 'js/ui-action.js', 'js/ui-siege.js', 'js/ui-battle.js', 'js/ui-action-combat.js', 'js/main.js']) {
  window.eval(await Bun.file(dir + '/' + f).text());
}

console.log('--- Globale Module ---');
ok(window.GameData && window.GameSystems && window.GameState && window.GameUI, 'alle Module geladen');
var T = window.__TEMPEST__;
ok(T && T.state, '__TEMPEST__ Laufzeit vorhanden');
T.stopLoop();

console.log('--- Grundgerüst gerendert ---');
ok(document.getElementById('resources').children.length === 6, 'Topbar: 6 Ressourcen-Chips');
ok(document.getElementById('tabbar').children.length === 3, 'Tabbar: anfangs 3 Tabs (Magie/Schmiede/Karte noch gegated)');
ok(document.getElementById('screen').children.length > 0, '#screen hat Inhalt (Übersicht)');
ok(document.getElementById('ruler-mini').textContent.indexOf('Lv') >= 0, 'Herrscher-Mini zeigt Level');
ok(document.querySelectorAll('#resources .ui-icon').length === 6, 'Topbar nutzt sechs einheitliche Ressourcensymbole');
ok(document.querySelectorAll('#tabbar .ui-icon').length === 3, 'sichtbare Tabs nutzen die lokale Symbolfamilie');
ok(document.querySelectorAll('#screen .scene-ambience > span').length === 7, 'Reichspanorama besitzt Wasser-, Rauch-, Banner- und Magieakzente');
ok(document.querySelectorAll('#screen .scene-status .ui-icon').length === 3, 'Panorama-Status nutzt die lokale Symbolfamilie');
ok(document.querySelectorAll('#screen .contract-card').length === 3, 'Auftragsbrett zeigt drei rotierende Ziele');
ok(document.querySelectorAll('#screen .profile-segment').length === 4, 'Auftragsbrett zeigt vier Auto-Profile');
ok(document.querySelectorAll('#screen .boss-entry').length === 4, 'Boss-Leiter zeigt vier feste Gegnerprofile');
ok(!!document.querySelector('#screen .boss-board'), 'Übersicht besitzt ein Boss-Leiter-Brett');
var wtBtn = document.getElementById('watch-toggle');
ok(!!wtBtn, 'Top-Bar hat einen Zuschauer-Modus-Toggle');
wtBtn.click();
ok(window.__TEMPEST__.state.settings.watch === true, 'Top-Bar-Toggle schaltet den Zuschauer-Modus ein');
ok(wtBtn.classList.contains('on'), 'Top-Bar-Toggle zeigt aktiven Zustand');
wtBtn.click();
ok(window.__TEMPEST__.state.settings.watch === false, 'Top-Bar-Toggle schaltet den Zuschauer-Modus wieder aus');

console.log('--- Alle Views rendern ---');
['uebersicht', 'reich', 'kreaturen', 'magie', 'schmiede', 'karte'].forEach(function (tab) {
  tryRender('View „' + tab + '"', function () {
    window.GameUI.activeTab = tab;
    window.GameUI.render();
    if (document.getElementById('screen').children.length === 0) throw new Error('leer');
  });
});

console.log('--- Tab-Klicks (echte Buttons) ---');
var tabbar = document.getElementById('tabbar');
for (var i = 0; i < tabbar.children.length; i++) {
  (function (idx) { tryRender('Klick Tab #' + idx, function () { tabbar.children[idx].click(); }); })(i);
}

console.log('--- Aktionen über die UI ---');
var s = T.state, SYS = window.GameSystems;
// genug Ressourcen
s.resources.gold += 5000; s.resources.material += 5000; s.resources.magie += 5000; s.resources.wissen += 500; s.resources.seelen += 500;
s.buildings.beschwoerungskreis = 3; s.buildings.wohnbezirk = 6;

tryRender('Alle 20 Kreaturenlinien besitzen lokale Portraits ohne Emoji-Fallback', function () {
  var artState = window.GameState.createDefault(), seenLines = {};
  artState.creatures = [];
  window.GameData.creatures.forEach(function (species) {
    if (seenLines[species.line]) return;
    seenLines[species.line] = true;
    artState.creatures.push(window.GameState.newCreature(artState, species.id));
  });
  artState.buildings.beschwoerungskreis = 10; artState.herrscher.stage = 6;
  window.GameUI.state = artState; window.GameUI.activeTab = 'kreaturen'; window.GameUI.render();
  var expectedSprites = ['slime','goblin','wolf','ogre','lizard','orc','spirit','griffin','treant','phoenix','kobold','rabbitfolk','tengu','merfolk','undead','demon','vampire','golem','insect','dragon'];
  if (!expectedSprites.every(function (id) { return !!document.querySelector('#screen .sprite-' + id); })) throw new Error('mindestens eine Linie nutzt weiter Emoji-Fallback');
  if (document.querySelectorAll('#screen .sprite-extended').length < 14) throw new Error('erweitertes Atlas ist nicht für alle 14 neuen Linien verdrahtet');
  window.GameUI.state = s;
});

tryRender('Reich rendern & "Bauen"-Button klicken', function () {
  window.GameUI.activeTab = 'reich'; window.GameUI.render();
  if (!document.querySelector('#screen .district-ledger')) throw new Error('kein materialisiertes Bezirksbrett');
  if (!document.querySelector('#screen .special-board')) throw new Error('strategische Ausrichtung fehlt');
  if (!document.querySelector('#screen .trophy-room')) throw new Error('Trophäenraum fehlt');
  if (!document.querySelector('#screen .chronicle-board')) throw new Error('Chronikraum fehlt');
  if (document.querySelectorAll('#screen .special-auto .profile-segment').length !== 6) throw new Error('Auto-Doktrinprofile fehlen');
  if (document.querySelectorAll('#screen .special-slot').length !== 2) throw new Error('frühe Bezirks-Slots fehlen');
  if (!document.querySelector('#screen .district-card .district-icon .ui-icon')) throw new Error('Gebäudesymbole fehlen');
  var btns = document.querySelectorAll('#screen .district-card .btn');
  var before = JSON.stringify(s.buildings);
  if (btns.length) btns[0].click();
  if (JSON.stringify(s.buildings) === before) throw new Error('kein Gebäude verändert');
});

tryRender('Doktrin- und Anführerschul-Modals', function () {
  window.GameUI.openDoctrineModal();
  if (document.querySelectorAll('#modal-root .doctrine-choice').length !== 5) throw new Error('Doktrin-Auswahl unvollständig');
  document.querySelector('.modal-close').click();
  var leader = window.GameState.newCreature(s, 'hobgoblin');
  leader.named = true; leader.armyGroupId = null; s.creatures.push(leader);
  window.GameUI.openLeaderSchoolModal(leader);
  if (document.querySelectorAll('#modal-root .doctrine-choice').length !== 5) throw new Error('Anführerschulen unvollständig');
  document.querySelector('.modal-close').click();
  s.creatures = s.creatures.filter(function (creature) { return creature.uid !== leader.uid; });
});

tryRender('Boss-Trophäen erscheinen im Reich und im Panorama', function () {
  s.bosses.defeated = ['jura_koloss'];
  s.bosses.hardDefeated = ['jura_koloss'];
  s.bosses.banners = 1;
  s.bosses.components.herzholz = 2;
  window.GameUI.activeTab = 'uebersicht'; window.GameUI.render();
  if (!document.querySelector('#screen .scene-trophies')) throw new Error('Panorama-Trophäe fehlt');
  window.GameUI.activeTab = 'reich'; window.GameUI.render();
  if (!document.querySelector('#screen .trophy-plaque')) throw new Error('Trophäenplakette fehlt');
  if (!document.querySelector('#screen .trophy-components')) throw new Error('Bosskomponente fehlt');
  s.bosses.defeated = []; s.bosses.hardDefeated = []; s.bosses.banners = 0; s.bosses.components = {};
});

tryRender('Kreatur beschwören über UI', function () {
  window.GameUI.activeTab = 'kreaturen'; window.GameUI.render();
  var n = SYS.totalCreatureCount(s);
  var btns = document.querySelectorAll('#screen .btn');
  var clicked = false;
  for (var j = 0; j < btns.length; j++) { if (btns[j].textContent.indexOf('Beschwören') >= 0 && !btns[j].hasAttribute('disabled')) { btns[j].click(); clicked = true; break; } }
  if (!clicked) throw new Error('kein Beschwören-Button aktiv');
  if (SYS.totalCreatureCount(s) !== n + 1) throw new Error('keine Kreatur zum Stapel hinzugefügt');
});

console.log('--- Modals bauen sich auf ---');
var c0 = s.creatures[1];
tryRender('Namens-Modal', function () { window.GameUI.openNameModal(c0); if (!document.querySelector('.modal')) throw new Error('kein Modal'); });
tryRender('Modal schließen', function () { document.querySelector('.modal-close').click(); if (document.getElementById('modal-root').children.length) throw new Error('nicht geschlossen'); });
// benennen, damit Evolution möglich ist
SYS.nameCreature(s, c0.uid, 'Test');
tryRender('Evolutions-Modal', function () { window.GameUI.openEvolveModal(c0); if (!document.querySelector('.modal')) throw new Error('kein Modal'); window.GameUI.closeModal ? 0 : 0; });
// Item schmieden für Ausrüst-Modal
s.buildings.schmiede = 2; var rc = SYS.craft(s, 'magistahlklinge');
tryRender('Ausrüst-Modal', function () { window.GameUI.openEquipModal(rc.item); if (!document.querySelector('.modal')) throw new Error('kein Modal'); });
tryRender('Expeditions-Modal', function () { window.GameUI.openExpeditionModal(window.GameData.region('wald')); if (!document.querySelector('.modal')) throw new Error('kein Modal'); });
tryRender('Herrscher-Modal', function () { window.GameUI.openRulerModal(); if (!document.querySelector('.modal')) throw new Error('kein Modal'); });
tryRender('Kompendium-Modal (Erfolge/Statistik/Bestiarium)', function () {
  window.GameUI.openCodexModal('erfolge');
  if (!document.querySelector('.modal.codex-modal')) throw new Error('kein Codex-Modal');
  if (document.querySelectorAll('#modal-root .ach-card').length !== window.GameAchievements.total()) throw new Error('Erfolgskarten fehlen');
  window.GameUI.openCodexModal('statistik');
  if (!document.querySelector('#modal-root .stat-cell')) throw new Error('keine Statistikzellen');
  window.GameUI.openCodexModal('bestiarium');
  if (document.querySelectorAll('#modal-root .beast-card').length !== window.GameData.creatures.length) throw new Error('Bestiarium unvollständig');
  if (!document.querySelector('#modal-root .beast-card.locked')) throw new Error('keine gesperrten Formen markiert');
  if (!document.querySelector('#modal-root .hunt-board')) throw new Error('Bestiarium-Jagdboard fehlt');
  if (!document.querySelector('#modal-root .beast-hint')) throw new Error('Bestiarium-Hinweise fehlen');
  if (!document.querySelector('#modal-root .hunt-card .btn')) throw new Error('Köder-Aktion fehlt');
  var previousSeen = s.seenSpecies.slice();
  s.seenSpecies = Array.from(new Set(s.seenSpecies.concat(SYS.bestiaryLineSpecies('Goblin').map(function (sp) { return sp.id; }))));
  window.GameUI.openCodexModal('bestiarium');
  if (!document.querySelector('#modal-root .hunt-card.elite-ready')) throw new Error('Elite-Jagdziel fehlt');
  if (!document.querySelector('#modal-root .hunt-card.elite-ready .elite-portrait')) throw new Error('Elite-Portrait-Rahmen fehlt');
  s.seenSpecies = previousSeen;
  document.querySelector('.modal-close').click();
});
tryRender('Reichskrise mit mehrstufiger Entscheidungs-UI', function () {
  window.GameContracts.startCrisis(s, 'nahrung');
  window.GameUI.activeTab = 'uebersicht'; window.GameUI.render();
  if (!document.querySelector('#screen .crisis-banner')) throw new Error('Krisenhinweis fehlt');
  window.GameUI.openCrisisModal();
  if (!document.querySelector('.modal.crisis-modal')) throw new Error('kein Krisen-Modal');
  if (document.querySelectorAll('#modal-root .crisis-choice').length < 2) throw new Error('Krisenentscheidungen fehlen');
  document.querySelector('.modal-close').click();
  s.contracts.crisis = null;
});
tryRender('Einstellungs-Modal (Effektstufe umschaltbar)', function () {
  window.GameUI.openSettingsModal();
  if (!document.querySelector('.modal.settings-modal')) throw new Error('kein Einstellungs-Modal');
  var prev = s.settings.effects;
  var offBtn = Array.prototype.filter.call(document.querySelectorAll('#modal-root .opt-choice .btn'), function (b) { return b.textContent === 'Aus'; })[0];
  if (!offBtn) throw new Error('keine Effektstufen-Knöpfe');
  offBtn.click();
  if (s.settings.effects !== 'off') throw new Error('Effektstufe nicht übernommen');
  s.settings.effects = prev; // Zustand für Folgetests wiederherstellen
  document.querySelector('.modal-close').click();
});
tryRender('Sturmeinsatz-Karte und aktives Konter-Gefecht', function () {
  window.GameUI.activeTab = 'uebersicht'; window.GameUI.render();
  if (!document.querySelector('#screen .skirmish-card')) throw new Error('keine prominente Sturmeinsatz-Karte');
  window.GameUI.openSkirmishHub();
  if (document.querySelectorAll('#modal-root .skirmish-mission').length !== 3) throw new Error('Missionen fehlen');
  if (document.querySelectorAll('#modal-root .skirmish-mission-tags').length !== 3) throw new Error('Gegnerprofile oder Modifikator-Vorschau fehlt');
  if (document.querySelectorAll('#modal-root .skirmish-mission-copy small').length < 3) throw new Error('Optionalziel-Vorschau fehlt');
  if (document.querySelectorAll('#modal-root .skirmish-stance').length !== window.GameSystems.SKIRMISH_STANCES.length) throw new Error('Haltungs-Picker fehlt');
  var berserk = Array.prototype.filter.call(document.querySelectorAll('#modal-root .skirmish-stance'), function (b) { return b.textContent.indexOf('Berserker') >= 0; })[0];
  if (!berserk) throw new Error('Berserker-Haltung fehlt');
  berserk.click(); // wählt Haltung, rendert Hub neu
  if (window.GameSystems.skirmishStatus(s).stanceId !== 'berserker') throw new Error('Haltung nicht gewählt');
  var startBtn = Array.prototype.filter.call(document.querySelectorAll('#modal-root .skirmish-mission .btn'), function (b) { return b.textContent.indexOf('Start') >= 0 && !b.hasAttribute('disabled'); })[0];
  if (!startBtn) throw new Error('kein spielbarer Einsatz');
  startBtn.click();
  if (!s.skirmish.active || !document.querySelector('#modal-root .skirmish-battle')) throw new Error('Gefecht nicht gestartet');
  if (s.skirmish.active.stanceId !== 'berserker') throw new Error('Gefecht nutzt gewählte Haltung nicht');
  if (document.querySelectorAll('#modal-root .skirmish-encounter > div').length !== 3) throw new Error('Profil, Modifikator und Optionalziel nicht sichtbar');
  if (!document.querySelector('#modal-root .skirmish-phase')) throw new Error('Gegnerphase fehlt');
  var counter = window.GameSystems.skirmishStatus(s).intent.counter;
  var actionBtn = document.querySelector('#modal-root .action-' + counter);
  if (!actionBtn) throw new Error('Konteraktion fehlt');
  if (actionBtn.textContent.indexOf('✓ kontert') < 0) throw new Error('aktueller Konter nicht direkt am Button markiert');
  s.skirmish.active.enemyHp = Math.floor(s.skirmish.active.enemyMaxHp / 2) + 1;
  s.skirmish.active.heroAttack = 1;
  actionBtn.click();
  if (!s.skirmish.active || s.skirmish.active.combo !== 1) throw new Error('Konter baut keine Kombo auf');
  if (!document.querySelector('#modal-root .skirmish-phase.boss')) throw new Error('Bossphase wird nach Phasenwechsel nicht angezeigt');
  if (document.querySelector('#modal-root .skirmish-telegraph').textContent.indexOf('BOSSPHASE') < 0) throw new Error('Bossphase nicht in der Absicht angekündigt');
  var retreat = Array.prototype.filter.call(document.querySelectorAll('#modal-root .btn'), function (b) { return b.textContent.indexOf('Rückzug') >= 0; })[0];
  if (!retreat) throw new Error('Rückzug fehlt');
  retreat.click();
  if (s.skirmish.active) throw new Error('Rückzug beendet Einsatz nicht');
});
tryRender('Aktive Belagerungsabwehr (Karte + Verteidigung)', function () {
  s.claimedRegions = s.claimedRegions.length ? s.claimedRegions : ['wald'];
  s.raid = { rivalId: 'clayron', power: 120, atTick: s.tick + 18, warnTick: s.tick };
  window.GameUI.activeTab = 'uebersicht'; window.GameUI.render();
  if (!document.querySelector('#screen .siege-card')) throw new Error('keine Belagerungs-Karte bei drohendem Raid');
  window.GameUI.openSiegeModal();
  if (!s.siege.active || !document.querySelector('.modal.siege-modal')) throw new Error('Belagerung nicht gestartet');
  if (!document.querySelector('#modal-root .action-verstaerken')) throw new Error('Verteidigungsaktion fehlt');
  document.querySelector('#modal-root .action-verstaerken').click();
  if (!s.siege.active && !s.siege.lastResult) throw new Error('Aktion ohne Wirkung');
  // Aufräumen für Folgetests
  if (s.siege.active) { window.GameSystems.abortSiege(s); }
  s.raid = null; window.GameUI.activeTab = 'uebersicht'; window.GameUI.render();
});
tryRender('Tactical-RPG-Schlacht (Gitter + Aktionen)', function () {
  s.claimedRegions = s.claimedRegions.length ? s.claimedRegions : ['wald'];
  var uids = s.creatures.slice(0, 3).map(function (c) { return c.uid; });
  var start = window.GameBattle.startBattle(s, 'wald', uids, true, 99);
  if (!start.ok) throw new Error('Schlacht nicht gestartet: ' + start.reason);
  window.GameUI.openTacticalBattle();
  if (!document.querySelector('.modal.tb-modal')) throw new Error('kein Schlacht-Modal');
  if (document.querySelectorAll('#modal-root .tb-cell').length !== 8 * 6) throw new Error('Gitter unvollständig');
  if (!document.querySelector('#modal-root .tb-token.party')) throw new Error('keine Party-Einheit');
  if (window.GameBattle.isPlayerTurn(s)) {
    var waitBtn = Array.prototype.filter.call(document.querySelectorAll('#modal-root .tb-actions .btn'), function (b) { return b.textContent.indexOf('Warten') >= 0; })[0];
    if (!waitBtn) throw new Error('keine Aktionsknöpfe');
    waitBtn.click(); // führt eine Aktion aus + Gegnerzüge
  }
  window.GameBattle.abortBattle(s); s.tacticalBattle = null;
  var close = document.querySelector('.modal-close'); if (close) close.click();
  window.GameUI.activeTab = 'uebersicht'; window.GameUI.render();
});
tryRender('Echtzeit-Action-Gefecht (Übersichtskarte + Canvas-Modal)', function () {
  s.claimedRegions = s.claimedRegions.length ? s.claimedRegions : ['wald'];
  if (!s.metrics) s.metrics = {}; s.metrics.named = Math.max(1, s.metrics.named || 0);   // Karte freischalten
  var card = window.GameUI.buildActionCombatCard();
  if (!card || !card.classList.contains('action-combat-card')) throw new Error('keine Action-Gefecht-Karte');
  var uids = s.creatures.slice(0, 3).map(function (c) { return c.uid; });
  var start = window.GameActionCombat.start(s, 'wald', uids, true, 7);
  if (!start.ok) throw new Error('Gefecht nicht gestartet: ' + start.reason);
  window.GameUI.openActionCombat();
  if (!document.querySelector('.modal.ac-modal')) throw new Error('kein Action-Modal');
  if (!document.querySelector('#modal-root canvas.ac-stage')) throw new Error('keine Canvas-Bühne');
  if (!s.actionBattle) throw new Error('kein laufendes Gefecht im Zustand');
  if (window.GameUI._teardownActionScene) window.GameUI._teardownActionScene();
  window.GameActionCombat.abort(s);
  var close2 = document.querySelector('.modal-close'); if (close2) close2.click();
  window.GameUI.activeTab = 'uebersicht'; window.GameUI.render();
});
tryRender('Last-Epoch-artiger Herrscher-Talentbaum', function () {
  s.herrscher.level = Math.max(8, s.herrscher.level);
  window.GameUI.openTalentModal();
  if (document.querySelectorAll('#modal-root .talent-branch').length !== 3) throw new Error('nicht drei Talent-Zweige');
  if (document.querySelectorAll('#modal-root .talent-node').length !== window.GameData.talents.length) throw new Error('Talentknoten fehlen');
  var plus = Array.prototype.filter.call(document.querySelectorAll('#modal-root .talent-node .btn'), function (b) { return b.textContent.indexOf('+') >= 0 && !b.hasAttribute('disabled'); })[0];
  if (!plus) throw new Error('kein investierbarer Talentknoten');
  var before = window.GameSystems.talentPointsSpent(s); plus.click();
  if (window.GameSystems.talentPointsSpent(s) !== before + 1) throw new Error('Talentpunkt nicht investiert');
  document.querySelector('.modal-close').click();
});
// Aspekt-Wahl im Namens-Modal + Skill-Modal
var c1 = s.creatures[2];
tryRender('Namens-Modal Aspekt-Klick', function () {
  window.GameUI.openNameModal(c1);
  var cards = document.querySelectorAll('#modal-root .opt-list .card');
  if (cards.length < 2) throw new Error('keine Aspekt-Karten gerendert');
  cards[1].click();                                  // anderen Aspekt wählen
  document.querySelector('.modal-close').click();
});
SYS.nameCreature(s, c1.uid, 'Magier', 'arkanist');
s.resources.magie += 2000; s.resources.seelen += 200;
tryRender('Skill-Modal', function () { window.GameUI.openSkillModal(c1); if (!document.querySelector('.modal')) throw new Error('kein Modal'); document.querySelector('.modal-close').click(); });
// Bedrohung: Karte mit aktivem Raid + Gegenangriffs-Modal
s.claimedRegions.push('wald'); s.creatures.forEach(function (c) { c.job = 'armee'; });
SYS.scheduleRaid(s);
tryRender('Karte mit aktivem Raid', function () { window.GameUI.activeTab = 'karte'; window.GameUI.render(); if (document.getElementById('screen').children.length === 0) throw new Error('leer'); });
s.rivalProgress = s.rivalProgress || {}; s.rivalProgress.clayron = SYS.RIVAL_COUNTER_REPELS;
tryRender('Gegenangriffs-Modal', function () { window.GameUI.openCounterModal(window.GameData.rival('clayron')); if (!document.querySelector('.modal')) throw new Error('kein Modal'); document.querySelector('.modal-close').click(); });
// Events & Affinität
s.activeEvent = 'haendler'; s.resources.gold += 500;
tryRender('Event-Modal (Wahl)', function () { window.GameUI.openEventModal('haendler'); if (!document.querySelector('.modal')) throw new Error('kein Modal'); document.querySelector('.modal-close').click(); });
tryRender('Übersicht mit offenem Ereignis', function () { window.GameUI.activeTab = 'uebersicht'; window.GameUI.render(); });
s.herrscher.stage = 2; s.affinity = null;
tryRender('Affinitäts-Modal', function () { window.GameUI.openAffinityModal(); if (!document.querySelector('.modal')) throw new Error('kein Modal'); document.querySelector('.modal-close').click(); });
tryRender('Magie-Tab mit Affinitäts-Wahl', function () { window.GameUI.activeTab = 'magie'; window.GameUI.render(); if (document.getElementById('screen').children.length === 0) throw new Error('leer'); });

console.log('--- Freischaltung, Hilfe, Fusion, Zuschauer-Modus ---');
// Tabs schalten sich nach und nach frei
s.buildings.forschungsgilde = 1; s.buildings.schmiede = Math.max(1, s.buildings.schmiede);
if ((s.metrics.named || 0) < 1) SYS.nameCreature(s, s.creatures[0].uid, 'Erst');
window.GameUI.renderTabbar();
ok(document.getElementById('tabbar').children.length === 6, 'Alle 6 Tabs nach Freischaltung sichtbar');
// Forschungsbaum + Magie-Tier-Gating im Magie-Tab
tryRender('Magie-Tab mit Forschungsbaum', function () {
  window.GameUI.activeTab = 'magie'; window.GameUI.render();
  var txt = document.getElementById('screen').textContent;
  if (txt.indexOf('Forschung') < 0) throw new Error('kein Forschungsbaum');
});
tryRender('Magie-Tab trennt Feldmagie, Reichsrituale und Ausbau', function () {
  s.buildings.arkane_akademie = 3; s.resources.magie += 5000; s.resources.wissen += 5000; s.resources.seelen += 500;
  window.GameUI.activeTab = 'magie'; window.GameUI.render();
  var txt = document.getElementById('screen').textContent;
  if (txt.indexOf('Kampfzauber') < 0 || txt.indexOf('Abenteuerzauber') < 0 || txt.indexOf('Reichsrituale') < 0 || txt.indexOf('Königreichsausbau') < 0) throw new Error('Magieebenen nicht klar getrennt');
});
tryRender('Abenteuerzauber-Modal wirkt auf eine Armee', function () {
  if (!SYS.isFieldMagicLearned(s, 'abenteuer_windmarsch')) SYS.learnFieldMagic(s, 'abenteuer_windmarsch');
  var main = SYS.rulerArmyGroup(s); main.movement = 0;
  window.GameUI.openAdventureMagicModal(window.GameData.fieldSpell('abenteuer_windmarsch'));
  var cast = Array.prototype.filter.call(document.querySelectorAll('#modal-root .btn'), function (b) { return b.textContent.indexOf('Zauber wirken') >= 0 && !b.hasAttribute('disabled'); })[0];
  if (!cast) throw new Error('kein wirkbarer Abenteuerzauber');
  cast.click();
  if (main.movement !== SYS.armyMovementMax(s, main)) throw new Error('Windmarsch ohne Wirkung');
});
tryRender('Forschung über UI abschließen', function () {
  s.resources.wissen += 500;
  window.GameUI.activeTab = 'magie'; window.GameUI.render();
  var before = (s.research || []).length;
  var btns = document.querySelectorAll('#screen .btn');
  for (var i = 0; i < btns.length; i++) { if (btns[i].textContent.indexOf('Erforschen') >= 0 && !btns[i].hasAttribute('disabled')) { btns[i].click(); break; } }
  if ((s.research || []).length === before) throw new Error('keine Forschung abgeschlossen');
});
// Hilfe-Modal
tryRender('Hilfe-Modal', function () { window.GameUI.openHelpModal('kreaturen'); if (!document.querySelector('.modal')) throw new Error('kein Modal'); document.querySelector('.modal-close').click(); });
// Fusion (ab Herrscher-Stufe „Dämonenlord")
s.herrscher.stage = 3; s.resources.magie += 8000; s.resources.seelen += 3000; s.buildings.wohnbezirk = 10;
s.buildings.magieturm = 12;
s.creatures.forEach(function (c) { c.job = 'frei'; c.woundedUntil = 0; });   // niemand busy/verwundet
while (s.creatures.filter(function (c) { return c.named; }).length < 2) {
  SYS.summon(s, 'goblin');
  var candidate = s.creatures.filter(function (c) { return !c.named; })[0];
  if (!candidate || !SYS.nameCreature(s, candidate.uid, '', 'wuterich').ok) break;
}
(s.armyGroups || []).filter(function (g) { return !g.rulerLed; }).slice().forEach(function (g) { SYS.disbandArmyGroup(s, g.id); });
tryRender('Fusions-Modal', function () { window.GameUI.openFusionModal(); if (!document.querySelector('.modal')) throw new Error('kein Modal'); });
tryRender('Fusion über Modal ausführen', function () {
  var before = s.creatures.length;
  var btns = document.querySelectorAll('#modal-root .btn'), fbtn = null;
  for (var i = 0; i < btns.length; i++) { if (btns[i].textContent.indexOf('Fusionieren') >= 0) { fbtn = btns[i]; break; } }
  if (!fbtn) throw new Error('kein Fusions-Button');
  fbtn.click();
  if (s.creatures.length !== before - 1) throw new Error('Katalysator nicht verbraucht');
});
// Zuschauer-Modus: Auto-Play + Vorspulen
s.settings.watch = true;
tryRender('Zuschauer-Modus onTick (Auto-Play)', function () { var ev = SYS.tick(s); window.GameUI.onTick(ev); });
tryRender('Vorspulen (fastForward)', function () { var t0 = s.tick; window.GameUI.fastForward(20); if (s.tick < t0 + 20) throw new Error('Zeit nicht vorgespult'); });
s.settings.watch = false;

console.log('--- Phase 8–10 UI: sichtbarer Auto-Modus, Loadout, Kampf ---');
tryRender('Sichtbarer Zuschauer-Modus öffnet Aktionsdialog', function () {
  var sw = window.GameState.createDefault();
  sw.settings.watch = true; sw.settings.watchDetailed = true; sw.settings.watchCooldownUntil = 0;
  window.GameUI.state = sw;
  var ev = SYS.tick(sw); window.GameUI.onTick(ev);
  if (!document.querySelector('[data-watch-dialog="1"]')) throw new Error('kein sichtbarer Berater-Dialog');
  document.querySelector('.modal-close').click();
});
tryRender('Namenssiegel wird in der Kreaturen-UI erklärt', function () {
  window.GameUI.state = s; window.GameUI.activeTab = 'kreaturen'; window.GameUI.render();
  if (document.getElementById('screen').textContent.indexOf('Namenssiegel') < 0) throw new Error('kein Namenssiegel');
  if (!document.querySelector('#screen .creature-art.sprite-slime') || !document.querySelector('#screen .creature-art.sprite-goblin')) throw new Error('erkennbare Kreaturen-Assets fehlen');
});
tryRender('Diablo-artige Ausrüstungsplätze rendern', function () {
  window.GameUI.activeTab = 'schmiede'; window.GameUI.render();
  if (document.querySelectorAll('#screen .loadout-slot').length < window.GameData.equipSlots.length) throw new Error('Loadout unvollständig');
});
tryRender('Runenschmiede zeigt Komponenten, Baupläne und begrenztes Arsenal', function () {
  s.buildings.schmiede = 3; s.resources.wissen += 10000; s.resources.material += 10000; s.resources.magie += 10000; s.resources.seelen += 10000;
  SYS.addForgeMaterials(s, { runenstaub: 20, magistahlkern: 20, seelenkristall: 20, drachenessenz: 20 });
  window.GameUI.activeTab = 'schmiede'; window.GameUI.render();
  if (document.querySelectorAll('#screen .forge-material').length !== window.GameData.forgeMaterials.length) throw new Error('Komponentenleiste unvollständig');
  if (document.querySelectorAll('#screen .blueprint-card').length !== window.GameData.recipes.length) throw new Error('Bauplanarchiv unvollständig');
  if (!document.querySelector('#screen .arsenal-panel')) throw new Error('kein langlebiges Arsenal');
});
tryRender('Bauplan lässt sich über die Schmiede-UI entschlüsseln', function () {
  window.GameUI.activeTab = 'schmiede'; window.GameUI.render();
  var before = s.unlockedRecipes.length;
  var unlock = Array.prototype.filter.call(document.querySelectorAll('#screen .blueprint-card.locked .btn'), function (b) { return b.textContent.indexOf('Bauplan entschlüsseln') >= 0 && !b.hasAttribute('disabled'); })[0];
  if (!unlock) throw new Error('kein entschlüsselbarer Bauplan');
  unlock.click();
  if (s.unlockedRecipes.length !== before + 1) throw new Error('Bauplan nicht freigeschaltet');
});
tryRender('Qualitätsaufwertung besitzt Vorschau und verändert dasselbe Item', function () {
  var before = SYS.itemQuality(rc.item);
  window.GameUI.openTemperModal(rc.item.uid);
  if (!document.querySelector('.temper-modal') || document.getElementById('modal-root').textContent.indexOf('NACH DEM AUFWERTEN') < 0) throw new Error('keine Aufwertungsvorschau');
  var upgrade = Array.prototype.filter.call(document.querySelectorAll('#modal-root .btn'), function (b) { return b.textContent.indexOf('Qualität auf') >= 0 && !b.hasAttribute('disabled'); })[0];
  if (!upgrade) throw new Error('Aufwertung trotz Komponenten nicht möglich');
  upgrade.click();
  if (SYS.itemQuality(rc.item) !== before + 1) throw new Error('Itemqualität nicht erhöht');
});
tryRender('Taktische Gruppenauswahl rendert', function () {
  window.GameUI.openBattleSetupModal(window.GameData.region('wald'));
  if (document.getElementById('modal-root').textContent.indexOf('Kampf beginnen') < 0) throw new Error('keine Kampfauswahl');
  document.querySelector('.modal-close').click();
});
tryRender('Aktive taktische Kampfbühne rendert Aktionen, LP und MP', function () {
  var sc = window.GameState.createDefault(); sc.herrscher.level = 15; sc.claimedRegions = [];
  window.GameUI.state = sc;
  var r = SYS.startCombat(sc, 'wald', [], true, 'normal'); if (!r.ok) throw new Error(r.reason);
  window.GameUI.openBattleModal();
  var txt = document.getElementById('modal-root').textContent;
  if (txt.indexOf('RUNDE') < 0 || txt.indexOf('MP') < 0 || txt.indexOf('Angriff') < 0 || txt.indexOf('Warten') < 0) throw new Error('Kampfbühne unvollständig');
  if (document.querySelectorAll('#modal-root .battle-cell').length !== 35 || !document.querySelector('#modal-root .battle-initiative')) throw new Error('7×5-Raster oder Initiative fehlt');
  if (!document.querySelector('#modal-root .battle-canvas') || !document.querySelector('#modal-root .battle-effects-select')) throw new Error('Canvas oder Effektsteuerung fehlt');
  var reachable = document.querySelector('#modal-root .battle-cell.reachable');
  if (!reachable) throw new Error('kein erreichbares Bewegungsfeld');
  reachable.click();
  if (sc.activeCombat.log.join(' ').indexOf('bewegt sich') < 0) throw new Error('Rasterbewegung nicht ausgeführt');
  document.querySelector('.modal-close').click();
  window.GameUI.state = s;
});

console.log('--- Ziele / Quests ---');
tryRender('Übersicht zeigt aktuelles Ziel', function () {
  var sQ = window.GameState.createDefault(); window.GameUI.state = sQ; SYS.syncQuests(sQ);
  window.GameUI.activeTab = 'uebersicht'; window.GameUI.render();
  if (document.querySelector('#screen .quest-card') == null) throw new Error('keine Ziel-Karte');
  if (document.getElementById('screen').textContent.indexOf('Ziel 1/') < 0) throw new Error('kein Ziel-Fortschritt');
});
tryRender('Ziel-Abschluss meldet sich über onTick', function () {
  var sQ = window.GameUI.state;
  sQ.buildings.magieturm = 2;
  var ev = SYS.tick(sQ);
  if (!(ev.questsCompleted && ev.questsCompleted.length >= 1)) throw new Error('kein Ziel abgeschlossen');
  window.GameUI.onTick(ev);
  window.GameUI.state = s;   // Original-Zustand für Folgetests wiederherstellen
});

console.log('--- Tick über die UI ---');
tryRender('onTick rendert ohne Fehler', function () {
  window.GameUI.activeTab = 'uebersicht';
  var ev = SYS.tick(s);
  window.GameUI.onTick(ev);
});

console.log('--- Armeegruppen & strategische Karten-UI (Phase 11) ---');
var sArmy = window.GameState.createDefault();
sArmy.resources.gold = 99999; sArmy.resources.nahrung = 99999; sArmy.resources.magie = 99999;
sArmy.buildings.beschwoerungskreis = 3; sArmy.buildings.arena = 3;
var armyLeader = sArmy.creatures[0]; var autoArmyResult = SYS.nameCreature(sArmy, armyLeader.uid, 'Kobalt');
var autoArmy = autoArmyResult.autoArmy;
SYS.disbandArmyGroup(sArmy, autoArmy.id);
window.GameUI.state = sArmy;
tryRender('Armee-Aufstellungsmodal zeigt benannten Anführer', function () {
  window.GameUI.openCreateArmyModal();
  if (document.getElementById('modal-root').textContent.indexOf('Kobalt') < 0) throw new Error('Anführer fehlt');
  document.querySelector('.modal-close').click();
});
var armyGroup = SYS.createArmyGroup(sArmy, armyLeader.uid, 'Kobalts Hundertschaft').group;
SYS.recruitTroops(sArmy, armyGroup.id, 'schleim', 20);
tryRender('Strategische Karte zeigt steuerbare Armeefigur', function () {
  window.GameUI.activeTab = 'karte'; window.GameUI.render();
  if (!document.querySelector('#screen .strategy-map')) throw new Error('keine Weltkarte');
  if (!document.querySelector('#screen .strategy-map-canvas') || !document.querySelector('#screen .map-inspector')) throw new Error('Canvas-Karte oder Ortsinspektor fehlt');
  if (!document.querySelector('#screen .map-routes') || document.querySelectorAll('#screen .map-node-resource, #screen .map-node-discovery').length < 8) throw new Error('keine echte Abenteuerkarte mit Fundorten');
  if (!document.querySelector('#screen .map-army-marker')) throw new Error('keine Armeefigur');
  if (document.getElementById('screen').textContent.indexOf('Kobalts Hundertschaft') < 0) throw new Error('keine Armee-Karte');
  var targetNode = document.querySelector('#screen .map-node-resource'); targetNode.click();
  if (document.querySelector('#screen .map-inspector').textContent.indexOf('Direkte Wege') < 0) throw new Error('Ortsauswahl aktualisiert Inspektor nicht');
});
sArmy.claimedRegions = ['wald', 'hoehlen'];
var echoUi = SYS.ensureEchoMap(sArmy);
tryRender('Echo-Netz rendert prozedurale Pfade, Knoten und Zyklusstatus', function () {
  window.GameUI.activeTab = 'karte'; window.GameUI.render();
  if (!document.querySelector('#screen .echo-map') || !document.querySelector('#screen .echo-routes')) throw new Error('Echo-Karte fehlt');
  if (document.querySelectorAll('#screen .echo-node').length !== 12) throw new Error('falsche Echo-Knotenzahl');
  if (!document.querySelector('#screen .echo-node.available') || document.getElementById('screen').textContent.indexOf('Zyklus 1') < 0) throw new Error('erreichbarer Echo-Pfad fehlt');
});
tryRender('Echo-Modal zeigt Beute, Affixe und drei Risikostufen', function () {
  window.GameUI.openEchoModal(SYS.availableEchoNodes(sArmy)[0]);
  var txt = document.getElementById('modal-root').textContent;
  if (txt.indexOf('Angekündigte Beute') < 0 || txt.indexOf('Aktive Gegneraffixe') < 0) throw new Error('Echo-Details fehlen');
  if (txt.indexOf('Sicher') < 0 || txt.indexOf('Normal') < 0 || txt.indexOf('Riskant') < 0) throw new Error('Echo-Risikoauswahl fehlt');
  document.querySelector('.modal-close').click();
});
tryRender('Armeeverwaltung rendert Truppen und Rekrutierung', function () {
  window.GameUI.openArmyModal(armyGroup);
  var txt = document.getElementById('modal-root').textContent;
  if (txt.indexOf('20 Basistruppen') < 0 || txt.indexOf('+10') < 0) throw new Error('Armeeverwaltung unvollständig');
  document.querySelector('.modal-close').click();
});
SYS.moveArmyGroup(sArmy, armyGroup.id, 'wald');
tryRender('Kartenangriff bietet drei Risikostufen', function () {
  window.GameUI.openArmyAttackModal(armyGroup);
  var txt = document.getElementById('modal-root').textContent;
  if (txt.indexOf('Sicher') < 0 || txt.indexOf('Normal') < 0 || txt.indexOf('Riskant') < 0) throw new Error('Risikoauswahl fehlt');
  document.querySelector('.modal-close').click();
});
var mapWin = SYS.attackWithArmyGroup(sArmy, armyGroup.id, 'sicher');
SYS.moveArmyGroup(sArmy, armyGroup.id, 'site_manaquelle');
tryRender('Fundort-Modal zeigt Wache und Außenanlagen-Produktion', function () {
  window.GameUI.openMapSiteModal(SYS.strategicNode('site_manaquelle'));
  var txt = document.getElementById('modal-root').textContent;
  if (!mapWin.won || txt.indexOf('Wache') < 0 || txt.indexOf('pro Sekunde') < 0) throw new Error('Fundort-Details fehlen');
});
tryRender('Ressourcenanlage über die UI sichern und ausbauen', function () {
  var buttons = document.querySelectorAll('#modal-root .btn'), action = null;
  for (var i = 0; i < buttons.length; i++) if (buttons[i].textContent.indexOf('Kobalts Hundertschaft') >= 0) { action = buttons[i]; break; }
  if (!action) throw new Error('keine stationierte Armee auswählbar');
  action.click();
  if (!SYS.mapSiteClaimed(sArmy, 'manaquelle')) throw new Error('Anlage nicht gesichert');
  var upgrade = Array.prototype.filter.call(document.querySelectorAll('#modal-root .btn'), function (b) { return b.textContent.indexOf('Anlage ausbauen') >= 0; })[0];
  if (!upgrade) throw new Error('kein Ausbau-Button');
  upgrade.click();
  if (sArmy.mapSiteLevels.manaquelle !== 2) throw new Error('Anlage nicht ausgebaut');
  document.querySelector('.modal-close').click();
});
window.GameUI.state = s;

tryRender('vollständiger Run öffnet die New-Game+-Auswahl', function () {
  s.achievements = window.GameAchievements.ACHIEVEMENTS.map(function (entry) { return entry.id; });
  s.seenSpecies = window.GameData.creatures.map(function (entry) { return entry.id; });
  s.claimedRegions = window.GameData.regions.map(function (entry) { return entry.id; });
  window.GameUI.state = s; window.GameUI.activeTab = 'reich'; window.GameUI.render();
  if (document.querySelector('#screen .chronicle-board .tag-ok') == null) throw new Error('Run nicht als versiegelbar markiert');
  window.GameUI.openChronicleRunModal();
  if (!document.querySelector('.modal.chronicle-modal')) throw new Error('kein Chronik-Modal');
  if (document.querySelectorAll('#modal-root .chronicle-select').length !== 4) throw new Error('Start-, Challenge-, Tempo- oder Bannerauswahl fehlt');
  if (document.querySelectorAll('#modal-root select[aria-label="Challenge"] option').length !== window.GameChronicle.CHALLENGES.length) throw new Error('Challenges unvollständig');
  if (document.querySelectorAll('#modal-root select[aria-label="Startlinie"] option').length < 2) throw new Error('erste Meta-Startlinie nicht sofort verfügbar');
  if (document.querySelectorAll('#modal-root select[aria-label="Simulationsgeschwindigkeit"] option').length < 2) throw new Error('2×-Simulation nicht sofort verfügbar');
  if (!document.querySelector('#modal-root .chronicle-challenge-info').textContent) throw new Error('Challenge-Regel fehlt');
  if (!document.querySelector('#modal-root .chronicle-seed')) throw new Error('Seed-Eingabe fehlt');
  document.querySelector('.modal-close').click();
});

console.log('--- Spielstand-Reset (Phase 11) ---');
tryRender('Alter Nazarick-Save-Key wird auf Tempest-v2 migriert', function () {
  window.localStorage.clear();
  window.localStorage.setItem(window.GameState.LEGACY_SAVE_KEY, JSON.stringify(window.GameState.createDefault()));
  var migrated = window.GameState.load();
  if (!migrated || !window.localStorage.getItem(window.GameState.SAVE_KEY)) throw new Error('neuer Save-Key fehlt');
  if (window.localStorage.getItem(window.GameState.LEGACY_SAVE_KEY)) throw new Error('alter Save-Key nicht entfernt');
});
tryRender('Reset bleibt trotz beforeunload wirklich gelöscht', function () {
  window.GameState.save(s);
  if (!window.localStorage.getItem(window.GameState.SAVE_KEY)) throw new Error('Teststand nicht gespeichert');
  T.resetGame(true); // Testmodus: löschen, aber jsdom nicht navigieren
  window.dispatchEvent(new window.Event('beforeunload'));
  if (window.localStorage.getItem(window.GameState.SAVE_KEY)) throw new Error('beforeunload hat den gelöschten Stand wiederhergestellt');
  if (!T.isResetting()) throw new Error('Reset-Sperre nicht aktiv');
});

console.log('\n========================================');
console.log('  DOM-Test: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
console.log('========================================');
try { dom.window.close(); } catch (e) {}

test('domtest — gesamte Oberfläche rendert ohne Laufzeitfehler', () => {
  if (fails.length) console.log('FEHLER:\n  - ' + fails.join('\n  - '));
  expect(fails).toEqual([]);
});
