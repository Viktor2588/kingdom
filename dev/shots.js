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
    await page.evaluate(function (t) {
      window.GameUI.activeTab = t; window.GameUI.renderTabbar(); window.GameUI.render(); window.scrollTo(0, 0);
      var screen = document.getElementById('screen'); if (screen) screen.scrollTop = 0;
    }, tab);
    await page.waitForTimeout(180);
    if (tab === 'karte') {
      await page.waitForTimeout(900);
      var mapReady = await page.evaluate(function () {
        var canvas = document.querySelector('.strategy-map-canvas');
        return { exists: !!canvas, ready: canvas && canvas.dataset.assetsReady, connected: canvas && canvas.isConnected, display: canvas && getComputedStyle(canvas).display, scene: typeof window.GameAdventureScene };
      });
      if (!mapReady.exists || mapReady.ready !== '1') throw new Error('Abenteuerkarten-Canvas wurde nicht bereit: ' + JSON.stringify(mapReady));
    }
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
    SYS.setDoctrine(S, 'research', 'Screenshot-Profil');
    S.specializations.districts = ['archive', 'runeforge', 'bazaar'];
    SYS.assignLeaderSchool(S, gob.uid, 'mage');
    gob.schoolId = 'mage';
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
    S.settings.effects = 'reduced';
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
  await page.evaluate(function () {
    var T = window.__TEMPEST__, S = T.state, pacing = window.GamePacing.ensure(S);
    S.tick = 720;
    pacing.overlay = true;
    pacing.lastMeaningfulTick = 710;
    pacing.lastQuestTick = 680;
    pacing.actionCounts = { build: 14, combat: 9, research: 6, contract: 5, creature: 4, decision: 2 };
    window.GamePacing.EVENT_IDS.forEach(function (id, index) {
      pacing.events[id] = { count: 3 + index, lastTick: 706 - index * 9, totalGap: 120 + index * 12, maxGap: 62 + index * 8 };
    });
    pacing.snapshot = window.GamePacing.snapshot(S);
    window.GameUI.render();
    var overlay = document.querySelector('.pacing-overlay'); if (overlay) overlay.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(150);
  var phase53Mobile = await page.evaluate(function () {
    return document.querySelectorAll('.pacing-event').length === 7 &&
      document.documentElement.scrollWidth <= window.innerWidth;
  });
  if (!phase53Mobile) errors.push('phase53-mobile: Pacing-Auslöser fehlen oder Seite besitzt Überbreite');
  await page.screenshot({ path: path.join(out, 'phase53-pacing-mobile.png') });
  console.log('  📸 phase53-pacing-mobile.png');
  await page.evaluate(function () { window.__TEMPEST__.state.pacing.overlay = false; window.GameUI.render(); });
  await page.evaluate(function () {
    var S = window.__TEMPEST__.state;
    window.GameDirector.observe(S, { text: '🏘️ Wohnbezirk Stufe 7.' });
    S.seenSpecies.push('daemonenfuerst');
    S.claimedRegions.push('sumpf');
    S.tick += 20;
    window.GameDirector.observe(S, { text: '🏆 Giftsumpf erobert.' });
    window.GameUI.render();
    var feed = document.querySelector('.director-feed'); if (feed) feed.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(150);
  if (await page.locator('.director-entry').count() < 2) errors.push('phase47-mobile: Director-Feed fehlt');
  await page.screenshot({ path: path.join(out, 'phase47-director-mobile.png') });
  console.log('  📸 phase47-director-mobile.png');
  await page.evaluate(function () { var board = document.querySelector('.contract-board'); if (board) board.scrollIntoView({ block: 'start' }); });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(out, 'phase49-contracts-mobile.png') });
  console.log('  📸 phase49-contracts-mobile.png');
  await page.evaluate(function () {
    var T = window.__TEMPEST__;
    window.GameContracts.startCrisis(T.state, 'nahrung');
    window.GameUI.activeTab = 'uebersicht';
    window.GameUI.render();
    window.GameUI.openCrisisModal();
  });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(out, 'phase49-crisis-mobile.png') });
  console.log('  📸 phase49-crisis-mobile.png');
  await page.evaluate(function () {
    var T = window.__TEMPEST__, close = document.querySelector('.modal-close');
    if (close) close.click();
    T.state.contracts.crisis = null;
  });
  await page.evaluate(function () {
    var T = window.__TEMPEST__, S = T.state, SYS = T.SYS;
    S.bosses.defeated = ['jura_koloss'];
    S.bosses.hardDefeated = ['jura_koloss'];
    S.bosses.banners = 1;
    S.bosses.components.herzholz = 2;
    SYS.bestiaryLineSpecies('Goblin').forEach(function (species) {
      if (S.seenSpecies.indexOf(species.id) < 0) S.seenSpecies.push(species.id);
    });
    window.GameUI.activeTab = 'uebersicht'; window.GameUI.render();
    var board = document.querySelector('.boss-board'); if (board) board.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(150);
  var phase51BossBoard = await page.evaluate(function () {
    return document.querySelectorAll('.boss-entry').length === 4 &&
      !!document.querySelector('.boss-entry.done') &&
      document.querySelectorAll('.boss-entry.done .boss-actions .btn').length === 3;
  });
  if (!phase51BossBoard) errors.push('phase51-boss-board: Profile, Meisterschaft oder Kampfvarianten fehlen');
  await page.screenshot({ path: path.join(out, 'phase51-boss-ladder-mobile.png') });
  console.log('  📸 phase51-boss-ladder-mobile.png');
  await page.evaluate(function () {
    window.GameUI.openCodexModal('bestiarium');
    var elite = document.querySelector('.hunt-card.elite-ready'); if (elite) elite.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(150);
  var phase51Elite = await page.evaluate(function () {
    var elite = document.querySelector('.hunt-card.elite-ready');
    return !!elite && !!elite.querySelector('.elite-portrait') &&
      Array.from(elite.querySelectorAll('.btn')).some(function (button) { return button.textContent.indexOf('Elite jagen') >= 0; });
  });
  if (!phase51Elite) errors.push('phase51-elite: Jagdziel, Portrait oder Aktion fehlt');
  await page.screenshot({ path: path.join(out, 'phase51-elite-mobile.png') });
  console.log('  📸 phase51-elite-mobile.png');
  await page.evaluate(function () {
    var close = document.querySelector('.modal-close'); if (close) close.click();
    var T = window.__TEMPEST__, S = T.state;
    S.achievements = window.GameAchievements.ACHIEVEMENTS.map(function (entry) { return entry.id; });
    S.seenSpecies = window.GameData.creatures.map(function (entry) { return entry.id; });
    S.claimedRegions = window.GameData.regions.map(function (entry) { return entry.id; });
    S.chronicle.generation = 2;
    S.chronicle.challengeId = 'standard';
    S.chronicle.seed = 2026;
    S.chronicle.simSpeed = 2;
    S.chronicle.bannerId = 'jura_koloss';
    S.chronicle.meta.seals = 2;
    S.chronicle.meta.maxSimSpeed = 2;
    S.chronicle.meta.unlockedVariants = ['slime', 'undead', 'spirit'];
    S.chronicle.meta.unlockedBanners = ['jura_koloss'];
    S.chronicle.meta.bestTicks.standard = 6089;
    S.chronicle.meta.archives = [{
      id: 'chronicle_1_42_6581', generation: 1, seed: 42, challengeId: 'standard',
      challengeName: 'Freie Chronik', ticks: 6581, deaths: 29, bossAttempts: 4,
      rarestSpecies: { id: 'katastrophendrache', name: 'Katastrophendrache', icon: '🐉', rank: 'SS' }
    }];
    window.GameUI.activeTab = 'reich'; window.GameUI.render();
    var board = document.querySelector('.chronicle-board'); if (board) board.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(150);
  var phase52Chronicle = await page.evaluate(function () {
    var board = document.querySelector('.chronicle-board');
    return !!board && !!board.querySelector('.tag-ok') && !!board.querySelector('.chronicle-archive-row');
  });
  if (!phase52Chronicle) errors.push('phase52-chronicle: Abschlussstatus oder Archivzeile fehlt');
  await page.screenshot({ path: path.join(out, 'phase52-chronicle-mobile.png') });
  console.log('  📸 phase52-chronicle-mobile.png');
  await page.evaluate(function () { window.GameUI.openChronicleRunModal(); });
  await page.waitForTimeout(150);
  var phase52Modal = await page.evaluate(function () {
    return !!document.querySelector('.chronicle-modal') &&
      document.querySelectorAll('.chronicle-select').length === 4 &&
      document.querySelectorAll('select[aria-label="Challenge"] option').length === window.GameChronicle.CHALLENGES.length;
  });
  if (!phase52Modal) errors.push('phase52-modal: Start-, Challenge-, Tempo- oder Bannerauswahl fehlt');
  await page.screenshot({ path: path.join(out, 'phase52-new-run-mobile.png') });
  console.log('  📸 phase52-new-run-mobile.png');
  await page.evaluate(function () { var close = document.querySelector('.modal-close'); if (close) close.click(); });
  await shot('reich', '2-reich');
  await page.evaluate(function () { var board = document.querySelector('.special-board'); if (board) board.scrollIntoView({ block: 'start' }); });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(out, 'phase50-specializations-mobile.png') });
  console.log('  📸 phase50-specializations-mobile.png');
  await page.evaluate(function () { window.GameUI.openDoctrineModal(); });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(out, 'phase50-doctrines-mobile.png') });
  console.log('  📸 phase50-doctrines-mobile.png');
  await page.evaluate(function () { var close = document.querySelector('.modal-close'); if (close) close.click(); });
  await shot('kreaturen', '3-kreaturen');
  await shot('magie', '4-magie');
  await shot('schmiede', '5-schmiede');
  await shot('karte', '6-karte');
  await page.screenshot({ path: path.join(out, 'phase34-adventure-mobile.png') });
  console.log('  📸 phase34-adventure-mobile.png');
  var mobileMapInteraction = await page.evaluate(function () {
    var canvas = document.querySelector('.strategy-map-canvas'), node = window.GameSystems.strategicNode('site_manaquelle');
    if (!canvas || !node) return false;
    var rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: rect.left + rect.width * node.x / 100, clientY: rect.top + rect.height * node.y / 100 }));
    var inspector = document.querySelector('.map-inspector');
    return canvas.dataset.assetsReady === '1' && inspector && inspector.textContent.indexOf('Manaquelle') >= 0;
  });
  if (!mobileMapInteraction) errors.push('adventure-map: Canvas-Hit-Test oder Ortsinspektor reagiert nicht');
  else console.log('  ✓ Canvas-Ortswahl aktualisiert den Inspector');

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

  // Phase 42: Gegnerprofile/Modifikatoren/Ziele im Hub und sichtbare Bossphase.
  await page.evaluate(function () {
    var close = document.querySelector('.modal-close'); if (close) close.click();
    var T = window.__TEMPEST__; T.SYS.retreatSkirmish(T.state);
    window.GameUI.openSkirmishHub();
  });
  await page.waitForTimeout(150);
  var phase42Hub = await page.evaluate(function () {
    return {
      missions: document.querySelectorAll('.skirmish-mission').length,
      tags: document.querySelectorAll('.skirmish-mission-tags').length,
      objectives: Array.from(document.querySelectorAll('.skirmish-mission-copy small')).filter(function (n) { return n.textContent.indexOf('Optionalziel') >= 0; }).length
    };
  });
  if (phase42Hub.missions !== 3 || phase42Hub.tags !== 3 || phase42Hub.objectives < 1) errors.push('phase42-hub: Profil-/Modifikator-/Zielvorschau unvollständig ' + JSON.stringify(phase42Hub));
  await page.screenshot({ path: path.join(out, '12d-phase42-hub-mobile.png') });
  console.log('  📸 12d-phase42-hub-mobile.png');
  await page.evaluate(function () {
    var close = document.querySelector('.modal-close'); if (close) close.click();
    var T = window.__TEMPEST__, S = T.state, SYS = T.SYS;
    SYS.startSkirmish(S, 'grenzalarm', 'waechter');
    S.skirmish.active.enemyHp = Math.floor(S.skirmish.active.enemyMaxHp / 2) + 1;
    S.skirmish.active.heroAttack = 1;
    SYS.skirmishAction(S, SYS.skirmishStatus(S).intent.counter);
    window.GameUI.openSkirmishBattle();
  });
  await page.waitForTimeout(150);
  var phase42Boss = await page.evaluate(function () {
    var status = window.GameSystems.skirmishStatus(window.__TEMPEST__.state);
    return status.active && status.active.phase === 'boss' && !!document.querySelector('.skirmish-phase.boss') && document.querySelector('.skirmish-telegraph').textContent.indexOf('BOSSPHASE') >= 0;
  });
  if (!phase42Boss) errors.push('phase42-boss: Bossphase oder Telegraphiestatus fehlt');
  await page.screenshot({ path: path.join(out, '12e-phase42-boss-mobile.png') });
  console.log('  📸 12e-phase42-boss-mobile.png');
  await page.evaluate(function () { window.GameSystems.retreatSkirmish(window.__TEMPEST__.state); var close = document.querySelector('.modal-close'); if (close) close.click(); });

  // Desktop-Abnahme: dieselbe Sitzung bei 1440×900 in der neuen Spiel-Shell.
  await page.evaluate(function () {
    var close = document.querySelector('.modal-close');
    if (close) close.click();
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await shot('uebersicht', '13-desktop-uebersicht');
  await page.evaluate(function () {
    window.__TEMPEST__.state.pacing.overlay = true;
    window.GameUI.render();
    var overlay = document.querySelector('.pacing-overlay'); if (overlay) overlay.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(150);
  var phase53Desktop = await page.evaluate(function () {
    var overlay = document.querySelector('.pacing-overlay');
    return !!overlay && overlay.querySelectorAll('.pacing-event').length === 7 &&
      document.documentElement.scrollWidth <= window.innerWidth;
  });
  if (!phase53Desktop) errors.push('phase53-desktop: Dashboard fehlt oder Seite besitzt Überbreite');
  await page.screenshot({ path: path.join(out, 'phase53-pacing-desktop.png') });
  console.log('  📸 phase53-pacing-desktop.png');
  await page.evaluate(function () { window.__TEMPEST__.state.pacing.overlay = false; window.GameUI.render(); });
  await page.evaluate(function () { var feed = document.querySelector('.director-feed'); if (feed) feed.scrollIntoView({ block: 'center' }); });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(out, 'phase47-director-desktop.png') });
  console.log('  📸 phase47-director-desktop.png');
  var phase52Desktop = await page.evaluate(function () {
    var mark = document.querySelector('.scene-chronicle');
    return !!mark && mark.textContent.indexOf('Chronik 3') >= 0 && document.documentElement.scrollWidth <= window.innerWidth;
  });
  if (!phase52Desktop) errors.push('phase52-desktop: Chronikmarker fehlt oder Seite besitzt Überbreite');
  await page.screenshot({ path: path.join(out, 'phase52-chronicle-desktop.png') });
  console.log('  📸 phase52-chronicle-desktop.png');
  await page.evaluate(function () { var board = document.querySelector('.contract-board'); if (board) board.scrollIntoView({ block: 'start' }); });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(out, 'phase49-contracts-desktop.png') });
  console.log('  📸 phase49-contracts-desktop.png');
  await shot('karte', '14-desktop-karte');
  await page.screenshot({ path: path.join(out, 'phase34-adventure-desktop.png') });
  console.log('  📸 phase34-adventure-desktop.png');
  await page.evaluate(function () { var map = document.querySelector('.strategy-map-viewport'); if (map) map.scrollIntoView({ block: 'start' }); });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(out, '14b-desktop-illustrated-map.png') });
  console.log('  📸 14b-desktop-illustrated-map.png');
  await page.evaluate(function () { var echo = document.querySelector('.echo-header'); if (echo) echo.scrollIntoView({ block: 'start' }); });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(out, '14a-desktop-echo-map.png') });
  console.log('  📸 14a-desktop-echo-map.png');
  await shot('reich', '16-desktop-reich');
  await page.evaluate(function () { var room = document.querySelector('.trophy-room'); if (room) room.scrollIntoView({ block: 'start' }); });
  await page.waitForTimeout(150);
  var phase51Trophies = await page.evaluate(function () {
    var room = document.querySelector('.trophy-room');
    return !!room && room.querySelectorAll('.trophy-plaque').length >= 2 &&
      !!room.querySelector('.trophy-components') && room.scrollWidth <= room.clientWidth;
  });
  if (!phase51Trophies) errors.push('phase51-trophies: Plaketten, Komponenten oder Breitenbegrenzung fehlen');
  await page.screenshot({ path: path.join(out, 'phase51-trophies-desktop.png') });
  console.log('  📸 phase51-trophies-desktop.png');
  await page.evaluate(function () { var board = document.querySelector('.special-board'); if (board) board.scrollIntoView({ block: 'start' }); });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(out, 'phase50-specializations-desktop.png') });
  console.log('  📸 phase50-specializations-desktop.png');
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

  await page.evaluate(function () {
    var close = document.querySelector('.modal-close'); if (close) close.click();
    var T = window.__TEMPEST__, S = T.state, SYS = T.SYS;
    SYS.closeCombat(S); SYS.startSkirmish(S, 'daemonenvorstoss', 'arkanist');
    S.skirmish.active.enemyHp = Math.floor(S.skirmish.active.enemyMaxHp / 2) + 1;
    S.skirmish.active.heroAttack = 1;
    SYS.skirmishAction(S, SYS.skirmishStatus(S).intent.counter);
    window.GameUI.openSkirmishBattle();
  });
  await page.waitForTimeout(180);
  var phase42Desktop = await page.evaluate(function () {
    var modal = document.querySelector('.skirmish-modal.battle');
    return !!modal && !!modal.querySelector('.skirmish-phase.boss') && modal.scrollWidth <= modal.clientWidth;
  });
  if (!phase42Desktop) errors.push('phase42-desktop: Bossmodal fehlt oder besitzt horizontale Überbreite');
  await page.screenshot({ path: path.join(out, '20-phase42-boss-desktop.png') });
  console.log('  📸 20-phase42-boss-desktop.png');
  await page.evaluate(function () { window.GameSystems.retreatSkirmish(window.__TEMPEST__.state); var close = document.querySelector('.modal-close'); if (close) close.click(); });

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
  console.log('\nFertig — 46 Screenshots in dev/screenshots/, keine Browser-Fehler ✔');
})().catch(function (e) { console.error('FEHLER:', e); process.exit(1); });
