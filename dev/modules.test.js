/* dev/modules.test.js — Architektur-Regressionschecks für Phase 27. */
import { test, expect } from "bun:test";

const root = import.meta.dir + '/..';
const expectedOrder = [
  'js/data-tables.js', 'js/data.js', 'js/art-data.js', 'js/state.js',
  'js/systems.js', 'js/systems-combat.js',
  'js/render/canvas-core.js', 'js/render/effects.js', 'js/render/battle-scene.js',
  'js/ui.js', 'js/ui-adventure.js', 'js/main.js'
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
  const combat = await Bun.file(root + '/js/systems-combat.js').text();
  const ui = await Bun.file(root + '/js/ui.js').text();
  const adventure = await Bun.file(root + '/js/ui-adventure.js').text();
  const canvasCore = await Bun.file(root + '/js/render/canvas-core.js').text();
  const battleScene = await Bun.file(root + '/js/render/battle-scene.js').text();

  [systems, combat].forEach(function (source) {
    expect(source).not.toMatch(/\bdocument\s*[.[]/);
    expect(source).not.toContain('innerHTML');
  });
  expect(lines(systems)).toBeLessThan(2800);
  expect(lines(ui)).toBeLessThan(1900);
  expect(lines(combat)).toBeGreaterThan(350);
  expect(lines(adventure)).toBeGreaterThan(600);
  expect(canvasCore).not.toContain('GameSystems.');
  expect(battleScene).toContain('GameBattleScene');
  expect(battleScene).not.toContain('battleAction(');
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
});
