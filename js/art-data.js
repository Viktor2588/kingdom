/* ============================================================
   art-data.js — Reine Darstellungsmetadaten für Canvas-Szenen.
   Keine Spiellogik; klassisches Script für file:// und Tests.
   ============================================================ */
(function () {
  'use strict';
  var root = (typeof window !== 'undefined') ? window : globalThis;

  var lineOrder = [
    'slime', 'goblin', 'wolf', 'ogre', 'lizard',
    'orc', 'undead', 'demon', 'vampire', 'golem',
    'insect', 'dragon', 'spirit', 'griffin', 'treant',
    'phoenix', 'kobold', 'rabbitfolk', 'tengu', 'merfolk'
  ];
  var lineAliases = {
    'schleim': 'slime', 'slime': 'slime',
    'goblin': 'goblin',
    'wolf': 'wolf', 'direwolf': 'wolf',
    'oger': 'ogre', 'ogre': 'ogre',
    'echse': 'lizard', 'lizard': 'lizard',
    'ork': 'orc', 'orc': 'orc',
    'untot': 'undead', 'skelett': 'undead', 'undead': 'undead',
    'dämon': 'demon', 'daemon': 'demon', 'demon': 'demon',
    'vampir': 'vampire', 'vampire': 'vampire',
    'golem': 'golem',
    'insekt': 'insect', 'insect': 'insect',
    'drache': 'dragon', 'dragon': 'dragon',
    'geist': 'spirit', 'spirit': 'spirit',
    'greif': 'griffin', 'griffin': 'griffin',
    'baumhirte': 'treant', 'treant': 'treant',
    'phönix': 'phoenix', 'phoenix': 'phoenix',
    'kobold': 'kobold',
    'hasenmensch': 'rabbitfolk', 'rabbitfolk': 'rabbitfolk',
    'tengu': 'tengu',
    'meervolk': 'merfolk', 'merfolk': 'merfolk'
  };

  var unitTuning = {
    slime: { scale: 0.76, anchorY: 0.80 }, wolf: { scale: 1.02, anchorY: 0.86 },
    ogre: { scale: 1.08, anchorY: 0.92 }, lizard: { scale: 1.02, anchorY: 0.91 },
    orc: { scale: 1.04, anchorY: 0.91 }, dragon: { scale: 1.04, anchorY: 0.90 },
    spirit: { scale: 0.92, anchorY: 0.89 }, griffin: { scale: 1.03, anchorY: 0.89 },
    treant: { scale: 1.06, anchorY: 0.92 }, phoenix: { scale: 1.02, anchorY: 0.90 },
    insect: { scale: 1.00, anchorY: 0.91 }, merfolk: { scale: 1.02, anchorY: 0.92 }
  };
  var units = {};
  lineOrder.forEach(function (key, index) {
    var tune = unitTuning[key] || {};
    units[key] = { col: index % 5, row: Math.floor(index / 5), scale: tune.scale || 1, anchorY: tune.anchorY || 0.91 };
  });

  var biomes = {
    jura: { col: 0, row: 0, tint: '#7fb458', particle: '#d8ef8b' },
    cave: { col: 1, row: 0, tint: '#56d9ef', particle: '#72eaff' },
    swamp: { col: 2, row: 0, tint: '#9fca45', particle: '#b9ee61' },
    ruins: { col: 0, row: 1, tint: '#e16035', particle: '#ff8b42' },
    mountain: { col: 1, row: 1, tint: '#cde7ff', particle: '#e5f5ff' },
    shadow: { col: 2, row: 1, tint: '#a16cf1', particle: '#d097ff' },
    sky: { col: 2, row: 1, tint: '#f3e6a5', particle: '#fff4bd' }
  };
  var regionBiomes = {
    wald: 'jura', hoehlen: 'cave', sumpf: 'swamp', ruinen: 'ruins', grenze: 'ruins',
    gebirge: 'mountain', schattenreich: 'shadow', himmelsfeste: 'sky', goetterthron: 'sky',
    hauptstadt: 'jura', site_manaquelle: 'jura', site_jagdlager: 'jura', site_mine: 'cave',
    site_handel: 'swamp', site_archiv: 'ruins', site_drachennest: 'mountain',
    site_seelenbrunnen: 'shadow', site_schatzhort: 'shadow'
  };
  var effects = {
    slash: { col: 0, row: 0 }, block: { col: 1, row: 0 }, fire: { col: 2, row: 0 }, frost: { col: 3, row: 0 },
    lightning: { col: 0, row: 1 }, heal: { col: 1, row: 1 }, soul: { col: 2, row: 1 }, death: { col: 3, row: 1 }
  };

  var locationOrder = [
    'hauptstadt', 'wald', 'site_manaquelle', 'site_jagdlager', 'hoehlen', 'site_mine',
    'sumpf', 'site_handel', 'ruinen', 'site_archiv', 'grenze', 'gebirge',
    'site_drachennest', 'schattenreich', 'site_seelenbrunnen', 'site_schatzhort', 'himmelsfeste', 'goetterthron'
  ];
  var mapObjects = {};
  locationOrder.forEach(function (id, index) {
    mapObjects[id] = { col: index % 6, row: Math.floor(index / 6), scale: id === 'hauptstadt' ? 1.15 : (id.indexOf('site_') === 0 ? 0.88 : 1) };
  });

  function normalizeLine(line) { return String(line || '').toLowerCase().replace(/[^a-zäöüß]/g, ''); }
  function copyEntry(source, key) {
    if (!source) return null;
    var out = { key: key }; for (var prop in source) out[prop] = source[prop]; return out;
  }
  function unitFor(line) {
    var key = lineAliases[normalizeLine(line)] || null;
    return copyEntry(key && units[key], key);
  }
  function biomeFor(regionId) {
    var key = regionBiomes[regionId] || (biomes[regionId] ? regionId : 'jura');
    return copyEntry(biomes[key], key);
  }
  function effectFor(id) { return copyEntry(effects[id], id); }
  function mapObjectFor(nodeId) { return copyEntry(mapObjects[nodeId], nodeId); }
  function armyFor(rulerLed, direction) {
    var directions = { east: 0, south: 1, west: 2, north: 3 };
    return { col: directions[direction] == null ? 0 : directions[direction], row: rulerLed ? 0 : 1 };
  }

  root.GameArtData = {
    assets: {
      battleJura: 'assets/battle/jura-clearing.png',
      battleJuraUnits: 'assets/battle/jura-units.png',
      battleBiomes: 'assets/battle/biomes.png',
      battleUnits: 'assets/battle/board-units.png',
      battleEffects: 'assets/battle/effects.png',
      adventureMap: 'assets/tempest-adventure-map.png',
      adventureLocations: 'assets/world/adventure-locations.png',
      adventureArmies: 'assets/world/adventure-armies.png'
    },
    battleAtlas: { columns: 5, rows: 4, units: units },
    battleBiomeAtlas: { columns: 3, rows: 2, biomes: biomes },
    battleEffectAtlas: { columns: 4, rows: 2, effects: effects },
    adventureLocationAtlas: { columns: 6, rows: 3, objects: mapObjects },
    adventureArmyAtlas: { columns: 4, rows: 2 },
    battleLines: lineOrder.slice(),
    unitFor: unitFor,
    biomeFor: biomeFor,
    effectFor: effectFor,
    mapObjectFor: mapObjectFor,
    armyFor: armyFor
  };
})();
