/* Service Worker — App-Shell-Cache für echtes Offline (Phase 32).
   Cache-first für die Shell; alle übrigen gleichartigen GETs (Assets)
   werden zur Laufzeit beim ersten Laden gecached. */
var CACHE = 'tempest-shell-v17';
var SHELL = [
  './', './index.html', './style.css', './manifest.webmanifest', './icon.svg', './assets/ui-icons.svg',
  './js/data-tables.js', './js/data.js', './js/art-data.js', './js/state.js',
  './js/systems.js', './js/systems-bestiary.js', './js/systems-combat.js', './js/systems-skirmish.js', './js/systems-siege.js', './js/systems-battle.js', './js/systems-action.js', './js/systems-contracts.js', './js/systems-specializations.js', './js/systems-bosses.js', './js/achievements.js', './js/completion-planner.js',
  './js/render/canvas-core.js', './js/render/effects.js', './js/render/battle-scene.js', './js/render/adventure-scene.js', './js/render/action-scene.js',
  './js/ui.js', './js/ui-adventure.js', './js/ui-progress.js', './js/ui-contracts.js', './js/ui-specializations.js', './js/ui-bosses.js', './js/ui-action.js', './js/ui-siege.js', './js/ui-battle.js', './js/ui-action-combat.js', './js/main.js',
  './assets/battle/jura-clearing.png', './assets/battle/jura-units.png',
  './assets/battle/biomes.png', './assets/battle/board-units.png', './assets/battle/effects.png',
  './assets/tempest-adventure-map.png', './assets/world/adventure-locations.png', './assets/world/adventure-armies.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (res) {
        if (res && res.ok && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return cached; });
    })
  );
});
