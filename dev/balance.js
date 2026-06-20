/* dev/balance.js — Balance-Analyse (Bun, DOM-frei). Rechnet Kraft-
   kurven, Regionskräfte, Kosten/Belohnungen durch und markiert Aus-
   reißer. Nur Analyse, ändert nichts. NICHT Teil des Spiels.
   Aufruf:  bun run dev/balance.js                                     */
import "../js/data-tables.js";
import "../js/data.js";
import "../js/state.js";
import "../js/systems.js";
var GD = globalThis.GameData, GST = globalThis.GameState, SYS = globalThis.GameSystems;

function pad(s, n) { s = '' + s; while (s.length < n) s += ' '; return s; }
function padL(s, n) { s = '' + s; while (s.length < n) s = ' ' + s; return s; }

// Kampfkraft einer Spezies bei gegebenem Level (benannt, ohne Ausrüstung)
function speciesPower(sp, level, named) {
  var lf = 1 + 0.05 * (level - 1);
  var nf = named ? 1.12 : 1;
  var stats = {};
  ['lp', 'ang', 'ver', 'mag', 'tmp'].forEach(function (k) { stats[k] = Math.round(sp.base[k] * lf * nf); });
  var km = 1;
  if (sp.skill && GD.skill(sp.skill)) km += GD.skill(sp.skill).kampf;
  return GD.combatPower(stats, 1, km);
}

console.log('\n=== KREATUREN: Kampfkraft je Rang (Lv1 / Cap, benannt+Skill) ===');
console.log(pad('Spezies', 22) + pad('Linie', 12) + pad('Rang', 5) + padL('Lv1', 7) + padL('@Cap', 9) + padL('Cap', 5));
var byRank = {};
GD.creatures.forEach(function (sp) {
  var p1 = speciesPower(sp, 1, false);
  var pc = speciesPower(sp, sp.levelCap, true);
  byRank[sp.rank] = byRank[sp.rank] || [];
  byRank[sp.rank].push({ sp: sp, p1: p1, pc: pc });
});
GD.RANKS.forEach(function (rank) {
  (byRank[rank] || []).forEach(function (e) {
    console.log(pad(e.sp.name, 22) + pad(e.sp.line, 12) + pad(e.sp.rank, 5) + padL(e.p1, 7) + padL(e.pc, 9) + padL(e.sp.levelCap, 5));
  });
});

console.log('\n=== Spannweite @Cap je Rang (min–max, Faktor) ===');
GD.RANKS.forEach(function (rank) {
  var arr = (byRank[rank] || []).map(function (e) { return e.pc; });
  if (!arr.length) return;
  var mn = Math.min.apply(null, arr), mx = Math.max.apply(null, arr);
  var flag = (mx / mn > 1.6) ? '  ⚠ große Spannweite' : '';
  console.log(pad('Rang ' + rank, 9) + padL(mn, 8) + ' – ' + padL(mx, 8) + '   (' + (mx / mn).toFixed(2) + 'x)' + flag);
});

console.log('\n=== REGIONEN: Kraft, Beute/Tick, Aufschlag ===');
console.log(pad('Region', 26) + padL('Kraft', 8) + padL('Dauer', 7) + padL('Beute/Tick', 12) + padL('vs.Vorher', 11));
var prevPow = 0, prevRate = 0;
GD.regions.forEach(function (r) {
  var rewardSum = 0; for (var k in r.rewards) rewardSum += r.rewards[k];
  var perTick = rewardSum / r.dauer;
  var powRatio = prevPow ? (r.power / prevPow).toFixed(2) + 'x' : '—';
  var rateRatio = prevRate ? '  (Beute ' + (perTick / prevRate).toFixed(2) + 'x)' : '';
  console.log(pad(r.name, 26) + padL(r.power, 8) + padL(r.dauer, 7) + padL(perTick.toFixed(1), 12) + padL(powRatio, 11) + rateRatio);
  prevPow = r.power; prevRate = perTick;
});

console.log('\n=== REGION erreichbar? (Armee aus N Top-Cap-Einheiten, +Boni) ===');
// stärkste verfügbare Cap-Einheiten je Spielphase grob: nimm Top-Powers @Cap
var allCap = GD.creatures.map(function (sp) { return { name: sp.name, p: speciesPower(sp, sp.levelCap, true), rank: sp.rank }; })
  .sort(function (a, b) { return b.p - a.p; });
[[5, 1.0, 'Mitte (keine Boni)'], [6, 1.5, 'Spät (+50% Boni)'], [8, 2.2, 'Endgame (+120% Boni)']].forEach(function (cfg) {
  var n = cfg[0], bonus = cfg[1];
  var sum = 0; for (var i = 0; i < n; i++) sum += allCap[i].p;
  var total = Math.round(sum * bonus);
  console.log(pad(cfg[2], 26) + 'Top-' + n + ' Einheiten → Kraft ' + padL(total, 8));
});
console.log('Top-Einheiten @Cap:', allCap.slice(0, 4).map(function (e) { return e.name + ' ' + e.p; }).join(', '));

console.log('\n=== AUSRÜSTUNG: Rezepte (Statsumme × Schmiede-Tier, Set) ===');
console.log(pad('Rezept', 28) + pad('Slot', 12) + padL('Schm', 5) + padL('Σstats', 8) + '  Set/Unikat');
GD.recipes.forEach(function (r) {
  var sum = 0; for (var k in r.stats) sum += r.stats[k];
  var tag = r.unique ? ('UNIKAT ' + (r.fixedRarity || '')) : (r.set || '');
  console.log(pad(r.name, 28) + pad(r.slot, 12) + padL(r.schmiede, 5) + padL(sum, 8) + '  ' + tag);
});

console.log('\n=== GEBÄUDE: Produktion & Boni (Stufe 1) ===');
GD.buildings.forEach(function (b) {
  var parts = [];
  if (b.producePer) for (var k in b.producePer) parts.push('+' + b.producePer[k] + ' ' + k);
  if (b.effect) for (var e in b.effect) parts.push('+' + (b.effect[e] * 100) + '% ' + e + '/Stufe');
  if (b.capacityPer) parts.push('+' + b.capacityPer + ' Kapazität');
  console.log(pad(b.name, 22) + (parts.join(', ') || '—'));
});

console.log('\n=== ARMEEGRUPPEN: Beispielverbände & Kommandolimits ===');
function armyExample(label, leaderSpecies, level, stage, arena, troops) {
  var s = GST.createDefault();
  s.herrscher.stage = stage; s.buildings.arena = arena;
  var leader = s.creatures[0]; leader.speciesId = leaderSpecies; leader.level = level; leader.named = true; leader.name = label;
  var g = { id: 1, leaderUid: leader.uid, name: label, troops: troops, position: 'hauptstadt', movement: 3 };
  s.armyGroups = [g];
  var parts = [], count = 0;
  Object.keys(troops).forEach(function (id) { count += troops[id]; parts.push(troops[id] + '× ' + GD.creature(id).name); });
  console.log(pad(label, 24) + pad(parts.join(', '), 35) + ' Kommando ' + padL(SYS.armyCommandUsed(g), 4) + '/' + padL(SYS.armyCommandCapacity(s, g), 4) + '  Kraft ' + padL(SYS.armyGroupPower(s, g), 6));
}
armyExample('Goldzahn (Hobgoblin)', 'hobgoblin', 10, 1, 3, { goblin: 100 });
armyExample('Oger-Mischlegion', 'oger', 40, 3, 3, { goblin: 20, schleim: 100, ork: 50 });

console.log('\n=== ECHO-ZYKLEN: prozedurale Kraft, Beute & Affixe (Basis 700) ===');
console.log(pad('Zyklus', 9) + padL('min Kraft', 11) + padL('Ø Kraft', 10) + padL('Boss', 10) + padL('Ø Beute', 11) + padL('Affixe', 9));
var previousEchoAverage = 0;
[1, 3, 5, 10].forEach(function (cycle) {
  var nodes = SYS.generateEchoMap(424242, cycle, 700), powers = nodes.map(function (n) { return n.power; });
  var boss = nodes.filter(function (n) { return n.boss; })[0], rewardTotal = 0, affixTotal = 0;
  nodes.forEach(function (node) {
    for (var resource in node.reward.resources) rewardTotal += node.reward.resources[resource];
    for (var material in node.reward.forgeMaterials) rewardTotal += node.reward.forgeMaterials[material] * 100;
    affixTotal += node.affixIds.length;
  });
  var average = Math.round(powers.reduce(function (a, b) { return a + b; }, 0) / powers.length);
  var flag = previousEchoAverage && average <= previousEchoAverage ? ' ⚠ nicht steigend' : '';
  console.log(pad(String(cycle), 9) + padL(Math.min.apply(null, powers), 11) + padL(average, 10) + padL(boss.power, 10) + padL(Math.round(rewardTotal / nodes.length), 11) + padL((affixTotal / nodes.length).toFixed(1), 9) + flag);
  previousEchoAverage = average;
});

console.log('');
