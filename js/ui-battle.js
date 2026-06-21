/* ============================================================
   ui-battle.js — Oberfläche für das neue Tactical-RPG (Phase 44).
   Übersichts-Einstieg + interaktives Schlacht-Modal (Gitter,
   Zugreihenfolge, Bewegen/Fähigkeiten/Zielauswahl, Auto-Gegnerzüge).
   Nutzt GameBattle (Engine) – verändert den Zustand nur über deren API.
   ============================================================ */
(function () {
  'use strict';
  var UI = window.GameUI, H = window.GameUIInternal, SYS = window.GameSystems, GD = window.GameData;
  if (!UI || !H || !SYS) throw new Error('ui-battle.js muss nach ui.js und systems-battle.js geladen werden');
  var B = function () { return window.GameBattle; };
  var el = H.el, btn = H.btn, bar = H.bar, fmt = H.fmt;
  var openModal = H.openModal, closeModal = H.closeModal, toast = H.toast, costText = H.costText;

  function battleRegion(state) {
    var unlocked = GD.regions.filter(function (r) { return SYS.regionUnlocked(state, r.id); });
    if (!unlocked.length) return GD.regions[0];
    // höchste freigeschaltete Region als Herausforderung
    return unlocked[unlocked.length - 1];
  }
  function battleParty(state) {
    var avail = (SYS.armyAvailable ? SYS.armyAvailable(state) : state.creatures.filter(function (c) { return !SYS.creatureBusy(state, c.uid) && !SYS.isWounded(state, c); }));
    return avail.slice(0, 5).map(function (c) { return c.uid; });
  }

  UI = window.GameUI;
  Object.assign(UI, {
    buildTacticalCard: function () {
      if (!SYS.tabUnlocked(this.state, 'karte')) return null;   // erst ab freigeschalteter Karte
      var self = this, active = !!this.state.tacticalBattle;
      var region = battleRegion(this.state);
      return el('div', { class: 'card tactical-card' + (active ? ' active' : '') }, [
        el('div', { class: 'card-head' }, [
          el('div', { class: 'card-emoji', text: '♟️' }),
          el('div', { class: 'card-title' }, [
            el('div', { class: 'name' }, ['Taktische Schlacht', el('span', { class: 'pill', text: active ? '● läuft' : 'NEU' })]),
            el('div', { class: 'meta', text: active ? 'Eine Schlacht wartet auf deine Befehle.' : ('Rundenbasierter Gittergefecht gegen ' + region.name + '. Stelle, ziehe und kontere taktisch.') })
          ])
        ]),
        el('div', { class: 'card-actions' }, [
          btn(active ? '♟️ Schlacht fortsetzen' : '♟️ Schlacht beginnen', function () {
            if (!self.state.tacticalBattle) {
              var party = battleParty(self.state);
              if (!party.length) { toast('Keine einsatzbereiten Kreaturen.', 'bad'); return; }
              var r = B().startBattle(self.state, region.id, party, true);
              if (!r.ok) { toast(r.reason, 'bad'); return; }
              self.persist(self.state);
            }
            self.openTacticalBattle();
          }, { cls: 'btn-action' })
        ])
      ]);
    },

    // Gegner ziehen automatisch, bis der Spieler wieder am Zug ist oder die Schlacht endet.
    _runEnemyTurns: function () {
      var s = this.state, guard = 0;
      while (s.tacticalBattle && B().renderView(s).status === 'active' && !B().isPlayerTurn(s) && guard++ < 200) {
        B().enemyTurn(s);
      }
      this.persist(s);
    },

    openTacticalBattle: function () {
      var self = this, s = this.state;
      if (!s.tacticalBattle) return;
      this._runEnemyTurns();
      var view = B().renderView(s);
      if (!view) return;
      if (view.status !== 'active') { this.openTacticalResult(); return; }

      var mode = this._battleMode || null;   // {type:'move'} oder {type:'ability', abId}
      var active = view.active;
      var reach = (mode && mode.type === 'move') ? B().reachableCells(s) : {};
      var targets = (mode && mode.type === 'ability') ? B().abilityTargets(s, mode.abId) : [];
      var targetKeys = {}; targets.forEach(function (t) { targetKeys[t.x + ',' + t.y] = true; });
      var unitByCell = {}; view.party.concat(view.enemies).forEach(function (u) { if (!u.dead) unitByCell[u.pos.x + ',' + u.pos.y] = u; });

      var body = el('div', { class: 'tb-battle' });

      // Zugreihenfolge
      body.appendChild(el('div', { class: 'tb-order' }, view.order.slice(0, 8).map(function (o) {
        return el('span', { class: 'tb-order-chip ' + o.side + (o.key === view.activeKey ? ' now' : '') }, [el('span', { text: o.icon }), el('small', { text: o.name.slice(0, 8) })]);
      })));

      // Gitter
      var grid = el('div', { class: 'tb-grid', style: 'grid-template-columns:repeat(' + view.w + ',1fr)' });
      for (var y = 0; y < view.h; y++) {
        for (var x = 0; x < view.w; x++) {
          (function (cx, cy) {
            var t = B().terrain(view.grid[cy][cx]);
            var key = cx + ',' + cy, u = unitByCell[key];
            var cls = 'tb-cell terrain-' + t.key;
            if (reach[key] != null) cls += ' reachable';
            if (targetKeys[key]) cls += ' targetable';
            if (u && u.key === view.activeKey) cls += ' active';
            var children = [];
            if (!u) children.push(el('span', { class: 'tb-terrain', text: t.icon === '·' ? '' : t.icon }));
            if (u) {
              children.push(el('span', { class: 'tb-token ' + u.side + (u.dead ? ' dead' : '') }, [
                el('span', { class: 'tb-ico', text: u.icon }),
                el('span', { class: 'tb-face face-' + u.facing }),
                el('span', { class: 'tb-hp' }, el('i', { style: 'width:' + Math.round(100 * u.hp / u.maxHp) + '%' }))
              ]));
            }
            grid.appendChild(el('button', {
              type: 'button', class: cls, 'aria-label': 'Feld ' + cx + ',' + cy,
              onclick: function () { self._battleCellClick(cx, cy); }
            }, children));
          })(x, y);
        }
      }
      body.appendChild(grid);

      // Aktive Einheit + Aktionen
      if (active && active.side === 'party') {
        body.appendChild(el('div', { class: 'tb-active' }, [
          el('span', { class: 'tb-active-ico', text: active.icon }),
          el('div', { style: 'flex:1;min-width:0' }, [
            el('b', { text: active.name }),
            el('div', { class: 'tb-active-stats', text: '❤ ' + Math.ceil(active.hp) + '/' + active.maxHp + '  ✦ ' + active.mp + '/' + active.maxMp + (active.statuses.length ? '  ' + active.statuses.map(function (id) { return statusIcon(id); }).join('') : '') })
          ])
        ]));
        var actions = el('div', { class: 'tb-actions' });
        actions.appendChild(btn('🦶 Bewegen', function () { self._battleMode = active.moved ? null : { type: 'move' }; if (active.moved) toast('Bereits bewegt.', 'bad'); self.openTacticalBattle(); }, { small: true, cls: (mode && mode.type === 'move') ? 'btn-gold' : '' }));
        (active.abilities || []).forEach(function (abId) {
          var ab = B().ability(abId);
          actions.appendChild(btn(ab.icon + ' ' + ab.name + (ab.mp ? ' (' + ab.mp + ')' : ''), function () {
            if (ab.target === 'self') { var r = B().useAbility(s, abId, active.pos.x, active.pos.y); self._afterPlayerAction(r); return; }
            self._battleMode = { type: 'ability', abId: abId }; self.openTacticalBattle();
          }, { small: true, cls: (mode && mode.type === 'ability' && mode.abId === abId) ? 'btn-gold' : '', disabled: active.mp < ab.mp }));
        });
        actions.appendChild(btn('🛡️ Verteidigen', function () { self._afterPlayerAction(B().defend(s)); }, { small: true }));
        actions.appendChild(btn('⏳ Warten', function () { self._afterPlayerAction(B().waitTurn(s)); }, { small: true }));
        body.appendChild(actions);
        if (mode) body.appendChild(el('div', { class: 'tb-hint muted', text: mode.type === 'move' ? 'Wähle ein hervorgehobenes Feld zum Bewegen.' : 'Wähle ein Ziel für ' + B().ability(mode.abId).name + '.' }));
      }

      var log = el('div', { class: 'tb-log' });
      view.log.forEach(function (line) { log.appendChild(el('div', { text: line })); });
      body.appendChild(log);
      body.appendChild(el('div', { class: 'tb-foot' }, [
        btn('🏳️ Rückzug', function () { B().abortBattle(s); self._battleMode = null; self.persist(s); closeModal(); self.refresh(); }, { small: true, cls: 'btn-ghost' }),
        el('span', { class: 'muted', text: 'Flankieren & Höhe erhöhen den Schaden.' })
      ]));
      openModal('Taktische Schlacht · ' + (GD.region(view.regionId) ? GD.region(view.regionId).name : ''), body, '♟️', 'tb-modal');
    },

    _battleCellClick: function (x, y) {
      var s = this.state, mode = this._battleMode;
      if (!mode || !B().isPlayerTurn(s)) return;
      if (mode.type === 'move') {
        var r = B().moveUnit(s, x, y);
        if (!r.ok) { toast(r.reason, 'bad'); return; }
        this._battleMode = null; this.persist(s); this.openTacticalBattle();   // nach Bewegen noch eine Aktion möglich
      } else if (mode.type === 'ability') {
        var r2 = B().useAbility(s, mode.abId, x, y);
        if (!r2.ok) { toast(r2.reason, 'bad'); return; }
        this._afterPlayerAction(r2);
      }
    },
    _afterPlayerAction: function (r) {
      if (r && !r.ok) { toast(r.reason, 'bad'); return; }
      this._battleMode = null;
      this.updateTopbar();
      this.openTacticalBattle();   // rendert neu, läuft Gegnerzüge, zeigt ggf. Ergebnis
    },

    openTacticalResult: function () {
      var self = this, s = this.state;
      var view = B().renderView(s), won = view && view.status === 'won';
      var result = B().applyResult(s);
      this._battleMode = null; this.persist(s);
      var body = el('div', { class: 'tb-result ' + (won ? 'won' : 'lost') }, [
        el('div', { class: 'tb-result-icon', text: won ? '🏆' : '💀' }),
        el('h4', { text: won ? 'Schlacht gewonnen!' : 'Schlacht verloren' }),
        (won && result && result.reward) ? el('p', { text: 'Beute: ' + costText(result.reward) + (result.xp ? '  +' + result.xp + ' EP' : '') }) : el('p', { text: 'Deine Truppen ziehen sich zurück.' }),
        el('div', { class: 'card-actions' }, [btn('Zur Übersicht', function () { closeModal(); self.refresh(); }, { cls: 'btn-action' })])
      ]);
      openModal(won ? 'Sieg' : 'Niederlage', body, won ? '🏆' : '💀', 'tb-modal result');
    }
  });

  function statusIcon(id) { return { brand: '🔥', frost: '❄️', schock: '⚡', wall: '🛡️' }[id] || '●'; }
})();
