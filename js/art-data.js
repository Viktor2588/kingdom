/* ============================================================
   art-data.js — Reine Darstellungsmetadaten für Canvas-Szenen.
   Keine Spiellogik; klassisches Script für file:// und Tests.
   ============================================================ */
(function () {
  'use strict';
  var root = (typeof window !== 'undefined') ? window : globalThis;

  var lineAliases = {
    'schleim': 'slime', 'slime': 'slime',
    'goblin': 'goblin',
    'wolf': 'wolf', 'direwolf': 'wolf',
    'oger': 'ogre', 'ogre': 'ogre',
    'untot': 'undead', 'skelett': 'undead', 'undead': 'undead',
    'drache': 'dragon', 'dragon': 'dragon'
  };

  var units = {
    slime:  { col: 0, row: 0, scale: 0.78, anchorY: 0.84 },
    goblin: { col: 1, row: 0, scale: 1.00, anchorY: 0.91 },
    wolf:   { col: 2, row: 0, scale: 1.03, anchorY: 0.87 },
    ogre:   { col: 0, row: 1, scale: 1.08, anchorY: 0.94 },
    undead: { col: 1, row: 1, scale: 1.00, anchorY: 0.94 },
    dragon: { col: 2, row: 1, scale: 1.05, anchorY: 0.92 }
  };

  function normalizeLine(line) {
    return String(line || '').toLowerCase().replace(/[^a-zäöüß]/g, '');
  }

  function unitFor(line) {
    var key = lineAliases[normalizeLine(line)] || null;
    if (!key || !units[key]) return null;
    var source = units[key], out = { key: key };
    for (var prop in source) out[prop] = source[prop];
    return out;
  }

  root.GameArtData = {
    assets: {
      battleJura: 'assets/battle/jura-clearing.png',
      battleJuraUnits: 'assets/battle/jura-units.png'
    },
    battleAtlas: { columns: 3, rows: 2, units: units },
    battleLines: Object.keys(units),
    unitFor: unitFor
  };
})();
