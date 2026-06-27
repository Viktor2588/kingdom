/* ============================================================
   ui-bosses.js — Boss-Leiter, Meisterschaft und Trophäenraum
   (Phase 51). Erweitert GameUI über gemeinsame DOM-Helfer.
   ============================================================ */
(function () {
  'use strict';
  var UI = window.GameUI, H = window.GameUIInternal, SYS = window.GameSystems;
  if (!UI || !H || !SYS) throw new Error('ui-bosses.js muss nach ui.js geladen werden');
  var el = H.el, btn = H.btn, bar = H.bar, costText = H.costText, toast = H.toast;
  function BOSSES() { return window.GameBosses; }

  function party(state) {
    var creatures = (state.creatures || []).filter(function (creature) {
      return !SYS.creatureBusy(state, creature.uid) && !SYS.isWounded(state, creature);
    });
    return creatures.slice(0, 6).map(function (creature) { return creature.uid; });
  }
  function bossStatus(state, entry) {
    var api = BOSSES(), normal = api.defeated(state, entry.id, false), hard = api.defeated(state, entry.id, true);
    if (!api.unlocked(state, entry)) return { label: 'Gesperrt', cls: '', hard: false };
    if (!normal) return { label: 'Herausforderung', cls: 'ready', hard: false };
    if (!hard) return { label: 'Meisterschaft', cls: 'mastery', hard: true };
    return { label: 'Gemeistert', cls: 'done', hard: true };
  }
  function resultToast(result) {
    if (!result || !result.ok) { toast(result && result.reason || 'Bosskampf konnte nicht beginnen.', 'bad'); return; }
    if (!result.result) return;
    toast(result.won
      ? (result.result.boss.icon + ' ' + result.result.boss.name + ' bezwungen.')
      : ('Hinweis: ' + result.result.hint), result.won ? 'gold' : 'bad');
  }

  Object.assign(UI, {
    buildSceneTrophies: function () {
      var trophies = BOSSES().earnedTrophies(this.state);
      if (!trophies.length) return null;
      var featured = [];
      ['Meilenstein', 'Boss', 'Banner', 'Bestiarium', 'Aufträge', 'Exemplar'].forEach(function (kind) {
        var match = trophies.filter(function (entry) { return entry.kind === kind; }).slice(-1)[0];
        if (match && featured.length < 5) featured.push(match);
      });
      return el('div', { class: 'scene-trophies', 'aria-label': trophies.length + ' Trophäen im Reich' }, [
        el('span', { class: 'scene-trophy-count', text: '🏆 ' + trophies.length }),
        el('span', { class: 'scene-trophy-icons', text: featured.map(function (entry) { return entry.icon; }).join(' ') })
      ]);
    },

    buildBossBoard: function () {
      var self = this, state = this.state, api = BOSSES();
      api.ensure(state);
      var section = el('section', { class: 'boss-board', 'aria-label': 'Boss-Leiter' });
      section.appendChild(el('div', { class: 'boss-board-head' }, [
        el('div', null, [
          el('div', { class: 'section-label', text: 'Boss-Leiter' }),
          el('div', { class: 'boss-board-title', text: 'Einzigartige Gegner & Beute' })
        ]),
        el('span', { class: 'pill', text: api.ensure(state).defeated.length + ' / ' + api.BOSSES.length })
      ]));
      var grid = el('div', { class: 'boss-grid' });
      api.BOSSES.forEach(function (entry) {
        var unlocked = api.unlocked(state, entry), status = bossStatus(state, entry);
        var hard = status.hard, required = api.challengePower(entry, hard);
        var rewardRecipe = window.GameData.recipe(entry.recipeId);
        var actions = [];
        if (unlocked) {
          actions.push(btn('♟️ Taktik', function () {
            var uids = party(state);
            if (!uids.length) { toast('Keine einsatzbereite Gruppe.', 'bad'); return; }
            var started = api.startTactical(state, entry.id, uids, true, hard);
            if (!started.ok) { toast(started.reason, 'bad'); return; }
            self.persist(state); self.openTacticalBattle();
          }, { small: true }));
          actions.push(btn('⚔️ Action', function () {
            var uids = party(state);
            if (!uids.length) { toast('Keine einsatzbereite Gruppe.', 'bad'); return; }
            var started = api.startAction(state, entry.id, uids, true, hard);
            if (!started.ok) { toast(started.reason, 'bad'); return; }
            self.persist(state); self.openActionCombat();
          }, { small: true }));
          actions.push(btn('▶ Auto', function () {
            var uids = party(state);
            if (!uids.length) { toast('Keine einsatzbereite Gruppe.', 'bad'); return; }
            resultToast(api.resolveAuto(state, entry.id, uids, true, hard));
            self.commit();
          }, { small: true, cls: 'btn-gold' }));
        }
        grid.appendChild(el('article', { class: 'boss-entry ' + status.cls + (!unlocked ? ' locked' : '') }, [
          el('div', { class: 'boss-entry-head' }, [
            el('span', { class: 'boss-icon', text: unlocked ? entry.icon : '🔒' }),
            el('div', { class: 'boss-copy' }, [
              el('div', { class: 'name' }, [unlocked ? entry.name : 'Unbekannter Gegner', el('span', { class: 'pill', text: status.label })]),
              el('div', { class: 'meta', text: unlocked ? entry.title + ' · ' + entry.source : entry.unlockHint })
            ])
          ]),
          unlocked ? el('div', { class: 'boss-power' }, [
            bar(Math.min(1, api.partyPower(state, party(state), true) / Math.max(1, required)), status.cls === 'done' ? 'good' : 'gold'),
            el('span', { text: 'Kraft ' + required })
          ]) : null,
          unlocked ? el('div', { class: 'boss-mechanic', text: hard ? ('Meisterschaft: ' + entry.mastery) : entry.mechanic }) : null,
          unlocked ? el('div', { class: 'boss-reward', text: hard
            ? ('Meisterbelohnung: 🏅 Banner + ' + (api.COMPONENTS[entry.componentId] ? api.COMPONENTS[entry.componentId].icon + ' Komponente' : 'Komponente'))
            : ('Belohnung: ' + (rewardRecipe ? rewardRecipe.icon + ' ' + rewardRecipe.name : costText(entry.reward))) }) : null,
          actions.length ? el('div', { class: 'boss-actions' }, actions) : null
        ]));
      });
      section.appendChild(grid);
      return section;
    },

    buildTrophyRoom: function () {
      var state = this.state, api = BOSSES(), trophies = api.earnedTrophies(state), bosses = api.ensure(state);
      var room = el('section', { class: 'trophy-room', 'aria-label': 'Trophäenraum' });
      room.appendChild(el('div', { class: 'trophy-room-head' }, [
        el('div', null, [
          el('div', { class: 'section-label', text: 'Trophäenraum' }),
          el('div', { class: 'trophy-room-title', text: trophies.length ? trophies.length + ' Zeichen deiner Chronik' : 'Noch keine Trophäen' })
        ]),
        bosses.banners ? el('span', { class: 'pill tag-ok', text: '🏅 ' + bosses.banners + ' Meisterbanner' }) : null
      ]));
      if (!trophies.length) {
        room.appendChild(el('div', { class: 'empty-hint', text: 'Boss-Siege, Elite-Exemplare und große Meilensteine füllen diesen Raum.' }));
      } else {
        room.appendChild(el('div', { class: 'trophy-grid' }, trophies.map(function (entry) {
          return el('div', { class: 'trophy-plaque' }, [
            el('span', { class: 'trophy-icon', text: entry.icon }),
            el('div', null, [el('div', { class: 'name', text: entry.name }), el('div', { class: 'meta', text: entry.kind })])
          ]);
        })));
      }
      var componentIds = Object.keys(bosses.components || {});
      if (componentIds.length) {
        room.appendChild(el('div', { class: 'trophy-components' }, componentIds.map(function (id) {
          var def = api.COMPONENTS[id];
          return el('span', { class: 'pill', text: (def ? def.icon + ' ' + def.name : '🦴 ' + id.replace(/^elite_/, 'Elite: ')) + ' ×' + bosses.components[id] });
        })));
      }
      return room;
    }
  });
})();
