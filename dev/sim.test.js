/* dev/sim.test.js — Headless-Logiktest (bun:test). Lädt die DOM-freien
   Module und prüft den kompletten Spielkreislauf. NICHT Teil des Spiels.
   Aufruf:  bun test dev/sim.test.js                                    */
import { test, expect } from "bun:test";
import "../js/data.js";
import "../js/state.js";
import "../js/systems.js";

var GD = globalThis.GameData, GST = globalThis.GameState, SYS = globalThis.GameSystems;

var pass = 0, fail = 0, fails = [];
function ok(cond, msg) { if (cond) { pass++; } else { fail++; fails.push(msg); console.log('  ✗ ' + msg); } }
function approx(a, b, eps) { return Math.abs(a - b) <= (eps || 1e-6); }

console.log('--- Daten-Integrität ---');
ok(GD.creatures.length >= 40, 'mind. 40 Kreaturenformen (' + GD.creatures.length + ')');
ok(['kobold', 'hasenmensch', 'tengu', 'meerling'].every(function (id) { return !!GD.creature(id); }), 'zusätzliche Tensura-nahe Völker sind spielbar');
ok(['dryadenrat', 'zwergenkarawane', 'geisterfest', 'bestiengesandte'].every(function (id) { return !!GD.event(id); }), 'vier neue Welt-/Völkerereignisse vorhanden');
var spritePath = import.meta.dir + '/../assets/creature-sprites.png';
ok(Bun.file(spritePath).size > 100000, 'generiertes Kreaturen-Sprite-Sheet ist als lokales Spielasset vorhanden');
var extendedSpritePath = import.meta.dir + '/../assets/creature-sprites-extended.png';
var adventureMapPath = import.meta.dir + '/../assets/tempest-adventure-map.png';
ok(Bun.file(extendedSpritePath).size > 1000000, 'erweitertes transparentes Portrait-Atlas ist als lokales Spielasset vorhanden');
ok(Bun.file(adventureMapPath).size > 1000000, 'illustrierte Abenteuerkarte ist als lokales Spielasset vorhanden');
// jede evolvesTo-Zielspezies existiert
var badEvo = [];
GD.creatures.forEach(function (sp) {
  (sp.evolvesTo || []).forEach(function (ev) { if (!GD.creature(ev.to)) badEvo.push(sp.id + '->' + ev.to); });
});
ok(badEvo.length === 0, 'alle Evolutionsziele existieren' + (badEvo.length ? ' ABER: ' + badEvo.join(',') : ''));
// jede Skill-Referenz existiert
var badSkill = [];
GD.creatures.forEach(function (sp) { if (sp.skill && !GD.skill(sp.skill)) badSkill.push(sp.id + ':' + sp.skill); });
ok(badSkill.length === 0, 'alle Kreatur-Skills existieren' + (badSkill.length ? ' ABER: ' + badSkill.join(',') : ''));
// Basiswerte gesetzt
ok(GD.creature('schleim').base.mag > 0, 'Basiswerte berechnet (schleim.mag=' + GD.creature('schleim').base.mag + ')');
// Power steigt mit Rang
var ssE = GD.creature('katastrophendrache').power / GD.creature('goblin').power;
ok(ssE > 25, 'SS deutlich stärker als E (Faktor ' + ssE.toFixed(1) + 'x)');
// Rezept-Slots passen zu einer Ausrüstungsposition; Set-Referenzen existieren
var slotTypes = {}; GD.equipSlots.forEach(function (p) { slotTypes[p.type] = true; });
var badSlot = [], badSet = [];
GD.recipes.forEach(function (r) {
  if (!slotTypes[r.slot]) badSlot.push(r.id + ':' + r.slot);
  if (r.set && !GD.set(r.set)) badSet.push(r.id + ':' + r.set);
});
ok(badSlot.length === 0, 'alle Rezept-Slots gültig' + (badSlot.length ? ' ABER: ' + badSlot.join(',') : ''));
ok(badSet.length === 0, 'alle Rezept-Set-Refs existieren' + (badSet.length ? ' ABER: ' + badSet.join(',') : ''));
// Regionen bilden eine aufsteigende Kette (Kampfkraft streng steigend)
var ascending = true;
for (var ri = 1; ri < GD.regions.length; ri++) { if (GD.regions[ri].power <= GD.regions[ri - 1].power) ascending = false; }
ok(ascending, 'Regionen aufsteigend (' + GD.regions.map(function (r) { return r.power; }).join('<') + ')');
var badLinks = [], nodeIds = {};
GD.strategicNodes.forEach(function (n) { nodeIds[n.id] = n; });
GD.strategicNodes.forEach(function (n) {
  (n.links || []).forEach(function (id) {
    if (!nodeIds[id]) badLinks.push(n.id + '->' + id);
    else if ((nodeIds[id].links || []).indexOf(n.id) < 0) badLinks.push(n.id + '->' + id + ' nicht symmetrisch');
  });
  if (n.siteId && !GD.strategicSite(n.siteId)) badLinks.push(n.id + ':site=' + n.siteId);
});
ok(badLinks.length === 0, 'Abenteuerkarten-Wege und Fundorte sind vollständig' + (badLinks.length ? ' ABER: ' + badLinks.join(',') : ''));
ok(GD.strategicSites.length >= 8 && GD.strategicSites.some(function (x) { return x.kind === 'discovery'; }), 'Ressourcenanlagen und Entdeckungsorte vorhanden');
// Gebäude-Bonus-Schlüssel sind bekannte Bonus-Keys
var knownBonus = { produktionAll: 1, produktionMagie: 1, armee: 1, verteidigung: 1, summonRang: 1, wissen: 1, xp: 1, seelen: 1, drop: 1, summonRabatt: 1, bauRabatt: 1,
  kapazitaet: 1, expedTempo: 1, heiltempo: 1, threatRuhe: 1, beuteRang: 1, evoRabatt: 1, produce: 1 };
var badBE = [];
GD.buildings.forEach(function (bd) { if (bd.effect) for (var k in bd.effect) { if (!knownBonus[k]) badBE.push(bd.id + ':' + k); } });
ok(badBE.length === 0, 'alle Gebäude-Effekt-Keys bekannt' + (badBE.length ? ' ABER: ' + badBE.join(',') : ''));

console.log('--- Standardzustand ---');
var s = GST.createDefault();
ok(SYS.totalCreatureCount(s) === 3 && s.creatures.length === 2, '3 Startkreaturen in 2 Artenstapeln');
ok(s.armyGroups.length === 1 && s.armyGroups[0].rulerLed && s.armyGroups[0].troops.goblin === 2, 'alle Startkreaturen hängen an der Herrscherarmee');
ok(SYS.capacity(s) >= 8, 'Kapazität >= 8 (' + SYS.capacity(s) + ')');
ok(s.resources.magie === 60, 'Start-Magie 60');

console.log('--- Produktion & Tick ---');
var p = SYS.production(s);
ok(p.rates.magie > 0, 'Magie-Rate > 0 (Magieturm) = ' + p.rates.magie.toFixed(2));
ok(typeof p.rates.nahrung === 'number', 'Nahrungs-Netto berechnet (' + p.rates.nahrung.toFixed(2) + ')');
var magie0 = s.resources.magie;
for (var i = 0; i < 30; i++) SYS.tick(s);
ok(s.tick === 30, '30 Ticks gezählt');
ok(s.resources.magie > magie0, 'Magie ist nach Ticks gestiegen (' + magie0 + '->' + s.resources.magie.toFixed(1) + ')');

console.log('--- Bauen ---');
s.resources.gold += 1000; s.resources.material += 1000; s.resources.magie += 1000;
var beforeMine = s.buildings.mine;
var rb = SYS.build(s, 'mine');
ok(rb.ok && s.buildings.mine === beforeMine + 1, 'Mine gebaut');
var c1 = SYS.buildingCost(s, 'mine'), c2 = SYS.buildingCost(s, 'mine');
ok(JSON.stringify(c1) === JSON.stringify(c2), 'Baukosten stabil/abfragbar');
// Gebäude-Bonus: Arena steigert Armee-Kampfkraft
var armeeVor = SYS.computeBonuses(s).armee;
s.buildings.arena = (s.buildings.arena || 0) + 2;
ok(approx(SYS.computeBonuses(s).armee, armeeVor + 0.10), 'Arena (2 Stufen) gibt +10 % Armee-Bonus');
s.buildings.arena = 0;

console.log('--- Beschwören ---');
s.buildings.beschwoerungskreis = 3;       // erlaubt bis Rang C
s.resources.magie += 2000; s.resources.seelen += 200;
s.buildings.wohnbezirk = 5;               // Kapazität erhöhen
var nBefore = SYS.totalCreatureCount(s), stackBefore = s.creatures.length;
var rsum = SYS.summon(s, 'goblin');
ok(rsum.ok && SYS.totalCreatureCount(s) === nBefore + 1 && s.creatures.length === stackBefore && rsum.count >= 3, 'Goblin beschworen und automatisch gestapelt');
var rsum2 = SYS.summon(s, 'oger');        // Rang C, sollte erlaubt sein
ok(rsum2.ok, 'Oger (Rang C) beschwörbar bei Kreis-Stufe 3');
var rsum3 = SYS.summon(s, 'drakeling');   // Rang B, zu hoch
ok(!rsum3.ok, 'Drakeling (Rang B) NICHT beschwörbar bei Kreis-Stufe 3');

console.log('--- Namensgebung & Skill ---');
var schleim = s.creatures.filter(function (c) { return c.speciesId === 'schleim'; })[0];
s.resources.magie += 500;
var rn = SYS.nameCreature(s, schleim.uid, 'Rimbo');
ok(rn.ok && schleim.named === true, 'Schleim benannt');
ok(schleim.name === 'Rimbo', 'Name übernommen');
ok(schleim.skills.indexOf('verschlinger') >= 0, 'Skill „Verschlinger" durch Namensgebung erhalten');
var statsUnnamed = GD.combatPower(GD.creature('schleim').base, 1, 1);
ok(SYS.creaturePower(s, schleim) > statsUnnamed, 'Benennung erhöht Kampfkraft');

console.log('--- Evolution ---');
var gob = s.creatures.filter(function (c) { return c.speciesId === 'goblin'; })[0];
s.resources.magie += 500;
s.buildings.magieturm = 4; // zweites Namenssiegel freischalten
SYS.nameCreature(s, gob.uid, 'Goblin-A');
var opts = SYS.evolveOptions(s, gob);
ok(opts.length === 1 && opts[0].to === 'hobgoblin', 'Goblin hat Evolution -> Hobgoblin');
ok(opts[0].ok === true, 'Evolution erfüllbar (benannt)');
var rev = SYS.evolve(s, gob.uid, 'hobgoblin');
ok(rev.ok && gob.speciesId === 'hobgoblin', 'Goblin -> Hobgoblin entwickelt');
ok(gob.skills.indexOf('raubtier') >= 0, 'Hobgoblin erhält Skill „Raubtier"');

console.log('--- Leveln ---');
var cap = SYS.creatureLevelCap(gob);
SYS.addCreatureXp(s, gob, 100000);
ok(gob.level === cap, 'Level auf Cap begrenzt (' + gob.level + '/' + cap + ')');

console.log('--- Aspekte & Skill-Slots ---');
s.resources.magie += 3000; s.resources.seelen += 400; s.buildings.wohnbezirk = 10;
s.herrscher.stage = 2; s.buildings.magieturm = 8;
SYS.summon(s, 'goblin'); SYS.summon(s, 'goblin'); SYS.summon(s, 'goblin');
var gA = SYS.summon(s, 'goblin').creature;
var magBefore = SYS.creatureStats(s, gA).mag;
SYS.nameCreature(s, gA.uid, 'Arkan', 'arkanist');
ok(gA.aspect === 'arkanist', 'Aspekt gesetzt');
ok(SYS.creatureStats(s, gA).mag > magBefore, 'Arkanist erhöht Magie (' + magBefore + '->' + SYS.creatureStats(s, gA).mag + ')');
ok(gA.skills.indexOf('magieader') >= 0, 'Aspekt gewährt Signatur-Skill');
SYS.summon(s, 'goblin');
var gB = s.creatures.filter(function (c) { return !c.named && c.speciesId === 'goblin'; })[0];
var namedGB = SYS.nameCreature(s, gB.uid, 'Wall', 'bollwerk');
ok(namedGB.ok && SYS.creatureStats(s, gB).ver > SYS.creatureStats(s, gA).ver, 'Bollwerk hat mehr Verteidigung als Arkanist (' + SYS.creatureStats(s, gB).ver + '>' + SYS.creatureStats(s, gA).ver + (namedGB.reason ? ', ' + namedGB.reason : '') + ')');
var capS = SYS.skillCapacity(gA);
ok(capS >= 2, 'Skill-Kapazität >= 2 (' + capS + ')');
var avail = SYS.availableSkills(s, gA);
ok(avail.length > 0 && GD.skill(avail[0]).common, 'lernbare (common) Skills vorhanden (' + avail.length + ')');
var skBefore = gA.skills.length;
var rls = SYS.learnSkill(s, gA.uid, avail[0]);
ok(rls.ok && gA.skills.length === skBefore + 1, 'Skill in freien Slot gelernt');
ok(gA.skills.length === capS, 'Slots voll bei Kapazität (' + gA.skills.length + '/' + capS + ')');
var rover = SYS.learnSkill(s, gA.uid, 'kriegstanz');
ok(!rover.ok, 'Lernen über Kapazität wird blockiert');

console.log('--- Verzweigte Evolution ---');
var hopts = GD.creature('hobgoblin').evolvesTo.map(function (e) { return e.to; });
ok(hopts.indexOf('goblin_lord') >= 0 && hopts.indexOf('goblin_schamane') >= 0, 'Hobgoblin hat 2 Evolutionspfade');
ok(GD.creature('goblin_schamane') && GD.creature('goblin_schamane').role === 'Magie', 'Verzweigungsform goblin_schamane existiert (Magie)');

console.log('--- Magie/Forschung ---');
s.resources.wissen += 500; s.resources.magie += 500;
var rl = SYS.learnMagic(s, 'magiestrom');
ok(rl.ok && SYS.isLearned(s, 'magiestrom'), 'Magiestrom erlernt');
ok(SYS.computeBonuses(s).produktionMagie >= 0.15, 'Bonus produktionMagie >= 0.15');
var rl2 = SYS.learnMagic(s, 'todesstrahl'); // Stufe zu niedrig
ok(!rl2.ok, 'Hochstufige Magie blockiert (Herrscher-Stufe)');

console.log('--- Getrennte Feldmagie & Reichsrituale (Phase 17) ---');
var s17 = GST.createDefault();
s17.resources = { magie: 99999, gold: 99999, nahrung: 99999, material: 99999, seelen: 99999, wissen: 99999 };
s17.buildings.arkane_akademie = 1;
ok(SYS.combatAbilitiesFor(s17, 'herrscher').indexOf('feuerlanze') < 0, 'Reichsfortschritt gewährt nicht automatisch aktive Kampfzauber');
var learnCombat17 = SYS.learnFieldMagic(s17, 'kampf_feuerlanze');
ok(learnCombat17.ok && SYS.combatAbilitiesFor(s17, 'herrscher').indexOf('feuerlanze') >= 0, 'Akademie-Zauber schaltet eigene Rasterkampf-Aktion frei');
ok(!SYS.canLearnFieldMagic(s17, 'kampf_sturmstoss').ok, 'höhere Feldmagie ist an Akademiestufen gebunden');
s17.buildings.arkane_akademie = 3;
['abenteuer_windmarsch', 'abenteuer_feldbarriere', 'abenteuer_heimkehr'].forEach(function (id) { SYS.learnFieldMagic(s17, id); });
var army17 = SYS.rulerArmyGroup(s17); army17.movement = 0;
var wind17 = SYS.castAdventureMagic(s17, 'abenteuer_windmarsch', army17.id);
ok(wind17.ok && army17.movement === SYS.armyMovementMax(s17, army17), 'Windmarsch stellt Armee-Bewegung wieder her');
ok(!SYS.canCastAdventureMagic(s17, 'abenteuer_windmarsch', army17.id).ok && SYS.adventureMagicCooldown(s17, 'abenteuer_windmarsch') > 0, 'Abenteuerzauber besitzt eine Abklingzeit');
army17.position = 'wald';
var ward17 = SYS.castAdventureMagic(s17, 'abenteuer_feldbarriere', army17.id);
var attack17 = SYS.attackWithArmyGroup(s17, army17.id, 'sicher');
ok(ward17.ok && attack17.warded && army17.wardCharges === 0, 'Feldbarriere schützt den nächsten Kartenkampf und wird verbraucht');
var home17 = SYS.castAdventureMagic(s17, 'abenteuer_heimkehr', army17.id);
ok(home17.ok && army17.position === 'hauptstadt' && army17.movement === 0, 'Tor nach Tempest teleportiert eine Armee zurück');
var save17 = GST.normalize(JSON.parse(JSON.stringify(s17)));
ok(save17.learnedFieldMagic.length === s17.learnedFieldMagic.length && SYS.adventureMagicCooldown(save17, 'abenteuer_heimkehr') > 0, 'Feldmagie und Abklingzeiten überstehen Save-Roundtrip');

console.log('--- Schmieden & Ausrüsten ---');
s.buildings.schmiede = 1;
s.resources.material += 500; s.resources.magie += 500;
var rc = SYS.craft(s, 'magistahlklinge');
ok(rc.ok && rc.item.stats.ang >= 12, 'Klinge geschmiedet (ang=' + rc.item.stats.ang + ')');
var powBefore = SYS.creaturePower(s, gob);
SYS.equipItem(s, rc.item.uid, gob.uid);
ok(gob.equipment.waffe === rc.item.uid, 'Waffe ausgerüstet');
ok(SYS.creaturePower(s, gob) > powBefore, 'Ausrüstung erhöht Kampfkraft (' + powBefore + '->' + SYS.creaturePower(s, gob) + ')');
SYS.equipItem(s, rc.item.uid, 'herrscher'); // Umrüsten auf Herrscher
ok(gob.equipment.waffe === null && s.herrscher.equipment.waffe === rc.item.uid, 'Item korrekt umgerüstet');

console.log('--- Runenschmiede & langlebige Ausrüstung (Phase 21) ---');
var sF = GST.createDefault(); sF.buildings.schmiede = 3;
sF.resources.material = 999999; sF.resources.magie = 999999; sF.resources.wissen = 999999; sF.resources.seelen = 999999;
ok(GD.forgeMaterials.length === 4 && SYS.forgeMaterialAmount(sF, 'runenstaub') === 0, 'vier abgestufte Schmiedekomponenten initialisiert');
ok(SYS.isRecipeUnlocked(sF, 'magistahlklinge') && !SYS.isRecipeUnlocked(sF, 'windklinge'), 'nur Starter-Baupläne sind anfangs bekannt');
SYS.addForgeMaterials(sF, { runenstaub: 20, magistahlkern: 20, seelenkristall: 20, drachenessenz: 20 });
var unlockF = SYS.unlockRecipe(sF, 'windklinge', false);
ok(unlockF.ok && SYS.isRecipeUnlocked(sF, 'windklinge'), 'Bauplan wird mit Wissen und seltener Komponente entschlüsselt');
var craftF = SYS.craft(sF, 'windklinge');
ok(craftF.ok && SYS.itemQuality(craftF.item) === 0, 'ein langlebiges Schmiedestück startet Gewöhnlich');
ok(!SYS.craft(sF, 'windklinge').ok && sF.inventory.length === 1, 'jedes Rezept erzeugt höchstens ein Exemplar');
var forgeStatsBefore = craftF.item.stats.ang;
for (var fq = 1; fq < GD.rarities.length; fq++) ok(SYS.temperItem(sF, craftF.item.uid).ok, 'Qualitätsstufe ' + GD.rarities[fq].name + ' gezielt aufgewertet');
ok(SYS.itemQuality(craftF.item) === 4 && craftF.item.stats.ang > forgeStatsBefore && !SYS.canTemperItem(sF, craftF.item.uid).ok, 'Göttliche Maximalqualität erhöht Werte und beendet Aufwertung');
SYS.equipItem(sF, craftF.item.uid, 'herrscher');
ok(!SYS.canSalvageItem(sF, craftF.item.uid).ok, 'angelegte Ausrüstung ist vor Zerlegung geschützt');
SYS.unequipItem(sF, craftF.item.uid);
var dustBefore = SYS.forgeMaterialAmount(sF, 'runenstaub'), salvagedF = SYS.salvageItem(sF, craftF.item.uid);
ok(salvagedF.ok && !SYS.findItem(sF, craftF.item.uid) && SYS.forgeMaterialAmount(sF, 'runenstaub') > dustBefore, 'freie Ausrüstung kann in Komponenten zurückverwandelt werden');
var oldForgeSave = GST.createDefault(); oldForgeSave.version = 6; oldForgeSave.buildings.schmiede = 3;
oldForgeSave.resources.material = 500; oldForgeSave.resources.magie = 500;
var oldItem = SYS.craft(oldForgeSave, 'magistahlklinge').item; oldItem.rarity = 'episch'; delete oldItem.quality;
delete oldForgeSave.unlockedRecipes; delete oldForgeSave.forgeMaterials;
var migratedForge = GST.normalize(JSON.parse(JSON.stringify(oldForgeSave)));
ok(migratedForge.version === GST.VERSION && SYS.itemQuality(migratedForge.inventory[0]) === 2 && SYS.isRecipeUnlocked(migratedForge, 'windklinge'), 'Save-Migration erhält alte Qualität und frühere Rezeptfreischaltungen');
var inventoryBeforeDrop = sF.inventory.length, plansBeforeDrop = sF.unlockedRecipes.length, randomBeforeForge = Math.random;
Math.random = function () { return 0.1; };
SYS.resolveExpedition(sF, { regionId: 'goetterthron', creatureUids: [], rulerJoined: true, risk: 'normal', power: 999999, startTick: 0, returnsAtTick: 0 });
Math.random = randomBeforeForge;
ok(sF.inventory.length === inventoryBeforeDrop && sF.unlockedRecipes.length > plansBeforeDrop, 'Kampfbeute liefert Baupläne statt neuer Zufallsgegenstände');

console.log('--- Herrscher-Progression ---');
var lvlBefore = s.herrscher.level;
SYS.addRulerXp(s, 5000);
ok(s.herrscher.level > lvlBefore, 'Herrscher gelevelt (' + lvlBefore + '->' + s.herrscher.level + ')');
s.metrics.seelenGesamt = 9999; SYS.checkRulerStage(s);
ok(s.herrscher.stage >= 1, 'Herrscher-Stufe vorangeschritten (' + s.herrscher.stage + ')');
s.resources.seelen += 100;
var rsac = SYS.sacrificeSouls(s, 50);
ok(rsac.ok && rsac.xp === 100, 'Seelen opfern -> Herrscher-EP');

console.log('--- Herrscher-Talentbaum (Phase 20) ---');
var sT = GST.createDefault(); sT.herrscher.level = 12; sT.herrscher.stage = 1; sT.resources.gold = 10000;
ok(GD.talents.length === 15 && GD.talentBranches.length === 3, '15 Talente in drei Spezialisierungszweigen definiert');
ok(SYS.talentPointsEarned(sT) === 13 && SYS.talentPointsAvailable(sT) === 13, 'Talentpunkte aus Level und Evolutionsstufe berechnet');
ok(!SYS.canAllocateTalent(sT, 't_seelensinn').ok, 'höherer Knoten ist an Zweigschwelle und Vorgänger gebunden');
var talentPowerBefore = SYS.rulerPower(sT), commandBefore = SYS.armyCommandCapacity(sT, SYS.rulerArmyGroup(sT));
for (var tp = 0; tp < 3; tp++) ok(SYS.allocateTalent(sT, 't_magicule_koerper').ok, 'Magicule-Körper Rang ' + (tp + 1) + ' investiert');
ok(SYS.canAllocateTalent(sT, 't_seelensinn').ok && SYS.allocateTalent(sT, 't_seelensinn').ok, 'Folgeknoten nach drei Zweigpunkten freigeschaltet');
for (var tb = 0; tb < 3; tb++) SYS.allocateTalent(sT, 't_tempest_banner');
ok(SYS.allocateTalent(sT, 't_logistik').ok, 'Herrschaft-Pfad bis Kriegslogistik erreichbar');
ok(SYS.rulerPower(sT) > talentPowerBefore && SYS.armyCommandCapacity(sT, SYS.rulerArmyGroup(sT)) > commandBefore, 'Talente verändern Herrscherkraft und Kommandolimit direkt');
ok(!SYS.canRefundTalent(sT, 't_magicule_koerper').ok, 'tragender Talentpunkt kann nicht unter abhängigen Knoten entfernt werden');
ok(SYS.refundTalent(sT, 't_seelensinn').ok, 'nicht mehr tragender Folgeknoten kann gegen Gold zurückerstattet werden');
var talentSave = GST.normalize(JSON.parse(JSON.stringify(sT)));
ok(talentSave.version === GST.VERSION && SYS.talentRank(talentSave, 't_magicule_koerper') === 3, 'Talentbelegung übersteht Save-Roundtrip');

console.log('--- Expedition (Auto-Kampf) ---');
gob.job = 'armee';
var rstart = SYS.startExpedition(s, 'wald', [gob.uid], true);
ok(rstart.ok, 'Expedition gestartet');
ok(SYS.creatureBusy(s, gob.uid), 'Einheit ist unterwegs (busy)');
var seelenBefore = s.resources.seelen;
var resolved = null;
for (var t = 0; t < 12; t++) { var r = SYS.tick(s); if (r.expeditionResults.length) { resolved = r.expeditionResults[0]; break; } }
ok(resolved !== null, 'Expedition wurde aufgelöst');
ok(resolved && resolved.won === true, 'Wald von Jura gewonnen (Kraft ' + (resolved && resolved.power) + ' vs ' + (resolved && resolved.regionPower) + ')');
ok(s.claimedRegions.indexOf('wald') >= 0, 'Wald als Territorium gesichert');
ok(s.resources.seelen > seelenBefore, 'Seelen aus Expedition erhalten');
ok(!SYS.creatureBusy(s, gob.uid), 'Einheit nach Expedition wieder frei');
ok(SYS.production(s).rates.nahrung !== undefined, 'Claim-Bonus integriert (Produktion rechnet)');

console.log('--- Risiko & Verwundung ---');
ok(SYS.RISK.riskant.reward > SYS.RISK.normal.reward && SYS.RISK.sicher.reward < SYS.RISK.normal.reward, 'Risiko-Multiplikatoren gestaffelt');
var doomed = s.creatures.filter(function (c) { return c.uid !== gob.uid; })[0], countBeforeDeath = s.creatures.length;
var lossExp = { regionId: 'gebirge', creatureUids: [doomed.uid], rulerJoined: false, risk: 'riskant', power: 1, startTick: s.tick, returnsAtTick: s.tick };
var lr = SYS.resolveExpedition(s, lossExp);
ok(lr.won === false, 'Schwache Truppe verliert im Drachengebirge');
ok(lr.dead === 1 && s.creatures.length === countBeforeDeath - 1 && !SYS.findCreature(s, doomed.uid), 'Riskanter Verlust bedeutet endgültigen Tod');
gob.job = 'armee';
var angBefore = SYS.creatureStats(s, gob).ang;
var normalLoss = { regionId: 'gebirge', creatureUids: [gob.uid], rulerJoined: false, risk: 'normal', power: 1, startTick: s.tick, returnsAtTick: s.tick };
var nr = SYS.resolveExpedition(s, normalLoss);
ok(nr.wounded === 1 && SYS.isWounded(s, gob), 'Normaler Verlust verwundet die Einheit');
ok(SYS.creatureStats(s, gob).ang < angBefore, 'Verwundung senkt Werte (' + angBefore + '->' + SYS.creatureStats(s, gob).ang + ')');
ok(SYS.armyAvailable(s).indexOf(gob) < 0, 'Verwundete Einheit ist nicht expeditionsfähig');
var startRej = SYS.canStartExpedition(s, 'wald', [gob.uid], false);
ok(!startRej.ok, 'Verwundete Einheit kann keine Expedition starten');
var healAt = gob.woundedUntil;
while (s.tick < healAt) SYS.tick(s);
ok(!SYS.isWounded(s, gob), 'Einheit heilt nach Ablauf der Zeit');

console.log('--- Begrenzte Namen & Named-only-Ausrüstung (Phase 9) ---');
var sN = GST.createDefault();
sN.resources.magie = 999999; sN.resources.seelen = 999999; sN.buildings.schmiede = 1;
var firstCost = SYS.nameCost(sN, sN.creatures[0]).magie;
ok(SYS.nameCreature(sN, sN.creatures[0].uid, 'Elite').ok, 'Erstes Namenssiegel nutzbar');
var secondCost = SYS.nameCost(sN, sN.creatures[1]).magie;
ok(secondCost > firstCost, 'Namenskosten steigen deutlich an (' + firstCost + '→' + secondCost + ')');
ok(!SYS.canName(sN, sN.creatures[1]).ok, 'Namenssiegel verhindert eine komplett benannte Startarmee');
var ni = SYS.craft(sN, 'magistahlklinge').item;
ok(!SYS.equipItem(sN, ni.uid, sN.creatures[1].uid).ok, 'Unbenannte Kreatur darf keine Ausrüstung tragen');
ok(SYS.equipItem(sN, ni.uid, sN.creatures[0].uid).ok, 'Benannte Kreatur darf Ausrüstung tragen');

console.log('--- Skill-Meisterschaft & Folgefähigkeiten (Phase 9) ---');
var elite = sN.creatures[0], sourceSkill = elite.skills[0];
ok(!!sourceSkill && SYS.skillProgress(elite, sourceSkill).level === 1, 'Skill-Fortschritt beginnt auf Stufe 1');
SYS.addSkillXp(sN, elite, 10000);
ok(SYS.skillProgress(elite, sourceSkill).level === 5, 'Fähigkeit steigt durch Kampferfahrung bis Stufe 5');
var followId = GD.skill(sourceSkill).next;
ok(followId && elite.skills.indexOf(followId) >= 0, 'Folgefähigkeit auf Meisterschaftsstufe 3 freigeschaltet');
ok(SYS.creatureKampfMult(sN, elite) > 1 + GD.skill(sourceSkill).kampf, 'Meisterschaft verstärkt die Skill-Wirkung');

console.log('--- Taktischer Rundenkampf (Phase 10) ---');
var sT = GST.createDefault();
sT.herrscher.level = 25; sT.herrscher.stage = 2; sT.learnedFieldMagic.push('kampf_feuerlanze');
var bst = SYS.startCombat(sT, 'wald', [], true, 'normal');
ok(bst.ok && sT.activeCombat.status === 'active', 'Taktischer Kampf startet mit persistiertem Zustand');
ok(sT.activeCombat.party[0].abilities.indexOf('feuerlanze') >= 0, 'Gelernte Magieschule gibt eine taktische Fähigkeit');
sT = GST.normalize(JSON.parse(JSON.stringify(sT)));
ok(sT.activeCombat && sT.activeCombat.status === 'active' && sT.activeCombat.party.length === 1, 'Aktiver Kampf übersteht Speicher-Roundtrip');
var guard = 0;
while (sT.activeCombat.status === 'active' && guard++ < 30) {
  var ti = -1; for (var ei = 0; ei < sT.activeCombat.enemies.length; ei++) if (!sT.activeCombat.enemies[ei].dead) { ti = ei; break; }
  var ability = sT.activeCombat.party[sT.activeCombat.turnIndex].mp >= 8 ? 'feuerlanze' : 'angriff';
  SYS.battleAction(sT, ability, ti);
}
ok(sT.activeCombat.status === 'victory', 'Taktischer Kampf endet regelkonform mit Sieg');
ok(sT.activeCombat.log.some(function (line) { return line.indexOf('SCHWÄCHE') >= 0; }), 'Elementschwäche erhöht Schaden und wird protokolliert');
ok((sT.metrics.tacticalWins || 0) === 1 && sT.claimedRegions.indexOf('wald') >= 0, 'Taktischer Sieg gibt Fortschritt und Territorium');
SYS.closeCombat(sT);
ok(sT.activeCombat === null, 'Kampfergebnis kann bestätigt und geschlossen werden');

var sTD = GST.createDefault(), doomedT = sTD.creatures[1], doomedUidT = sTD.creatures[1].uid;
SYS.startCombat(sTD, 'wald', [doomedUidT], false, 'riskant');
sTD.activeCombat.party[0].hp = 1; sTD.activeCombat.party[0].stats.ang = 1;
sTD.activeCombat.enemies[0].hp = 999; sTD.activeCombat.enemies[0].maxHp = 999; sTD.activeCombat.enemies[0].stats.ang = 9999;
SYS.battleAction(sTD, 'angriff', 0);
ok(sTD.activeCombat.status === 'defeat' && !SYS.findCreature(sTD, doomedT.uid), 'Riskante taktische Niederlage tötet die eingesetzte Kreatur endgültig');

console.log('--- Heroes-artiger Rasterkampf (Phase 14) ---');
var s14 = GST.createDefault(); s14.herrscher.level = 12; s14.learnedFieldMagic.push('kampf_feuerlanze');
SYS.startCombat(s14, 'wald', [], true, 'normal');
var grid14 = s14.activeCombat, current14 = SYS.battleCurrentActor(grid14);
ok(grid14.board.w === 7 && grid14.board.h === 5 && grid14.obstacles.length >= 2, 'persistentes 7×5-Kampffeld mit Hindernissen erzeugt');
ok(grid14.turnOrder.length === grid14.party.length + grid14.enemies.length && current14.side === 'party', 'Initiativreihenfolge enthält beide Seiten und hält beim Spieler');
var cells14 = SYS.battleReachableCells(grid14, current14), oldPos14 = current14.pos.x + ',' + current14.pos.y;
ok(cells14.length > 0 && !cells14.some(function (c) { return grid14.obstacles.indexOf(c.x + ',' + c.y) >= 0; }), 'Bewegungsreichweite respektiert Hindernisse und belegte Felder');
var move14 = SYS.battleMove(s14, cells14[0].x, cells14[0].y);
ok(move14.ok && (current14.pos.x + ',' + current14.pos.y) !== oldPos14, 'Einheitenstapel kann auf dem Raster bewegt werden');
var s14w = GST.createDefault(); s14w.herrscher.level = 12; SYS.startCombat(s14w, 'wald', [], true, 'normal');
var waitActor14 = SYS.battleCurrentActor(s14w.activeCombat), wait14 = SYS.battleWait(s14w);
ok(wait14.ok && waitActor14.waited && s14w.activeCombat.log.some(function (line) { return line.indexOf('wartet') >= 0; }), 'Warten verschiebt eine Einheit in der Initiative nach hinten');
var s14r = GST.createDefault(); s14r.herrscher.level = 12; SYS.startCombat(s14r, 'wald', [], true, 'normal');
var retaliator14 = s14r.activeCombat.enemies[0], attacker14 = SYS.battleCurrentActor(s14r.activeCombat);
attacker14.pos = { x: 2, y: 2 }; retaliator14.pos = { x: 3, y: 2 }; attacker14.hp = attacker14.maxHp = 999; retaliator14.hp = retaliator14.maxHp = 999;
SYS.battleAction(s14r, 'angriff', 0);
ok(s14r.activeCombat.log.some(function (line) { return line.indexOf('schlägt zurück') >= 0; }), 'Nahkampfangriff löst eine Heroes-artige Gegenwehr aus');

console.log('--- Armeegruppen & strategische Karte (Phase 11) ---');
var s11 = GST.createDefault();
s11.resources = { magie: 999999, gold: 999999, nahrung: 999999, material: 999999, seelen: 999999, wissen: 999999 };
s11.buildings.magieturm = 4; s11.buildings.beschwoerungskreis = 3; s11.buildings.arena = 3;
var leader11 = s11.creatures.filter(function (c) { return c.speciesId === 'goblin'; })[0];
var named11 = SYS.nameCreature(s11, leader11.uid, 'Goldzahn', 'wuterich');
ok(named11.ok && named11.autoArmy, 'Erste benannte Elite gründet automatisch eine Armee');
SYS.evolve(s11, leader11.uid, 'hobgoblin'); leader11.level = 10;
ok(!SYS.canCreateArmyGroup(s11, s11.creatures.filter(function (c) { return !c.named; })[0].uid).ok, 'Unbenannte Kreatur darf keine Armee führen');
var group11 = named11.autoArmy;
ok(s11.armyGroups.length === 2 && group11.leaderUid === leader11.uid, 'Herrscher- und Elitearmee bestehen parallel');
ok(SYS.leaderArmyGroup(s11, leader11.uid) === group11 && SYS.creatureBusy(s11, leader11.uid), 'Anführer ist eindeutige steuerbare Armeefigur');
var cap11 = SYS.armyCommandCapacity(s11, group11);
ok(cap11 >= 100, 'Kommandolimit skaliert mit Anführer/Arena (' + cap11 + ')');
var recG = SYS.recruitTroops(s11, group11.id, 'goblin', 50);
var recS = SYS.recruitTroops(s11, group11.id, 'schleim', 20);
ok(recG.ok && recS.ok && group11.troops.goblin === 50 && group11.troops.schleim === 20, 'Gemischte Massentruppen rekrutiert (50 Goblins + 20 Schleime)');
ok(SYS.armyCommandUsed(group11) === 70, 'Kommandokosten aus Truppenzahlen berechnet');
ok(SYS.armyGroupPower(s11, group11) > SYS.creaturePower(s11, leader11), 'Truppenkontingente erhöhen die Armeekraft');
var mv11 = SYS.moveArmyGroup(s11, group11.id, 'wald');
ok(mv11.ok && group11.position === 'wald' && group11.movement < SYS.armyMovementMax(s11, group11), 'Armeefigur bewegt sich auf benachbartes Kartenfeld');
var beforeTroops11 = group11.troops.goblin + group11.troops.schleim;
var atk11 = SYS.attackWithArmyGroup(s11, group11.id, 'normal');
ok(atk11.ok && atk11.won && s11.claimedRegions.indexOf('wald') >= 0, 'Armeegruppe erobert Region auf der spielbaren Karte');
ok(group11.troops.goblin + group11.troops.schleim < beforeTroops11, 'Kartenkampf verursacht dauerhafte Truppenverluste');
group11.movement = 0; s11.tick = s11.nextMapRefreshTick;
ok(SYS.stepArmyMap(s11) && group11.movement === SYS.armyMovementMax(s11, group11), 'Bewegungspunkte erneuern sich am Kartentag');
var save11 = GST.normalize(JSON.parse(JSON.stringify(s11)));
var savedEliteArmy = save11.armyGroups.filter(function (g) { return !g.rulerLed; })[0];
ok(save11.armyGroups.length === 2 && savedEliteArmy.troops.goblin > 0, 'Herrscher- und Elitearmee überstehen Speicher-Roundtrip');
ok(SYS.disbandArmyGroup(save11, savedEliteArmy.id).ok && !SYS.creatureBusy(save11, leader11.uid), 'Elitearmee kann aufgelöst werden; Truppen kehren zum Herrscher zurück');

var s11d = GST.createDefault(); s11d.resources.gold = 9999; s11d.resources.nahrung = 9999; s11d.resources.magie = 9999;
var doomedLeader11 = s11d.creatures[0]; var dg11 = SYS.nameCreature(s11d, doomedLeader11.uid, 'Wagemut').autoArmy;
SYS.recruitTroops(s11d, dg11.id, 'schleim', 10); dg11.position = 'gebirge'; s11d.claimedRegions.push('grenze');
var death11 = SYS.attackWithArmyGroup(s11d, dg11.id, 'riskant');
ok(!death11.won && death11.leaderDead && !SYS.findCreature(s11d, doomedLeader11.uid) && !SYS.findArmyGroup(s11d, dg11.id), 'Riskante Karten-Niederlage löscht Anführer und Armee endgültig');

console.log('--- Rivalen & Bedrohung ---');
s.buildings.labyrinth = 2;
s.creatures.forEach(function (c) { if (!SYS.isWounded(s, c)) c.job = 'armee'; });
ok(SYS.defenseValue(s) > 0, 'Verteidigung aus Labyrinth + Armee (' + SYS.defenseValue(s) + ')');
var s2 = GST.createDefault();
ok(SYS.threatRate(s2) === 0, 'Keine Bedrohung ohne erobertes Territorium');
s2.claimedRegions.push('wald');
ok(SYS.threatRate(s2) > 0, 'Bedrohung steigt mit Territorium');
SYS.scheduleRaid(s);
ok(s.raid && s.raid.power > 0, 'Angriff eingeplant (Kraft ' + s.raid.power + ')');
s.raid.power = 1; s.raid.atTick = s.tick;
var rr = SYS.resolveRaid(s);
ok(rr && rr.repelled === true, 'Starke Verteidigung wehrt schwachen Angriff ab');
ok(SYS.rivalProgress(s, rr.rivalId) >= 1, 'Abwehr zählt zum Rivalen-Fortschritt');
ok(s.raid === null, 'Angriff nach Auflösung zurückgesetzt');
SYS.scheduleRaid(s); s.raid.power = 1e9; s.raid.atTick = s.tick;
var goldBeforeRaid = s.resources.gold;
var rb = SYS.resolveRaid(s);
ok(rb && rb.repelled === false, 'Übermächtiger Angriff bricht durch');
ok(s.resources.gold <= goldBeforeRaid, 'Durchbruch kostet Ressourcen');
var rivId = 'clayron';
var ccBlock = SYS.canCounterAttack(s, rivId);
s.rivalProgress[rivId] = 0;
ok(!SYS.canCounterAttack(s, rivId).ok, 'Gegenangriff erst nach genug Abwehren');
s.rivalProgress[rivId] = SYS.RIVAL_COUNTER_REPELS;
ok(SYS.canCounterAttack(s, rivId).ok, 'Gegenangriff nach genug Abwehren freigeschaltet');
s.metrics.seelenGesamt = 99999; SYS.addRulerXp(s, 500000);
var cc = SYS.counterAttackRival(s, rivId, s.creatures.map(function (c) { return c.uid; }));
ok(cc.ok && cc.won === true, 'Starker Gegenangriff besiegt Rivalen (Kraft ' + cc.power + ' vs ' + cc.enemyPower + ')');
ok(SYS.isRivalDefeated(s, rivId), 'Besiegter Rivale wird vermerkt');
ok(SYS.computeBonuses(s).verteidigung >= GD.rival(rivId).defeatBonus.verteidigung, 'Sieg gewährt dauerhaften Reichsbonus');

console.log('--- Offline-Fortschritt ---');
var goldBefore = s.resources.gold;
SYS.offlineProgress(s, 600);
ok(s.resources.gold >= goldBefore, 'Offline-Produktion gutgeschrieben');

console.log('--- Events & Affinität ---');
var sE = GST.createDefault();
var goldE = sE.resources.gold;
SYS.applyEventEffect(sE, { res: { gold: 300 } });
ok(sE.resources.gold === goldE + 300, 'Event-Ressourceneffekt angewendet');
SYS.applyEventEffect(sE, { buff: { effect: { produktionAll: 0.5 }, dauer: 5, label: 'Test' } });
ok(SYS.computeBonuses(sE).produktionAll >= 0.5, 'Temporärer Buff wirkt sofort');
for (var te = 0; te < 6; te++) SYS.tick(sE);
ok(SYS.computeBonuses(sE).produktionAll < 0.5, 'Buff läuft nach Ablauf aus');
sE.activeEvent = 'haendler'; sE.resources.gold += 500;
var goldB = sE.resources.gold;
var re = SYS.resolveEvent(sE, 0);
ok(re.ok && sE.activeEvent === null, 'Wahl-Event aufgelöst & zurückgesetzt');
ok(sE.resources.gold === goldB - 200, 'Händler-Kosten abgebucht');
var sF = GST.createDefault();
sF.nextEventTick = sF.tick + 1;
var fired = null; for (var k2 = 0; k2 < 5 && !fired; k2++) { var rt = SYS.tick(sF); if (rt.event) fired = rt.event; }
ok(fired !== null, 'stepEvents feuert ein Event');
var sA = GST.createDefault();
ok(!SYS.canChooseAffinity(sA).ok, 'Affinität erst ab Herrscher-Stufe 2');
sA.herrscher.stage = 2;
ok(SYS.canChooseAffinity(sA).ok, 'Affinität ab Stufe 2 wählbar');
sA.learnedMagic.push('feuerlanze');
var armNo = SYS.computeBonuses(sA).armee;
SYS.chooseAffinity(sA, 'feuer');
ok(sA.affinity === 'feuer', 'Affinität gesetzt');
ok(SYS.computeBonuses(sA).armee > armNo, 'Feuer-Affinität verstärkt Feuerzauber + Armee-Bonus');
ok(!SYS.chooseAffinity(sA, 'wasser').ok, 'Affinität ist endgültig');

console.log('--- Forschung & Magie-Tiers (Phase 7) ---');
var sR = GST.createDefault();
ok(SYS.unlockedMagicTier(sR) === 1, 'Start: nur Magie-Tier 1');
ok(!SYS.canLearn(sR, 'windschritt').ok, 'Tier-2-Zauber vor Forschung gesperrt');
sR.resources.wissen += 200;
var rr0 = SYS.doResearch(sR, 'r_arkane_grundlagen');
ok(rr0.ok && SYS.isResearched(sR, 'r_arkane_grundlagen'), 'Forschung „Arkane Grundlagen" abgeschlossen');
ok(SYS.unlockedMagicTier(sR) >= 3, 'Magie-Tier nach Forschung auf 3');
sR.resources.magie += 200;
ok(SYS.canLearn(sR, 'windschritt').ok, 'Tier-2-Zauber nach Forschung lernbar');

console.log('--- Neue, einzigartige Zauber-Effekte ---');
var matRate0 = SYS.production(GST.createDefault()).rates.material;
var sM = GST.createDefault();
sM.learnedMagic.push('transmutation');                       // produce: material +6
ok((SYS.computeBonuses(sM).produce.material || 0) === 6, 'produce-Effekt akkumuliert (+6 Material)');
ok(SYS.production(sM).rates.material >= matRate0 + 6, 'Direkt-Produktion erhöht die Materialrate');
var sCap = GST.createDefault(), cap0 = SYS.capacity(sCap);
sCap.learnedMagic.push('weltbaum');                          // kapazitaet +12
ok(SYS.capacity(sCap) === cap0 + 12, 'kapazitaet-Effekt erhöht Kapazität (+12)');
var sT = GST.createDefault(); sT.creatures[0].job = 'armee';
var d0 = SYS.startExpedition(sT, 'wald', [sT.creatures[0].uid], false, 'normal').expedition.dauer;
var sT2 = GST.createDefault(); sT2.creatures[0].job = 'armee'; sT2.learnedMagic.push('windschritt');  // expedTempo
var d1 = SYS.startExpedition(sT2, 'wald', [sT2.creatures[0].uid], false, 'normal').expedition.dauer;
ok(d1 < d0, 'expedTempo verkürzt die Expeditionsdauer (' + d0 + '->' + d1 + ')');
var sTR = GST.createDefault(); sTR.claimedRegions.push('wald');
var tr0 = SYS.threatRate(sTR);
sTR.learnedMagic.push('eiszone');                            // threatRuhe 0.30
ok(SYS.threatRate(sTR) < tr0, 'threatRuhe senkt den Bedrohungsanstieg');

console.log('--- Freischaltungen / progressive Sichtbarkeit ---');
var sU = GST.createDefault();
ok(!SYS.tabUnlocked(sU, 'magie') && !SYS.tabUnlocked(sU, 'schmiede') && !SYS.tabUnlocked(sU, 'karte'), 'Magie/Schmiede/Karte anfangs gegated');
ok(SYS.tabUnlocked(sU, 'reich') && SYS.tabUnlocked(sU, 'kreaturen'), 'Reich & Kreaturen immer offen');
SYS.syncUnlocks(sU);
sU.resources.magie += 500; SYS.nameCreature(sU, sU.creatures[0].uid, 'X');
ok(SYS.tabUnlocked(sU, 'karte'), 'Karte nach erster Namensgebung frei');
var freshU = SYS.collectNewUnlocks(sU);
ok(freshU.some(function (f) { return f.id === 'tab_karte'; }), 'collectNewUnlocks meldet neue Karte-Freischaltung');
ok(SYS.collectNewUnlocks(sU).length === 0, 'bereits gemeldete Freischaltung nicht erneut gemeldet');
ok(!SYS.buildingUnlocked(sU, 'schmiede'), 'Schmiede-Gebäude vor erster Eroberung gesperrt');
sU.claimedRegions.push('wald');
ok(SYS.buildingUnlocked(sU, 'schmiede') && SYS.buildingUnlocked(sU, 'forschungsgilde'), 'Schmiede & Forschungsgilde nach Eroberung baubar');
var sV = GST.createDefault();
ok(SYS.visibleRegions(sV).length === 2, 'anfangs nur 2 Regionen sichtbar (verfügbar + Ausblick)');
sV.claimedRegions.push('wald');
ok(SYS.visibleRegions(sV).length === 3, 'nach Eroberung wächst der Ausblick (+1)');
ok(SYS.summonTeasers(sV).length > 0, 'nächster Beschwörungsrang als Ausblick vorhanden');

console.log('--- Chimära-Fusion ---');
var sF2 = GST.createDefault();
ok(!SYS.featureUnlocked(sF2, 'fusion'), 'Fusion vor Stufe 3 gesperrt');
sF2.herrscher.stage = 3;
ok(SYS.featureUnlocked(sF2, 'fusion'), 'Fusion ab Stufe „Dämonenlord" frei');
sF2.buildings.wohnbezirk = 8; sF2.buildings.magieturm = 8; sF2.resources.magie += 50000; sF2.resources.seelen += 20000;
SYS.summon(sF2, 'schleim'); SYS.summon(sF2, 'goblin');
var fbase = sF2.creatures[0]; var firstFusionName = SYS.nameCreature(sF2, fbase.uid, 'Basis');
SYS.disbandArmyGroup(sF2, firstFusionName.autoArmy.id);
var fcat = sF2.creatures.filter(function (c) { return !c.named && c.speciesId === 'goblin'; })[0];
var secondFusionName = SYS.nameCreature(sF2, fcat.uid, 'Katalysator');
SYS.disbandArmyGroup(sF2, secondFusionName.autoArmy.id);
fcat.skills.push('berserker'); fcat.skillProgress.berserker = { level: 1, xp: 0 };
var angBeforeF = SYS.creatureStats(sF2, fbase).ang, nCre = sF2.creatures.length;
var rf = SYS.fuse(sF2, fbase.uid, fcat.uid);
ok(rf.ok && fbase.fusionLevel === 1, 'Fusion durchgeführt (Stufe 1)');
ok(sF2.creatures.length === nCre - 1, 'Katalysator verbraucht');
ok(SYS.creatureStats(sF2, fbase).ang > angBeforeF, 'Fusion erhöht Werte (' + angBeforeF + '->' + SYS.creatureStats(sF2, fbase).ang + ')');
ok(fbase.skills.indexOf('berserker') >= 0, 'Skill des Katalysators vererbt');

console.log('--- Stapel, Elitenlimit & Basisskills (Phase 12) ---');
var s12 = GST.createDefault();
s12.resources.magie = 1e20; s12.resources.seelen = 1e20; s12.resources.gold = 1e20; s12.resources.nahrung = 1e20;
s12.herrscher.stage = 6; s12.buildings.magieturm = 40; s12.buildings.seelentempel = 30;
s12.creatures.filter(function (c) { return !c.named && c.speciesId === 'goblin'; })[0].count = 50;
s12.armyGroups[0].troops.goblin = 50;
ok(SYS.combatAbilitiesFor(s12, s12.creatures[0].uid).length <= 2 && SYS.skillCapacity(s12.creatures[0]) === 0, 'Unbenannte haben nur 1–2 Basisfähigkeiten und keine erweiterten Skill-Slots');
var firstRandom = SYS.nameCreature(s12, s12.creatures[0].uid, '', 'arkanist');
ok(firstRandom.ok && firstRandom.creature.name !== GD.creature(firstRandom.creature.speciesId).name, 'leerer Name erzeugt einen passenden Zufallsnamen');
while (SYS.namedCount(s12) < 20) {
  var nextStack = s12.creatures.filter(function (c) { return !c.named && c.speciesId === 'goblin'; })[0];
  if (!nextStack || !SYS.nameCreature(s12, nextStack.uid, '', 'wuterich').ok) break;
}
var leftover12 = s12.creatures.filter(function (c) { return !c.named; })[0];
ok(SYS.namedCount(s12) === 20 && SYS.nameCapacity(s12) === 20 && !SYS.canName(s12, leftover12).ok, 'absolutes Limit von 20 benannten Kreaturen greift');
ok(!SYS.canFuse(s12, firstRandom.creature.uid, leftover12.uid).ok, 'Fusion lehnt unbenannte Katalysatoren ab');

console.log('--- Abenteuerkarte, Fundorte & Außenanlagen (Phase 13) ---');
var s13 = GST.createDefault(), main13 = SYS.rulerArmyGroup(s13);
s13.resources.gold = 99999; s13.resources.material = 99999; s13.resources.magie = 99999; s13.resources.nahrung = 99999;
ok(!SYS.canMoveArmyGroup(s13, main13.id, 'hoehlen').ok, 'Armeen können keine nicht verbundenen Kartenfelder überspringen');
ok(SYS.moveArmyGroup(s13, main13.id, 'wald').ok, 'Herrscherarmee bewegt sich über einen gezeichneten Kartenweg');
var conquer13 = SYS.attackWithArmyGroup(s13, main13.id, 'sicher');
ok(conquer13.ok && conquer13.won && s13.claimedRegions.indexOf('wald') >= 0, 'erstes Territorium auf der Abenteuerkarte erobert');
ok(SYS.strategicNodeUnlocked(s13, 'site_manaquelle') && SYS.moveArmyGroup(s13, main13.id, 'site_manaquelle').ok, 'Fundort wird durch sein Territorium freigeschaltet und ist begehbar');
var magieRate13 = SYS.production(s13).rates.magie;
var capture13 = SYS.interactMapSite(s13, main13.id, 'manaquelle');
ok(capture13.ok && SYS.mapSiteClaimed(s13, 'manaquelle') && s13.mapSiteLevels.manaquelle === 1, 'Ressourcenanlage mit stationierter Armee gesichert');
ok(approx(SYS.production(s13).rates.magie, magieRate13 + GD.strategicSite('manaquelle').produce.magie), 'gesicherte Manaquelle produziert pro Tick');
var up13 = SYS.upgradeMapSite(s13, 'manaquelle');
ok(up13.ok && up13.level === 2 && approx(SYS.production(s13).rates.magie, magieRate13 + GD.strategicSite('manaquelle').produce.magie * 2), 'Außenanlage ausgebaut und Produktion skaliert');
main13.position = 'gebirge'; main13.movement = 3; main13.troops.goblin = 220;
s13.claimedRegions = ['wald', 'hoehlen', 'sumpf', 'ruinen', 'grenze', 'gebirge'];
ok(SYS.moveArmyGroup(s13, main13.id, 'site_drachennest').ok, 'optionaler Entdeckungsort über Seitenweg erreichbar');
var souls13 = s13.resources.seelen || 0, discover13 = SYS.interactMapSite(s13, main13.id, 'drachennest');
ok(discover13.ok && SYS.mapSiteExplored(s13, 'drachennest') && s13.resources.seelen > souls13, 'einmaliger Fundort gibt Beute und bleibt erkundet');
var save13 = GST.normalize(JSON.parse(JSON.stringify(s13)));
ok(SYS.mapSiteClaimed(save13, 'manaquelle') && SYS.mapSiteExplored(save13, 'drachennest') && save13.mapSiteLevels.manaquelle === 2, 'Abenteuerkarten-Fortschritt übersteht Save-Roundtrip');

console.log('--- Prozedurale Echo-Territorien (Phase 22) ---');
var s22 = GST.createDefault(), main22 = SYS.rulerArmyGroup(s22);
s22.claimedRegions = ['wald', 'hoehlen'];
s22.resources.wissen = 9999;
s22.creatures.filter(function (c) { return !c.named; }).forEach(function (c) { c.count = 250; main22.troops[c.speciesId] = 250; });
var echoA = SYS.ensureEchoMap(s22);
var generatedAgain = SYS.generateEchoMap(echoA.seed, echoA.cycle, SYS.echoBasePower(s22));
ok(SYS.echoUnlocked(s22) && echoA.nodes.length === 12 && echoA.nodes.filter(function (n) { return n.boss; }).length === 1, 'Echo-System öffnet ein Netz aus 12 Knoten und einem Kern');
ok(JSON.stringify(echoA.nodes) === JSON.stringify(generatedAgain), 'gleicher Seed erzeugt deterministisch dieselbe Echo-Karte');
var echoIds22 = {}; echoA.nodes.forEach(function (n) { echoIds22[n.id] = true; });
ok(echoA.nodes.every(function (n) { return n.parents.every(function (id) { return echoIds22[id]; }) && n.affixIds.length >= 1 && !!GD.echoReward(n.rewardId); }), 'Echo-Pfade, Affixe und Belohnungen sind vollständig referenziert');
ok(new Set(echoA.nodes.map(function (n) { return n.rewardId; })).size >= 4, 'prozedurale Karte bietet mindestens vier verschiedene Belohnungstypen');
var firstEcho22 = SYS.availableEchoNodes(s22)[0], resBefore22 = s22.resources.seelen + s22.resources.gold + s22.resources.magie + s22.resources.material + s22.resources.wissen;
var clear22 = SYS.challengeEcho(s22, main22.id, firstEcho22.id, 'sicher');
var resAfter22 = s22.resources.seelen + s22.resources.gold + s22.resources.magie + s22.resources.material + s22.resources.wissen;
ok(clear22.ok && clear22.won && SYS.echoNodeCompleted(s22, firstEcho22.id) && resAfter22 > resBefore22, 'erreichbares Echo wird ausgewertet, belohnt und dauerhaft abgeschlossen');
var safety22 = 20;
while (!SYS.echoBossCompleted(s22) && safety22-- > 0) {
  var target22 = SYS.availableEchoNodes(s22).sort(function (a, b) { return b.col - a.col || a.power - b.power; })[0];
  if (!target22) break;
  var result22 = SYS.challengeEcho(s22, main22.id, target22.id, 'sicher');
  if (!result22.won) break;
}
ok(SYS.echoBossCompleted(s22) && s22.metrics.echoBosses === 1, 'verzweigter Pfad führt bis zum Echo-Kern');
var oldSeed22 = s22.echoes.seed, oldMaxPower22 = Math.max.apply(null, s22.echoes.nodes.map(function (n) { return n.power; }));
var next22 = SYS.advanceEchoCycle(s22), newMaxPower22 = Math.max.apply(null, s22.echoes.nodes.map(function (n) { return n.power; }));
ok(next22.ok && s22.echoes.cycle === 2 && s22.echoes.seed !== oldSeed22 && newMaxPower22 > oldMaxPower22, 'neuer Echo-Zyklus erzeugt ein anderes, stärkeres Netz');
var reroll22 = GST.createDefault(); reroll22.claimedRegions = ['wald', 'hoehlen']; reroll22.resources.wissen = 9999; SYS.ensureEchoMap(reroll22);
var rerollSeed22 = reroll22.echoes.seed;
ok(SYS.rerollEchoMap(reroll22).ok && reroll22.echoes.seed !== rerollSeed22, 'unberührtes Netz kann gegen Wissen neu verwoben werden');
var save22 = GST.normalize(JSON.parse(JSON.stringify(s22)));
ok(save22.version === 8 && save22.echoes.cycle === 2 && save22.echoes.nodes.length === 12 && save22.echoes.stability > 0, 'Save-v8 erhält Seed, Zyklus, Karte und Echo-Stabilität');

console.log('--- Zuschauer-/Auto-Modus (spielt sich selbst) ---');
var sW = GST.createDefault(); SYS.syncUnlocks(sW);
var acted = 0;
for (var w = 0; w < 500; w++) { if (SYS.autoPlayStep(sW)) acted++; SYS.tick(sW); }
ok(acted > 5, 'Auto-Modus führt mehrere Aktionen aus (' + acted + ')');
ok(sW.metrics.named >= 1, 'Auto-Modus benennt Kreaturen');
ok((sW.metrics.summoned || 0) >= 1 || SYS.totalCreatureCount(sW) > 3, 'Auto-Modus erweitert das Reich');
ok(!isNaN(SYS.production(sW).rates.magie), 'Auto-Modus hält den Zustand stabil (keine NaN)');

console.log('--- Ziele / Quests ---');
var sQ = GST.createDefault();
ok(SYS.activeQuestIndex(sQ) === 0, 'Start: erstes Ziel aktiv');
ok(SYS.activeQuest(sQ).id === 'q_magieturm', 'erstes Ziel ist der Magieturm-Ausbau');
sQ.buildings.magieturm = 2;
var goldBeforeQ = sQ.resources.gold;
var doneQ = SYS.checkQuests(sQ, false);
ok(doneQ.length === 1 && sQ.questProgress === 1, 'Ziel wird bei Erfüllung abgeschlossen');
ok(sQ.resources.gold > goldBeforeQ, 'Ziel-Belohnung wird gutgeschrieben');
ok(SYS.activeQuest(sQ).id === 'q_jobs', 'nächstes Ziel rückt nach');
// syncQuests: bestehenden Fortschritt still nachziehen (keine Belohnungsflut)
var sQ2 = GST.createDefault();
sQ2.buildings.magieturm = 5; sQ2.metrics.summoned = 3; sQ2.metrics.named = 2;
sQ2.creatures.forEach(function (c) { c.job = 'magie'; });
var goldB2 = sQ2.resources.gold, magB2 = sQ2.resources.magie;
SYS.syncQuests(sQ2);
ok(sQ2.questProgress >= 4, 'syncQuests rückt still über bereits erfüllte Ziele vor (' + sQ2.questProgress + ')');
ok(sQ2.resources.gold === goldB2 && sQ2.resources.magie === magB2, 'syncQuests vergibt keine rückwirkenden Belohnungen');
// tick liefert abgeschlossene Ziele zurück
var sQ3 = GST.createDefault(); SYS.syncQuests(sQ3);
sQ3.buildings.magieturm = 2;
var evQ = SYS.tick(sQ3);
ok(evQ.questsCompleted && evQ.questsCompleted.length >= 1, 'tick meldet abgeschlossene Ziele');
// vollständige Kette durchlaufbar (kein Stecken bleiben)
var sQ4 = GST.createDefault();
sQ4.buildings.magieturm = 9; sQ4.buildings.forschungsgilde = 1; sQ4.creatures.forEach(function (c) { c.job = 'armee'; });
sQ4.metrics = { summoned: 9, named: 9, evolutions: 9, expeditions: 9, expeditionsWon: 9, crafted: 9, raidsRepelled: 9, fused: 9 };
sQ4.learnedMagic = ['magiestrom', 'feuerlanze', 'wasserwall']; sQ4.research = ['r_arkane_grundlagen'];
sQ4.claimedRegions = ['wald', 'hoehlen', 'sumpf']; sQ4.herrscher.stage = 3;
SYS.checkQuests(sQ4, false);
ok(sQ4.questProgress === SYS.questCount() && SYS.activeQuest(sQ4) === null, 'alle Ziele erfüllbar (Kette vollständig)');

console.log('--- Speicher-Roundtrip (normalize) ---');
var clone = GST.normalize(JSON.parse(JSON.stringify(s)));
ok(clone.creatures.length === s.creatures.length, 'JSON-Roundtrip erhält Kreaturen');
ok(SYS.production(clone).rates.magie >= 0, 'Geladener Stand ist berechenbar');

console.log('\n========================================');
console.log('  Ergebnis: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
console.log('========================================');

test('sim — Datenintegrität & kompletter Spielkreislauf', () => {
  if (fails.length) console.log('FEHLER:\n  - ' + fails.join('\n  - '));
  expect(fails).toEqual([]);
});
