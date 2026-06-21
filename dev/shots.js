/* dev/shots.js — Handy-Screenshots via Playwright/Chromium.
   Lädt die echte index.html im Handy-Viewport, befüllt den Stand
   leicht und fotografiert alle Tabs + ein Modal. NICHT Teil des Spiels.
   Aufruf:  bun run dev/shots.js                                       */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

var dir = path.join(import.meta.dir, '..');
var out = path.join(dir, 'dev', 'screenshots');
fs.mkdirSync(out, { recursive: true });
var fileUrl = 'file://' + path.join(dir, 'index.html');

(async function () {
  var browser = await chromium.launch();
  var ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
  });
  var page = await ctx.newPage();
  var errors = [];
  page.on('pageerror', function (e) { errors.push('pageerror: ' + e.message); });
  page.on('console', function (m) { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(fileUrl, { waitUntil: 'load' });
  await page.waitForSelector('#tabbar .tab');

  async function shot(tab, name) {
    await page.evaluate(function (t) { window.GameUI.activeTab = t; window.GameUI.renderTabbar(); window.GameUI.render(); window.scrollTo(0, 0); }, tab);
    await page.waitForTimeout(180);
    await page.screenshot({ path: path.join(out, name + '.png') });
    console.log('  📸 ' + name + '.png');
  }

  // Frischer Stand: Onboarding (gegatete Tabs + „Als Nächstes" + Zuschauer-Modus)
  await page.evaluate(function () { window.__TEMPEST__.stopLoop(); });
  await shot('uebersicht', '0-onboarding');

  // Stand für aussagekräftige Bilder befüllen
  await page.evaluate(function () {
    var T = window.__TEMPEST__;
    var S = T.state, SYS = T.SYS;
    S.reich = 'Tempest'; S.herrscher.name = 'Schleimfürst';
    S.resources.gold += 4000; S.resources.material += 4000; S.resources.magie += 4000;
    S.resources.wissen += 400; S.resources.seelen += 400; S.resources.nahrung += 200;
    S.buildings.magieturm = 3; S.buildings.mine = 2; S.buildings.farm = 2; S.buildings.markt = 1;
    S.buildings.forschungsgilde = 2; S.buildings.wohnbezirk = 6; S.buildings.beschwoerungskreis = 3;
    S.buildings.schmiede = 2; S.buildings.labyrinth = 1;
    S.herrscher.stage = 3;
    SYS.summon(S, 'schreckenswolf'); SYS.summon(S, 'skelett'); SYS.summon(S, 'oger');
    var gob = S.creatures.filter(function (c) { return c.speciesId === 'goblin'; })[0];
    SYS.nameCreature(S, gob.uid, 'Goldzahn', 'wuterich'); SYS.evolve(S, gob.uid, 'hobgoblin'); SYS.addCreatureXp(S, gob, 3000);
    SYS.learnSkill(S, gob.uid, 'kriegstanz');
    var sl = S.creatures.filter(function (c) { return c.speciesId === 'schleim'; })[0];
    SYS.nameCreature(S, sl.uid, 'Tempest', 'arkanist');
    var it = SYS.craft(S, 'magistahlklinge').item; SYS.equipItem(S, it.uid, gob.uid);
    SYS.craft(S, 'magieamulett'); SYS.craft(S, 'bestienklaue');
    // Forschung freischalten (zeigt den Forschungsbaum + höhere Magie-Tiers)
    S.resources.wissen += 3000;
    ['r_arkane_grundlagen', 'r_ruestkammer', 'r_effiziente_bauten', 'r_seelenkunde', 'r_kriegslehre'].forEach(function (id) { SYS.doResearch(S, id); });
    SYS.learnMagic(S, 'magiestrom'); SYS.learnMagic(S, 'feuerlanze');
    SYS.learnMagic(S, 'windschritt'); SYS.learnMagic(S, 'todesstrahl');
    // Endgame-Features für die Bilder: Herrscher-Stufe (Fusion + Affinität)
    SYS.chooseAffinity(S, 'feuer');
    var jobs = ['armee', 'magie', 'material', 'armee', 'wissen', 'armee'];
    S.creatures.forEach(function (c, i) { c.job = jobs[i % jobs.length]; });
    S.buildings.arena = 3;
    var legion = SYS.createArmyGroup(S, gob.uid, 'Goldzahns Jura-Legion');
    if (legion.ok) {
      SYS.recruitTroops(S, legion.group.id, 'goblin', 50);
      SYS.recruitTroops(S, legion.group.id, 'schleim', 20);
      SYS.moveArmyGroup(S, legion.group.id, 'wald');
    }
    SYS.addRulerXp(S, 900);
    // Bedrohung für den Karten-Screenshot sichtbar machen
    S.claimedRegions.push('wald'); S.claimedRegions.push('hoehlen'); SYS.scheduleRaid(S);
    SYS.syncUnlocks(S); SYS.syncQuests(S);
    window.GameUI.refresh();
  });

  await shot('uebersicht', '1-uebersicht');
  await shot('reich', '2-reich');
  await shot('kreaturen', '3-kreaturen');
  await shot('magie', '4-magie');
  await shot('schmiede', '5-schmiede');
  await shot('karte', '6-karte');

  // Modal-Aufnahme: Expedition
  await page.evaluate(function () { window.GameUI.activeTab = 'karte'; window.GameUI.render(); window.GameUI.openExpeditionModal(window.GameData.region('wald')); });
  await page.waitForTimeout(180);
  await page.screenshot({ path: path.join(out, '7-expedition-modal.png') });
  console.log('  📸 7-expedition-modal.png');

  // Modal-Aufnahme: Chimära-Fusion
  await page.evaluate(function () { window.GameUI.activeTab = 'kreaturen'; window.GameUI.render(); window.GameUI.openFusionModal(); });
  await page.waitForTimeout(180);
  await page.screenshot({ path: path.join(out, '8-fusion-modal.png') });
  console.log('  📸 8-fusion-modal.png');

  // Modal-Aufnahme: Hilfe / Erklärung
  await page.evaluate(function () { window.GameUI.openHelpModal('kreaturen'); });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(out, '9-hilfe-modal.png') });
  console.log('  📸 9-hilfe-modal.png');

  // Modal-Aufnahme: echtes taktisches Kampfsystem
  await page.evaluate(function () {
    var T = window.__TEMPEST__, S = T.state, SYS = T.SYS;
    SYS.closeCombat(S);
    SYS.startCombat(S, 'wald', [], true, 'normal');
    window.GameUI.openBattleModal();
  });
  await page.waitForSelector('.battle-canvas[data-assets-ready="1"]');
  await page.waitForTimeout(420);
  await page.screenshot({ path: path.join(out, '10-taktischer-kampf.png') });
  console.log('  📸 10-taktischer-kampf.png');

  // Modal-Aufnahme: sichtbarer Berater-Schritt
  await page.evaluate(function () {
    var T = window.__TEMPEST__, S = T.state;
    T.SYS.closeCombat(S); S.settings.watchDetailed = true;
    window.GameUI.showWatchAction({ text: 'Die Kampfarena wird auf Stufe 2 ausgebaut.' });
  });
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(out, '11-sichtbarer-auto-modus.png') });
  console.log('  📸 11-sichtbarer-auto-modus.png');

  // Modal-Aufnahme: Heroes-artige Armeegruppe
  await page.evaluate(function () {
    var S = window.__TEMPEST__.state;
    if (S.armyGroups.length) window.GameUI.openArmyModal(S.armyGroups[0]);
  });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(out, '12-armeegruppe.png') });
  console.log('  📸 12-armeegruppe.png');

  // Phase 22: prozedurales Echo-Netz und Detailmodal auf Handygröße.
  await page.evaluate(function () {
    var close = document.querySelector('.modal-close'); if (close) close.click();
    window.GameUI.activeTab = 'karte'; window.GameUI.render();
    var echo = document.querySelector('.echo-header'); if (echo) echo.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(180);
  await page.screenshot({ path: path.join(out, '12a-echo-map-mobile.png') });
  console.log('  📸 12a-echo-map-mobile.png');
  await page.evaluate(function () { window.GameUI.openEchoModal(window.GameSystems.availableEchoNodes(window.__TEMPEST__.state)[0]); });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(out, '12b-echo-modal-mobile.png') });
  console.log('  📸 12b-echo-modal-mobile.png');
  await page.evaluate(function () {
    var close = document.querySelector('.modal-close'); if (close) close.click();
    var T = window.__TEMPEST__, S = T.state, GD = window.GameData, GST = T.GST;
    window.__PHASE23_CREATURES__ = S.creatures;
    var lines = ['Geist','Greif','Baumhirte','Phönix','Kobold','Hasenmensch','Tengu','Meervolk','Untot','Dämon','Vampir','Golem','Insekt','Drache'];
    S.creatures = lines.map(function (line) { return GST.newCreature(S, GD.creatures.filter(function (sp) { return sp.line === line; })[0].id); });
    window.GameUI.activeTab = 'kreaturen'; window.GameUI.render();
    var portrait = document.querySelector('.sprite-extended'); if (portrait) portrait.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(160);
  await page.screenshot({ path: path.join(out, '12c-phase23-portraits-mobile.png') });
  console.log('  📸 12c-phase23-portraits-mobile.png');
  await page.evaluate(function () {
    var S = window.__TEMPEST__.state;
    S.creatures = window.__PHASE23_CREATURES__; delete window.__PHASE23_CREATURES__;
  });

  // Desktop-Abnahme: dieselbe Sitzung bei 1440×900 in der neuen Spiel-Shell.
  await page.evaluate(function () {
    var close = document.querySelector('.modal-close');
    if (close) close.click();
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await shot('uebersicht', '13-desktop-uebersicht');
  await shot('karte', '14-desktop-karte');
  await page.evaluate(function () { var map = document.querySelector('.strategy-map-viewport'); if (map) map.scrollIntoView({ block: 'start' }); });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(out, '14b-desktop-illustrated-map.png') });
  console.log('  📸 14b-desktop-illustrated-map.png');
  await page.evaluate(function () { var echo = document.querySelector('.echo-header'); if (echo) echo.scrollIntoView({ block: 'start' }); });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(out, '14a-desktop-echo-map.png') });
  console.log('  📸 14a-desktop-echo-map.png');
  await shot('reich', '16-desktop-reich');
  await shot('kreaturen', '17-desktop-kreaturen');
  await shot('magie', '18-desktop-magie');
  await shot('schmiede', '19-desktop-schmiede');
  await page.evaluate(function () {
    var T = window.__TEMPEST__, S = T.state, SYS = T.SYS;
    SYS.closeCombat(S);
    SYS.startCombat(S, 'wald', [], true, 'normal');
    window.GameUI.openBattleModal();
  });
  await page.waitForSelector('.battle-canvas[data-assets-ready="1"]');
  await page.waitForTimeout(420);
  await page.screenshot({ path: path.join(out, '15-desktop-kampf.png') });
  console.log('  📸 15-desktop-kampf.png');

  // Zweite typische Desktopgröße: keine horizontale Seitenüberbreite.
  await page.evaluate(function () { var close = document.querySelector('.modal-close'); if (close) close.click(); });
  await page.setViewportSize({ width: 1366, height: 768 });
  var desktopOverflow = await page.evaluate(function () {
    var tabs = ['uebersicht', 'reich', 'kreaturen', 'magie', 'schmiede', 'karte'];
    var bad = [];
    tabs.forEach(function (tab) {
      window.GameUI.activeTab = tab; window.GameUI.renderTabbar(); window.GameUI.render();
      if (document.documentElement.scrollWidth > window.innerWidth || document.body.scrollWidth > window.innerWidth) bad.push(tab);
    });
    return bad;
  });
  if (desktopOverflow.length) errors.push('desktop-overflow: ' + desktopOverflow.join(', '));
  else console.log('  ✓ Desktop-Regressionscheck 1366×768 ohne Seitenüberbreite');

  // Echter Browser-Regressionscheck: Reset darf durch beforeunload nicht zurückgespeichert werden.
  var resetOk = await page.evaluate(function () {
    var T = window.__TEMPEST__;
    T.GST.save(T.state);
    T.resetGame(true);
    window.dispatchEvent(new Event('beforeunload'));
    return localStorage.getItem(T.GST.SAVE_KEY) === null && T.isResetting();
  });
  if (!resetOk) errors.push('reset: Spielstand wurde nach beforeunload wiederhergestellt');
  else console.log('  ✓ Reset-Regressionscheck im Browser');

  await browser.close();
  if (errors.length) { console.log('\n⚠️ Laufzeitfehler im Browser:'); errors.forEach(function (e) { console.log('   ' + e); }); process.exit(1); }
  console.log('\nFertig — 25 Screenshots in dev/screenshots/, keine Browser-Fehler ✔');
})().catch(function (e) { console.error('FEHLER:', e); process.exit(1); });
