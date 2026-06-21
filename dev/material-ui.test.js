/* Phase 36: statische Abnahme der materialisierten Reichs- und Management-UI. */
import { test, expect } from "bun:test";

const root = import.meta.dir + '/..';
const css = await Bun.file(root + '/style.css').text();
const ui = await Bun.file(root + '/js/ui.js').text();

function luminance(hex) {
  const rgb = hex.match(/[a-f\d]{2}/gi).map(function (part) { return parseInt(part, 16) / 255; });
  const linear = rgb.map(function (channel) {
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(foreground, background) {
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test('Panorama belegt die Desktopbreite und besitzt vier interaktive Gebäudeflächen', () => {
  expect(css).toMatch(/\.kingdom-scene\s*\{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*none;[\s\S]*?aspect-ratio:\s*3\s*\/\s*2;/);
  ['reich', 'magie', 'schmiede', 'karte'].forEach(function (id) {
    expect(ui).toContain("sceneLink('" + id + "'");
  });
  expect(ui).toContain("class: 'scene-ambience'");
  ['scene-water', 'scene-smoke-forge', 'scene-banner-gate', 'scene-magic-tower'].forEach(function (cls) {
    expect(ui).toContain(cls);
    expect(css).toContain('.' + cls);
  });
});

test('Reichsverwaltung nutzt ein zusammenhängendes Materialbrett statt Einzelkarten', () => {
  expect(ui).toContain("class: 'district-ledger'");
  expect(ui).toContain("class: 'district-card district-' ");
  expect(ui).toContain('BUILDING_ICONS');
  expect(css).toContain('.district-ledger');
  expect(css).toContain('.district-card::before');
  expect(css).toContain('.realm-summary');
});

test('Symbolfamilie deckt Ressourcen, Navigation, Orte, Aktionen und Status ab', () => {
  ['magic', 'gold', 'food', 'material', 'seelen', 'knowledge', 'realm', 'creatures', 'forge', 'map',
    'crown', 'combat', 'territory', 'build', 'time', 'watch', 'overview', 'defense', 'temple', 'arena'].forEach(function (id) {
    expect(css).toContain('.ui-icon-' + id);
  });
  expect(ui).toContain("uiIcon(r.id === 'nahrung'");
  expect(ui).toContain("uiIcon(t.icon, t.label, 'tab-ico')");
  expect(ui).toContain("uiIcon('combat', 'Kampfkraft')");
});

test('Mobile Ziele, Tastaturfokus, Kontrast und Bewegungsreduktion erfüllen die UI-Grenzen', () => {
  expect(css).toContain('--tap: 44px');
  expect(css).toMatch(/\.btn-small\s*\{\s*min-height:\s*var\(--tap\)/);
  expect(css).toMatch(/\.modal-close\s*\{[\s\S]*?width:\s*var\(--tap\);\s*height:\s*var\(--tap\)/);
  expect(css).toMatch(/\.info-btn\s*\{[\s\S]*?min-width:\s*var\(--tap\)/);
  expect(css).toContain(':focus-visible');
  expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  expect(css).toContain('@media (prefers-contrast: more)');
  expect(contrast('#e9e6f7', '#14131d')).toBeGreaterThanOrEqual(4.5);
  expect(contrast('#edf4f8', '#111a29')).toBeGreaterThanOrEqual(4.5);
});
