/* ============================================================
   ui-action-combat.js — Oberfläche für den Echtzeit-Action-Kampf
   (Phase 45, Schritt 4). Übersichts-Einstieg + Vollbild-Modal mit
   Canvas-Bühne (GameActionScene), Touch-Steuertasten und Ergebnis.
   Verändert den Zustand nur über GameActionCombat.
   ============================================================ */
(function () {
  'use strict';
  var UI = window.GameUI, H = window.GameUIInternal, SYS = window.GameSystems, GD = window.GameData;
  if (!UI || !H || !SYS) throw new Error('ui-action-combat.js muss nach ui.js geladen werden');
  var A = function () { return window.GameActionCombat; };
  var el = H.el, btn = H.btn, fmt = H.fmt;
  var openModal = H.openModal, closeModal = H.closeModal, toast = H.toast, costText = H.costText;

  function combatRegion(state) {
    var unlocked = GD.regions.filter(function (r) { return SYS.regionUnlocked(state, r.id); });
    return unlocked.length ? unlocked[unlocked.length - 1] : GD.regions[0];
  }
  function combatParty(state) {
    var avail = SYS.armyAvailable ? SYS.armyAvailable(state) : state.creatures.filter(function (c) { return !SYS.creatureBusy(state, c.uid) && !SYS.isWounded(state, c); });
    return avail.slice(0, 5).map(function (c) { return c.uid; });
  }
  function combatTitle(state, view) {
    var challenge = state.actionBattle && state.actionBattle.bossChallenge;
    var boss = challenge && window.GameBosses ? window.GameBosses.boss(challenge.bossId) : null;
    return boss ? (boss.name + (challenge.hard ? ' · Meisterschaft' : '')) : (GD.region(view.regionId) ? GD.region(view.regionId).name : '');
  }

  Object.assign(UI, {
    buildActionCombatCard: function () {
      if (!SYS.tabUnlocked(this.state, 'karte')) return null;
      var self = this, active = !!this.state.actionBattle, region = combatRegion(this.state);
      return el('div', { class: 'card action-combat-card' + (active ? ' active' : '') }, [
        el('div', { class: 'card-head' }, [
          el('div', { class: 'card-emoji', text: '⚔️' }),
          el('div', { class: 'card-title' }, [
            el('div', { class: 'name' }, ['Echtzeit-Gefecht', el('span', { class: 'pill', text: active ? '● läuft' : 'NEU' })]),
            el('div', { class: 'meta', text: active ? 'Ein Gefecht läuft — kehre zurück ins Getümmel.' : ('Schnelles Action-Gefecht gegen ' + region.name + '. Bewegen, ausweichen, Fähigkeiten — in Echtzeit.') })
          ])
        ]),
        el('div', { class: 'card-actions' }, [
          btn(active ? '⚔️ Gefecht fortsetzen' : '⚔️ Gefecht starten', function () {
            if (!self.state.actionBattle) {
              var party = combatParty(self.state);
              if (!party.length) { toast('Keine einsatzbereiten Kreaturen.', 'bad'); return; }
              var r = A().start(self.state, region.id, party, true);
              if (!r.ok) { toast(r.reason, 'bad'); return; }
              self.persist(self.state);
            }
            self.openActionCombat();
          }, { cls: 'btn-action' })
        ])
      ]);
    },

    openActionCombat: function () {
      var self = this, s = this.state;
      if (!s.actionBattle) return;
      var view = A().renderView(s);
      if (!view) return;
      if (view.status !== 'active') { this.openActionResult(); return; }

      var canvas = el('canvas', { class: 'ac-stage', style: 'width:100%;height:46vh;max-height:440px;display:block;border-radius:10px;background:#0b0f16' });
      var controlsRow = el('div', { class: 'ac-controls' });
      var body = el('div', { class: 'ac-battle' }, [
        el('div', { class: 'ac-stage-wrap' }, [canvas]),
        controlsRow,
        el('div', { class: 'ac-hint muted', text: 'Ziehen/​WASD: bewegen · ⟳/Leertaste: ausweichen · 1–3: Fähigkeiten · Angriff automatisch.' }),
        el('div', { class: 'tb-foot' }, [
          btn('🏳️ Rückzug', function () { self._teardownActionScene(); A().abort(s); self.persist(s); closeModal(); self.refresh(); }, { small: true, cls: 'btn-ghost' }),
          el('span', { class: 'muted', text: 'Weiche den roten Zonen aus, bevor sie zuschlagen.' })
        ])
      ]);

      openModal('Echtzeit-Gefecht · ' + combatTitle(s, view), body, '⚔️', 'ac-modal');

      // Steuertasten: Ausweichen + Fähigkeiten-Slots (Cooldown-Status zeigt die Canvas-Bühne).
      var scene = window.GameActionScene.mount(canvas, {
        getState: function () { return self.state; },
        onEnd: function () { self._teardownActionScene(); self.persist(self.state); self.openActionResult(); }
      });
      this._actionScene = scene;
      if (!scene) { toast('Canvas nicht verfügbar.', 'bad'); return; }

      controlsRow.appendChild(btn('⟳ Ausweichen', function () { scene.queueDodge(); }, { cls: 'ac-btn ac-dodge' }));
      view.hero.cooldowns.forEach(function (c, i) {
        controlsRow.appendChild(btn(c.icon + ' ' + c.name, function () { scene.queueSkill(i); }, { cls: 'ac-btn ac-skill' }));
      });
    },

    _teardownActionScene: function () {
      if (this._actionScene) { try { this._actionScene.destroy(); } catch (e) {} this._actionScene = null; }
    },

    openActionResult: function () {
      var self = this, s = this.state;
      var view = A().renderView(s), won = view && view.status === 'won';
      var result = A().applyResult(s);
      this.persist(s);
      var bossResult = result && result.bossResult;
      var body = el('div', { class: 'tb-result ' + (won ? 'won' : 'lost') }, [
        el('div', { class: 'tb-result-icon', text: won ? '🏆' : '💀' }),
        el('h4', { text: bossResult ? (won ? bossResult.boss.name + ' bezwungen!' : bossResult.boss.name + ' widersteht') : (won ? 'Gefecht gewonnen!' : 'Gefecht verloren') }),
        (won && result && result.reward) ? el('p', { text: 'Beute: ' + costText(result.reward) + (result.xp ? '  +' + result.xp + ' EP' : '') }) : el('p', { text: 'Du ziehst dich aus dem Getümmel zurück.' }),
        bossResult && bossResult.reward ? el('p', { text: 'Bossbeute: ' + costText(bossResult.reward) + (bossResult.recipe ? ' · Bauplan ' + bossResult.recipe.name : '') }) : null,
        bossResult && !won ? el('p', { class: 'notice bad', text: 'Lernhinweis: ' + bossResult.hint }) : null,
        el('div', { class: 'card-actions' }, [btn('Zur Übersicht', function () { closeModal(); self.refresh(); }, { cls: 'btn-action' })])
      ]);
      openModal(won ? 'Sieg' : 'Niederlage', body, won ? '🏆' : '💀', 'ac-modal result');
    }
  });
})();
