/* dev/adventure-canvas.test.js — Phase-34-Kartenrenderer und Assets. */
import { test, expect } from 'bun:test';
import { PNG } from 'pngjs';
import '../js/data-tables.js';
import '../js/data.js';
import '../js/art-data.js';
import '../js/state.js';
import '../js/systems.js';
import '../js/systems-bestiary.js';
import '../js/systems-combat.js';
import '../js/systems-contracts.js';
import '../js/render/canvas-core.js';
import '../js/render/effects.js';
import '../js/render/adventure-scene.js';

const Art = globalThis.GameArtData;
const State = globalThis.GameState;
const Systems = globalThis.GameSystems;
const Scene = globalThis.GameAdventureScene;

test('alle 18 Kartenorte besitzen eindeutige Atlaszellen', () => {
  const cells = globalThis.GameData.strategicNodes.map(function (node) {
    const object = Art.mapObjectFor(node.id);
    expect(object).toBeTruthy();
    return object.col + ',' + object.row;
  });
  expect(cells.length).toBe(18);
  expect(new Set(cells).size).toBe(18);
});

test('Karten-View-Modell enthält Orte, Wege, Status und Armeen ohne Zustandsreferenzen', () => {
  const state = State.createDefault();
  const view = Systems.adventureRenderState(state);
  expect(view.nodes.length).toBe(18);
  expect(view.routes.length).toBeGreaterThan(17);
  expect(view.armies.length).toBe(1);
  expect(view.nodes.find(function (node) { return node.id === 'hauptstadt'; }).status).toBe('secured');
  expect(view.nodes.find(function (node) { return node.id === 'wald'; }).status).toBe('reachable');
  expect(view.nodes.find(function (node) { return node.id === 'site_manaquelle'; }).status).toBe('locked');
  view.nodes[0].x = 99; view.armies[0].x = 99;
  expect(globalThis.GameData.strategicNodes[0].x).toBe(7);
  expect(state.armyGroups[0].position).toBe('hauptstadt');
});

test('Karten-Hit-Test trifft alle Ortsmittelpunkte und keine leere Ecke', () => {
  const view = Systems.adventureRenderState(State.createDefault()), width = 1200, height = 680;
  view.nodes.forEach(function (node) {
    expect(Scene.hitTest(view, width, height, node.x / 100 * width, node.y / 100 * height)).toBe(node.id);
  });
  expect(Scene.hitTest(view, width, height, width * 0.5, 4)).toBeNull();
});

test('Armeerichtungen sind formstabil und decken vier Blickrichtungen ab', () => {
  expect(Scene.direction({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe('east');
  expect(Scene.direction({ x: 1, y: 0 }, { x: 0, y: 0 })).toBe('west');
  expect(Scene.direction({ x: 0, y: 1 }, { x: 0, y: 0 })).toBe('north');
  expect(Scene.direction({ x: 0, y: 0 }, { x: 0, y: 1 })).toBe('south');
  expect(Art.armyFor(true, 'west').row).toBe(0);
  expect(Art.armyFor(false, 'west').row).toBe(1);
});

test('Orts- und Armeeatlanten besitzen transparente Ränder und plausible Abdeckung', async () => {
  for (const asset of ['adventure-locations.png', 'adventure-armies.png']) {
    const buffer = Buffer.from(await Bun.file(import.meta.dir + '/../assets/world/' + asset).arrayBuffer());
    const png = PNG.sync.read(buffer), corners = [3, (png.width - 1) * 4 + 3, ((png.height - 1) * png.width) * 4 + 3, (png.width * png.height - 1) * 4 + 3];
    corners.forEach(function (index) { expect(png.data[index]).toBe(0); });
    let visible = 0; for (let i = 3; i < png.data.length; i += 4) if (png.data[i] > 0) visible++;
    const coverage = visible / (png.width * png.height);
    expect(coverage).toBeGreaterThan(0.18); expect(coverage).toBeLessThan(0.55);
  }
});
