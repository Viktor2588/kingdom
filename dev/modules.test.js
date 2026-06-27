/* dev/modules.test.js — Architektur-Regressionschecks für Phase 27. */
import { test, expect } from "bun:test";

const root = import.meta.dir + '/..';
const expectedOrder = [
  'js/data-tables.js', 'js/data.js', 'js/art-data.js', 'js/state.js',
  'js/systems.js', 'js/systems-bestiary.js', 'js/systems-combat.js', 'js/systems-skirmish.js', 'js/systems-siege.js', 'js/systems-battle.js', 'js/systems-action.js', 'js/systems-contracts.js', 'js/systems-specializations.js', 'js/systems-bosses.js', 'js/achievements.js', 'js/completion-planner.js',
  'js/render/canvas-core.js', 'js/render/effects.js', 'js/render/battle-scene.js', 'js/render/adventure-scene.js', 'js/render/action-scene.js',
  'js/ui.js', 'js/ui-adventure.js', 'js/ui-progress.js', 'js/ui-contracts.js', 'js/ui-specializations.js', 'js/ui-bosses.js', 'js/ui-action.js', 'js/ui-siege.js', 'js/ui-battle.js', 'js/ui-action-combat.js', 'js/main.js'
];

function scriptSources(html) {
  return Array.from(html.matchAll(/<script\s+src="([^"]+)"/g), function (match) { return match[1]; });
}

function lines(text) { return text.split(/\r?\n/).length; }

test('klassische Scripts werden in fester Abhängigkeitsreihenfolge geladen und offline gecacht', async () => {
  const html = await Bun.file(root + '/index.html').text();
  const worker = await Bun.file(root + '/sw.js').text();
  expect(scriptSources(html)).toEqual(expectedOrder);
  expectedOrder.forEach(function (path) {
    expect(worker).toContain("'./" + path + "'");
  });
});

test('Systemmodule bleiben DOM-frei und Kernmonolithen unter den vereinbarten Grenzen', async () => {
  const systems = await Bun.file(root + '/js/systems.js').text();
  const bestiary = await Bun.file(root + '/js/systems-bestiary.js').text();
  const contracts = await Bun.file(root + '/js/systems-contracts.js').text();
  const specializations = await Bun.file(root + '/js/systems-specializations.js').text();
  const bosses = await Bun.file(root + '/js/systems-bosses.js').text();
  const combat = await Bun.file(root + '/js/systems-combat.js').text();
  const skirmish = await Bun.file(root + '/js/systems-skirmish.js').text();
  const completion = await Bun.file(root + '/js/completion-planner.js').text();
  const ui = await Bun.file(root + '/js/ui.js').text();
  const adventure = await Bun.file(root + '/js/ui-adventure.js').text();
  const canvasCore = await Bun.file(root + '/js/render/canvas-core.js').text();
  const battleScene = await Bun.file(root + '/js/render/battle-scene.js').text();
  const adventureScene = await Bun.file(root + '/js/render/adventure-scene.js').text();

  [systems, bestiary, contracts, specializations, bosses, combat, skirmish, completion].forEach(function (source) {
    expect(source).not.toMatch(/\bdocument\s*[.[]/);
    expect(source).not.toContain('innerHTML');
  });
  expect(lines(systems)).toBeLessThan(2800);
  expect(lines(bestiary)).toBeLessThan(360);
  expect(lines(contracts)).toBeLessThan(620);
  expect(lines(specializations)).toBeLessThan(620);
  expect(lines(bosses)).toBeLessThan(620);
  expect(lines(ui)).toBeLessThan(1900);
  expect(lines(combat)).toBeGreaterThan(350);
  expect(lines(skirmish)).toBeGreaterThan(200);
  expect(lines(adventure)).toBeGreaterThan(600);
  expect(canvasCore).not.toContain('GameSystems.');
  expect(battleScene).toContain('GameBattleScene');
  expect(battleScene).not.toContain('battleAction(');
  expect(adventureScene).toContain('GameAdventureScene');
  expect(adventureScene).not.toContain('moveArmyGroup(');
  expect(systems).toContain('root.GameSystemsInternal');
  expect(ui).toContain('window.GameUIInternal');
});

test('Canvas-Assets sind lokal und innerhalb des Phase-33-Budgets', async () => {
  const background = Bun.file(root + '/assets/battle/jura-clearing.png');
  const units = Bun.file(root + '/assets/battle/jura-units.png');
  expect(background.size).toBeGreaterThan(500000);
  expect(units.size).toBeGreaterThan(500000);
  expect(background.size + units.size).toBeLessThan(25 * 1024 * 1024);
  const worker = await Bun.file(root + '/sw.js').text();
  expect(worker).toContain("'./assets/battle/jura-clearing.png'");
  expect(worker).toContain("'./assets/battle/jura-units.png'");
  ['biomes.png', 'board-units.png', 'effects.png'].forEach(function (name) {
    expect(worker).toContain("'./assets/battle/" + name + "'");
  });
});

test('Abenteuerkarten-Assets sind lokal gecacht und im Gesamtbudget', async () => {
  const locations = Bun.file(root + '/assets/world/adventure-locations.png');
  const armies = Bun.file(root + '/assets/world/adventure-armies.png');
  expect(locations.size).toBeGreaterThan(500000);
  expect(armies.size).toBeGreaterThan(500000);
  expect(locations.size + armies.size).toBeLessThan(15 * 1024 * 1024);
  const worker = await Bun.file(root + '/sw.js').text();
  expect(worker).toContain("'./assets/world/adventure-locations.png'");
  expect(worker).toContain("'./assets/world/adventure-armies.png'");
});

test('Materialisierte UI-Symbole sind lokal, kompakt und offline verfügbar', async () => {
  const icons = Bun.file(root + '/assets/ui-icons.svg');
  const source = await icons.text();
  const worker = await Bun.file(root + '/sw.js').text();
  expect(icons.size).toBeLessThan(20 * 1024);
  expect(source).toContain('viewBox="0 0 144 96"');
  expect(source.match(/transform="translate\(/g)?.length).toBe(24);
  expect(worker).toContain("'./assets/ui-icons.svg'");
  expect(worker).toMatch(/tempest-shell-v\d+/);
});
