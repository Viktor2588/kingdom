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
for (const f of ['js/data.js', 'js/state.js', 'js/systems.js', 'js/ui.js', 'js/main.js']) {
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

tryRender('Reich rendern & "Bauen"-Button klicken', function () {
  window.GameUI.activeTab = 'reich'; window.GameUI.render();
  var btns = document.querySelectorAll('#screen .btn');
  var before = JSON.stringify(s.buildings);
  if (btns.length) btns[0].click();
  if (JSON.stringify(s.buildings) === before) throw new Error('kein Gebäude verändert');
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
  if (!document.querySelector('#screen .map-routes') || document.querySelectorAll('#screen .map-node-resource, #screen .map-node-discovery').length < 8) throw new Error('keine echte Abenteuerkarte mit Fundorten');
  if (!document.querySelector('#screen .map-army-marker')) throw new Error('keine Armeefigur');
  if (document.getElementById('screen').textContent.indexOf('Kobalts Hundertschaft') < 0) throw new Error('keine Armee-Karte');
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
