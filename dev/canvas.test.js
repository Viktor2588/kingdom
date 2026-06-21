/* dev/canvas.test.js — Phase-33-Renderervertrag und Asset-Checks. */
import { test, expect } from 'bun:test';
import { PNG } from 'pngjs';
import '../js/data-tables.js';
import '../js/data.js';
import '../js/art-data.js';
import '../js/state.js';
import '../js/systems.js';
import '../js/systems-combat.js';
import '../js/render/canvas-core.js';
import '../js/render/effects.js';
import '../js/render/battle-scene.js';

const Art = globalThis.GameArtData;
const State = globalThis.GameState;
const Systems = globalThis.GameSystems;
const Scene = globalThis.GameBattleScene;

test('alle 20 Kreaturenlinien besitzen eindeutige Board-Atlaszellen', () => {
  const lines = Array.from(new Set(globalThis.GameData.creatures.map(function (species) { return species.line; })));
  expect(lines.length).toBe(20);
  const cells = lines.map(function (line) {
    const unit = Art.unitFor(line);
    expect(unit).toBeTruthy();
    return unit.col + ',' + unit.row;
  });
  expect(new Set(cells).size).toBe(20);
  expect(Art.unitFor('Phönix')).toBeTruthy();
  expect(Art.unitFor('Meervolk')).toBeTruthy();
});

test('Regionen werden auf sechs Atlas-Biome plus Schatten-/Himmelstönung verteilt', () => {
  const expected = {
    wald: 'jura', hoehlen: 'cave', sumpf: 'swamp', ruinen: 'ruins', grenze: 'ruins',
    gebirge: 'mountain', schattenreich: 'shadow', himmelsfeste: 'sky', goetterthron: 'sky'
  };
  Object.keys(expected).forEach(function (id) { expect(Art.biomeFor(id).key).toBe(expected[id]); });
  const atlasCells = ['jura', 'cave', 'swamp', 'ruins', 'mountain', 'shadow'].map(function (id) {
    const biome = Art.biomeFor(id); return biome.col + ',' + biome.row;
  });
  expect(new Set(atlasCells).size).toBe(6);
});

test('vollständiger Effektatlas besitzt acht eindeutige Effekte', () => {
  const ids = ['slash', 'block', 'fire', 'frost', 'lightning', 'heal', 'soul', 'death'];
  const cells = ids.map(function (id) { const fx = Art.effectFor(id); expect(fx).toBeTruthy(); return fx.col + ',' + fx.row; });
  expect(new Set(cells).size).toBe(8);
});

test('Kampf-View-Modell ist vollständig und vom Zustand entkoppelt', () => {
  const state = State.createDefault();
  const goblin = state.creatures.filter(function (c) { return c.speciesId === 'goblin'; })[0];
  const started = Systems.startCombat(state, 'wald', [goblin.uid], true, 'normal');
  expect(started.ok).toBe(true);
  const view = Systems.battleRenderState(state);
  expect(view.width).toBe(7); expect(view.height).toBe(5);
  expect(view.actors.length).toBeGreaterThanOrEqual(3);
  expect(view.actors.some(function (actor) { return actor.line === 'Schleim'; })).toBe(true);
  expect(view.actors.some(function (actor) { return actor.line === 'Goblin'; })).toBe(true);
  expect(view.reachable.length).toBeGreaterThan(0);
  const originalHp = state.activeCombat.party[0].hp;
  view.actors[0].hp = 0; view.actors[0].pos.x = 6;
  expect(state.activeCombat.party[0].hp).toBe(originalHp);
  expect(state.activeCombat.party[0].pos.x).not.toBe(6);
});

test('isometrischer Hit-Test bildet alle 35 Zellzentren exakt zurück', () => {
  const geometry = Scene.geometry(960, 540, 7, 5);
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 7; x++) {
      const point = Scene.cellPoint(geometry, x, y);
      expect(Scene.hitTest(geometry, point.x, point.y)).toEqual({ x: x, y: y });
    }
  }
  expect(Scene.hitTest(geometry, 2, 2)).toBeNull();
});

test('Effektstufen und Save-Normalisierung bleiben deterministisch', () => {
  const off = globalThis.GameCanvasEffects.createTimeline([{ type: 'attack' }], 'off');
  const reduced = globalThis.GameCanvasEffects.createTimeline([{ type: 'attack' }], 'reduced');
  const full = globalThis.GameCanvasEffects.createTimeline([{ type: 'attack' }], 'full');
  expect(off.active()).toBe(false);
  expect(reduced.duration).toBeLessThan(full.duration);
  const state = State.createDefault(); state.settings.effects = 'kaputt';
  expect(State.normalize(state).settings.effects).toBe('full');
});

test('20-Linien-Einheitenatlas besitzt echte transparente Ränder und plausible Abdeckung', async () => {
  const path = import.meta.dir + '/../assets/battle/board-units.png';
  const png = PNG.sync.read(Buffer.from(await Bun.file(path).arrayBuffer()));
  const cornerIndexes = [3, (png.width - 1) * 4 + 3, ((png.height - 1) * png.width) * 4 + 3, (png.width * png.height - 1) * 4 + 3];
  cornerIndexes.forEach(function (index) { expect(png.data[index]).toBe(0); });
  let visible = 0;
  for (let i = 3; i < png.data.length; i += 4) if (png.data[i] > 0) visible++;
  const coverage = visible / (png.width * png.height);
  expect(coverage).toBeGreaterThan(0.22);
  expect(coverage).toBeLessThan(0.48);
});

test('Biome und Effekte bleiben innerhalb des Laufzeit-Assetbudgets', async () => {
  const names = ['biomes.png', 'board-units.png', 'effects.png'];
  let total = 0;
  for (const name of names) {
    const file = Bun.file(import.meta.dir + '/../assets/battle/' + name); total += file.size;
    expect(file.size).toBeLessThan(3 * 1024 * 1024);
    const png = PNG.sync.read(Buffer.from(await file.arrayBuffer()));
    expect(png.width).toBeGreaterThanOrEqual(1500); expect(png.width).toBeLessThanOrEqual(2048);
    expect(png.height).toBeGreaterThanOrEqual(850); expect(png.height).toBeLessThanOrEqual(1024);
  }
  expect(total).toBeLessThan(25 * 1024 * 1024);
});
